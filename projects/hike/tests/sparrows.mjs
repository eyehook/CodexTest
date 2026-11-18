import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../../../shared/vendor/three-r180/three.module.js';
import {Sparrows} from '../sparrows.mjs';
import {generateSparrowEncounters} from '../sparrow-placement.mjs';
import {generatePines} from '../flora-placement.mjs';
import {cachedWorld,snapshotWorld,restoreWorld} from './helpers/world-fixture.mjs';
const record=(kind='ground',id='g:0',x=0)=>({id,kind,x,y:0,z:0,count:5,seed:42,canopy:4});
function system(records=[record()],height=()=>0){return new Sparrows(new T.Scene(),{height,sparrowEncounters:records});}
test('hidden trees allocate no birds; consumption survives retirement, revisit and exhausted pool',()=>{
 const r=record('tree'),s=system([r]),p=new T.Vector3(40,1.7,0);s.update(.02,p);assert.equal(s.instanceCount,0);assert.ok(s.flocks.every(f=>!f.record));
 let launches=0;s.onTakeoff=()=>launches++;
 p.x=3;s.update(.05,p);s.update(.05,p);assert.equal(launches,1);assert.ok(s.consumed.has(r.id));assert.ok(s.flocks[0].flying);
 p.x=1000;for(let i=0;i<10;i++)s.update(.05,p);assert.ok(s.flocks.every(f=>!f.record));p.x=0;for(let i=0;i<10;i++)s.update(.05,p);assert.equal(s.instanceCount,0);assert.equal(launches,1);
 for(let i=0;i<20;i++)s.trigger(record('tree',`t:${i}`),p);assert.equal(s.consumed.size,21);assert.equal(s.flocks.filter(f=>f.record).length,12);s.dispose();
});
test('foragers stream out and back; disturbed ground encounters never return',()=>{
 const r=record(),s=system([r]),p=new T.Vector3(20,1.7,0);s.update(.05,p);assert.equal(s.instanceCount,5);
 const matrices=s.meshes[0].instanceMatrix.array.slice();for(let i=0;i<20;i++)s.update(.05,p);assert.notDeepEqual(matrices,s.meshes[0].instanceMatrix.array);
 p.x=1000;for(let i=0;i<3;i++)s.update(.05,p);assert.equal(s.instanceCount,0);assert.equal(s.consumed.size,0);
 p.x=20;for(let i=0;i<3;i++)s.update(.05,p);assert.equal(s.instanceCount,5);
 p.x=3;for(let i=0;i<10;i++)s.update(.05,p);assert.ok(s.consumed.has(r.id));assert.ok(new Set(s.flocks[0].birds.slice(0,5).map(b=>b.delay)).size>1);s.dispose();
});
test('flight climbs terrain, separates, stays bounded and recycles beyond fade distance',()=>{
 const height=(x,z)=>Math.max(0,x-8)*1.5+Math.max(0,z-40)*2,r=record(),s=system([r],height),p=new T.Vector3(-3,1.7,0);s.trigger(r,p);
 let min=Infinity;for(let i=0;i<600;i++){s.update(1/60,p);const f=s.flocks[0];for(let j=0;j<5;j++){const b=f.birds[j];assert.ok(Number.isFinite(b.y));assert.ok(b.y>=height(b.x,b.z)-1e-8);for(let k=j+1;k<5;k++){const o=f.birds[k];min=Math.min(min,Math.hypot(b.x-o.x,b.y-o.y,b.z-o.z));}}}
 assert.ok(min>.12,`minimum separation ${min}`);assert.ok(s.flocks[0].birds[0].x>40);
 p.set(-1000,0,0);s.update(.05,p);assert.equal(s.instanceCount,0);assert.equal(s.flocks[0].record,null);assert.equal(s.meshes.length,3);assert.equal(s.geometries[0].attributes.position.count/3+2*s.geometries[1].attributes.position.count/3,38);s.dispose();
});
test('real-world encounters are deterministic, sparse, suitable, stable under tree reordering and snapshot-safe',async()=>{
 const w=await cachedWorld();w.flora=generatePines(w);const a=generateSparrowEncounters(w),b=generateSparrowEncounters(w);assert.deepEqual(a,b);
 const trees=a.filter(r=>r.kind==='tree'),ground=a.filter(r=>r.kind==='ground');assert.ok(trees.length/w.flora.count>.045&&trees.length/w.flora.count<.055);assert.ok(ground.length>=2);
 for(const r of ground){assert.ok(w.normal(r.x,r.z,{}).slope<24);assert.equal(w.height(r.x,r.z),r.y);}
 w.sparrowEncounters=a;assert.deepEqual(restoreWorld(structuredClone(snapshotWorld(w))).sparrowEncounters,a);
 const reversed=new Float32Array(w.flora.trees.length);for(let i=0;i<w.flora.count;i++)reversed.set(w.flora.trees.subarray(i*9,i*9+9),(w.flora.count-1-i)*9);
 w.flora={...w.flora,trees:reversed};assert.deepEqual(generateSparrowEncounters(w).filter(r=>r.kind==='tree').reverse(),trees);
});

test('tree flocks escape beside the canopy from any approach; ground flocks escape away',()=>{
 for(const seed of [42,43])for(const angle of [0,.7,1.57,3.14,4.7]){
  const r={...record('tree'),seed},p=new T.Vector3(Math.cos(angle)*20,1.7,Math.sin(angle)*20),s=system([r]);s.trigger(r,p);
  const f=s.flocks[0],awayX=-p.x/20,awayZ=-p.z/20;
  assert.ok(Math.abs(f.dx*awayX+f.dz*awayZ)<1e-12);
  assert.ok(Math.abs(Math.hypot(f.dx,f.dz)-1)<1e-12);
  assert.equal(Math.sign(awayX*f.dz-awayZ*f.dx),seed&1?1:-1);
  for(let i=0;i<90;i++)s.update(1/60,p);
  const x=f.birds.slice(0,5).reduce((v,b)=>v+b.x,0)/5,z=f.birds.slice(0,5).reduce((v,b)=>v+b.z,0)/5;
  assert.ok(x*f.dx+z*f.dz>5,'flock clears the tree sideways');s.dispose();
 }
 const r=record(),s=system([r]);s.trigger(r,new T.Vector3(-10,1.7,0));assert.equal(s.flocks[0].dx,1);assert.equal(s.flocks[0].dz,0);s.dispose();
});
