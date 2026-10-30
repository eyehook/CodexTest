import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../../shared/vendor/three-r180/three.module.js';
import {generatePlant} from '../generator.mjs';
import {PlantRenderer} from '../renderer.mjs';
import {PlantManager} from '../manager.mjs';
test('single-sphere hydrangea flowers grow, clone, batch and resolve plant selection',()=>{
 let seed=0;while(seed<5000){const p=generatePlant(seed);if(p.parts.some(x=>x.kind==='flower'&&x.volume))break;seed++;}
 assert.ok(seed<5000);
 const scene=new THREE.Scene(),r=new PlantRenderer(scene),m=new PlantManager(r,()=>seed,()=>.4,()=>1);
 const plant=m.plant(new THREE.Vector3(),0);m.copy(plant.id);const clone=m.plant(new THREE.Vector3(1,0,0),0);
 assert.deepEqual(plant.structure,clone.structure);
 m.update(10);
 const flowers=plant.structure.parts.filter(p=>p.kind==='flower'),batch=plant.visual.batches.find(b=>b.key==='hydrangea');
 assert.ok(flowers.every(p=>p.volume));assert.equal(batch.mesh.count,flowers.length);
 assert.equal(batch.mesh.geometry.attributes.position.count/3,80);
 assert.ok(!plant.visual.batches.some(b=>b.key.startsWith('petal')||b.key==='center'));
 const other=clone.visual.batches.find(b=>b.key==='hydrangea');assert.deepEqual(batch.mesh.instanceMatrix.array,other.mesh.instanceMatrix.array);assert.deepEqual(batch.mesh.instanceColor.array,other.mesh.instanceColor.array);
 assert.equal(r.matureBatches.pools.get('hydrangea').mesh.count,flowers.length*2);
 const matrix=new THREE.Matrix4();batch.mesh.getMatrixAt(0,matrix);matrix.premultiply(batch.mesh.matrixWorld);
 const center=new THREE.Vector3(0,0,.65).applyMatrix4(matrix),normal=new THREE.Vector3(0,0,1).transformDirection(matrix);
 const ray=new THREE.Raycaster(center.clone().addScaledVector(normal,2),normal.clone().negate());
 assert.equal(ray.intersectObject(plant.visual.group,true)[0].object.userData.plantId,plant.id);
 m.remove(plant.id);m.remove(clone.id);assert.equal(scene.children.length,0);r.dispose();
});
