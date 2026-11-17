import {sample, phrase, events, sequence, leadChoices} from './score.mjs?v=poploop1';

import {voicePalette} from './voices.mjs?v=songs1';

export class Loom {
  constructor(seed) {
    this.seed = seed;
    this.palette = voicePalette(seed);
    this.unit = 15 / sequence(seed).bpm;
    this.active = new Set();
    this.leads = new Set();
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
    if(this.leads)for(const lead of this.leads)if(lead.time<=now)this.leads.delete(lead);
    this.next = Math.max(this.next, Math.ceil((now - this.start) / this.unit));
    while (this.start + this.next * this.unit < now + .16) {
      const step = this.next++, section = Math.floor(step / 128);
      if (this.section !== section) {
        this.section = section;
        this.plan = phrase(this.seed, section);
        if(this.song!==this.plan.song) {
          this.song=this.plan.song;
          this.palette=voicePalette(this.plan.songSeed);
        }
      }
      const time = this.start + step * this.unit;
      events(this.seed, this.plan, step, (kind, note, level, length) => {
        const original=note;
        if(kind==='bell' && Number.isInteger(this.leadChoice) && this.leadChoice>=0 && this.leadChoice<5)
          note=leadChoices(this.plan,step)[this.leadChoice];
        const silent=kind==='bell' && this.conducting && this.leadChoice===null;
        const active=silent?null:this.voice(kind, note, level, length, time);
        const lead=kind==='bell'?{time,original,choices:leadChoices(this.plan,step),level,length,palette:this.palette,active}:null;
        if(lead)this.leads?.add(lead);
        if (kind === 'kick' || kind === 'bell') {
          const cue = this.cues[this.cueIndex];
          this.cueIndex = (this.cueIndex + 1) % this.cues.length;
          Object.assign(cue, {time:silent?-Infinity:time, kind, note, level, length});
          if(lead){lead.cue=cue;cue.lead=lead;}
        }
      });
    }
  }
  setLeadChoice(choice,conducting=false) {
    this.conducting=conducting;
    this.leadChoice=Number.isInteger(choice) && choice>=0 && choice<5?choice:null;
    const now=this.ctx.currentTime;
    for(const lead of this.leads) {
      if(lead.time<=now){this.leads.delete(lead);continue;}
      const note=this.conducting && this.leadChoice===null?null:
        this.leadChoice===null?lead.original:lead.choices[this.leadChoice];
      if(note===(lead.active?.note ?? null))continue;
      // Replace only voices whose onset is still in the future. Sounding notes
      // and their envelopes are never touched by pointer or mode changes.
      for(const node of lead.active?[lead.active.source,...lead.active.nodes]:[]) {
        if(node.stop)node.stop(now);
        node.disconnect();
      }
      this.active.delete(lead.active);
      const palette=this.palette;this.palette=lead.palette;
      lead.active=note===null?null:this.voice('bell',note,lead.level,lead.length,lead.time);
      this.palette=palette;
      if(lead.cue && (lead.cue.lead===lead || lead.cue.time===lead.time)){
        lead.cue.time=note===null?-Infinity:lead.time;
        if(note!==null)lead.cue.note=note;
      }
    }
  }
  nextSong() {
    const now=this.ctx.currentTime;
    const periods=sequence(this.seed).periods;
    const song=Math.max(Math.floor(this.beat()/(periods*32)),this.skippedTo ?? 0)+1;
    this.skippedTo=song;
    for(const voice of this.active) {
      voice.env.gain.cancelScheduledValues(now);
      voice.env.gain.setTargetAtTime(.0001,now,.015);
      for(const node of [voice.source,...voice.nodes]) if(node.stop) node.stop(now+.07);
    }
    this.next=song*periods*128;
    this.start=now+.10-this.next*this.unit;
    this.section=undefined;
    this.leads?.clear();
    for(const cue of this.cues) cue.time=-Infinity;
    this.schedule();
  }
  voice(kind, note, level, length, t) {
    const c = this.ctx, env = c.createGain(), nodes = [env];
    const drum = kind === 'hat' || kind === 'brush';
    const pad = kind === 'pad', bell = kind === 'bell';
    const patch = this.palette[kind];
    const held = length * this.unit;
    const duration = drum ? (kind === 'hat' ? .075 : .18) :
      held + (patch?.release ?? 0);
    const attack = Math.min(patch?.attack ?? .005, duration*.35);
    // Layer gains below are normalized before this instrument envelope.
    env.gain.setValueAtTime(.0001, t);
    env.gain.exponentialRampToValueAtTime(level, t + attack);
    if (bell) env.gain.exponentialRampToValueAtTime(level * .30, t + Math.max(attack+.001,held*.85));
    if (pad) env.gain.setValueAtTime(level * .8, t + Math.max(attack,held));
    env.gain.exponentialRampToValueAtTime(.0001, t + duration);
    const pan = c.createStereoPanner();
    pan.pan.value = pad || bell ? .66 * Math.sin(note * 2.1) : drum ? .24 : 0;
    env.connect(pan).connect(this.bus);
    nodes.push(pan);
    if (bell || pad || kind === 'reed') {
      const send=c.createGain();
      send.gain.value=this.palette.echo;
      pan.connect(send).connect(this.echo);
      nodes.push(send);
    }
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
      const hz = 440 * 2 ** ((note - 69) / 12);
      source.type = patch?.wave ?? 'sine';
      source.frequency.setValueAtTime(kind === 'kick' ? 128 : hz, t);
      if (kind === 'kick') {
        source.frequency.exponentialRampToValueAtTime(43, t + .09);
        source.connect(env);
      } else {
        const filter=c.createBiquadFilter();
        filter.type='lowpass';
        filter.Q.value=patch.q ?? .5;
        const base=Math.min(c.sampleRate*.42,patch.cutoff);
        filter.frequency.setValueAtTime(base,t);
        filter.frequency.exponentialRampToValueAtTime(
          Math.max(100,base*(pad ? .8 : kind==='bass' ? .32 : .48)),t+Math.min(held,duration*.75));
        filter.connect(env);
        nodes.push(filter);
        const gain=c.createGain();
        gain.gain.value=pad ? .5 : kind==='bass' ? .45 : kind==='reed' ? .55 : .75;
        source.connect(gain).connect(filter);
        nodes.push(gain);
        if(pad || kind==='bass') {
          const layer=c.createOscillator(), mix=c.createGain();
          layer.type=pad?patch.wave:'sine';
          // The bass fundamental remains at score pitch; no inaudible octave sub.
          layer.frequency.value=hz;
          if(pad) {source.detune.value=-patch.detune;layer.detune.value=patch.detune;}
          mix.gain.value=pad ? .5 : .55;
          layer.connect(mix).connect(filter);
          layer.start(t);layer.stop(t+duration);
          nodes.push(layer,mix);
        }
        if(bell) {
          const mod=c.createOscillator(), depth=c.createGain();
          mod.frequency.value=hz*patch.ratio;
          depth.gain.setValueAtTime(hz*patch.depth,t);
          depth.gain.exponentialRampToValueAtTime(1,t+Math.min(.3,duration*.8));
          mod.connect(depth).connect(source.frequency);
          mod.start(t);mod.stop(t+duration);
          nodes.push(mod,depth);
        }
      }
    }
    const active={source,nodes,env,note};
    this.active?.add(active);
    source.onended = () => {
      this.active?.delete(active);
      source.disconnect(); for (const n of nodes) n.disconnect();
    };
    source.start(t); source.stop(t + duration);
    return active;
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
