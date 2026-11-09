import test from 'node:test';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import * as THREE from '../../../shared/vendor/three-r180/three.module.js';
import {BeeAudio,updateAudioListenerPose,flightBuzzGain} from '../bee-audio.mjs';
function mock(){
 const param=()=>({value:0,setValueAtTime(v){this.value=v;},setTargetAtTime(v){this.value=v;}});
 const spatial=()=>({positionX:param(),positionY:param(),positionZ:param()});
 return {sampleRate:44100,currentTime:0,destination:{},listener:{...spatial(),forwardX:param(),forwardY:param(),forwardZ:param(),upX:param(),upY:param(),upZ:param()},
 createBuffer:(channels,length)=>({data:new Float32Array(length),getChannelData(){return this.data;}}),
 createBufferSource:()=>({playbackRate:param(),connect(){},disconnect(){},start(){this.started=true;},stop(){this.stopped=true;}}),
 createGain:()=>({gain:param(),connect(){},disconnect(){}}),createPanner:()=>({...spatial(),connect(){},disconnect(){}})};
}

test('bee voices follow flight positions, listener transforms, mute and population removal',async()=>{
 let loads=0;const audio=new BeeAudio({load:async()=>{loads++;return new ArrayBuffer(1);}}),ctx=mock(),rig=new THREE.Group(),camera=new THREE.PerspectiveCamera();rig.add(camera);rig.position.set(2,1,3);rig.rotation.y=Math.PI/2;rig.updateMatrixWorld(true);
 const bee={flying:true,position:new THREE.Vector3(4,2,6)};
 ctx.decodeAudioData=async()=>({duration:5});audio.update(ctx,[bee],camera);await audio.loading;audio.update(ctx,[bee],camera);assert.equal(loads,1);const voice=audio.voices[0];assert.equal(voice.source.loop,true);assert.equal(voice.panner.panningModel,'HRTF');assert.equal(voice.panner.distanceModel,'linear');assert.equal(voice.panner.refDistance,.5);assert.equal(voice.panner.maxDistance,6);assert.equal(voice.panner.rolloffFactor,1);assert.equal(voice.source.playbackRate.value,1);assert.equal(voice.panner.positionX.value,4);assert.equal(voice.gain.gain.value,.0675);
 assert.equal(ctx.listener.positionX.value,2);assert.ok(Math.abs(ctx.listener.forwardX.value+1)<1e-8);
 bee.flying=false;audio.update(ctx,[bee],camera);assert.equal(voice.gain.gain.value,0);
 bee.flying=true;audio.update(ctx,[bee],camera,false);assert.equal(voice.gain.gain.value,0);
 audio.update(ctx,[bee],camera);audio.mute();assert.equal(voice.gain.gain.value,0);
 audio.update(ctx,[],camera);assert.equal(voice.source.stopped,true);assert.equal(audio.voices.length,0);audio.dispose();
});



test('XR listener includes current head offset, rig yaw, height and same-frame teleport',()=>{
 const rig=new THREE.Group(),camera=new THREE.PerspectiveCamera(),target=new THREE.Object3D();rig.add(camera);
 rig.position.set(4,.5,8);rig.rotation.y=Math.PI/2;
 const viewer={position:new THREE.Vector3(1,1.6,2),orientation:new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),Math.PI/2)};
 viewer.orientation={x:viewer.orientation.x,y:viewer.orientation.y,z:viewer.orientation.z,w:viewer.orientation.w};
 updateAudioListenerPose(target,camera,rig,viewer);
 assert.ok(target.position.distanceTo(new THREE.Vector3(6,2.1,7))<1e-8);
 assert.ok(new THREE.Vector3(0,0,-1).applyQuaternion(target.quaternion).distanceTo(new THREE.Vector3(0,0,1))<1e-8);
 rig.position.x+=10;updateAudioListenerPose(target,camera,rig,viewer);assert.ok(Math.abs(target.position.x-16)<1e-8);
 camera.position.set(0,1.6,0);updateAudioListenerPose(target,camera,rig);assert.ok(target.position.distanceTo(new THREE.Vector3(14,2.1,8))<1e-8);
});

test('flight buzz fades through takeoff and approach and is silent at touchdown',()=>{
 const bee={flying:true,began:10,duration:3};
 assert.equal(flightBuzzGain(bee,10),0);assert.ok(flightBuzzGain(bee,10.175)>.4&&flightBuzzGain(bee,10.175)<.6);
 assert.equal(flightBuzzGain(bee,11),1);assert.ok(flightBuzzGain(bee,12.675)>.4&&flightBuzzGain(bee,12.675)<.6);
 assert.equal(flightBuzzGain(bee,13),0);bee.flying=false;assert.equal(flightBuzzGain(bee,14),0);
});





test('recorded bee asset is five-second mono PCM with a continuous loop boundary',()=>{
 const wav=readFileSync(new URL('../../../assets/secretGarden/audio/bee-buzz.wav',import.meta.url));
 assert.equal(wav.toString('ascii',0,4),'RIFF');assert.equal(wav.readUInt16LE(22),1);assert.equal(wav.readUInt16LE(34),16);
 const rate=wav.readUInt32LE(24),samples=wav.subarray(44);assert.equal(samples.length/2/rate,5);
 let sum=0,maxStep=0,previous=samples.readInt16LE(0);for(let i=0;i<samples.length;i+=2){const v=samples.readInt16LE(i);sum+=v*v;maxStep=Math.max(maxStep,Math.abs(v-previous));previous=v;}
 assert.ok(Math.sqrt(sum/(samples.length/2))/32768>.1);assert.ok(Math.abs(samples.readInt16LE(0)-previous)<=maxStep);
});
test('recorded bee load failures retry with backoff and disposal prevents playback',async()=>{
 let loads=0;const ctx=mock(),audio=new BeeAudio({load:async()=>{if(++loads===1)throw Error('offline');return new ArrayBuffer(1);}});
 ctx.decodeAudioData=async()=>({duration:5});audio.initialize(ctx);await audio.loading;audio.initialize(ctx);assert.equal(loads,1);
 ctx.currentTime=5;audio.initialize(ctx);await audio.loading;assert.equal(loads,2);assert.equal(audio.buffer.duration,5);audio.dispose();assert.equal(audio.disposed,true);
});
