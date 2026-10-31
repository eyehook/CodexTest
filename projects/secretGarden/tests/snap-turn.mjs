import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../../shared/vendor/three-r180/three.module.js';
import {Locomotion} from '../../../shared/xr/locomotion.mjs';
import {SnapTurn} from '../snap-turn.mjs';
const source=()=>({handedness:'right',gamepad:{mapping:'xr-standard',axes:[0,0,0,0]}});
test('snap turns once per neutral excursion, pivots around head and supports all three angles',()=>{
 for(const angle of [15,30,45]){const rig=new THREE.Group();rig.position.set(1,.5,2);const nav=new Locomotion(rig,{turnSpeed:1}),snap=new SnapTurn(),right=source(),v={position:new THREE.Vector3(.3,1,.2),orientation:new THREE.Quaternion()},settings={snapTurn:true,snapAngle:angle};
 const update=()=>snap.update(nav,1/90,[right],v,settings);right.gamepad.axes[2]=1;update();assert.equal(rig.rotation.y,0);right.gamepad.axes[2]=0;update();rig.updateMatrixWorld(true);const before=v.position.clone().applyMatrix4(rig.matrixWorld);right.gamepad.axes[2]=1;update();assert.ok(Math.abs(rig.rotation.y+angle*Math.PI/180)<1e-10);assert.ok(before.distanceTo(v.position.clone().applyMatrix4(rig.matrixWorld))<1e-9);
 for(let i=0;i<100;i++)update();right.gamepad.axes[2]=-1;update();assert.ok(Math.abs(rig.rotation.y+angle*Math.PI/180)<1e-10);right.gamepad.axes[2]=0;right.gamepad.axes[3]=1;update();right.gamepad.axes[2]=-1;update();assert.ok(Math.abs(rig.rotation.y+angle*Math.PI/180)<1e-10);
 right.gamepad.axes[2]=right.gamepad.axes[3]=0;update();right.gamepad.axes[2]=-1;update();assert.ok(Math.abs(rig.rotation.y)<1e-10);assert.equal(nav.settings.turnSpeed,1);}
});
test('tracking loss, reconnect and reset absorb held sticks; smooth mode still turns continuously',()=>{
 const rig=new THREE.Group(),nav=new Locomotion(rig),snap=new SnapTurn(),right=source(),v={position:new THREE.Vector3(),orientation:new THREE.Quaternion()},settings={snapTurn:true,snapAngle:30};
 snap.update(nav,.01,[right],v,settings);right.gamepad.axes[2]=1;snap.update(nav,.01,[right],v,settings,()=>false);snap.update(nav,.01,[right],v,settings);assert.equal(rig.rotation.y,0);
 right.gamepad.axes[2]=0;snap.update(nav,.01,[right],v,settings);snap.reset();right.gamepad.axes[2]=1;snap.update(nav,.01,[right],v,settings);assert.equal(rig.rotation.y,0);
 settings.snapTurn=false;snap.update(nav,.01,[right],v,settings);const first=rig.rotation.y;snap.update(nav,.01,[right],v,settings);assert.ok(rig.rotation.y<first);
});

test('Teleport mode blocks left-stick translation while preserving smooth and snap rotation',()=>{
 for(const snapping of [false,true]){const rig=new THREE.Group(),nav=new Locomotion(rig),snap=new SnapTurn(),right=source(),left={handedness:'left',gamepad:{mapping:'xr-standard',axes:[0,0,1,-1]}},v={position:new THREE.Vector3(),orientation:new THREE.Quaternion()},settings={teleport:true,snapTurn:snapping,snapAngle:30};
 snap.update(nav,.01,[left,right],v,settings);right.gamepad.axes[2]=1;snap.update(nav,.01,[left,right],v,settings);assert.deepEqual(rig.position.toArray(),[0,0,0]);assert.ok(rig.rotation.y<0);settings.teleport=false;snap.update(nav,.01,[left,right],v,settings);assert.ok(rig.position.length()>0);}
});

test('both controllers turn identically in Teleport mode, including while holding up',()=>{
 for(const hand of ['left','right'])for(const snapping of [false,true]){const rig=new THREE.Group(),nav=new Locomotion(rig),turn=new SnapTurn(),s=source();s.handedness=hand;s.gamepad.axes[3]=-1;const v={position:new THREE.Vector3(.2,1,0),orientation:new THREE.Quaternion()},settings={teleport:true,snapTurn:snapping,snapAngle:30};
 const update=()=>turn.update(nav,.01,[s],v,settings);update();s.gamepad.axes[2]=1;update();const first=rig.rotation.y;assert.ok(first<0);update();if(snapping)assert.equal(rig.rotation.y,first);else assert.ok(rig.rotation.y<first);s.gamepad.axes[2]=0;update();const centered=rig.rotation.y;s.gamepad.axes[2]=-1;update();assert.ok(rig.rotation.y>centered);}
});
test('simultaneous controller turns do not double rotation and opposing inputs cancel',()=>{
 for(const snapping of [false,true]){const rig=new THREE.Group(),nav=new Locomotion(rig),turn=new SnapTurn(),left=source(),right=source();left.handedness='left';const v={position:new THREE.Vector3(),orientation:new THREE.Quaternion()},settings={teleport:true,snapTurn:snapping,snapAngle:30};
 turn.update(nav,.01,[left,right],v,settings);left.gamepad.axes[2]=right.gamepad.axes[2]=1;turn.update(nav,.01,[left,right],v,settings);const expected=snapping?-Math.PI/6:-nav.settings.turnSpeed*.01;assert.ok(Math.abs(rig.rotation.y-expected)<1e-9);left.gamepad.axes[2]=right.gamepad.axes[2]=0;turn.update(nav,.01,[left,right],v,settings);left.gamepad.axes[2]=-1;right.gamepad.axes[2]=1;const before=rig.rotation.y;turn.update(nav,.01,[left,right],v,settings);assert.equal(rig.rotation.y,before);}
});
