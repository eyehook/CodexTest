import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../projects/forest/vendor/three.module.js';
import {LINE_SEGMENTS} from '../../src/fishing/rods/LinePhysics.mjs';
import {FishingRod,ROD_LENGTH,ROD_SEGMENTS,LINE_LENGTH,BOBBER_RADIUS,LEADER_LENGTH} from '../../src/fishing/rods/FishingRod.js';
import {RodSystem} from '../../src/fishing/rods/RodSystem.js';
import {createRodControls,updateRodControls} from '../../src/fishing/rods/RodControls.mjs';
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} != ${b}`);
function source(hand,pressed){return {handedness:hand,gripSpace:{},gamepad:{mapping:'xr-standard',buttons:[{},{},{},{},{},{pressed}]}};}
function session(right=false,left=false){return {visibilityState:'visible',inputSources:[source('right',right),source('left',left)]};}
test('B/Y toggle one equipped hand at a time, only on press edges',()=>{
 const c=createRodControls();updateRodControls(c,session(true),true);assert.equal(c.right.shown,true);assert.equal(c.left.shown,false);
 updateRodControls(c,session(true),true);assert.equal(c.right.shown,true);
 updateRodControls(c,session(true,true),true);assert.equal(c.left.shown,true);assert.equal(c.right.shown,false);
 updateRodControls(c,session(),true);updateRodControls(c,session(true),false);assert.equal(c.left.shown,true);
 updateRodControls(c,{...session(true),visibilityState:'hidden'},true);assert.equal(c.left.shown,true);
 updateRodControls(c,session(true),true);assert.equal(c.right.shown,true);assert.equal(c.left.shown,false);
 updateRodControls(c,session(),true);updateRodControls(c,session(true),true);assert.equal(c.right.shown,false);
 updateRodControls(c,session(),true);updateRodControls(c,session(true,true),true);assert.equal(c.right.shown,true);assert.equal(c.left.shown,false);
 updateRodControls(c,null,false);assert.equal(c.right.shown,false);
 const unsupported=session(true,true);for(const s of unsupported.inputSources)s.gamepad.mapping='';updateRodControls(c,unsupported,true);assert.equal(c.right.shown,false);
});
test('continuous rod curve has increasing curvature, fixed length and a stiff base',()=>{
 const rod=new FishingRod(new THREE.Scene()),g=rod.mesh.geometry,p=g.attributes.position;
 assert.equal(rod.mesh.isSkinnedMesh,undefined);assert.equal(g.attributes.skinWeight,undefined);
 const straight=rod.localTip.clone();rod.setBend(1);assert.ok(straight.distanceTo(rod.localTip)>.2);
 let length=0,previousAngle=0,previousTurn=0;
 for(let i=1;i<=ROD_SEGMENTS;i++){
  const a=(i-1)*3,b=i*3,dy=rod.curve[b+1]-rod.curve[a+1],dz=rod.curve[b+2]-rod.curve[a+2];
  length+=Math.hypot(dy,dz);const angle=Math.atan2(dz,dy),turn=previousAngle-angle;
  assert.ok(dy>0&&dz<0);assert.ok(turn>=previousTurn-1e-6);previousTurn=turn;previousAngle=angle;
 }
 assert.ok(Math.abs(length-ROD_LENGTH)<.001);assert.equal(rod.curve[1],0);assert.equal(rod.curve[2],0);
 // Every ring stays circular about its centre, including at former bone joints.
 for(let i=0;i<p.count;i++){
  const j=i*3,t=rod.restPositions[j+1]/ROD_LENGTH,ring=Math.round(t*ROD_SEGMENTS)*3;
  const radius=Math.hypot(p.getX(i),p.getY(i)-rod.curve[ring+1],p.getZ(i)-rod.curve[ring+2]);
  close(radius,Math.hypot(rod.restPositions[j],rod.restPositions[j+2]));
 }
 rod.setBend(9);assert.equal(rod.bend,1);rod.setBend(-1);assert.equal(rod.bend,0);close(rod.localTip.y,ROD_LENGTH);close(rod.localTip.z,0);rod.dispose();
});
test('bobber hangs vertically from bent rod tip and line remains attached through rig transforms',()=>{
 const scene=new THREE.Scene(),rig=new THREE.Group(),rod=new FishingRod(scene);scene.add(rig);rig.add(rod.root);rig.position.set(3,5,-7);rig.rotation.y=.8;rod.setBend(.75);rod.update(true);
 close(rod.bobber.position.x,rod.tip.x);close(rod.bobber.position.z,rod.tip.z);close(rod.tip.y-rod.bobber.position.y,LINE_LENGTH);
 const p=rod.line.geometry.attributes.position;close(p.getX(0),rod.tip.x);close(p.getY(LINE_SEGMENTS),rod.bobber.position.y+BOBBER_RADIUS);
 const colors=rod.bobber.geometry.attributes.color;assert.ok(Array.from(colors.array).some(c=>c<.1));assert.ok(Array.from(colors.array).some(c=>c>.9));
 rod.update(false);assert.equal(rod.line.visible,false);assert.equal(rod.bobber.visible,false);rod.dispose();
});
test('controller handedness, lost poses, disconnection and session end control visibility',()=>{
 const grips=[new THREE.Group(),new THREE.Group()],renderer={xr:{getControllerGrip:i=>grips[i]}},scene=new THREE.Scene(),rig=new THREE.Group();scene.add(rig);
 const system=new RodSystem(renderer,scene,rig),s=session(true,false),frame={getPose:()=>({})};
 grips[0].dispatchEvent({type:'connected',data:s.inputSources[0]});grips[1].dispatchEvent({type:'connected',data:s.inputSources[1]});
 system.update(s,frame,{},true);assert.equal(system.slots[0].rod.root.visible,true);assert.equal(system.slots[1].rod.root.visible,false);
 system.update(s,{getPose:()=>null},{},true);assert.ok(system.slots[0].rod.line.visible);assert.equal(system.slots[0].rod.root.visible,true);
 system.update(s,frame,{},true);assert.ok(system.slots[0].rod.root.visible);
 grips[0].dispatchEvent({type:'disconnected'});assert.equal(system.controls.right.shown,true);assert.equal(system.slots[0].rod.root.visible,true);
 system.update(null,null,null,false);assert.equal(system.controls.left.shown,false);assert.ok(system.slots.every(s=>!s.rod.bobber.visible));
 for(const slot of system.slots)slot.rod.dispose();
});

test('switching hands transfers the physical bobber state instead of creating a second bobber',()=>{
 const grips=[new THREE.Group(),new THREE.Group()],scene=new THREE.Scene(),rig=new THREE.Group(),system=new RodSystem({xr:{getControllerGrip:i=>grips[i]}},scene,rig);scene.add(rig);
 const s=session(true,false),frame={getPose:()=>({})};grips[0].dispatchEvent({type:'connected',data:s.inputSources[0]});grips[1].dispatchEvent({type:'connected',data:s.inputSources[1]});
 system.update(s,frame,{},true,1/72);const physics=system.slots[0].rod.physics;
 s.inputSources[0].gamepad.buttons[5].pressed=false;system.update(s,frame,{},true,1/72);s.inputSources[1].gamepad.buttons[5].pressed=true;
 system.update(s,frame,{},true,1/72);assert.equal(system.slots[1].rod.physics,physics);assert.equal(system.slots[0].rod.bobber.visible,false);assert.equal(system.slots[1].rod.bobber.visible,true);
 for(const slot of system.slots)slot.rod.dispose();
});

test('camera-relative world rebasing does not impart fake bobber momentum',()=>{
 const scene=new THREE.Scene(),rod=new FishingRod(scene);scene.add(rod.root);rod.update(true,1/72,1e9,-1e9,20);
 const before=rod.physics.position.slice(),bobber=rod.bobber.position.clone();
 rod.root.position.x-=100;rod.root.position.y-=30;
 rod.update(true,0,1e9+100,-1e9,50);
 assert.deepEqual(rod.physics.position,before);close(rod.bobber.position.x,bobber.x-100);close(rod.bobber.position.y,bobber.y-30);
 rod.dispose();
});

test('completing retrieval pulses only the equipped controller once, with safe haptic failures',async()=>{
 for(const hand of ['right','left'])for(const failure of ['none','missing','throw','reject']){
 const grips=[new THREE.Group(),new THREE.Group()],scene=new THREE.Scene(),rig=new THREE.Group();scene.add(rig);
 const system=new RodSystem({xr:{getControllerGrip:i=>grips[i]}},scene,rig),s=session(hand==='right',hand==='left'),frame={getPose:()=>({})},calls=[];
 for(let i=0;i<2;i++){
 const input=s.inputSources[i];
 if(failure!=='missing')input.gamepad.hapticActuators=[{pulse:(strength,duration)=>{calls.push([input.handedness,strength,duration]);if(failure==='throw')throw Error('unavailable');return failure==='reject'?Promise.reject(Error('unavailable')):Promise.resolve(true);}}];
 grips[i].dispatchEvent({type:'connected',data:input});
 }
 system.update(s,frame,{},true,1/120);assert.equal(calls.length,0);
 const slot=system.activeSlot,p=slot.rod.physics;
 p.length=p.homeLength+.0001;p.phase='reeling';p.deployed=true;p.triggerHeld=true;p.triggerAction='reel';
 slot.source.gamepad.buttons[0]={pressed:true};
 system.update(s,frame,{},true,1/120);assert.equal(p.completedRetrievals,1);assert.equal(p.length,p.homeLength);
 for(let i=0;i<600;i++)system.update(s,frame,{},true,1/120);
 assert.equal(p.length,p.homeLength);
 assert.deepEqual(calls,failure==='missing'?[]:[[hand,.12,50]]);
 system.resetPhysics();system.update(s,frame,{},true,1/120);assert.equal(calls.length,failure==='missing'?0:1);
 await Promise.resolve();for(const slot of system.slots)slot.rod.dispose();
 }
});

test('leader and hook remain attached beneath the bobber across motion and world rebasing',()=>{
 const scene=new THREE.Scene(),rod=new FishingRod(scene);scene.add(rod.root);rod.update(true,0,1e9,-1e9,20);
 assert.equal(LEADER_LENGTH,.25);assert.equal(rod.leader.parent,rod.bobber);assert.equal(rod.hook.parent,rod.bobber);
 const line=rod.leader.geometry.attributes.position;
 close(line.getY(0),-BOBBER_RADIUS);close(line.getY(2),rod.hook.position.y);assert.equal(line.count,3);
 close(rod.hookWorldPosition.y,rod.physics.position[LINE_SEGMENTS*3+1]-BOBBER_RADIUS-LEADER_LENGTH-.047);
 const anchor=rod.hookAnchor.getWorldPosition(new THREE.Vector3());
 close(anchor.x,rod.hookWorldPosition.x-1e9);close(anchor.y,rod.hookWorldPosition.y-20);close(anchor.z,rod.hookWorldPosition.z+1e9);
 const before=rod.hookWorldPosition.clone();rod.root.position.x-=100;rod.root.position.y-=30;
 rod.update(true,0,1e9+100,-1e9,50);assert.deepEqual(rod.hookWorldPosition,before);
 rod.update(false);assert.equal(rod.bobber.visible,false);rod.dispose();
});
