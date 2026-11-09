import * as THREE from '../../shared/vendor/three-r180/three.module.js';
function position(node,v,time){
 if(node.positionX){node.positionX.setValueAtTime(v.x,time);node.positionY.setValueAtTime(v.y,time);node.positionZ.setValueAtTime(v.z,time);}
 else node.setPosition(v.x,v.y,v.z);
}
const audioRigQuaternion=new THREE.Quaternion();
// XR's internal camera is unparented; use the current reference-space head pose.
export function updateAudioListenerPose(target,camera,rig,viewer=null){
 if(viewer){
  rig.updateWorldMatrix(true,false);
  target.position.copy(viewer.position).applyMatrix4(rig.matrixWorld);
  rig.getWorldQuaternion(audioRigQuaternion);
  const q=viewer.orientation;target.quaternion.set(q.x,q.y,q.z,q.w).premultiply(audioRigQuaternion);
 }else{
  camera.getWorldPosition(target.position);camera.getWorldQuaternion(target.quaternion);
 }
 target.updateMatrixWorld(true);return target;
}
const smoothFlight=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
export function flightBuzzGain(bee,now){
 if(!bee.flying)return 0;
 if(!Number.isFinite(now)||!Number.isFinite(bee.began)||!Number.isFinite(bee.duration))return 1;
 const elapsed=Math.max(0,now-bee.began),remaining=Math.max(0,bee.duration-elapsed);
 return smoothFlight(elapsed/Math.min(.35,bee.duration*.25))*smoothFlight(remaining/Math.min(.65,bee.duration*.35));
}
export class BeeAudio {
 constructor({load=()=>fetch(new URL('../../assets/secretGarden/audio/bee-buzz.wav?v=158',import.meta.url)).then(r=>{if(!r.ok)throw Error('Bee audio unavailable');return r.arrayBuffer();})}={}){this.load=load;this.retryAt=0;this.disposed=false;this.voices=[];this.position=new THREE.Vector3();this.rotation=new THREE.Quaternion();this.forward=new THREE.Vector3();this.up=new THREE.Vector3();}
 initialize(context){
  this.context=context;
  if(!this.loading&&context.currentTime>=this.retryAt)this.loading=this.load().then(data=>context.decodeAudioData(data)).then(buffer=>{if(!this.disposed)this.buffer=buffer;}).catch(()=>{this.loading=null;this.retryAt=context.currentTime+5;});
 }
 update(context,bees,camera,enabled=true,active=true,now=null){
  if(!context||this.disposed)return;if(!this.buffer){this.initialize(context);return;}
  const time=context.currentTime,listener=context.listener;
  camera.getWorldPosition(this.position);camera.getWorldQuaternion(this.rotation);
  position(listener,this.position,time);this.forward.set(0,0,-1).applyQuaternion(this.rotation);this.up.set(0,1,0).applyQuaternion(this.rotation);
  if(listener.forwardX){for(const [prefix,v] of [['forward',this.forward],['up',this.up]])for(const axis of ['x','y','z'])listener[prefix+axis.toUpperCase()].setValueAtTime(v[axis],time);}
  else listener.setOrientation(this.forward.x,this.forward.y,this.forward.z,this.up.x,this.up.y,this.up.z);
  while(this.voices.length>bees.length)this.release(this.voices.pop());
  for(let i=0;i<bees.length;i++){
   const bee=bees[i];let voice=this.voices[i];
   if(!voice){
    const source=context.createBufferSource(),gain=context.createGain(),panner=context.createPanner();
    source.buffer=this.buffer;source.loop=true;source.playbackRate.value=1;
    panner.panningModel='HRTF';panner.distanceModel='linear';panner.refDistance=.5;panner.maxDistance=6;panner.rolloffFactor=1;
    gain.gain.value=0;source.connect(gain);gain.connect(panner);panner.connect(context.destination);source.start(0,(i*.731)%this.buffer.duration);
    voice={source,gain,panner};this.voices.push(voice);
   }
   position(voice.panner,bee.position,time);
   voice.gain.gain.setTargetAtTime(enabled&&active ? .0675*flightBuzzGain(bee,now) : 0,time,.025);
  }
 }
 mute(){if(this.context)for(const voice of this.voices)voice.gain.gain.setTargetAtTime(0,this.context.currentTime,.025);}
 release(voice){voice.source.stop();voice.source.disconnect();voice.gain.disconnect();voice.panner.disconnect();}
 dispose(){this.disposed=true;for(const voice of this.voices)this.release(voice);this.voices=[];}
}
