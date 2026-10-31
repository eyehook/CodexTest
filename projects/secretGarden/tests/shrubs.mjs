import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../../shared/vendor/three-r180/three.module.js';
import {generatePlant,componentPose} from '../generator.mjs';
import {PlantRenderer} from '../renderer.mjs';
import {canopyRotation} from '../canopy-flowers.mjs';
test('shrubs have 1–5 overlapping ellipsoid crowns, visible connecting stems and exposed flowers',()=>{
 const counts=new Set();let flowering=0,plain=0,shrubs=0;
 for(let seed=0;seed<1200;seed++){
  const p=generatePlant(seed);if(p.parameters.form!=='bush')continue;shrubs++;const crowns=p.parts.filter(p=>p.kind==='foliage'),flowers=p.parts.filter(p=>p.kind==='flower'),stems=p.parts.filter(p=>p.kind==='stem');counts.add(crowns.length);assert.equal(crowns.length,p.parameters.canopyCount);assert.ok(stems.every(p=>!p.hidden));assert.equal(p.parts.filter(p=>p.kind==='leaf').length,0);assert.ok(crowns.every(p=>p.scale[1]<Math.max(p.scale[0],p.scale[2])));
  const poses=componentPose(p,10),base=crowns[0],center=poses[base.id].anchor;
  for(const crown of crowns.slice(1)){const local=canopyRotation(poses[crown.id].anchor.map((v,i)=>v-center[i]),base,true);assert.ok(local.reduce((sum,v,i)=>sum+(v/base.scale[i])**2,0)<1,'each secondary crown center should overlap the central crown');}
  if(p.parameters.flowers){flowering++;assert.ok(flowers.length>=4*crowns.length);}else {plain++;assert.equal(flowers.length,0);}
  for(const f of flowers){assert.equal(p.parts[f.parent].kind,'stem');assert.ok(!p.parts[f.parent].hidden);for(const crown of crowns){const local=canopyRotation(f.position.map((v,i)=>v-poses[crown.id].anchor[i]),crown,true);assert.ok(local.reduce((sum,v,i)=>sum+(v/crown.scale[i])**2,0)>=1-1e-9);}}
  if(shrubs<12){for(const age of [1,3,5,7,10]){const growing=componentPose(p,age);for(const flower of flowers)assert.ok(growing[flower.id].anchor.every((v,i)=>Math.abs(v-growing[flower.parent].end[i])<1e-9),'flowers stay attached throughout growth');}
const scene=new THREE.Scene(),r=new PlantRenderer(scene),instance={structure:p,visual:r.create(p,new THREE.Vector3(),seed)};r.update(instance,10);assert.ok(instance.visual.batches.some(batch=>batch.key.startsWith('stem')));assert.equal(instance.visual.batches.filter(batch=>batch.key.startsWith('stem')).reduce((sum,batch)=>sum+batch.entries.length,0),stems.length);r.mature(instance);r.flush();assert.ok([...r.matureBatches.pools.values()].some(pool=>pool.key.startsWith('stem')));r.remove(instance.visual);r.dispose();}
 }
 assert.deepEqual([...counts].sort(),[1,2,3,4,5]);assert.ok(shrubs>200&&flowering>30&&plain>100);
});
