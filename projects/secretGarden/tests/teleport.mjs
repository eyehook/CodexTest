import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../../shared/vendor/three-r180/three.module.js';
import {Teleport} from '../teleport.mjs';
import {SnapTurn} from '../snap-turn.mjs';
import {Locomotion} from '../../../shared/xr/locomotion.mjs';
import {createGardenRoom} from '../garden-room.mjs';
import {DOOR_Z,ROOM_FRONT,ROOM_BACK,HALF_WIDTH} from '../garden-layout.mjs';
const source=()=>({handedness:'left',gamepad:{mapping:'xr-standard',axes:[0,0,0,0]}});
function hit(x=0,y=0,z=0,normal=new THREE.Vector3(0,1,0)){const object=new THREE.Object3D();object.updateMatrixWorld();return {point:new THREE.Vector3(x,y,z),face:{normal},object};}
test('up activates, release teleports head to target preserving yaw, head offset and height',()=>{
 const t=new Teleport(new THREE.Scene()),s=source(),rig=new THREE.Group(),head=new THREE.Vector3(.3,1.2,.2);rig.position.set(1,.5,2);rig.rotation.y=1;
 t.sample(s);s.gamepad.axes[3]=-.8;t.sample(s);assert.equal(t.active,true);t.aim(hit(2,0,-3),false);assert.equal(t.marker.material.opacity,.5);assert.equal(t.valid,true);assert.equal(t.finish(rig,head),false);
 s.gamepad.axes[3]=0;t.sample(s);assert.equal(t.finish(rig,head),true);const world=head.clone().applyMatrix4(rig.matrixWorld);assert.ok(Math.abs(world.x-2)<1e-9&&Math.abs(world.z+3)<1e-9);assert.equal(rig.position.y,.5);assert.equal(rig.rotation.y,1);assert.equal(t.marker.visible,false);
});
test('invalid hits, walls, outer edges and target loss cancel release; room floors are valid',()=>{
 const t=new Teleport(new THREE.Scene()),s=source(),rig=new THREE.Group();t.sample(s);s.gamepad.axes[3]=-1;t.sample(s);
 for(const h of [hit(0,1,0,new THREE.Vector3(0,0,1)),hit(HALF_WIDTH-.05),hit(0,0,ROOM_BACK+1),null]){t.aim(h,false);assert.equal(t.valid,false);}
 t.aim(hit(0,0,(ROOM_FRONT+ROOM_BACK)/2),false);assert.equal(t.valid,true);t.aim(null,false);s.gamepad.axes[3]=0;t.sample(s);assert.equal(t.finish(rig,new THREE.Vector3()),false);assert.deepEqual(rig.position.toArray(),[0,0,0]);
});
test('entry and tracking resume absorb held up; tracking loss cancels without teleport',()=>{
 const t=new Teleport(new THREE.Scene()),s=source();s.gamepad.axes[3]=-1;t.sample(s);t.sample(s);assert.equal(t.active,false);s.gamepad.axes[3]=0;t.sample(s);s.gamepad.axes[3]=-1;t.sample(s);assert.equal(t.active,true);t.sample(null);assert.equal(t.active,false);t.sample(s,true);assert.equal(t.active,false);
});
test('left-stick teleport keeps right-stick turning independent',()=>{
 const rig=new THREE.Group(),nav=new Locomotion(rig),snap=new SnapTurn(),left=source(),right={...source(),handedness:'right',gamepad:{mapping:'xr-standard',axes:[0,0,0,0]}},viewer={position:new THREE.Vector3(),orientation:new THREE.Quaternion()},settings={teleport:true,snapTurn:true,snapAngle:30},t=new Teleport(new THREE.Scene());
 t.sample(left);left.gamepad.axes[3]=-1;t.sample(left);assert.equal(t.active,true);
 const update=()=>snap.update(nav,.01,[left,right],viewer,settings);
 update();right.gamepad.axes[2]=1;update();assert.ok(Math.abs(rig.rotation.y+Math.PI/6)<1e-9);right.gamepad.axes[2]=0;update();right.gamepad.axes[2]=-1;update();assert.ok(Math.abs(rig.rotation.y)<1e-9);assert.equal(t.active,true);
 settings.snapTurn=false;right.gamepad.axes[2]=1;update();assert.ok(rig.rotation.y<0);assert.deepEqual(rig.position.toArray(),[0,0,0]);
});

