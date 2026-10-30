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
    const p=manager.plant(new THREE.Vector3(i%6,0,-Math.floor(i/6)),0);renderer.update(p,10);
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
