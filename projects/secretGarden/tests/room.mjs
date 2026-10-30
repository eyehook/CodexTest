import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../../shared/vendor/three-r180/three.module.js';
import {createEnvironment} from '../environment.mjs';
import {PlantManager} from '../manager.mjs';
import {ROOM_SIZE,ROOM_HEIGHT,ROOM_FRONT,ROOM_BACK,DOOR_WIDTH,DOOR_HEIGHT,DOOR_Z,GARDEN_FRONT,HALL_LENGTH,HALL_WIDTH,HALL_HEIGHT,HALL_ENTRY_INSET,constrainPosition} from '../garden-layout.mjs';
import {componentPose} from '../generator.mjs';

test('recessed doorway connects to an enclosed 12 foot room and all interior targets reject planting',()=>{
 const scene=new THREE.Scene(),env=createEnvironment(scene,{shadowMap:{}});scene.updateMatrixWorld(true);
 assert.equal(env.room.staticMeshes.length,2);assert.equal(ROOM_SIZE,3.6576);assert.ok(Math.abs(ROOM_BACK-ROOM_FRONT-3.6576)<1e-9);
 const center=new THREE.Vector3(0,1.3,(ROOM_FRONT+ROOM_BACK)/2);
 const rays=[new THREE.Vector3(1,0,0),new THREE.Vector3(-1,0,0),new THREE.Vector3(0,1,0),new THREE.Vector3(0,-1,0),new THREE.Vector3(0,0,-1)];
 for(const direction of rays){
  const hit=new THREE.Raycaster(center,direction).intersectObjects(env.targets,true)[0];assert.ok(hit);
  assert.equal(hit.object.userData.surface,'environment');assert.equal(hit.object.userData.wallSurface,undefined);
  if(direction.y>0)assert.ok(Math.abs(hit.point.y-ROOM_HEIGHT)<1e-6);
 }
 const manager=new PlantManager({create:()=>({}),update:()=>{},remove:()=>{}},()=>10);
 assert.equal(manager.plant(new THREE.Vector3(0,0,center.z),0),null);
 assert.equal(manager.plant(center,0,{type:'environment'}),null);
 const support=env.walls[0].userData.wallSurface;
 assert.equal(manager.plant(new THREE.Vector3(0,1,GARDEN_FRONT),0,support),null);
 assert.equal(manager.instances.size,0);
});

test('door opens from either side, closes away, and leaves a clear passage',()=>{
 const scene=new THREE.Scene(),env=createEnvironment(scene,{shadowMap:{}}),room=env.room;
 const toward=new THREE.Raycaster(new THREE.Vector3(0,1.2,GARDEN_FRONT-1),new THREE.Vector3(0,0,1));
 scene.updateMatrixWorld(true);let hit=toward.intersectObjects(env.targets,true)[0];assert.equal(hit.object,room.leaf);assert.ok(hit.point.z>GARDEN_FRONT+.2);
 for(let i=0;i<90;i++)room.update(1/90,new THREE.Vector3(0,1.6,DOOR_Z+.7));
 assert.equal(room.fraction,1);assert.equal(room.passable,true);scene.updateMatrixWorld(true);
 hit=toward.intersectObjects(env.targets,true)[0];assert.notEqual(hit.object,room.leaf);assert.ok(hit.point.z>ROOM_FRONT);
 for(let i=0;i<90;i++)room.update(1/90,new THREE.Vector3(0,1.6,0));assert.equal(room.fraction,0);
 for(let i=0;i<90;i++)room.update(1/90,new THREE.Vector3(0,1.6,DOOR_Z-.7));assert.equal(room.passable,true);
});

