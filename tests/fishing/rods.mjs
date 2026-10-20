import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../projects/forest/vendor/three.module.js';
import {LINE_SEGMENTS} from '../../src/fishing/rods/LinePhysics.mjs';
import {FishingRod,ROD_LENGTH,ROD_SEGMENTS,LINE_LENGTH,BOBBER_RADIUS} from '../../src/fishing/rods/FishingRod.js';
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
test('rod skin weights are normalized, sections taper, and its bone rig bends the actual mesh',()=>{
 const scene=new THREE.Scene(),rod=new FishingRod(scene);scene.add(rod.root);rod.root.rotation.set(0,0,0);rod.root.position.set(0,0,0);
 assert.equal(rod.bones.length,ROD_SEGMENTS+1);const g=rod.mesh.geometry,p=g.attributes.position,weights=g.attributes.skinWeight;
 let tip=-1,baseRadius=0,tipRadius=0;
 for(let i=0;i<p.count;i++){close(weights.getX(i)+weights.getY(i),1);if(p.getY(i)>ROD_LENGTH-.001){tip=i;tipRadius=Math.max(tipRadius,Math.hypot(p.getX(i),p.getZ(i)));}if(p.getY(i)<.001)baseRadius=Math.max(baseRadius,Math.hypot(p.getX(i),p.getZ(i)));}
 assert.ok(baseRadius>tipRadius*3);
 rod.root.updateMatrixWorld(true);const straight=rod.mesh.getVertexPosition(tip,new THREE.Vector3());
 rod.setBend(1);rod.root.updateMatrixWorld(true);const bent=rod.mesh.getVertexPosition(tip,new THREE.Vector3());assert.ok(straight.distanceTo(bent)>.2);
 rod.setBend(9);assert.equal(rod.bend,1);rod.setBend(-1);assert.equal(rod.bend,0);rod.dispose();
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
 system.update(s,{getPose:()=>null},{},true);assert.ok(system.slots.every(s=>!s.rod.line.visible));
 system.update(s,frame,{},true);assert.ok(system.slots[0].rod.root.visible);
 grips[0].dispatchEvent({type:'disconnected'});assert.equal(system.controls.right.shown,false);assert.equal(system.slots[0].rod.root.visible,false);
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
