// Pure acoustic model, in metres. A ring is approximated by two opposite rim emitters.
const smooth = (a,b,x) => { const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t); };
export function ringSound(z, speed, radius, rear, reach, listenerX=0, listenerY=0, listenerZ=0, out={}) {
  const relativeZ=z-listenerZ;
  const distance=Math.hypot(radius-listenerX,listenerY,relativeZ);
  // Positive radial velocity means approaching. Speed of sound is 343 m/s.
  const approaching=-speed*relativeZ/Math.max(distance,0.01);
  out.pitch=343/(343-Math.max(-250,Math.min(250,approaching)));
  out.gain=(1-smooth(0,reach,Math.abs(relativeZ)))
    *(1-smooth(rear*0.2,rear*0.95,z))
    *smooth(0,12,speed);
  return out;
}
export class RingAudio {
  constructor(config,count,Context=globalThis.AudioContext||globalThis.webkitAudioContext) {
    this.config=config;this.count=count;this.Context=Context;this.context=null;
    this.voices=[];this.enabled=true;this.available=!!Context;this.active=false;
    this.state={gain:0,pitch:1};
  }
  unlock() {
    if(!this.available)return;
    try {
      if(!this.context){
        const ctx=this.context=new this.Context();
        this.master=ctx.createGain();this.master.gain.value=0;this.master.connect(ctx.destination);
        // Generated once, shared by every fixed voice. No downloaded audio or frame allocations.
        const noise=ctx.createBuffer(1,Math.ceil(ctx.sampleRate*2),ctx.sampleRate);
        const data=noise.getChannelData(0);
        for(let i=0;i<data.length;i++)data[i]=Math.random()*2-1;
        for(let i=0;i<this.count;i++)for(const side of [-1,1]){
          const source=ctx.createBufferSource(), filter=ctx.createBiquadFilter(), soften=ctx.createBiquadFilter(), gain=ctx.createGain(), pan=ctx.createPanner();
          source.buffer=noise;source.loop=true;filter.type='bandpass';filter.frequency.value=this.config.whooshFrequency;filter.Q.value=0.5;
          // Lift the broad noise band out of the gritty low mids, then roll off sharp highs.
          soften.type='lowpass';soften.frequency.value=this.config.whooshLowpass;soften.Q.value=0.5;
          gain.gain.value=0;pan.panningModel='HRTF';pan.distanceModel='inverse';pan.rolloffFactor=0;
          source.connect(filter);filter.connect(soften);soften.connect(gain);gain.connect(pan);pan.connect(this.master);
          source.start(0,(i*0.37+(side+1)*0.19)%2);
          this.voices.push({source,filter,soften,gain,pan,ring:i,side});
        }
      }
      // User gesture only; never await audio initialization in the XR startup chain.
      if(this.context.state!=='running')void this.context.resume().catch(()=>{});
    }catch{
      this.available=false;this.silence();
    }
  }
  toggle(){this.enabled=!this.enabled;this.unlock();if(!this.enabled)this.silence();return this.enabled;}
  silence(){
    this.active=false;
    if(this.context&&this.master){const t=this.context.currentTime;this.master.gain.cancelScheduledValues(t);this.master.gain.setTargetAtTime(0,t,0.015);}
  }
  update(rings,speed,active,position,forward,up){
    if(!this.context||!this.available)return;
    const ctx=this.context,t=ctx.currentTime,c=this.config;
    active=active&&this.enabled;
    if(active!==this.active){this.active=active;this.master.gain.setTargetAtTime(active?c.whooshVolume:0,t,0.015);}
    if(!active)return;
    const listener=ctx.listener;
    listener.positionX.value=position.x;listener.positionY.value=position.y;listener.positionZ.value=position.z;
    listener.forwardX.value=forward.x;listener.forwardY.value=forward.y;listener.forwardZ.value=forward.z;
    listener.upX.value=up.x;listener.upY.value=up.y;listener.upZ.value=up.z;
    for(const voice of this.voices){
      const x=c.ringRadius*voice.side,z=rings[voice.ring];
      const sound=ringSound(z,speed,x,c.rearBoundary,c.whooshReach,position.x,position.y,position.z,this.state);
      // Web Audio panners do not supply Doppler: shift the noise spectrum explicitly.
      voice.source.playbackRate.setTargetAtTime(sound.pitch,t,0.02);
      voice.filter.frequency.setTargetAtTime(c.whooshFrequency*sound.pitch,t,0.02);
      voice.gain.gain.setTargetAtTime(sound.gain*0.5,t,0.012);
      voice.pan.positionX.value=x;voice.pan.positionY.value=0;voice.pan.positionZ.value=z;
    }
  }
  dispose(){this.silence();for(const voice of this.voices){voice.source.stop();voice.source.disconnect();voice.filter.disconnect();voice.soften.disconnect();voice.gain.disconnect();voice.pan.disconnect();}this.voices.length=0;if(this.context)void this.context.close().catch(()=>{});}
}
