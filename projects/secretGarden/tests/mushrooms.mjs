import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../../shared/vendor/three-r180/three.module.js';
import {generatePlant,componentPose,MAX_COMPONENTS} from '../generator.mjs';
import {PlantRenderer} from '../renderer.mjs';
import {PlantManager} from '../manager.mjs';
import {SPAWN_MENU_ITEMS,selectPlantSeed} from '../spawn-plant-types.mjs';
test('mushrooms vary between singles and coherent clusters in three bounded seeded families',()=>{
 const families=new Set(),counts=new Set(),hues=new Set();let total=0;
 for(let seed=0;seed<1800;seed++){
  const p=generatePlant(seed);if(p.parameters.form!=='mushroom')continue;total++;assert.deepEqual(p,generatePlant(seed));
  const {mushroomForm,count}=p.parameters;families.add(mushroomForm);counts.add(count);hues.add(p.parameters.capHue);
  assert.ok(count===1||count>=3&&count<=7);assert.ok(p.parts.length<MAX_COMPONENTS);assert.equal(p.parameters.flowers,false);
  const stems=p.parts.filter(p=>p.kind==='stem'),caps=p.parts.filter(p=>p.shape==='mushroom-'+mushroomForm);assert.equal(stems.length,count);assert.equal(caps.length,count);
  const young=componentPose(p,0),mature=componentPose(p,10);
  for(const part of p.parts){assert.equal(young[part.id].growth,0);assert.equal(mature[part.id].growth,1);assert.ok(mature[part.id].anchor.every(Number.isFinite));if(part.kind==='foliage'){assert.deepEqual(mature[part.id].anchor,p.parts[part.parent].end);assert.ok(part.begin>=p.parts[part.parent].begin+p.parts[part.parent].duration);}}
  assert.equal(p.parts.filter(p=>p.shape==='mushroom-spots').length,mushroomForm==='fly-agaric'?count:0);
 }
 assert.ok(total>200&&hues.size>100);assert.deepEqual([...families].sort(),['bolete','chanterelle','fly-agaric']);assert.ok(counts.has(1)&&counts.has(3)&&counts.has(7));
 const menu=SPAWN_MENU_ITEMS.find(i=>i.label==='Mushrooms');assert.deepEqual(menu.children.map(i=>i.id),['bolete','fly-agaric','chanterelle']);
});
test('mushroom families select, grow, clone, batch, raycast and restore as one planting',()=>{
 for(const family of ['bolete','fly-agaric','chanterelle']){
  const seed=selectPlantSeed(family,()=>42).seed,structure=generatePlant(seed);assert.equal(structure.parameters.mushroomForm,family);
  const scene=new THREE.Scene(),renderer=new PlantRenderer(scene),manager=new PlantManager(renderer,()=>seed,()=>0,()=>1);
  manager.chooseType(family);const p=manager.plant(new THREE.Vector3(),0);manager.copy(p.id);const clone=manager.plant(new THREE.Vector3(1,0,0),0);
  for(const age of [0,2,5,8,10]){manager.update(age);for(const {mesh} of p.visual.batches)assert.ok([...mesh.instanceMatrix.array].every(Number.isFinite));}
  for(const batch of p.visual.batches){const other=clone.visual.batches.find(b=>b.key===batch.key);assert.deepEqual(batch.mesh.instanceMatrix.array,other.mesh.instanceMatrix.array);assert.deepEqual(batch.mesh.instanceColor.array,other.mesh.instanceColor.array);}
  const cap=p.visual.batches.find(b=>b.key==='mushroom-'+family),matrix=new THREE.Matrix4();cap.mesh.getMatrixAt(0,matrix);const center=new THREE.Vector3(0,.3,0).applyMatrix4(matrix);
  const ray=new THREE.Raycaster(center.clone().add(new THREE.Vector3(0,2,0)),new THREE.Vector3(0,-1,0));assert.ok(ray.intersectObject(p.visual.group,true).some(h=>h.object.userData.plantId===p.id));assert.ok(p.visual.matureSlots);
  const records=manager.snapshot(10);manager.restore(records,20);assert.deepEqual([...manager.instances.values()][0].structure,structure);
  manager.reset();assert.equal(renderer.matureBatches.pools.size,0);renderer.dispose();
 }
});

test('mushroom palettes cover uniform HSB ranges with visible within-cluster variations',()=>{
 const bins=Array.from({length:3},()=>Array(10).fill(0));let clusters=0;
 for(let seed=0;seed<18000;seed++){
  const p=generatePlant(seed);if(p.parameters.form!=='mushroom')continue;
  const base=[p.parameters.capHue,p.parameters.capSaturation,p.parameters.capBrightness];
  base.forEach((v,i)=>{assert.ok(v>=0&&v<=1);bins[i][Math.min(9,Math.floor(v*10))]++;});
  const caps=p.parts.filter(c=>c.shape==='mushroom-'+p.parameters.mushroomForm);
  for(const cap of caps){
   assert.ok(Math.abs(((cap.hue-base[0]+1.5)%1)-.5)<=.07+1e-9);
   assert.ok(Math.abs(cap.saturation-base[1])<=.18+1e-9);assert.ok(Math.abs(cap.brightness-base[2])<=.20+1e-9);
   assert.ok(cap.hue>=0&&cap.hue<=1&&cap.saturation>=0&&cap.saturation<=1&&cap.brightness>=0&&cap.brightness<=1);
  }
  if(caps.length>1){clusters++;assert.ok(new Set(caps.map(c=>c.hue)).size>1);}
 }
 for(const counts of bins){const expected=counts.reduce((a,b)=>a+b)/10;for(const count of counts)assert.ok(Math.abs(count-expected)<expected*.25);}
 assert.ok(clusters>1000);
});
