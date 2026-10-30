import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../../shared/vendor/three-r180/three.module.js';
import {constrainViewer,createEnvironment,HALF_WIDTH,HALF_DEPTH} from '../environment.mjs';
import {PlantRenderer} from '../renderer.mjs';
import {generatePlant} from '../generator.mjs';
test('boundary constraint accounts for physical head offset and rig yaw',()=>{
  const rig=new THREE.Group();rig.position.set(5,0,-5);rig.rotation.y=1.4;
  const local=new THREE.Vector3(1.2,1.65,-.6);constrainViewer(rig,local);
  const world=local.clone().applyMatrix4(rig.matrixWorld);
  assert.ok(Math.abs(world.x)<=HALF_WIDTH-.18+1e-8);assert.ok(Math.abs(world.z)<=HALF_DEPTH-.18+1e-8);assert.equal(rig.position.y,0);
});
test('rendered plant batches resolve ray hits to instance IDs and clones have identical matrices and colors',()=>{
  const scene=new THREE.Scene(),renderer=new PlantRenderer(scene),structure=generatePlant(29);
  const first={structure,visual:renderer.create(structure,new THREE.Vector3(),11)};
  const second={structure,visual:renderer.create(structure,new THREE.Vector3(1,0,0),12,1.2,.8)};
  assert.equal(second.visual.group.rotation.y,1.2);
  assert.deepEqual(second.visual.group.scale.toArray(),[.8,.8,.8]);
  renderer.update(first,10);renderer.update(second,10);scene.updateMatrixWorld(true);
  const ray=new THREE.Raycaster(),hitsByKind=new Set();
  for(let i=0;i<first.visual.batches.length;i++){
    const {key,mesh,entries}=first.visual.batches[i],other=second.visual.batches[i].mesh;
    assert.deepEqual(mesh.instanceMatrix.array,other.instanceMatrix.array);assert.deepEqual(mesh.instanceColor.array,other.instanceColor.array);
    for(let j=0;j<entries.length;j++){
      const matrix=new THREE.Matrix4();mesh.getMatrixAt(j,matrix);
      const center=new THREE.Vector3(0,key.startsWith('leaf')||key.startsWith('petal')?.4:0,0).applyMatrix4(matrix);
      ray.set(center.clone().add(new THREE.Vector3(0,0,2)),new THREE.Vector3(0,0,-1));
      const hits=ray.intersectObject(mesh);if(hits.length){assert.equal(hits[0].object.userData.plantId,11);hitsByKind.add(key.replace(/\d/g,''));break;}
    }
  }
  assert.ok(hitsByKind.has('stem'));assert.ok(hitsByKind.has('leaf'));
  renderer.remove(first.visual);renderer.remove(second.visual);assert.equal(scene.children.length,0);renderer.dispose();
});

test('rectangular garden has 30 by 45 foot interior and matching enclosing walls',()=>{
  const scene=new THREE.Scene(),renderer={shadowMap:{}};
  const {ground,walls}=createEnvironment(scene,renderer);
  assert.equal(ground.geometry.parameters.width,9.144);assert.equal(ground.geometry.parameters.height,13.716);
  assert.equal(walls.length,4);
  walls.forEach((wall,i)=>{
    const halfLength=i%2===0?HALF_WIDTH:HALF_DEPTH;
    const distance=i%2===0?HALF_DEPTH:HALF_WIDTH;
    assert.equal(wall.geometry.parameters.width,halfLength*2+.3);
    assert.ok(Math.abs(Math.hypot(wall.position.x,wall.position.z)-(distance+.11))<1e-8);
    assert.equal(wall.geometry.parameters.height,3.048);
  });
  for(const x of [-20,20])for(const z of [-20,20]){
    const rig=new THREE.Group();rig.position.set(x,0,z);constrainViewer(rig,new THREE.Vector3());
    assert.ok(Math.abs(Math.abs(rig.position.x)-(HALF_WIDTH-.18))<1e-8);
    assert.ok(Math.abs(Math.abs(rig.position.z)-(HALF_DEPTH-.18))<1e-8);
  }
});

test('new foliage volumes grow, clone identically, and resolve ray hits to the plant',()=>{
  const scene=new THREE.Scene(),renderer=new PlantRenderer(scene),seen=new Set();
  for(let seed=0;seen.size<3&&seed<500;seed++){
    const structure=generatePlant(seed),form=structure.parameters.treeForm;
    if(!form||form==='open'||seen.has(form))continue;seen.add(form);
    const first={structure,visual:renderer.create(structure,new THREE.Vector3(),101)};
    const clone={structure,visual:renderer.create(structure,new THREE.Vector3(),102)};
    renderer.update(first,0);
    renderer.update(first,10);renderer.update(clone,10);scene.updateMatrixWorld(true);
    const batch=first.visual.batches.find(b=>b.key==='crown'||b.key==='pine'||b.key==='spire');
    const other=clone.visual.batches.find(b=>b.key===batch.key);
    assert.deepEqual(batch.mesh.instanceMatrix.array,other.mesh.instanceMatrix.array);
    assert.deepEqual(batch.mesh.instanceColor.array,other.mesh.instanceColor.array);
    const matrix=new THREE.Matrix4();batch.mesh.getMatrixAt(0,matrix);
    const center=new THREE.Vector3(0,batch.key==='pine'?.5:0,0).applyMatrix4(matrix);
    const ray=new THREE.Raycaster(center.clone().add(new THREE.Vector3(0,0,10)),new THREE.Vector3(0,0,-1));
    const hit=ray.intersectObject(batch.mesh)[0];assert.ok(hit);assert.equal(hit.object.userData.plantId,101);
    renderer.remove(first.visual);renderer.remove(clone.visual);
  }
  assert.equal(seen.size,3);renderer.dispose();
});
