import {Vector3} from '../../shared/vendor/three-r180/three.module.js';
import {ForestAmbience} from './forest-audio.mjs?v=1';
const TAKEOFF_GAIN=1.95*10**(-3/20);
export const TAKEOFF_CLIP=new URL('../../assets/hike/audio/sparrow-takeoff.wav',import.meta.url);
// One spatial source per flock shares the ambience context/master/lifecycle.
function position(node,x,y,z){
 if(node.positionX){node.positionX.value=x;node.positionY.value=y;node.positionZ.value=z;}
 else node.setPosition(x,y,z);
}
export class HikeAudio extends ForestAmbience {
 constructor({loadTakeoffBytes=async signal=>{const response=await fetch(TAKEOFF_CLIP,{signal});if(!response.ok)throw Error(`Bird sound: HTTP ${response.status}`);return response.arrayBuffer();},...options}={}){
  super(options);this.loadTakeoffBytes=loadTakeoffBytes;this.takeoffs=new Set();this.lastTakeoff=-Infinity;this.takeoffBuffer=null;this.takeoffLoading=null;this.takeoffError=null;this.audioForward=new Vector3();this.audioUp=new Vector3();
 }
 async unlock(){
  const bed=super.unlock(); // Creates/resumes the shared context inside the gesture.
  if(this.context&&!this.disposed&&!this.takeoffLoading&&!this.takeoffBuffer){
   this.takeoffLoading=this.loadTakeoff().finally(()=>{this.takeoffLoading=null;});
  }
  await Promise.all([bed,this.takeoffLoading]);return !this.disposed&&this.context?.state==='running'&&!!this.buffers;
 }
 async loadTakeoff(){
  try{
   const bytes=await this.loadTakeoffBytes(this.abort.signal);if(this.disposed)return;
   const buffer=await this.context.decodeAudioData(bytes);if(this.disposed)return;
   if(buffer.duration<2||buffer.duration>4||buffer.numberOfChannels!==1)throw Error('Invalid bird takeoff clip');
   this.takeoffBuffer=buffer;this.takeoffError=null;
  }catch(error){if(!this.disposed)this.takeoffError=error.message;}
 }
 playTakeoff(encounter,flock){
  if(!encounter||this.disposed||!this.active||!this.playing||!this.takeoffBuffer||this.context?.state!=='running')return false;
  const now=this.context.currentTime;
  // Nearby trees may trigger together: one accent per .25 s, at most three voices.
  if(now-this.lastTakeoff<.25||this.takeoffs.size>=3)return false;
  let source,gain,panner,record;
  try{
   source=this.context.createBufferSource();gain=this.context.createGain();source.buffer=this.takeoffBuffer;
   panner=this.context.createPanner();panner.panningModel='HRTF';panner.distanceModel='inverse';
   panner.refDistance=30;panner.rolloffFactor=1;panner.maxDistance=200;
   source.connect(gain);gain.connect(panner);panner.connect(this.master);
   gain.gain.setValueAtTime(0,now);gain.gain.linearRampToValueAtTime(TAKEOFF_GAIN,now+.015);
   gain.gain.setValueAtTime(TAKEOFF_GAIN,now+.65);gain.gain.linearRampToValueAtTime(0,now+3);
   record={source,gain,panner,encounter,flock,x:encounter.x,y:encounter.y+(encounter.canopy??0),z:encounter.z};this.takeoffs.add(record);this.updateSource(record);
   source.onended=()=>{source.disconnect();gain.disconnect();panner.disconnect();source.buffer=null;this.takeoffs.delete(record);};
   source.start(now);source.stop(now+3);this.lastTakeoff=now;return true;
  }catch(error){source?.disconnect();gain?.disconnect();panner?.disconnect();if(record)this.takeoffs.delete(record);this.takeoffError=error.message;return false;}
 }
 updateListener(head,orientation){
  if(this.disposed||!this.context||this.context.state!=='running')return;
  const listener=this.context.listener;position(listener,head.x,head.y,head.z);
  const forward=this.audioForward.set(0,0,-1).applyQuaternion(orientation),up=this.audioUp.set(0,1,0).applyQuaternion(orientation);
  if(listener.forwardX){
   listener.forwardX.value=forward.x;listener.forwardY.value=forward.y;listener.forwardZ.value=forward.z;
   listener.upX.value=up.x;listener.upY.value=up.y;listener.upZ.value=up.z;
  }else listener.setOrientation(forward.x,forward.y,forward.z,up.x,up.y,up.z);
 }
 updateSource(record){
  const f=record.flock;
  // Pool reuse must not drag an old sound to a different encounter.
  if(f?.record===record.encounter){
   let x=0,y=0,z=0;const n=record.encounter.count;
   for(let i=0;i<n;i++){const b=f.birds[i];x+=b.x;y+=b.y;z+=b.z;}
   record.x=x/n;record.y=y/n;record.z=z/n;
  }
  position(record.panner,record.x,record.y,record.z);
 }
 updateSources(){for(const record of this.takeoffs)this.updateSource(record);}
 setActive(value){super.setActive(value);if(!value)this.stopTakeoffs();}
 stopTakeoffs(){
  for(const record of this.takeoffs){const {source,gain,panner}=record;source.onended=null;try{source.stop();}catch{}source.disconnect();gain.disconnect();panner.disconnect();source.buffer=null;}
  this.takeoffs.clear();this.lastTakeoff=-Infinity;
 }
 dispose(){this.stopTakeoffs();this.takeoffBuffer=null;super.dispose();}
}
