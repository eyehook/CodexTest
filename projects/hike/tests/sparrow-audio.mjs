import * as T from '../../../shared/vendor/three-r180/three.module.js';
import {FlightView} from '../flight-view.mjs';
import {applyHeightOffset} from '../height-offset.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {HikeAudio,TAKEOFF_CLIP} from '../sparrow-audio.mjs';
const encounter={x:10,y:2,z:3,canopy:4,count:2};
const spatial=()=>Object.fromEntries(['positionX','positionY','positionZ','forwardX','forwardY','forwardZ','upX','upY','upZ'].map(k=>[k,{value:0}]));
function fixture(options={}){
 let now=10,loads=0;const nodes=[];
 const context={state:'running',get currentTime(){return now;},destination:{},listener:spatial(),
  createPanner(){return {...spatial(),connect(){},disconnect(){this.disconnected=true;}};},
  createGain(){return {gain:{events:[],setValueAtTime(v,t){this.events.push([v,t]);},linearRampToValueAtTime(v,t){this.events.push([v,t]);}},connect(){},disconnect(){this.disconnected=true;}};},
  createBufferSource(){const n={connect(g){this.gain=g;},start(t){this.startTime=t;},stop(t){this.stopTime=t;},disconnect(){this.disconnected=true;}};nodes.push(n);return n;},
  decodeAudioData:async()=>({duration:3,numberOfChannels:1}),close:async()=>{context.state='closed';}};
 const a=new HikeAudio({loadTakeoffBytes:async()=>{loads++;return new ArrayBuffer(4)},...options});a.context=context;a.master=context.createGain();a.active=true;a.playing=true;
 return {a,context,nodes,advance(t){now+=t;},get loads(){return loads;}};
}
test('takeoff buffer is reused; gain fades over three seconds and ended nodes release',async()=>{
 const f=fixture(),a=f.a;await a.loadTakeoff();assert.equal(f.loads,1);assert.equal(a.playTakeoff(encounter),true);const n=f.nodes[0];assert.equal(n.buffer,a.takeoffBuffer);assert.equal(n.stopTime-n.startTime,3);assert.deepEqual(n.gain.gain.events.at(-1),[0,13]);assert.equal(a.playTakeoff(encounter),false);
 f.advance(.3);assert.equal(a.playTakeoff(encounter),true);f.advance(.3);assert.equal(a.playTakeoff(encounter),true);f.advance(.3);assert.equal(a.playTakeoff(encounter),false);assert.equal(a.takeoffs.size,3);
 n.onended();assert.equal(n.buffer,null);assert.ok(n.disconnected);assert.ok(n.gain.disconnected);assert.equal(a.takeoffs.size,2);assert.equal(a.playTakeoff(encounter),true);a.dispose();assert.equal(a.takeoffs.size,0);assert.equal(a.takeoffBuffer,null);
});
test('muting and disposal stop effects; failed/late loads cannot play stale encounters',async()=>{
 const f=fixture(),a=f.a;assert.equal(a.playTakeoff(encounter),false);await a.loadTakeoff();a.playTakeoff(encounter);a.setActive(false);assert.equal(a.takeoffs.size,0);assert.equal(a.playTakeoff(encounter),false);a.dispose();await a.unlock();assert.equal(a.playTakeoff(encounter),false);
 const failed=fixture({loadTakeoffBytes:async()=>{throw Error('offline')}});await failed.a.loadTakeoff();assert.match(failed.a.takeoffError,/offline/);assert.equal(failed.a.playTakeoff(encounter),false);failed.a.dispose();
 let release;const late=fixture({loadTakeoffBytes:()=>new Promise(resolve=>release=resolve)});const pending=late.a.loadTakeoff();late.a.dispose();release(new ArrayBuffer(4));await pending;assert.equal(late.a.takeoffBuffer,null);
});
test('packaged CC0 takeoff is a small mono three-second PCM asset matching provenance',async()=>{
 const bytes=await readFile(TAKEOFF_CLIP),meta=JSON.parse(await readFile(new URL('../../../assets/hike/audio/sparrow-takeoff.json',import.meta.url)));
 assert.equal(meta.license,'CC0-1.0');assert.equal(createHash('sha256').update(bytes).digest('hex'),meta.sha256);assert.equal(bytes.toString('ascii',0,4),'RIFF');assert.equal(bytes.readUInt16LE(22),1);assert.equal(bytes.readUInt32LE(24),32000);assert.equal(bytes.readUInt32LE(40)/64000,3);assert.ok(bytes.length<200000);
});

test('spatial source follows its flock but never a recycled encounter',async()=>{
 const {a}=fixture();await a.loadTakeoff();const flock={record:encounter,birds:[{x:8,y:5,z:2},{x:12,y:7,z:4}]};
 assert.ok(a.playTakeoff(encounter,flock));const voice=[...a.takeoffs][0],p=voice.panner;
 assert.equal(p.panningModel,'HRTF');assert.deepEqual([p.positionX.value,p.positionY.value,p.positionZ.value],[10,6,3]);
 flock.birds[0].x+=4;flock.birds[1].x+=4;a.updateSources();assert.equal(p.positionX.value,14);
 flock.record={...encounter};flock.birds[0].x=1000;a.updateSources();assert.equal(p.positionX.value,14);a.dispose();assert.ok(p.disconnected);
});
test('listener matches translated/yawed rig, head offset/rotation, height adjustment and same-frame teleport',()=>{
 const {a,context}=fixture(),rig=new T.Group(),heightRig=new T.Group(),view=new FlightView(new T.Group());rig.add(heightRig);
 rig.position.set(100,20,-60);rig.rotation.y=Math.PI/2;
 const viewer={position:new T.Vector3(.4,1.6,-.2),orientation:new T.Quaternion().setFromEuler(new T.Euler(.15,.6,-.1))};
 applyHeightOffset(heightRig,viewer,.5);
 for(const x of [100,350]){
  rig.position.x=x;view.sample(rig,viewer);a.updateListener(view.head,view.orientation);
  const camera=new T.PerspectiveCamera();heightRig.add(camera);camera.position.set(.4,1.6,-.2);camera.quaternion.copy(viewer.orientation);rig.updateMatrixWorld(true);
  const head=camera.getWorldPosition(new T.Vector3()),q=camera.getWorldQuaternion(new T.Quaternion()),forward=new T.Vector3(0,0,-1).applyQuaternion(q),up=new T.Vector3(0,1,0).applyQuaternion(q),l=context.listener;
  assert.ok(head.distanceTo(new T.Vector3(l.positionX.value,l.positionY.value,l.positionZ.value))<1e-10);
  assert.ok(forward.distanceTo(new T.Vector3(l.forwardX.value,l.forwardY.value,l.forwardZ.value))<1e-10);
  assert.ok(up.distanceTo(new T.Vector3(l.upX.value,l.upY.value,l.upZ.value))<1e-10);heightRig.remove(camera);
 }
 // Desktop supplies the same composed pose, with its ordinary camera local pose.
 rig.rotation.y=0;viewer.position.set(0,1.7,0);viewer.orientation.identity();view.sample(rig,viewer);a.updateListener(view.head,view.orientation);
 assert.deepEqual([context.listener.positionX.value,context.listener.positionY.value,context.listener.positionZ.value],[350,21.7,-60]);a.dispose();
});
