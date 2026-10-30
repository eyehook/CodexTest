import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../../shared/vendor/three-r180/three.module.js';
import {PlantRenderer} from '../renderer.mjs';
import {PlantManager} from '../manager.mjs';

function setup(){
  const scene=new THREE.Scene(),renderer=new PlantRenderer(scene);
  let seed=0,yaw=0;
  const manager=new PlantManager(renderer,()=>seed++,()=>yaw+=.37,()=>.84);
  return {scene,renderer,manager};
}
function snapshot(p){
  p.visual.group.updateWorldMatrix(true,true);
  const result=[];
  for(const {mesh,key} of p.visual.batches)for(let i=0;i<mesh.count;i++){
    const local=new THREE.Matrix4();mesh.getMatrixAt(i,local);
    const world=new THREE.Matrix4().multiplyMatrices(mesh.matrixWorld,local),color=new THREE.Color();mesh.getColorAt(i,color);
    result.push({key,matrix:world.toArray(),color:color.toArray()});
  }
  return result;
}
function compare(p,expected){
  assert.equal(p.visual.matureSlots.length,expected.length);
  p.visual.matureSlots.forEach(({pool,index},i)=>{
    assert.equal(pool.key,expected[i].key);
    const matrix=new THREE.Matrix4(),color=new THREE.Color();pool.mesh.getMatrixAt(index,matrix);pool.mesh.getColorAt(index,color);
    matrix.toArray().forEach((v,j)=>assert.ok(Math.abs(v-expected[i].matrix[j])<2e-6));
    assert.deepEqual(color.toArray(),expected[i].color);
  });
}
test('maturity preserves exact geometry, colors, world placement and ray targeting',()=>{
  const {scene,renderer,manager}=setup();
  const a=manager.plant(new THREE.Vector3(1,0,-2),0);manager.copy(a.id);
  const b=manager.plant(new THREE.Vector3(-1,0,1),0);
  renderer.update(a,10);renderer.update(b,10);
  const beforeA=snapshot(a),beforeB=snapshot(b);
  manager.update(10);scene.updateMatrixWorld(true);
  compare(a,beforeA);compare(b,beforeB);
  assert.equal(a.visual.group.parent,null);assert.equal(b.visual.group.parent,null);
  assert.equal(manager.targets.length,2);
  assert.equal(renderer.matureBatches.pools.size,new Set(a.visual.batches.map(b=>b.key)).size);
  // Detached targeting data retains its mature world transforms and plant IDs.
  const mesh=a.visual.batches.find(b=>b.key.startsWith('stem')).mesh,local=new THREE.Matrix4();mesh.getMatrixAt(0,local);
  const center=new THREE.Vector3().applyMatrix4(local).applyMatrix4(mesh.matrixWorld);
  const ray=new THREE.Raycaster(center.clone().add(new THREE.Vector3(0,0,5)),new THREE.Vector3(0,0,-1));
  assert.equal(ray.intersectObjects(manager.targets,true)[0].object.userData.plantId,a.id);
  manager.remove(a.id);manager.remove(b.id);assert.equal(scene.children.length,0);renderer.dispose();
});
test('pool growth and swap deletion preserve surviving plants and release empty batches',()=>{
  const {scene,renderer,manager}=setup(),plants=[],snapshots=new Map();
  for(let i=0;i<60;i++){
    const p=manager.plant(new THREE.Vector3(i%6-2.5,0,-Math.floor(i/6)*.6),0);renderer.update(p,10);
    snapshots.set(p.id,snapshot(p));plants.push(p);
  }
  manager.update(10);
  assert.ok([...renderer.matureBatches.pools.values()].some(p=>p.capacity>64));
  for(const index of [0,25,59,10,40])manager.remove(plants[index].id);
  for(const p of manager.instances.values())compare(p,snapshots.get(p.id));
  for(const pool of renderer.matureBatches.pools.values()){
    assert.equal(pool.mesh.count,pool.slots.length);assert.ok(pool.mesh.boundingSphere.radius>0);
    pool.slots.forEach((handle,i)=>assert.equal(handle.index,i));
  }
  for(const id of [...manager.instances.keys()])manager.remove(id);
  assert.equal(renderer.matureBatches.pools.size,0);assert.equal(scene.children.length,0);
  // Reuse after deleting the entire garden.
  const fresh=manager.plant(new THREE.Vector3(),20);manager.update(30);assert.ok(fresh.visual.matureSlots.length>0);
  manager.remove(fresh.id);renderer.dispose();
});
test('growing plants remain separate and migrate only once at ten seconds',()=>{
  const {scene,renderer,manager}=setup();
  const a=manager.plant(new THREE.Vector3(),0),b=manager.plant(new THREE.Vector3(1,0,0),5);
  manager.update(9);assert.equal(renderer.matureBatches.pools.size,0);assert.equal(scene.children.length,2);
  manager.update(10);assert.ok(a.visual.matureSlots);assert.equal(b.visual.matureSlots,undefined);assert.equal(b.visual.group.parent,scene);
  const count=[...renderer.matureBatches.pools.values()].reduce((n,p)=>n+p.mesh.count,0);
  manager.update(11);assert.equal([...renderer.matureBatches.pools.values()].reduce((n,p)=>n+p.mesh.count,0),count);
  manager.remove(b.id);manager.remove(a.id);assert.equal(scene.children.length,0);renderer.dispose();
});


