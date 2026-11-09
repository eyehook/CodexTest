import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../../shared/vendor/three-r180/three.module.js';
import {generatePlant,componentPose} from '../generator.mjs';
import {PlantRenderer} from '../renderer.mjs';
import {shrubProfile} from '../shrub-profile.mjs';
test('single-trunk shrubs cover both canopy varieties with deterministic growth and exposed flowers',()=>{
 const shapes=new Set();let flowering=0,plain=0,count=0;
 for(let seed=0;seed<1200;seed++){
  const p=generatePlant(seed);if(p.parameters.form!=='bush')continue;count++;assert.deepEqual(p,generatePlant(seed));
  const crowns=p.parts.filter(p=>p.kind==='foliage'),flowers=p.parts.filter(p=>p.kind==='flower'),stems=p.parts.filter(p=>p.kind==='stem'),root=p.parts[0],crown=crowns[0];shapes.add(crown.shape);
  assert.equal(crowns.length,1);assert.equal(stems.filter(s=>s.radius>.003).length,1);assert.equal(stems.length,flowers.length+1);assert.deepEqual(root.start,[0,0,0]);assert.equal(root.end[0],0);assert.equal(root.end[2],0);assert.ok(root.end[1]-crown.scale[1]>.07);assert.equal(crown.scale[0],crown.scale[2]);
  const drop=crown.shape==='shrubDrop',height=root.end[1]+crown.scale[1];assert.ok(height>=(drop?2.5:2)*.3048&&height<=(drop?3.5:3)*.3048);assert.ok(Math.abs(height-p.parameters.height)<1e-9);
  if(p.parameters.flowers){flowering++;assert.ok(flowers.length>=8);}else{plain++;assert.equal(flowers.length,0);}
  for(const f of flowers){
   assert.equal(f.canopy,crown.id);assert.equal(p.parts[f.parent].parent,root.id);assert.ok(Math.abs(Math.hypot(...f.normal)-1)<1e-9);
   const local=f.position.map((v,i)=>(v-root.end[i]-f.normal[i]*.006)/crown.scale[i]),theta=Math.acos(-local[1]),profile=shrubProfile(crown.shape,theta);
   assert.ok(Math.abs(Math.hypot(local[0],local[2])-profile.radius)<1e-8);assert.ok(f.normal[0]*local[0]+f.normal[2]*local[2]>0);
  }
  if(count<15)for(const age of [0,1,3,5,7,10]){const poses=componentPose(p,age);for(const f of flowers)assert.ok(poses[f.id].anchor.every((v,i)=>Math.abs(v-poses[f.parent].end[i])<1e-9));}
 }
 assert.deepEqual([...shapes].sort(),['shrubDrop','shrubSphere']);assert.ok(count>150&&flowering>30&&plain>80);
});
test('both shrub meshes render, raycast and migrate to shared mature batches',()=>{
 const renderer=new PlantRenderer(new THREE.Scene()),seen=new Set();
 for(let seed=0;seed<200&&! (seen.size===2);seed++){
  const structure=generatePlant(seed);if(structure.parameters.form!=='bush')continue;const crown=structure.parts.find(p=>p.kind==='foliage');if(seen.has(crown.shape))continue;seen.add(crown.shape);
  const instance={structure,visual:renderer.create(structure,new THREE.Vector3(),seed)};renderer.update(instance,10);
  const geometry=renderer.geometries[crown.shape];geometry.computeBoundingBox();assert.ok(geometry.boundingBox.min.y===-1&&geometry.boundingBox.max.y===1);assert.equal(geometry.index.count/3,120);
  const normals=geometry.attributes.normal,index=geometry.index;let smooth=false;for(let i=0;i<index.count;i+=3){const a=new THREE.Vector3().fromBufferAttribute(normals,index.getX(i)),b=new THREE.Vector3().fromBufferAttribute(normals,index.getX(i+1));if(a.distanceTo(b)>.01)smooth=true;}assert.ok(smooth);
  const tree=renderer.geometries.crown;for(let i=0;i<tree.attributes.position.count;i++){const radial=new THREE.Vector3().fromBufferAttribute(tree.attributes.position,i).normalize(),normal=new THREE.Vector3().fromBufferAttribute(tree.attributes.normal,i);assert.ok(radial.distanceTo(normal)<1e-6);}
  const mesh=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial()),ray=new THREE.Raycaster(new THREE.Vector3(0,0,3),new THREE.Vector3(0,0,-1));mesh.updateMatrixWorld();assert.ok(ray.intersectObject(mesh).length>0);mesh.material.dispose();
  renderer.mature(instance);renderer.flush();assert.ok([...renderer.matureBatches.pools.values()].some(pool=>pool.key===crown.shape));renderer.remove(instance.visual);
 }renderer.dispose();assert.equal(seen.size,2);
});
