import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../../shared/vendor/three-r180/three.module.js';
import {generatePlant,componentPose} from '../generator.mjs';
import {PlantRenderer} from '../renderer.mjs';
import {selectPlantSeed,SPAWN_PLANT_TYPES} from '../spawn-plant-types.mjs';
test('ferns are deterministic ground plants with bounded radial fronds and ten-second growth',()=>{
 let count=0;
 for(let seed=0;seed<1200;seed++){
  const p=generatePlant(seed);if(p.parameters.form!=='fern')continue;count++;
  assert.deepEqual(p,generatePlant(seed));assert.equal(p.parameters.flowers,false);
  assert.ok(p.parts.length>=7&&p.parts.length<=11);
  for(const part of p.parts){assert.equal(part.kind,'leaf');assert.equal(part.shape,5);assert.equal(part.parent,null);assert.equal(part.start[1],.015);assert.ok(part.width>0&&part.height>0);}
  assert.ok(componentPose(p,0).every(p=>p.growth===0));assert.ok(componentPose(p,10).every(p=>p.growth===1));
 }
 assert.ok(count>150);assert.ok(SPAWN_PLANT_TYPES.some(t=>t.id==='fern'&&t.label==='Ferns'));
 assert.equal(generatePlant(selectPlantSeed('fern',()=>42).seed).parameters.form,'fern');
});
test('single-mesh fronds clone exactly, support triangle picking and retain IDs after mature batching',()=>{
 const scene=new THREE.Scene(),renderer=new PlantRenderer(scene),structure=generatePlant(selectPlantSeed('fern',()=>42).seed);
 const a={structure,visual:renderer.create(structure,new THREE.Vector3(),401)},b={structure,visual:renderer.create(structure,new THREE.Vector3(2,0,0),402)};
 renderer.update(a,10);renderer.update(b,10);scene.updateMatrixWorld(true);
 assert.equal(a.visual.batches.length,1);const batch=a.visual.batches[0],mesh=batch.mesh;
 assert.equal(batch.key,'leaf5');assert.equal(mesh.count,structure.parts.length);
 assert.deepEqual(mesh.instanceMatrix.array,b.visual.batches[0].mesh.instanceMatrix.array);assert.deepEqual(mesh.instanceColor.array,b.visual.batches[0].mesh.instanceColor.array);
 const geometry=mesh.geometry,positions=geometry.attributes.position,index=geometry.index;
 assert.equal(index.count/3,120);assert.ok([...positions.array].every(Number.isFinite));
 const matrix=new THREE.Matrix4();mesh.getMatrixAt(0,matrix);
 const v=[0,1,2].map(i=>new THREE.Vector3().fromBufferAttribute(positions,index.getX(i)).applyMatrix4(matrix));
 const center=v[0].clone().add(v[1]).add(v[2]).multiplyScalar(1/3),normal=v[1].clone().sub(v[0]).cross(v[2].clone().sub(v[0])).normalize();
 const ray=new THREE.Raycaster(center.clone().addScaledVector(normal,1),normal.clone().negate());
 assert.ok(ray.intersectObject(a.visual.group,true).some(h=>h.object.userData.plantId===401));
 renderer.mature(a);renderer.flush();scene.updateMatrixWorld(true);
 assert.ok(ray.intersectObject(a.visual.group,true).some(h=>h.object.userData.plantId===401));
 renderer.remove(a.visual);renderer.remove(b.visual);renderer.dispose();assert.equal(scene.children.length,0);
});

test('fern frond orientation stays fixed throughout growth',()=>{
 const renderer=new PlantRenderer(new THREE.Scene()),structure=generatePlant(selectPlantSeed('fern',()=>42).seed);
 const instance={structure,visual:renderer.create(structure,new THREE.Vector3(),501)};
 const rotations=[];
 for(const age of [3,5,7,10]){
  renderer.update(instance,age);
  const mesh=instance.visual.batches[0].mesh,current=[];
  for(let i=0;i<mesh.count;i++){
   const matrix=new THREE.Matrix4(),position=new THREE.Vector3(),rotation=new THREE.Quaternion(),scale=new THREE.Vector3();
   mesh.getMatrixAt(i,matrix);matrix.decompose(position,rotation,scale);current.push(rotation);
  }
  rotations.push(current);
 }
 for(const frame of rotations)frame.forEach((q,i)=>assert.ok(1-Math.abs(q.dot(rotations.at(-1)[i]))<1e-6));
 renderer.remove(instance.visual);renderer.dispose();
});
