import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../../shared/vendor/three-r180/three.module.js';
import {PlantRenderer} from '../renderer.mjs';
import {PlantManager} from '../manager.mjs';
import {randomFor} from '../generator.mjs';

test('accelerated targeting matches original nearest hits for mature, overlapping and corner-wrapping plants',()=>{
 const scene=new THREE.Scene(),r=new PlantRenderer(scene),m=new PlantManager(r);let seed=0;
 for(let i=0;i<35;i++){m.clonedSeed=seed++;m.plant(new THREE.Vector3((i%5-2)*.65,0,-Math.floor(i/5)*.7),0);}
 const support={type:'wall',yaw:Math.PI*2,halfLength:4.572,adjacentHalfLength:6.858,height:3.048,normal:new THREE.Vector3(0,0,1)};
 m.copy(null);m.randomSeed=()=>8;m.plant(new THREE.Vector3(-4.3,1,-6.858),0,support);m.update(10);scene.updateMatrixWorld(true);
 const random=randomFor(77),ray=new THREE.Raycaster();let actualHits=0;
 for(let i=0;i<250;i++){
  const origin=new THREE.Vector3((random()-.5)*7,random()*4+.1,2);
  const point=new THREE.Vector3((random()-.5)*7,random()*3,-random()*7);
  ray.set(origin,point.sub(origin).normalize());ray.near=i%5===0?.5:0;ray.far=i%7===0?3:20;
  for(const p of m.instances.values())if(p.visual.targeting)p.visual.targeting.enabled=false;
  const expected=ray.intersectObjects(m.targets,true)[0];
  for(const p of m.instances.values())if(p.visual.targeting)p.visual.targeting.enabled=true;
  const actual=ray.intersectObjects(m.targets,true)[0];
  assert.equal(actual?.object.userData.plantId,expected?.object.userData.plantId);
  if(expected){actualHits++;assert.ok(Math.abs(actual.distance-expected.distance)<1e-6);}
 }
 assert.ok(actualHits>20);
 for(const id of [...m.instances.keys()])m.remove(id);r.dispose();
});

test('plant bounds skip detailed misses during growth and mature hierarchy skips whole-mesh traversal',()=>{
 const scene=new THREE.Scene(),r=new PlantRenderer(scene),m=new PlantManager(r,()=>0),p=m.plant(new THREE.Vector3(),0);
 m.update(5);scene.updateMatrixWorld(true);
 const originals=p.visual.batches.map(b=>b.mesh.raycast);
 p.visual.batches.forEach(b=>b.mesh.raycast=()=>{throw new Error('Unexpected full batch traversal');});
 const ray=new THREE.Raycaster(new THREE.Vector3(100,2,0),new THREE.Vector3(0,0,-1));
 assert.equal(ray.intersectObjects(m.targets,true).length,0);
 p.visual.batches.forEach((b,i)=>b.mesh.raycast=originals[i]);m.update(10);
 p.visual.batches.forEach(b=>b.mesh.raycast=()=>{throw new Error('Unexpected full batch traversal');});
 const mesh=p.visual.batches.find(b=>b.key.startsWith('stem')).mesh,mat=new THREE.Matrix4();mesh.getMatrixAt(0,mat);
 const center=new THREE.Vector3().applyMatrix4(mat).applyMatrix4(mesh.matrixWorld);
 ray.set(center.clone().add(new THREE.Vector3(0,0,3)),new THREE.Vector3(0,0,-1));
 assert.equal(ray.intersectObjects(m.targets,true)[0].object.userData.plantId,p.id);
 m.remove(p.id);assert.equal(ray.intersectObjects(m.targets,true).length,0);r.dispose();
});