test('door leaf and handles target hallway midpoint and open fully only on valid release from either side',()=>{
 for(const side of [-1,1]){const scene=new THREE.Scene(),room=createGardenRoom(scene),t=new Teleport(scene),s=source(),rig=new THREE.Group(),head=new THREE.Vector3(.2,1.4,.1);rig.position.z=DOOR_Z+side*2;rig.rotation.y=.4;
 t.sample(s);s.gamepad.axes[3]=-1;t.sample(s);
 for(const object of [room.leaf,room.hingeStile,...room.handles]){t.aim({...hit(.4,1,DOOR_Z+.02),object},false,room);assert.equal(t.valid,true);assert.deepEqual(t.destination.toArray(),[0,0,DOOR_Z]);assert.deepEqual(t.marker.position.toArray(),[0,.8,DOOR_Z]);}
 assert.equal(room.fraction,0);assert.equal(t.finish(rig,head),false);assert.equal(room.fraction,0);
 s.gamepad.axes[3]=0;t.sample(s);assert.equal(t.finish(rig,head),true);assert.equal(room.fraction,1);assert.equal(room.passable,true);assert.equal(room.hinge.rotation.y,side*Math.PI/2);const world=head.clone().applyMatrix4(rig.matrixWorld);assert.ok(Math.hypot(world.x,world.z-DOOR_Z)<1e-9);room.update(.05,world);assert.equal(room.fraction,1);
 }
});
test('leaving a door target clears its special action and does not open it on an invalid release',()=>{
 const scene=new THREE.Scene(),room=createGardenRoom(scene),t=new Teleport(scene),s=source();t.sample(s);s.gamepad.axes[3]=-1;t.sample(s);t.aim({...hit(),object:room.leaf},false,room);t.aim(hit(0,1,0,new THREE.Vector3(1,0,0)),false,room);s.gamepad.axes[3]=0;t.sample(s);assert.equal(t.finish(new THREE.Group(),new THREE.Vector3()),false);assert.equal(room.fraction,0);
});

test('either stick initiates and keeps ownership until its release; held other hand cannot steal',()=>{
 for(const hand of ['left','right']){const t=new Teleport(new THREE.Scene()),left=source(),right={...source(),handedness:'right'},owner=hand==='left'?left:right,other=hand==='left'?right:left;right.gamepad={mapping:'xr-standard',axes:[0,0,0,0]};t.sampleSources([left,right]);owner.gamepad.axes[3]=-1;t.sampleSources([left,right]);assert.equal(t.source,owner);assert.equal(t.active,true);other.gamepad.axes[3]=-1;t.sampleSources([left,right]);assert.equal(t.source,owner);owner.gamepad.axes[3]=0;t.sampleSources([left,right]);assert.equal(t.releasing,true);t.finish(new THREE.Group(),new THREE.Vector3());t.sampleSources([left,right]);assert.equal(t.active,false);other.gamepad.axes[3]=0;t.sampleSources([left,right]);other.gamepad.axes[3]=-1;t.sampleSources([left,right]);assert.equal(t.source,other);}
});
test('simultaneous starts choose one owner consistently and tracking loss cancels',()=>{
 for(const reverse of [false,true]){const t=new Teleport(new THREE.Scene()),left=source(),right={handedness:'right',gamepad:{mapping:'xr-standard',axes:[0,0,0,0]}},sources=reverse?[right,left]:[left,right];t.sampleSources(sources);left.gamepad.axes[3]=right.gamepad.axes[3]=-1;t.sampleSources(sources);assert.equal(t.source,left);t.sampleSources(sources,false,s=>s!==left);assert.equal(t.active,false);t.sampleSources(sources);assert.equal(t.active,false);}
});
