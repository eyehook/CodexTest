import {test} from 'node:test';
import assert from 'node:assert/strict';
import {defaults,terrainHeight} from '../../src/fishing/height.mjs';
import {bands} from '../../src/fishing/bands.mjs';
import {GrassPopulation,GRASS_RADIUS,PATCH_SIZE,GENERATION_BUDGET,PATCH_SLOTS,BLADES_PER_PATCH,STRIDE} from '../../src/fishing/grass/GrassPopulation.mjs';
import {GrassSystem} from '../../src/fishing/grass/GrassSystem.js';
import * as THREE from '../../projects/forest/vendor/three.module.js';
function settle(p,x,z){for(let i=0;i<1000;i++){p.update(x,z);assert.ok(p.generatedLastFrame<=GENERATION_BUDGET);if(!p.pending)return;}assert.fail('generation did not settle');}
function settleSystem(s,x,z){for(let i=0;i<1000;i++){s.update(x,z,30,2,3);if(!s.population.pending)return;}assert.fail('generation did not settle');}
function blades(p){const out=[];for(const c of p.patches)for(let i=0;i<c.count;i++){const d=c.data,j=i*STRIDE;out.push([c.cx*PATCH_SIZE+d[j],d[j+1],c.cz*PATCH_SIZE+d[j+2]]);}return out.sort((a,b)=>a[0]-b[0]||a[2]-b[2]);}
test('fixed patches preserve deterministic uniform grass and biome exclusion',()=>{
 const a=new GrassPopulation(defaults),b=new GrassPopulation(defaults);settle(a,-120,-60);settle(b,-120,-60);
 assert.deepEqual(blades(a),blades(b));assert.ok(a.count>100);assert.ok(a.count<=50000);
 assert.equal(GRASS_RADIUS,45.72);
 for(const [x,y,z]of blades(a)){assert.ok(y>defaults.amplitude*bands.beachEnd);assert.ok(y<defaults.amplitude*bands.snowStart);assert.ok(Math.abs(y-terrainHeight(x,z,defaults))<0.00001);}
 for(const p of a.patches){for(let i=0;i<p.count;i++){const height=p.data[i*STRIDE+4];assert.ok(height>=0.09-1e-7&&height<=0.21+1e-7);}
 const squares=new Set();for(let i=0;i<p.count;i++){const j=i*STRIDE,k=`${Math.floor(p.data[j]*2)},${Math.floor(p.data[j+2]*2.5)}`;assert.ok(!squares.has(k));squares.add(k);}}
});
test('fixed patch pool covers the entire 150 foot circle across movement tiles within 50000 slots',()=>{
 const p=new GrassPopulation(defaults);
 for(const ox of [-8,-6,-4,-2,0,2,4,6,8])for(const oz of [-8,-6,-4,-2,0,2,4,6,8]){
  const x=-120+ox,z=-60+oz;p.update(x,z);
  assert.ok(PATCH_SLOTS*BLADES_PER_PATCH<=50000);
  // Include opposite corners of the movement tile, then sample the whole circle.
  for(const dx of [0,1.999])for(const dz of [0,1.999])for(let i=0;i<100;i++){
   const a=i*Math.PI/50,px=Math.floor(x/2)*2+dx+Math.cos(a)*GRASS_RADIUS,pz=Math.floor(z/2)*2+dz+Math.sin(a)*GRASS_RADIUS;
   assert.ok(p.patches.some(c=>c.cx===Math.floor(px/PATCH_SIZE)&&c.cz===Math.floor(pz/PATCH_SIZE)));
  }
 }
});
test('ordinary frames do no uploads, retained patches keep fixed slots, packed uploads stay consolidated',()=>{
 const s=new GrassSystem(new THREE.Scene(),{...defaults});settleSystem(s,-120,-60);
 const version=s.buffer.version,old=s.population.patches.map(p=>({slot:p.slot,cx:p.cx,cz:p.cz}));
 s.update(-119.9,-59.9,31,4,5);assert.equal(s.buffer.version,version);assert.equal(s.mesh.position.x,4);assert.equal(s.material.uniforms.ground.value,31);
 s.buffer.clearUpdateRanges();s.update(-117.9,-59.9,31,4,5);
 let retained=0;for(const p of old){const match=s.population.patches.find(c=>c.cx===p.cx&&c.cz===p.cz);if(match){assert.equal(match.slot,p.slot);retained++;}}assert.ok(retained>30);
 assert.ok(s.buffer.updateRanges.length<=1);assert.ok(s.geometry.instanceCount<=50000);
 s.enabled=false;const uploads=s.uploads;s.update(100,100,0,0,0);assert.equal(s.mesh.visible,false);assert.equal(s.uploads,uploads);
});
test('teleports, invalidation and billion-meter rebasing preserve coverage and model positions',()=>{
 const s=new GrassSystem(new THREE.Scene(),{...defaults});settleSystem(s,-120,-60);const first=blades(s.population);
 for(const [x,z]of [[500,500],[1e9,-1e9],[-120,-60]]){
  settleSystem(s,x,z);assert.ok(s.geometry.instanceCount<=50000);
  const a=s.geometry.attributes.bladeBase;
  for(const p of s.population.patches){for(let i=0;i<p.count;i++){const j=i*STRIDE,slot=p.slot*BLADES_PER_PATCH+i;assert.ok(Math.abs(a.getX(slot)+s.anchorX-(p.cx*PATCH_SIZE+p.data[j]))<0.001);assert.ok(Math.abs(a.getZ(slot)+s.anchorZ-(p.cz*PATCH_SIZE+p.data[j+2]))<0.001);}
   for(let i=p.count;i<BLADES_PER_PATCH;i++)assert.equal(s.geometry.attributes.bladeShape.getY(p.slot*BLADES_PER_PATCH+i),0);
  }
 }
 assert.deepEqual(blades(s.population),first);s.invalidate();settleSystem(s,-120,-60);assert.deepEqual(blades(s.population),first);
 for(const value of Object.values(s.timings))assert.ok(Number.isFinite(value)&&value>=0);
});
test('zero-amplitude terrain clears all grass on invalidation',()=>{
 const c={...defaults},s=new GrassSystem(new THREE.Scene(),c);settleSystem(s,-120,-60);assert.ok(s.population.count>0);
 c.amplitude=0;s.invalidate();settleSystem(s,-120,-60);assert.equal(s.population.count,0);assert.equal(s.mesh.visible,false);
 for(let i=0;i<s.geometry.instanceCount;i++)assert.equal(s.geometry.attributes.bladeShape.getY(i),0);
});

test('partly generated patches stay hidden, including during large-coordinate rebasing',()=>{
 const s=new GrassSystem(new THREE.Scene(),{...defaults});
 for(const [x,z]of [[-120,-60],[1e9,-1e9]]){
  s.update(x,z,0,0,0);assert.ok(s.population.generatedLastFrame<=GENERATION_BUDGET);
  for(const p of s.population.patches)if(p.cursor<BLADES_PER_PATCH)for(let i=0;i<BLADES_PER_PATCH;i++)assert.equal(s.geometry.attributes.bladeShape.getY(p.slot*BLADES_PER_PATCH+i),0);
 }
});
