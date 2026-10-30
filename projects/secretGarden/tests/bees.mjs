import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../../shared/vendor/three-r180/three.module.js';
import {Bees,flowerLandings} from '../bees.mjs';
function plant(id,count=100){return {id,state:'growing',position:new THREE.Vector3(1,0,2),rotationY:Math.PI/2,scale:2,structure:{parts:Array.from({length:count},(_,id)=>({id,kind:'flower',parent:null,start:[id*.1,1,0],normal:[0,0,1],size:.1,begin:0,duration:1}))}};}
function garden(p){return {instances:new Map([[p.id,p]]),growing:new Set([p]),revision:1};}
test('landing points are created only at maturity, with transformed surface positions and normals',()=>{
 const p=plant(1);assert.deepEqual(flowerLandings(p),[]);p.state='mature';const points=flowerLandings(p);
 assert.equal(points.length,100);assert.ok(points[0].position.distanceTo(new THREE.Vector3(1.038,2,2))<1e-8);assert.ok(points[0].normal.distanceTo(new THREE.Vector3(1,0,0))<1e-8);
 p.structure.parts[0].volume=true;assert.ok(Math.abs(flowerLandings(p)[0].position.x-1.33)<1e-8);
});
test('population thresholds, growth exclusion, deletion, reset and reused IDs',()=>{
 const scene=new THREE.Scene(),b=new Bees(scene,()=>.4),p=plant(1,199),g=garden(p);b.update(g,0);assert.equal(b.landings.length,0);assert.equal(b.bees.length,0);
 p.state='mature';g.growing.clear();b.update(g,10);assert.equal(b.bees.length,1);assert.equal(b.landings.length,199);
 const q=plant(2,101);g.instances.set(2,q);g.growing.add(q);g.revision++;b.update(g,11);assert.equal(b.bees.length,1);assert.equal(b.landings.length,199);
 q.state='mature';g.growing.clear();b.update(g,21);assert.equal(b.bees.length,3);assert.equal(scene.children.length,2);
 g.instances.delete(1);g.revision++;b.update(g,22);assert.equal(b.bees.length,1);assert.ok(b.bees.every(bee=>bee.target.plantId===2));
 g.instances.clear();g.revision++;b.update(g,23);assert.equal(b.bees.length,0);assert.equal(b.bodies.count,0);assert.equal(b.wings.count,0);
 const fresh=plant(2);g.instances.set(2,fresh);g.growing.add(fresh);g.revision++;b.update(g,24);assert.equal(b.landings.length,0);
 b.dispose();assert.equal(scene.children.length,0);
});
test('flights have finite curved paths, land exactly, rest 2–5 seconds and visit another flower',()=>{
 const b=new Bees(new THREE.Scene(),()=>.4),p=plant(1,100),g=garden(p);p.state='mature';g.growing.clear();b.update(g,0);
 const bee=b.bees[0],first=bee.target;b.update(g,4);assert.equal(bee.flying,true);assert.notEqual(bee.target,first);
 const midpoint=new THREE.Vector3();b.flight(bee,.5,midpoint);assert.ok(midpoint.y>bee.start.y);assert.ok(midpoint.toArray().every(Number.isFinite));
 const arrival=bee.began+bee.duration;b.update(g,arrival);assert.equal(bee.flying,false);assert.ok(bee.position.distanceTo(bee.end)<1e-8);assert.ok(bee.until-arrival>=2&&bee.until-arrival<=5);
 const resting=bee.position.clone();b.update(g,arrival+1);assert.ok(bee.position.equals(resting));assert.equal(b.bodies.castShadow,false);assert.equal(b.wings.castShadow,false);
 assert.equal(b.bodies.count,1);assert.equal(b.wings.count,2);assert.ok([...b.bodies.instanceMatrix.array,...b.wings.instanceMatrix.array].every(Number.isFinite));b.dispose();
});

test('Off hides both batches, skips updates and resynchronizes changes on enable',()=>{
 const b=new Bees(new THREE.Scene(),()=>.4),p=plant(1,100),g=garden(p);p.state='mature';g.growing.clear();b.update(g,0);
 b.setDensity(0);assert.equal(b.enabled,false);assert.equal(b.bodies.visible,false);assert.equal(b.wings.visible,false);
 const revision=b.revision;b.update(g,20);assert.equal(b.revision,revision);assert.equal(b.bees.length,0);
 g.instances.clear();g.revision++;b.update(g,21);b.setDensity(2);b.update(g,22);
 assert.equal(b.enabled,true);assert.equal(b.bodies.visible,true);assert.equal(b.wings.visible,true);assert.equal(b.bees.length,0);assert.equal(b.landings.length,0);b.dispose();
});

test('one bee per 100 mature blooms at exact population boundaries',()=>{
 for(const [flowers,count] of [[99,0],[100,1],[199,1],[200,2]]){
  const b=new Bees(new THREE.Scene()),p=plant(1,flowers),g=garden(p);p.state='mature';g.growing.clear();b.update(g,0);assert.equal(b.bees.length,count);b.dispose();
 }
});

test('density levels use 150/100/50 blooms and refresh population without plant changes',()=>{
 const b=new Bees(new THREE.Scene()),p=plant(1,300),g=garden(p);p.state='mature';g.growing.clear();
 for(const [level,count] of [[2,3],[1,2],[3,6],[0,0],[1,2]]){b.setDensity(level);b.update(g,0);assert.equal(b.bees.length,count);assert.equal(b.enabled,level>0);}
 b.dispose();
});