test('viewer crosses only the doorway and stays inside the room or garden',()=>{
 let position={x:0,z:GARDEN_FRONT-.6};
 for(let i=0;i<240;i++)position=constrainPosition(position.x,position.z+.04,true);
 assert.ok(Math.abs(position.z-(ROOM_BACK-.18))<1e-8);
 for(let i=0;i<320;i++)position=constrainPosition(position.x,position.z-.04,true);
 assert.ok(position.z<GARDEN_FRONT-.3);
 position={x:0,z:DOOR_Z-.2};for(let i=0;i<100;i++)position=constrainPosition(position.x,position.z+.04,false);
 assert.ok(position.z<=DOOR_Z-.12+1e-8);
 position={x:DOOR_WIDTH/2+.4,z:GARDEN_FRONT-.4};for(let i=0;i<50;i++)position=constrainPosition(position.x,position.z+.04,true);
 assert.ok(position.z<=GARDEN_FRONT-.18+1e-8);
});

test('vines and their visible foliage stay clear of the doorway even when arriving from an adjacent wall',()=>{
 const scene=new THREE.Scene(),env=createEnvironment(scene,{shadowMap:{}});
 const manager=new PlantManager({create:()=>({}),update:()=>{},remove:()=>{}},()=>15,()=>0,()=>1.2);
 for(let seed=0;seed<80;seed++)for(const side of [0,1]){
  const point=side===0?new THREE.Vector3(-1.15,1,GARDEN_FRONT):new THREE.Vector3(4.572,1,GARDEN_FRONT-.3);
  manager.clonedSeed=seed;manager.clonedSurface='wall';const p=manager.plant(point,0,env.walls[side].userData.wallSurface);assert.ok(p);
  const transform=new THREE.Matrix4().compose(p.position,new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),p.rotationY),new THREE.Vector3(p.scale,p.scale,p.scale));
  const poses=componentPose(p.structure,10);
  for(const part of p.structure.parts){
   const samples=part.kind==='stem'?[poses[part.id].anchor,poses[part.id].end]:[poses[part.id].anchor];
   for(const sample of samples){const w=new THREE.Vector3().fromArray(sample).applyMatrix4(transform);
    if(Math.abs(w.z-GARDEN_FRONT)<.2)assert.ok(Math.abs(w.x)>DOOR_WIDTH/2+.2||w.y>DOOR_HEIGHT+.2);
   }
  }
 }
});

test('six foot hallway has centered door and inset surfaces to avoid coplanar seams',()=>{
 const scene=new THREE.Scene(),env=createEnvironment(scene,{shadowMap:{}});
 assert.equal(HALL_LENGTH,1.8288);assert.ok(Math.abs(ROOM_FRONT-GARDEN_FRONT-1.8288)<1e-9);
 assert.ok(Math.abs(DOOR_Z-GARDEN_FRONT-.9144)<1e-9);assert.ok(Math.abs(ROOM_FRONT-DOOR_Z-.9144)<1e-9);
 assert.ok(HALL_WIDTH<DOOR_WIDTH);assert.ok(HALL_HEIGHT<DOOR_HEIGHT);assert.ok(HALL_ENTRY_INSET>0);
 assert.equal(env.room.hinge.position.z,DOOR_Z);
 const hallwayWalls=env.room.targets.filter(mesh=>Math.abs(mesh.geometry.parameters?.depth-(HALL_LENGTH-HALL_ENTRY_INSET))<1e-9&&mesh.geometry.parameters?.width===.12);
 assert.equal(hallwayWalls.length,2);
 for(const wall of hallwayWalls){
  assert.ok(Math.abs(wall.position.x)-.06<DOOR_WIDTH/2);
  assert.ok(wall.position.z-wall.geometry.parameters.depth/2>GARDEN_FRONT+.01);
 }
});

