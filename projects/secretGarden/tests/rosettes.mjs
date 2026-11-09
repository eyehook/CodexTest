import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../../shared/vendor/three-r180/three.module.js';
import {generatePlant,componentPose,MAX_COMPONENTS} from '../generator.mjs';
import {PlantRenderer} from '../renderer.mjs';
import {PlantManager} from '../manager.mjs';
import {flowerLandings} from '../bees.mjs';
import {selectPlantSeed,SPAWN_MENU_ITEMS} from '../spawn-plant-types.mjs';
test('rosettes have seeded broad foliage and optional flowers only on separate spikes',()=>{
 let flowering=0,plain=0;const blooms=new Set();
 for(let seed=0;seed<6000;seed++){
  const p=generatePlant(seed);if(p.parameters.form!=='rosette')continue;assert.deepEqual(p,generatePlant(seed));assert.ok(p.parts.length<MAX_COMPONENTS);
  const leaves=p.parts.filter(p=>p.kind==='leaf'),flowers=p.parts.filter(p=>p.kind==='flower');assert.equal(leaves.length,p.parameters.leafCount);assert.ok(leaves.length>=10&&leaves.length<=16);assert.ok(leaves.every(p=>p.shape===9&&p.parent===null));
  for(const spike of p.parts.filter(p=>p.role==='flower-spike')){const last=p.parts.filter(p=>p.parent===spike.id&&p.role==='flower-stalk').at(-1);assert.equal(last.attachment,1);assert.ok(spike.end.every((v,k)=>Math.abs(v-last.start[k])<1e-9));}
  const poses=componentPose(p,10);assert.ok(poses.every(p=>p.growth===1&&p.anchor.every(Number.isFinite)));
  if(p.parameters.flowers){flowering++;blooms.add(p.parameters.bloomForm);assert.ok(flowers.length>=5);assert.ok(p.parameters.spikeCount>=1&&p.parameters.spikeCount<=3);}
  else {plain++;assert.equal(flowers.length,0);assert.equal(p.parts.filter(p=>p.kind==='stem').length,0);}
  for(const flower of flowers){assert.equal(flower.layers,p.parameters.bloomForm==='rosette'?3:1);const stalk=p.parts[flower.parent],spike=p.parts[stalk.parent];const direction=stalk.end.map((v,k)=>v-stalk.start[k]),length=Math.hypot(...direction);assert.ok(flower.normal.every((v,k)=>Math.abs(v-direction[k]/length)<1e-9));assert.equal(stalk.role,'flower-stalk');assert.equal(spike.role,'flower-spike');assert.ok(flower.begin>=stalk.begin+stalk.duration);assert.ok(stalk.begin>=spike.begin+spike.duration);}
 }
 assert.ok(flowering>60&&plain>90);assert.deepEqual([...blooms].sort(),['bell','buttercup','daisy','lily','rosette','star']);assert.ok(SPAWN_MENU_ITEMS.some(p=>p.id==='rosette'&&!p.children));
});
test('rosettes clone, batch, restore, expose bee landings and delete as one planting',()=>{
 let cursor=0,seed;do{seed=selectPlantSeed('rosette',()=>cursor++).seed;}while(!generatePlant(seed).parameters.flowers);
 const renderer=new PlantRenderer(new THREE.Scene()),manager=new PlantManager(renderer,()=>seed,()=>0,()=>1);
 manager.chooseType('rosette');const first=manager.plant(new THREE.Vector3(),0);manager.copy(first.id);const clone=manager.plant(new THREE.Vector3(1,0,0),0);assert.deepEqual(clone.structure,first.structure);
 manager.update(10);assert.ok(first.visual.matureSlots);assert.equal(flowerLandings(first).length,first.structure.parts.filter(p=>p.kind==='flower').length);assert.ok(first.visual.batches.some(b=>b.key==='leaf9'));
 for(const batch of first.visual.batches)assert.ok([...batch.mesh.instanceMatrix.array].every(Number.isFinite));
 const snapshot=manager.snapshot(10);manager.restore(snapshot,20);assert.deepEqual([...manager.instances.values()][0].structure,first.structure);manager.reset();assert.equal(renderer.matureBatches.pools.size,0);renderer.dispose();
});

test('rosette flowering branches turn progressively upward toward the spike tip',()=>{
 for(let seed=0;seed<300;seed++){
  const p=generatePlant(seed);if(p.parameters.form!=='rosette')continue;
  for(const spike of p.parts.filter(p=>p.role==='flower-spike')){
   const branches=p.parts.filter(p=>p.parent===spike.id&&p.role==='flower-stalk');let previous=-Infinity;
   for(const b of branches){const d=b.end.map((v,k)=>v-b.start[k]),vertical=d[1]/Math.hypot(...d);assert.ok(vertical>previous);previous=vertical;}
   const tilt=b=>{const d=b.end.map((v,k)=>v-b.start[k]);return Math.acos(d[1]/Math.hypot(...d))*180/Math.PI;};
   assert.ok(Math.abs(tilt(branches[0])-75)<1e-8);assert.ok(Math.abs(tilt(branches.at(-1))-20)<1e-8);
  }
 }
});
