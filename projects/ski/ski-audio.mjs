import {createPinkNoise} from './wind-noise.mjs?v=0.1.64';

const clamp01 = value => Math.max(0, Math.min(1, value));
const LOOPS = ['gentle-glide-01', 'fast-glide-01', 'carving-03'];
const EVENTS = ['braking', 'launch', 'landing', 'pole-push'];

export class SkiAudio {
  volume = 0.35;
  windVolume = 0.5;
  buffers = new Map();
  loops = [];
  shots = new Set();
  nextVariation = Object.fromEntries(EVENTS.map(category => [category, 0]));
  brakeHeld = false;
  duckUntil = 0;

  setVolume(volume) {
    if (volume === this.volume) return;
    this.volume = volume;
    if (this.master) this.master.gain.setTargetAtTime(volume, this.context.currentTime, 0.025);
  }

  setWindVolume(volume) {
    if (volume === this.windVolume) return;
    this.windVolume = volume;
    if (this.wind) this.wind.volume.gain.setTargetAtTime(volume, this.context.currentTime, 0.025);
  }

  createWind() {
    const {context} = this;
    const source = context.createBufferSource();
    source.buffer = createPinkNoise(context);
    source.loop = true;
    const highpass = context.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.value = 70;
    highpass.Q.value = 0;
    const lowpass = context.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 400;
    lowpass.Q.value = 0;
    const motion = context.createGain();
    motion.gain.value = 0;
    const volume = context.createGain();
    volume.gain.value = this.windVolume;
    source.connect(highpass).connect(lowpass).connect(motion).connect(volume).connect(context.destination);
    source.start();
    this.wind = {lowpass, motion, volume, intensity: 0};
  }

  updateWind(speed) {
    if (this.context?.state !== 'running') return;
    const intensity = clamp01((speed - 1.5) / 22.5);
    if (!this.wind) {
      if (intensity === 0) return;
      this.createWind();
    }
    const wind = this.wind;
    if (intensity === wind.intensity || (intensity !== 0 && Math.abs(intensity - wind.intensity) < 0.002)) return;
    wind.intensity = intensity;
    const now = this.context.currentTime;
    wind.motion.gain.setTargetAtTime(0.55 * intensity ** 1.4, now, 0.09);
    wind.lowpass.frequency.setTargetAtTime(400 * 6 ** intensity, now, 0.12);
  }

  unlock() {
    try {
      if (!this.context) {
        this.context = new AudioContext();
        this.master = this.context.createGain();
        this.master.gain.value = this.volume;
        this.master.connect(this.context.destination);
        this.load().catch(error => console.warn('Could not load ski audio', error));
      }
      if (this.context.state !== 'running') {
        this.context.resume().catch(() => {});
      }
    } catch (error) {
      console.warn('Could not initialize ski audio', error);
    }
  }

  async load() {
    const manifestUrl = new URL('./audio/manifest.json?v=0.1.67', import.meta.url);
    const response = await fetch(manifestUrl);
    if (!response.ok) throw new Error(`Audio manifest HTTP ${response.status}`);
    const {samples} = await response.json();
    await Promise.all(samples.filter(sample =>
      LOOPS.includes(sample.id) || EVENTS.includes(sample.category)
    ).map(async sample => {
      try {
        const url = new URL(sample.filename, manifestUrl);
        if (sample.category === 'pole-push') url.search = manifestUrl.search;
        const audio = await fetch(url);
        if (!audio.ok) throw new Error(`Audio HTTP ${audio.status}`);
        const buffer = await this.context.decodeAudioData(await audio.arrayBuffer());
        this.buffers.set(sample.id, buffer);
      } catch (error) {
        console.warn(`Could not load ski sample ${sample.id}`, error);
      }
    }));
  }

  voice(id, loop, level) {
    const buffer = this.buffers.get(id);
    if (!buffer || this.context.state !== 'running') return null;
    const source = this.context.createBufferSource();
    const gain = this.context.createGain();
    source.buffer = buffer;
    source.loop = loop;
    gain.gain.value = level;
    source.connect(gain).connect(this.master);
    const voice = {source, gain, level, rate: 1};
    source.onended = () => {
      source.disconnect();
      gain.disconnect();
      this.shots.delete(voice);
    };
    source.start();
    return voice;
  }

