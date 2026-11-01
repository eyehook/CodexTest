import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../../shared/vendor/three-r180/three.module.js';
import {generatePlant,componentPose} from '../generator.mjs';
import {PlantRenderer} from '../renderer.mjs';
import {generateVine} from '../vine-generator.mjs';
import {GardenPicker} from '../garden-picker.mjs';

test('reused growth poses match fresh evaluation, retain storage and settle completed components',()=>{
 for(let seed=0;seed<70;seed++){
  const plant=generatePlant(seed);let cache=componentPose(plant,0),first=cache[0],anchor=first.anchor;
  for(const age of [0,.5,1,2,3,4,6,8,10,11]){
   const fresh=componentPose(plant,age);assert.equal(componentPose(plant,age,cache),cache);
   for(let i=0;i<cache.length;i++){assert.deepEqual(cache[i].anchor,fresh[i].anchor);assert.deepEqual(cache[i].end,fresh[i].end);assert.equal(cache[i].growth,fresh[i].growth);}
  }
  assert.equal(cache[0],first);assert.equal(cache[0].anchor,anchor);assert.ok(cache.every(p=>!p.changed));
 }
});
test('fixed growth spheres enclose instance geometry throughout animation without rescanning',()=>{
 const r=new PlantRenderer(new THREE.Scene()),matrix=new THREE.Matrix4(),vertex=new THREE.Vector3();
 for(let seed=0;seed<50;seed++){
  const structure=seed<40?generatePlant(seed):generateVine(seed,{minX:-4,maxX:4,minY:-1,maxY:2,wrapDepth:12}),visual=r.create(structure,new THREE.Vector3(),seed),plant={structure,visual};
  for(const {mesh} of visual.batches)mesh.computeBoundingSphere=()=>{throw Error('Unexpected growth bounds scan');};
  for(const age of [0,1,3,5,7,10]){
   r.update(plant,age);
   for(const {mesh} of visual.batches)for(let i=0;i<mesh.count;i++){
    mesh.getMatrixAt(i,matrix);const vertices=mesh.geometry.attributes.position;
    for(let v=0;v<vertices.count;v++){vertex.fromBufferAttribute(vertices,v).applyMatrix4(matrix);assert.ok(vertex.distanceTo(mesh.boundingSphere.center)<=mesh.boundingSphere.radius+1e-5,`seed ${seed}, age ${age}`);}
   }
  }
  r.remove(visual);
 }
 r.dispose();
});
test('garden hierarchy skips distant plant pickers and rebuilds after removal',()=>{
 const picker=new GardenPicker(),plants=[];let visited=0;
 for(let i=0;i<100;i++){const group=new THREE.Group();group.position.set(i*5,0,0);group.userData.pickRadius=1;group.raycast=()=>{visited++;return false;};plants.push({visual:{group}});}
 picker.rebuild(plants);const ray=new THREE.Raycaster(new THREE.Vector3(0,0,5),new THREE.Vector3(0,0,-1));ray.intersectObject(picker.group,true);assert.equal(visited,1);
 visited=0;picker.rebuild(plants.slice(1));ray.intersectObject(picker.group,true);assert.equal(visited,0);
});
test('mature pools expand cached bounds without full scans on additions or deletions',()=>{
 const r=new PlantRenderer(new THREE.Scene()),structure=generatePlant(0),plants=[];
 for(let i=0;i<3;i++){const visual=r.create(structure,new THREE.Vector3(i*10,0,0),i),plant={structure,visual};r.update(plant,10);r.mature(plant);plants.push(plant);for(const pool of r.matureBatches.pools.values())pool.mesh.computeBoundingSphere=()=>{throw Error('Unexpected mature bounds scan');};r.flush();}
 for(const pool of r.matureBatches.pools.values())assert.ok(pool.mesh.boundingSphere.radius>0);
 for(const plant of plants)r.remove(plant.visual);r.dispose();
});
