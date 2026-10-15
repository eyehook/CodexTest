import test from 'node:test';
import assert from 'node:assert/strict';
import {Group,Vector3,Quaternion} from 'three';
import {Locomotion} from '../src/locomotion.js';
import {config} from '../src/config.js';
const source=(hand)=>({handedness:hand,gamepad:{mapping:'xr-standard',axes:[0,0,0,0],buttons:Array.from({length:6},()=>({pressed:false}))}});
const pose=()=>({position:new Vector3(.4,1.6,-.2),orientation:new Quaternion()});
function setup(){const rig=new Group();rig.updateMatrixWorld(true);return {rig,motion:new Locomotion(rig,config.locomotion)};}
test('walking is frame-rate independent, horizontal, normalized diagonally and head-directed',()=>{
 for(const hz of [30,72,120]){
  const {rig,motion}=setup(),left=source('left'),viewer=pose();left.gamepad.axes[2]=1;left.gamepad.axes[3]=-1;
  for(let i=0;i<hz;i++)motion.update(1/hz,[left],viewer,()=>{});
  assert.ok(Math.abs(rig.position.length()-1.5)<1e-8);assert.equal(rig.position.y,0);
 }
 const {rig,motion}=setup(),left=source('left'),viewer=pose();viewer.orientation.setFromAxisAngle(new Vector3(0,1,0),Math.PI/2);left.gamepad.axes[3]=-1;
 motion.update(1,[left],viewer,()=>{});assert.ok(Math.abs(rig.position.x+1.5)<1e-8);assert.ok(Math.abs(rig.position.z)<1e-8);
});
test('smooth right turn preserves headset pivot and ignores stick drift',()=>{
 const {rig,motion}=setup(),right=source('right'),viewer=pose();rig.position.set(8,0,12);rig.updateMatrixWorld(true);
 const before=viewer.position.clone().applyMatrix4(rig.matrixWorld);right.gamepad.axes[2]=1;
 motion.update(1,[right],viewer,()=>{});
 assert.ok(before.distanceTo(viewer.position.clone().applyMatrix4(rig.matrixWorld))<1e-8);
 assert.ok(Math.abs(rig.rotation.y+Math.PI/3)<1e-8);
 const previous=rig.position.clone();right.gamepad.axes[2]=.1;motion.update(1,[right],viewer,()=>{});assert.ok(previous.distanceTo(rig.position)<1e-8);
});
test('A/X use independent press edges, simultaneous press once, release and reconnect recover',()=>{
 const {motion}=setup(),a=source('right'),x=source('left');let count=0;const tick=s=>motion.update(0,s,pose(),()=>count++);
 tick([a,x]);a.gamepad.buttons[4].pressed=true;x.gamepad.buttons[4].pressed=true;tick([a,x]);tick([a,x]);assert.equal(count,1);
 x.gamepad.buttons[4].pressed=false;tick([a,x]);x.gamepad.buttons[4].pressed=true;tick([a,x]);assert.equal(count,2);
 tick([]);tick([a]);assert.equal(count,3);motion.reset();a.gamepad.buttons[4].pressed=false;tick([a]);assert.equal(count,3);
});