  event(category, strength) {
    const index = this.nextVariation[category];
    const voice = this.voice(`${category}-0${index + 1}`, false, strength);
    if (!voice) {
      if (category === 'pole-push') this.pendingPole = {strength, expires: performance.now() + 250};
      return;
    }
    if (category === 'pole-push') this.pendingPole = null;
    this.nextVariation[category] = (index + 1) % 3;
    this.shots.add(voice);
    if (category === 'braking') this.duckUntil = this.context.currentTime + 0.32;
  }

  brake(ski, pressure) {
    if (pressure <= 0.2) this.brakeHeld = false;
    if (this.brakeHeld || pressure < 0.35 || !ski.active || ski.airborne) return;
    const speed = Math.hypot(ski.vx, ski.vz);
    if (speed < 2) return;
    this.brakeHeld = true;
    this.event('braking', 0.3 + 0.65 * clamp01(speed / 16) * pressure);
  }

  update(ski, steering = 0, walkingSpeed = 0) {
    if (this.pendingPole) {
      if (performance.now() > this.pendingPole.expires) this.pendingPole = null;
      else if (this.context?.state === 'running' &&
        this.buffers.has(`pole-push-0${this.nextVariation['pole-push'] + 1}`)) {
        this.event('pole-push', this.pendingPole.strength);
      }
    }
    const speed = ski.active ? Math.hypot(ski.vx, ski.vz) : walkingSpeed;
    this.updateWind(speed);
    if (!ski.active) {
      this.stopLoops();
      return;
    }
    if (this.context?.state !== 'running') return;
    const now = this.context.currentTime;
    const speedMix = clamp01((speed - 5) / 9);
    const contact = ski.airborne ? 0 : clamp01((speed - 0.18) / 4);
    const heading = ski.rigYaw + ski.angle;
    const slip = Math.abs(ski.vx * Math.cos(heading) - ski.vz * Math.sin(heading));
    const steerEdge = clamp01((Math.abs(steering) - 0.2) / 0.65);
    const slipEdge = clamp01((slip - 0.35) / 3);
    const carving = contact * Math.max(steerEdge, slipEdge);
    const brakeDuck = now < this.duckUntil ? 0.55 : 1;
    const glide = contact * Math.min(brakeDuck, 1 - 0.3 * carving);
    this.updateLoop(0, glide * Math.sqrt(1 - speedMix), 0.88 + 0.19 * speedMix, now);
    this.updateLoop(1, glide * Math.sqrt(speedMix), 0.92 + 0.16 * clamp01((speed - 5) / 20), now);
    this.updateLoop(2, 1.2 * carving, 0.95 + 0.12 * speedMix, now);
  }

  updateLoop(index, level, rate, now) {
    let voice = this.loops[index];
    if (!voice && level > 0) {
      voice = this.voice(LOOPS[index], true, 0);
      this.loops[index] = voice;
    }
    if (!voice) return;
    if (level !== voice.level && (level === 0 || Math.abs(level - voice.level) >= 0.005)) {
      voice.level = level;
      voice.gain.gain.setTargetAtTime(level, now, 0.045);
    }
    if (Math.abs(rate - voice.rate) >= 0.005) {
      voice.rate = rate;
      voice.source.playbackRate.setTargetAtTime(rate, now, 0.09);
    }
  }

  fadeOut(voice) {
    const now = this.context.currentTime;
    voice.gain.gain.cancelAndHoldAtTime(now);
    voice.gain.gain.linearRampToValueAtTime(0, now + 0.05);
    voice.source.stop(now + 0.05);
  }

  stopLoops() {
    this.loops.forEach(voice => {
      if (voice) this.fadeOut(voice);
    });
    this.loops.length = 0;
  }

  reset() {
    this.pendingPole = null;
    if (this.wind?.intensity) {
      this.wind.intensity = 0;
      this.wind.motion.gain.setTargetAtTime(0, this.context.currentTime, 0.025);
    }
    this.stopLoops();
    this.shots.forEach(voice => this.fadeOut(voice));
    this.shots.clear();
    this.brakeHeld = false;
    this.duckUntil = 0;
  }
}
