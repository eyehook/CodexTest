import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../../shared/vendor/three-r180/three.module.js';
import {doorwayPlantingBlocked} from '../garden-layout.mjs';
import {Bees,flowerLandings} from '../bees.mjs';
function plant(id,count=100){return {id,state:'growing',position:new THREE.Vector3(1,0,2),rotationY:Math.PI/2,scale:2,structure:{parts:Array.from({length:count},(_,id)=>({id,kind:'flower',parent:null,start:[id*.1,1,0],normal:[0,0,1],size:.1,begin:0,duration:1}))}};}
function garden(p){return {instances:new Map([[p.id,p]]),growing:new Set([p]),revision:1};}
test('landing points are created only at maturity, with transformed surface positions and normals',()=>{
 const p=plant(1);assert.deepEqual(flowerLandings(p),[]);p.state='mature';const points=flowerLandings(p);
 assert.equal(points.length,100);assert.ok(points[0].position.distanceTo(new THREE.Vector3(1.038,2,2))<1e-8);assert.ok(points[0].normal.distanceTo(new THREE.Vector3(1,0,0))<1e-8);
 p.structure.parts[0].volume=true;assert.ok(Math.abs(flowerLandings(p)[0].position.x-1.33)<1e-8);
});
test('exact population survives growth, deletion and reset with mature-only flower targets',()=>{
 const b=new Bees(new THREE.Scene(),()=>.4),p=plant(1),g=garden(p);b.update(g,0);assert.equal(b.landings.length,0);assert.equal(b.bees.length,3);assert.ok(b.bees.every(bee=>bee.target.wall));
 p.state='mature';g.growing.clear();b.update(g,10);assert.equal(b.landings.length,100);assert.equal(b.bees.length,3);assert.ok(b.bees.every(bee=>bee.target.plantId===1));
 g.instances.clear();g.revision++;b.update(g,11);assert.equal(b.landings.length,0);assert.equal(b.bees.length,3);assert.ok(b.bees.every(bee=>bee.target.wall));assert.equal(b.bodies.count,3);assert.equal(b.wings.count,6);b.dispose();
});
test('flights have finite curved paths, land exactly, rest 2–5 seconds and visit another flower',()=>{
 const b=new Bees(new THREE.Scene(),()=>.4),p=plant(1,100),g=garden(p);p.state='mature';g.growing.clear();b.update(g,0);
 const bee=b.bees[0],first=bee.target;b.update(g,4);assert.equal(bee.flying,true);assert.notEqual(bee.target,first);
 const midpoint=new THREE.Vector3();b.flight(bee,.5,midpoint);assert.ok(midpoint.y>bee.start.y);assert.ok(midpoint.toArray().every(Number.isFinite));
 const arrival=bee.began+bee.duration;b.update(g,arrival);assert.equal(bee.flying,false);assert.ok(bee.position.distanceTo(bee.end)<1e-8);assert.ok(bee.until-arrival>=2&&bee.until-arrival<=5);
 const resting=bee.position.clone();b.update(g,arrival+1);assert.ok(bee.position.equals(resting));assert.equal(b.bodies.castShadow,false);assert.equal(b.wings.castShadow,false);
 assert.equal(b.bodies.count,3);assert.equal(b.wings.count,6);assert.ok([...b.bodies.instanceMatrix.array,...b.wings.instanceMatrix.array].every(Number.isFinite));b.dispose();
});

test('Off hides both batches, skips updates and resynchronizes changes on enable',()=>{
 const b=new Bees(new THREE.Scene(),()=>.4),p=plant(1,100),g=garden(p);p.state='mature';g.growing.clear();b.update(g,0);
 b.setCount(0);assert.equal(b.enabled,false);assert.equal(b.bodies.visible,false);assert.equal(b.wings.visible,false);
 const revision=b.revision;b.update(g,20);assert.equal(b.revision,revision);assert.equal(b.bees.length,0);
 g.instances.clear();g.revision++;b.update(g,21);b.setCount(2);b.update(g,22);
 assert.equal(b.enabled,true);assert.equal(b.bodies.visible,true);assert.equal(b.wings.visible,true);assert.equal(b.bees.length,2);assert.equal(b.landings.length,0);b.dispose();
});

test('0–10 selector sets the exact population without any flowers',()=>{
 const b=new Bees(new THREE.Scene()),g={instances:new Map(),growing:new Set(),revision:0};
 for(let count=0;count<=10;count++){b.setCount(count);b.update(g,0);assert.equal(b.count,count);assert.equal(b.bees.length,count);assert.ok(b.bees.every(bee=>bee.target.wall));}
 b.setCount(11);assert.equal(b.count,10);b.dispose();
});
test('wall fallback points are interior, oriented inward and avoid the doorway',()=>{
 const b=new Bees(new THREE.Scene());for(let i=0;i<200;i++){const point=b.wallLanding();assert.ok(point.wall);assert.equal(doorwayPlantingBlocked(point.position),false);assert.equal(point.normal.length(),1);assert.ok(point.position.y>0&&point.position.y<3.048);assert.ok(Math.abs(point.position.x)<4.572&&Math.abs(point.position.z)<6.858);}
 const flower={position:new THREE.Vector3(),normal:new THREE.Vector3(0,1,0)};b.landings=[flower];assert.equal(b.pick(),flower);assert.ok(b.pick(flower).wall);b.dispose();
});
test('arrival position, surface orientation and wing pose converge before touchdown on floor and wall blooms',()=>{
 for(const normal of [[0,1,0],[1,0,0],[0,0,-1]]){
  const b=new Bees(new THREE.Scene(),()=>.4),p=plant(1),g=garden(p);for(const part of p.structure.parts)part.normal=normal;p.state='mature';g.growing.clear();b.update(g,0);b.update(g,4);
  const bee=b.bees[0],arrival=bee.began+bee.duration;
  b.update(g,arrival-1/90);const before=bee.position.clone(),rotation=bee.quaternion.clone(),wingBefore=new THREE.Matrix4();b.wings.getMatrixAt(0,wingBefore);
  b.update(g,arrival);const wingAfter=new THREE.Matrix4();b.wings.getMatrixAt(0,wingAfter);
  assert.ok(before.distanceTo(bee.position)<.001,'final frame should settle without a position jump');
  assert.ok(rotation.angleTo(bee.quaternion)<.01,'orientation must already match the flower at arrival');
  assert.ok(new THREE.Vector3(0,1,0).applyQuaternion(bee.quaternion).distanceTo(bee.target.normal)<1e-8);
  assert.ok(wingBefore.elements.every((v,i)=>Math.abs(v-wingAfter.elements[i])<.01),'wings must settle before arrival');
  const endRotation=bee.quaternion.clone();b.update(g,arrival+.5);assert.ok(bee.position.equals(bee.end));assert.ok(endRotation.angleTo(bee.quaternion)<1e-7);
  b.dispose();
 }
});