test('vines receive but never cast shadows, including pooled growth and mixed ground geometry',()=>{
 const {scene,renderer,manager}=setup();
 const support={type:'wall',yaw:Math.PI,halfLength:4.572,adjacentHalfLength:6.858,height:3.048,normal:new THREE.Vector3(0,0,-1)};
 const vine=manager.plant(new THREE.Vector3(2,1,6.858),0,support);
 assert.equal(vine.structure.parameters.form,'vine');
 assert.equal(manager.hasGrowingShadows,false);assert.equal(manager.shadowRevision,0);
 for(const {mesh} of vine.visual.batches){assert.equal(mesh.castShadow,false);assert.equal(mesh.receiveShadow,true);}
 manager.update(10);
 for(const {pool} of vine.visual.matureSlots){assert.equal(pool.mesh.castShadow,false);assert.equal(pool.mesh.receiveShadow,true);}
 // Many vines force shared pool capacity expansion without restoring casting.
 for(let i=0;i<12;i++)manager.plant(new THREE.Vector3(2,1,6.858),10,support);
 manager.update(20);
 assert.equal(manager.shadowRevision,0);assert.equal(manager.hasGrowingShadows,false);
 for(const pool of renderer.matureBatches.pools.values()){assert.equal(pool.mesh.castShadow,false);assert.equal(pool.mesh.receiveShadow,true);}
 const ground=manager.plant(new THREE.Vector3(),20);manager.update(30);
 const sharedKeys=new Set(vine.visual.batches.map(b=>b.key));
 assert.ok(ground.visual.batches.some(b=>sharedKeys.has(b.key)));
 for(const {pool} of ground.visual.matureSlots){assert.equal(pool.mesh.castShadow,true);assert.equal(pool.mesh.receiveShadow,true);}
 assert.equal(manager.shadowRevision,1);
 for(const p of [...manager.instances.values()])if(p!==ground)manager.remove(p.id);
 assert.equal(manager.shadowRevision,1);
 for(const {pool} of ground.visual.matureSlots)assert.ok(scene.children.includes(pool.mesh));
 manager.remove(ground.id);assert.equal(manager.shadowRevision,2);assert.equal(renderer.matureBatches.pools.size,0);renderer.dispose();
});


test('reset releases growing and mature plants, clears clones, and allows fresh planting',()=>{
 const {scene,renderer,manager}=setup();
 const mature=manager.plant(new THREE.Vector3(),0);manager.update(10);
 const growing=manager.plant(new THREE.Vector3(1,0,0),10);manager.copy(growing.id);
 const oldRevision=manager.shadowRevision,oldVisuals=[mature.visual,growing.visual];
 assert.ok(renderer.matureBatches.pools.size>0);assert.equal(manager.growing.size,1);
 manager.reset();
 assert.equal(manager.instances.size,0);assert.equal(manager.growing.size,0);assert.equal(manager.targets.length,0);
 assert.equal(manager.clonedSeed,null);assert.equal(manager.clonedSurface,null);assert.equal(manager.hasGrowingShadows,false);
 assert.equal(renderer.matureBatches.pools.size,0);assert.equal(scene.children.length,0);
 assert.ok(manager.shadowRevision>oldRevision);assert.ok(oldVisuals.every(v=>v.removed));
 const fresh=manager.plant(new THREE.Vector3(),20);assert.equal(fresh.id,1);assert.equal(fresh.state,'growing');
 manager.update(30);assert.ok(fresh.visual.matureSlots.length>0);manager.reset();manager.reset();assert.equal(scene.children.length,0);renderer.dispose();
});