test('double-action door opens away from approach, stays stable when crossed, and has cube handles on both faces',()=>{
 const scene=new THREE.Scene(),room=createEnvironment(scene,{shadowMap:{}}).room;
 const advance=(z,count=90)=>{for(let i=0;i<count;i++)room.update(1/90,new THREE.Vector3(0,1.6,z));};
 assert.equal(room.handles.length,2);assert.ok(room.handles[0].position.z<0&&room.handles[1].position.z>0);
 for(const handle of room.handles)assert.equal(handle.geometry.type,'BoxGeometry');
 advance(DOOR_Z+.7);assert.ok(room.hinge.rotation.y>0);assert.equal(room.fraction,1);
 advance(DOOR_Z-.3);assert.ok(room.hinge.rotation.y>0);assert.equal(room.fraction,1);
 advance(DOOR_Z-3);assert.equal(room.fraction,0);
 advance(DOOR_Z-.7);assert.ok(room.hinge.rotation.y<0);assert.equal(room.fraction,1);
 advance(DOOR_Z+3,15);assert.ok(room.fraction>0&&room.fraction<1);
 const before=room.hinge.rotation.y;room.update(1/90,new THREE.Vector3(0,1.6,DOOR_Z+.7));
 assert.ok(room.hinge.rotation.y<0&&room.hinge.rotation.y>before);
 advance(DOOR_Z+.7,180);assert.ok(room.hinge.rotation.y>0);assert.equal(room.fraction,1);
});

test('door complex is behind the starting player and the original forward wall is solid again',()=>{
 const scene=new THREE.Scene(),env=createEnvironment(scene,{shadowMap:{}});scene.updateMatrixWorld(true);
 const start=new THREE.Vector3(0,1.6,2.1);assert.ok(DOOR_Z>start.z);assert.ok(ROOM_FRONT>DOOR_Z&&ROOM_BACK>ROOM_FRONT);
 const forward=new THREE.Raycaster(start,new THREE.Vector3(0,0,-1)).intersectObjects(env.targets,true)[0];
 assert.equal(forward.object,env.walls[2]);assert.equal(forward.object.geometry.type,'BoxGeometry');
 const rear=new THREE.Raycaster(start,new THREE.Vector3(0,0,1)).intersectObjects(env.targets,true)[0];
 assert.equal(rear.object,env.room.leaf);assert.ok(rear.point.z>GARDEN_FRONT);
});


test('door fits the closed opening and its hinge seam stays fixed through both swings',()=>{
 const scene=new THREE.Scene(),room=createEnvironment(scene,{shadowMap:{}}).room;
 const axis=new THREE.Vector3(-HALL_WIDTH/2,HALL_HEIGHT/2,DOOR_Z);
 const checkAxis=()=>{
  scene.updateMatrixWorld(true);
  assert.ok(new THREE.Vector3(0,HALL_HEIGHT/2,0).applyMatrix4(room.hinge.matrixWorld).distanceTo(axis)<1e-10);
  assert.ok(room.hingeStile.getWorldPosition(new THREE.Vector3()).distanceTo(axis)<1e-10);
 };
 const checkClosed=()=>{
  assert.equal(room.fraction,0);assert.equal(Math.abs(room.hinge.rotation.y),0);
  scene.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(room.leaf);
  assert.ok(Math.abs(bounds.min.x+HALL_WIDTH/2)<1e-6);assert.ok(Math.abs(bounds.max.x-HALL_WIDTH/2)<1e-6);
  assert.ok(Math.abs(bounds.min.y)<1e-6);assert.ok(Math.abs(bounds.max.y-HALL_HEIGHT)<1e-6);
  for(const x of [-HALL_WIDTH/2+.001,0,HALL_WIDTH/2-.001])for(const y of [.001,HALL_HEIGHT/2,HALL_HEIGHT-.001]){
   const ray=new THREE.Raycaster(new THREE.Vector3(x,y,DOOR_Z-.3),new THREE.Vector3(0,0,1));
   assert.ok(ray.intersectObjects([room.leaf,room.hingeStile]).length>0);
  }
 };
 checkClosed();
 for(const side of [-1,1]){
  for(let i=0;i<60;i++){room.update(1/90,new THREE.Vector3(0,1.6,DOOR_Z+side*.7));checkAxis();}
  assert.equal(room.fraction,1);
  for(let i=0;i<60;i++){room.update(1/90,new THREE.Vector3(0,1.6,DOOR_Z+side*3));checkAxis();}
  checkClosed();
 }
});
