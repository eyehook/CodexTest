import {sample, phrase, events} from './score.mjs';

export class Loom {
  constructor(seed) {
    this.seed = seed;
    this.unit = 15 / (78 + Math.floor(sample(seed, 1) * 18));
    this.ctx = new AudioContext();
    const c = this.ctx;
    this.bus = c.createGain();
    this.bus.gain.value = .56;
    const limiter = c.createDynamicsCompressor();
    this.meter = c.createAnalyser();
    this.meter.fftSize = 512;
    this.samples = new Float32Array(this.meter.fftSize);
    this.bus.connect(limiter).connect(this.meter).connect(c.destination);
    this.cues = Array.from({length: 16}, () => ({time: -Infinity, kind: '', note: 0, level: 0, length: 0}));
    this.cueIndex = 0;
    this.response = {pulse: 0, melody: 0, pitch: .5, volume: 0};
    this.lastRead = c.currentTime;
    this.echo = c.createDelay(2);
    this.echo.delayTime.value = this.unit * 3;
    const feedback = c.createGain();
    feedback.gain.value = .31;
    this.echo.connect(feedback).connect(this.echo);
    feedback.connect(this.bus);
    this.noise = c.createBuffer(1, c.sampleRate, c.sampleRate);
    const data = this.noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = sample(seed, i, 42) * 2 - 1;
    this.start = c.currentTime + .10;
    this.next = 0;
    this.clock = setInterval(() => this.schedule(), 30);
  }
  schedule() {
    const now = this.ctx.currentTime;
    this.next = Math.max(this.next, Math.ceil((now - this.start) / this.unit));
    while (this.start + this.next * this.unit < now + .16) {
      const step = this.next++, section = Math.floor(step / 128);
      if (this.section !== section) {
        this.section = section;
        this.plan = phrase(this.seed, section);
      }
      const time = this.start + step * this.unit;
      events(this.seed, this.plan, step, (kind, note, level, length) => {
        this.voice(kind, note, level, length, time);
        if (kind === 'kick' || kind === 'bell') {
          const cue = this.cues[this.cueIndex];
          this.cueIndex = (this.cueIndex + 1) % this.cues.length;
          Object.assign(cue, {time, kind, note, level, length});
        }
      });
    }
  }
  voice(kind, note, level, length, t) {
    const c = this.ctx, env = c.createGain(), nodes = [env];
    const drum = kind === 'hat' || kind === 'brush';
    const pad = kind === 'pad', bell = kind === 'bell';
    const duration = drum ? (kind === 'hat' ? .075 : .18) :
      length * this.unit + (pad ? .85 : bell ? .65 : 0);
    const attack = kind === 'reed' ? .09 : pad ? .7 : kind === 'bass' ? .018 : .005;
    env.gain.setValueAtTime(.0001, t);
    env.gain.exponentialRampToValueAtTime(level, t + attack);
    if (bell) env.gain.exponentialRampToValueAtTime(level * .30, t + length * this.unit * .85);
    if (pad) env.gain.setValueAtTime(level * .8, t + length * this.unit - .3);
    env.gain.exponentialRampToValueAtTime(.0001, t + duration);
    const pan = c.createStereoPanner();
    pan.pan.value = pad || bell ? .66 * Math.sin(note * 2.1) : drum ? .24 : 0;
    env.connect(pan).connect(this.bus);
    nodes.push(pan);
    if (bell || pad || kind === 'reed') pan.connect(this.echo);
    let source;
    if (drum) {
      source = c.createBufferSource();
      source.buffer = this.noise;
      const filter = c.createBiquadFilter();
      filter.type = kind === 'hat' ? 'highpass' : 'bandpass';
      filter.frequency.value = kind === 'hat' ? 7200 : 2100;
      source.connect(filter).connect(env);
      nodes.push(filter);
    } else {
      source = c.createOscillator();
      source.type = pad || kind === 'bass' ? 'triangle' : 'sine';
      const hz = 440 * 2 ** ((note - 69) / 12);
      source.frequency.setValueAtTime(kind === 'kick' ? 128 : hz, t);
      if (kind === 'kick') source.frequency.exponentialRampToValueAtTime(43, t + .09);
      if (bell || kind === 'reed') {
        const mod = c.createOscillator(), depth = c.createGain();
        mod.frequency.value = hz * (bell ? 2.006 : 1);
        depth.gain.setValueAtTime(hz * (bell ? 1.4 : .75), t);
        depth.gain.exponentialRampToValueAtTime(bell ? 1 : hz * .28, t + .26);
        mod.connect(depth).connect(source.frequency);
        mod.start(t); mod.stop(t + duration);
        nodes.push(mod, depth);
      }
      source.connect(env);
    }
    source.onended = () => { source.disconnect(); for (const n of nodes) n.disconnect(); };
    source.start(t); source.stop(t + duration);
  }
  readResponse() {
    const now = this.ctx.currentTime, signal = this.response;
    let kick, bell;
    for (const cue of this.cues) {
      if (cue.time > now) continue;
      if (cue.kind === 'kick' && (!kick || cue.time > kick.time)) kick = cue;
      if (cue.kind === 'bell' && (!bell || cue.time > bell.time)) bell = cue;
    }
    signal.pulse = kick ? kick.level * 1.6 * Math.exp(-(now-kick.time)/.19) : 0;
    const dt = Math.max(0, now - this.lastRead);
    if (bell) {
      signal.pitch += (Math.min(1, Math.max(0,(bell.note-56)/24)) - signal.pitch) * (1-Math.exp(-dt/.10));
      signal.melody = bell.level * 3 * Math.exp(-(now-bell.time)/(.22+bell.length*this.unit*.3));
    }
    this.meter.getFloatTimeDomainData(this.samples);
    let sum = 0;
    for (const value of this.samples) sum += value*value;
    const rms = Math.min(1, 7*Math.sqrt(sum/this.samples.length));
    signal.volume += (rms-signal.volume)*(1-Math.exp(-dt/.14));
    this.lastRead = now;
    return signal;
  }
  beat() { return Math.max(0, (this.ctx.currentTime - this.start) / (4 * this.unit)); }
  dispose() { clearInterval(this.clock); return this.ctx.close(); }
}
