import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../../../shared/vendor/three-r180/three.module.js';
import {Locomotion} from '../../../shared/xr/locomotion.mjs';
import {GroundNavigation} from '../ground-navigation.mjs';
const source=handedness=>({handedness,gamepad:{mapping:'xr-standard',axes:[0,0,0,0]}});
const world={extent:1920,height:()=>10,normal:(x,z,out)=>Object.assign(out,{x:0,y:1,z:0,slope:0})};
const settings={teleport:true,snapTurn:true,snapAngle:30};
function setup(){const ground=new GroundNavigation(new T.Scene(),world),rig=new T.Group(),nav=new Locomotion(rig),viewer={position:new T.Vector3(.6,2,-.4),orientation:new T.Quaternion()};rig.position.set(50,10,-20);rig.rotation.y=.8;return {ground,rig,nav,viewer};}
test('snap turns pivot around physical head and require neutral after holds/reset/reconnection',()=>{
 const {ground,rig,nav,viewer}=setup(),right=source('right');
 const tick=()=>ground.update(nav,.02,[right],viewer,settings,()=>true,()=>false);
 right.gamepad.axes[2]=1;tick();assert.equal(rig.rotation.y,.8);
 right.gamepad.axes[2]=0;tick();const before=viewer.position.clone().applyMatrix4(rig.matrixWorld);
 right.gamepad.axes[2]=1;tick();assert.ok(Math.abs(rig.rotation.y-(.8-Math.PI/6))<1e-9);
 assert.ok(before.distanceTo(viewer.position.clone().applyMatrix4(rig.matrixWorld))<1e-9);
 tick();assert.ok(Math.abs(rig.rotation.y-(.8-Math.PI/6))<1e-9);
 ground.reset();tick();assert.ok(Math.abs(rig.rotation.y-(.8-Math.PI/6))<1e-9);
});
test('teleport release uses authoritative elevation and current rotated head offset; held/disconnected inputs cancel',()=>{
 const {ground,rig,nav,viewer}=setup(),left=source('left');
 const ray=(s,o,d)=>{o.copy(viewer.position).applyMatrix4(rig.matrixWorld);d.set(0,-.5,-1).normalize();return true;};
 const tick=(tracked=true)=>ground.update(nav,.02,[left],viewer,settings,()=>tracked,ray);
 left.gamepad.axes[3]=-1;assert.equal(tick(),false);assert.equal(ground.active,false);
 left.gamepad.axes[3]=0;tick();left.gamepad.axes[3]=-1;tick();assert.equal(ground.valid,true);
 const destination=ground.destination.clone();left.gamepad.axes[3]=0;assert.equal(tick(),true);
 const head=viewer.position.clone().applyMatrix4(rig.matrixWorld);assert.ok(Math.hypot(head.x-destination.x,head.z-destination.z)<1e-9);assert.equal(rig.position.y,10);assert.equal(ground.arc.visible,false);
 left.gamepad.axes[3]=0;tick();left.gamepad.axes[3]=-1;tick();tick(false);assert.equal(ground.active,false);assert.equal(ground.marker.visible,false);
});
test('range includes elevation and rejects steep/out-of-bounds targets',()=>{
 const {ground}=setup(),origin=new T.Vector3(0,12,0),direction=new T.Vector3(0,0,-1),head=origin.clone();
 ground.aim(origin,direction,head,10);assert.equal(ground.valid,true);
 ground.aim(origin,direction,head,-10);assert.equal(ground.valid,false,'vertical displacement counts toward fifteen metres');
 const raised=new T.Vector3(0,.45,-1).normalize();ground.aim(origin,raised,head,10);
 assert.equal(ground.valid,true);assert.ok(ground.destination.distanceTo(new T.Vector3(0,10,0))>14,'arc reaches the extended range');
 ground.world={...world,normal:(x,z,out)=>Object.assign(out,{x:0,y:1,z:0,slope:36})};ground.aim(origin,direction,head,10);assert.equal(ground.valid,false);
 ground.world={...world,extent:1};ground.aim(origin,direction,head,10);assert.equal(ground.valid,false);
});
test('smooth mode preserves shared movement and smooth turning',()=>{
 const {ground,rig,nav,viewer}=setup(),left=source('left'),right=source('right');left.gamepad.axes[3]=-1;right.gamepad.axes[2]=1;
 const before=rig.position.clone();ground.update(nav,.02,[left,right],viewer,{...settings,teleport:false,snapTurn:false},()=>true,()=>false);
 assert.notDeepEqual(rig.position.toArray(),before.toArray());assert.ok(rig.rotation.y<.8);assert.equal(ground.active,false);
});

test('smooth turning respects all four angular speeds at full stick',()=>{
 for(const turnSpeed of [30,60,90,120]){
  const {ground,rig,nav,viewer}=setup(),right=source('right');right.gamepad.axes[2]=1;
  ground.update(nav,.02,[right],viewer,{...settings,snapTurn:false,turnSpeed},()=>true,()=>false);
  assert.ok(Math.abs(rig.rotation.y-(.8-turnSpeed*Math.PI/180*.02))<1e-9);
 }
});

test('either hand owns its teleport until release; other hand cannot steal or commit it',()=>{
 for(const hand of ['left','right']){
  const {ground,rig,nav,viewer}=setup(),owner=source(hand),other=source(hand==='left'?'right':'left');let aimed=null;
  const tick=()=>ground.update(nav,.02,[owner,other],viewer,settings,()=>true,(s,o,d)=>{aimed=s;o.copy(viewer.position).applyMatrix4(rig.matrixWorld);d.set(0,-.5,-1).normalize();return true;});
  tick();owner.gamepad.axes[3]=-1;tick();assert.equal(aimed,owner);assert.equal(ground.active,true);
  other.gamepad.axes[3]=-1;tick();assert.equal(aimed,owner);
  other.gamepad.axes[3]=0;assert.equal(tick(),false);assert.equal(ground.active,true);
  owner.gamepad.axes[3]=0;assert.equal(tick(),true);assert.equal(ground.active,false);
 }
});
test('either stick turns in teleport mode; simultaneous inputs do not double and equal opposites cancel',()=>{
 for(const snapTurn of [true,false])for(const [leftX,rightX,sign] of [[1,0,1],[0,-1,-1],[1,1,1],[1,-1,0]]){
  const {ground,rig,nav,viewer}=setup(),left=source('left'),right=source('right'),values={...settings,snapTurn,turnSpeed:60};
  const tick=()=>ground.update(nav,.02,[left,right],viewer,values,()=>true,()=>false);
  tick();left.gamepad.axes[2]=leftX;right.gamepad.axes[2]=rightX;tick();
  const amount=snapTurn?Math.PI/6:60*Math.PI/180*.02;
  assert.ok(Math.abs(rig.rotation.y-(.8-sign*amount))<1e-9);
 }
});
test('smooth movement with snap turning reserves left stick for strafe and right stick for snaps',()=>{
 const {ground,rig,nav,viewer}=setup(),left=source('left'),right=source('right'),values={...settings,teleport:false};
 const tick=()=>ground.update(nav,.02,[left,right],viewer,values,()=>true,()=>false);
 tick();left.gamepad.axes[2]=1;left.gamepad.axes[3]=-1;const before=rig.position.clone();tick();
 assert.equal(rig.rotation.y,.8);assert.ok(rig.position.distanceTo(before)>0);assert.equal(ground.active,false);
 right.gamepad.axes[2]=1;tick();assert.ok(Math.abs(rig.rotation.y-(.8-Math.PI/6))<1e-9);
});
