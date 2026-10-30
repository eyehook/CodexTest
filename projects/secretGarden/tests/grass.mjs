import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../../shared/vendor/three-r180/three.module.js';
import {generatePlant,MAX_COMPONENTS,growthAmount} from '../generator.mjs';
import {PlantRenderer} from '../renderer.mjs';
import {PlantManager} from '../manager.mjs';
test('seeded grass patches have rounded irregular outlines and shorter edge blades',()=>{
 let patches=0;
 for(let seed=0;seed<500;seed++){
  const p=generatePlant(seed);if(p.parameters.form!=='grass')continue;patches++;
  assert.deepEqual(p,generatePlant(seed));assert.ok(p.parts.length<MAX_COMPONENTS);
  const center=p.parts.filter(b=>b.radial<.4),edge=p.parts.filter(b=>b.radial>.85);
  const average=blades=>blades.reduce((n,b)=>n+b.height,0)/blades.length;
  assert.ok(average(center)>average(edge)*2);
  for(const b of p.parts){assert.equal(b.kind,'leaf');assert.equal(b.shape,4);assert.equal(b.start[1],0);assert.equal(b.parent,null);assert.ok(b.height>0&&b.width>0);assert.equal(growthAmount(b,0),0);assert.equal(growthAmount(b,10),1);}
  const outline=t=>1+.12*Math.sin(t*3+p.parameters.phaseA)+.07*Math.sin(t*5+p.parameters.phaseB);
  const radii=Array.from({length:24},(_,i)=>outline(i/24*Math.PI*2));assert.ok(Math.max(...radii)-Math.min(...radii)>.15);
 }
 assert.ok(patches>90);
});
test('grass clones grow, batch and remain selectable/deletable as whole patches',()=>{
 let seed=0;while(generatePlant(seed).parameters.form!=='grass')seed++;
 const scene=new THREE.Scene(),r=new PlantRenderer(scene),m=new PlantManager(r,()=>seed,()=>.7,()=>.85);
 const p=m.plant(new THREE.Vector3(),0);m.copy(p.id);const clone=m.plant(new THREE.Vector3(1,0,0),0);
 assert.deepEqual(p.structure,clone.structure);assert.equal(clone.scale,.85);m.update(10);
 assert.equal(r.matureBatches.pools.size,1);assert.ok(r.matureBatches.pools.has('leaf4'));
 const mesh=p.visual.batches[0].mesh,matrix=new THREE.Matrix4();mesh.getMatrixAt(0,matrix);matrix.premultiply(mesh.matrixWorld);
 const center=new THREE.Vector3(0,.45,.04).applyMatrix4(matrix),normal=new THREE.Vector3(0,0,1).transformDirection(matrix);
 const ray=new THREE.Raycaster(center.clone().addScaledVector(normal,2),normal.clone().negate());
 assert.equal(ray.intersectObject(p.visual.group,true)[0].object.userData.plantId,p.id);
 m.remove(p.id);assert.equal(m.instances.size,1);assert.equal(r.matureBatches.pools.size,1);
 m.remove(clone.id);assert.equal(scene.children.length,0);r.dispose();
});

test('grass targeting uses one ellipsoid and never traverses individual blades',()=>{
 let seed=0;while(generatePlant(seed).parameters.form!=='grass')seed++;
 const scene=new THREE.Scene(),r=new PlantRenderer(scene),m=new PlantManager(r,()=>seed,()=>.6,()=>1.2);
 const p=m.plant(new THREE.Vector3(1,0,-1),0);m.update(5);scene.updateMatrixWorld(true);
 p.visual.batches[0].mesh.raycast=()=>{throw new Error('Blade raycasting must be skipped');};
 const ray=new THREE.Raycaster(new THREE.Vector3(1,3,-1),new THREE.Vector3(0,-1,0),0,5);
 assert.equal(ray.intersectObjects(m.targets,true)[0].object.userData.plantId,p.id);
 ray.far=1;assert.equal(ray.intersectObjects(m.targets,true).length,0);
 ray.far=5;ray.ray.origin.x=20;assert.equal(ray.intersectObjects(m.targets,true).length,0);
 m.update(10);ray.ray.origin.x=1;assert.equal(ray.intersectObjects(m.targets,true)[0].object.userData.plantId,p.id);
 m.remove(p.id);assert.equal(ray.intersectObjects(m.targets,true).length,0);r.dispose();
});
test('grass never casts/receives shadows or invalidates cached shadow maps',()=>{
 let grassSeed=0;while(generatePlant(grassSeed).parameters.form!=='grass')grassSeed++;
 let treeSeed=0;while(generatePlant(treeSeed).parameters.form!=='tree')treeSeed++;
 const scene=new THREE.Scene(),r=new PlantRenderer(scene),m=new PlantManager(r,()=>grassSeed);
 const p=m.plant(new THREE.Vector3(),0);assert.equal(m.shadowRevision,0);assert.equal(m.hasGrowingShadows,false);
 assert.equal(p.visual.batches[0].mesh.castShadow,false);assert.equal(p.visual.batches[0].mesh.receiveShadow,false);
 m.update(10);const batch=r.matureBatches.pools.get('leaf4').mesh;assert.equal(batch.castShadow,false);assert.equal(batch.receiveShadow,false);
 m.remove(p.id);assert.equal(m.shadowRevision,0);
 m.randomSeed=()=>treeSeed;const tree=m.plant(new THREE.Vector3(),20);assert.equal(m.shadowRevision,1);assert.equal(m.hasGrowingShadows,true);
 m.remove(tree.id);assert.equal(m.shadowRevision,2);r.dispose();
});
