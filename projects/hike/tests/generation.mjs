import {test} from 'node:test';
import assert from 'node:assert/strict';
import {cachedWorld} from './helpers/world-fixture.mjs';
const seeds=[41729,1,3,8,42,999,15,3307485663];
const worlds=[];for(const seed of seeds)worlds.push(await cachedWorld({seed}));
test('one unified heightfield covers the main hiking area and distant ridges',()=>{
 for(const w of worlds){
  assert.equal(w.landscape.gridSize,1025);assert.equal(w.extent,1920);
  let min=Infinity,max=-Infinity;
  for(const value of w.landscape.heights){assert.ok(Number.isFinite(value)&&value>=0);min=Math.min(min,value);max=Math.max(max,value);}
  assert.ok(w.start.y>min);assert.ok(w.start.y<w.summit.y*.35);assert.equal(w.summit.y,max);
  assert.ok(Math.hypot(w.summit.x,w.summit.z)<700,'highest point should be central');
  const distant=[];for(let x=-1400;x<=1400;x+=200)for(let z=-1400;z<=1400;z+=200)if(Math.hypot(x,z)>900)distant.push(w.rawHeight(x,z));
  assert.ok(Math.max(...distant)-Math.min(...distant)>15,'surroundings should be real varied terrain');
  assert.ok(distant.filter(h=>h>w.boundaryHeight+5).length>distant.length*.7);
 }
});
test('seed changes ridge networks throughout the unified landscape',()=>{
 const a=worlds[0];
 for(const b of worlds.slice(1)){
  let sum=0,count=0;for(let x=-1200;x<=1200;x+=200)for(let z=-1200;z<=1200;z+=200){sum+=(a.rawHeight(x,z)/a.summit.y-b.rawHeight(x,z)/b.summit.y)**2;count++;}
  assert.ok(Math.sqrt(sum/count)>.035);
 }
});
test('default low-bench-to-highest routes remain walkable and within view range',()=>{
 for(const w of worlds){
  assert.ok(w.totalLength>1300&&w.totalLength<2000,`seed ${w.config.seed}: length ${w.totalLength}`);
  assert.ok(w.maxGrade<=.301);
  // Width-aware switchbacks and the level arrival approach need cut/fill.
  // Seed 1 now reaches 35.13 m; retain a bounded 36 m regression budget.
  assert.ok(w.maxEarthwork<36,`seed ${w.config.seed}: earthwork ${w.maxEarthwork}`);
  assert.ok(Math.hypot(w.start.x-w.summit.x,w.start.z-w.summit.z)<950);
  assert.deepEqual(w.sections,[{kind:'ground',start:0,end:800}]);
  for(let i=0;i<w.route.length;i++){const p=w.route[i];assert.ok(Math.abs(w.height(p.x,p.z)-p.y)<1e-6);assert.ok(w.normal(p.x,p.z).slope<30,`seed ${w.config.seed}, point ${i}`);}
 }
});
test('explicit endpoints alter route planning without regenerating different geology',async()=>{
 const a=worlds[0],start={x:-900,z:-600},end={x:-600,z:-300};
 const b=await cachedWorld({seed:a.config.seed,start,end,targetLength:1000});
 assert.deepEqual(a.landscape.heights,b.landscape.heights);
 assert.equal(b.start.x,start.x);assert.equal(b.start.z,start.z);assert.equal(b.summit.x,end.x);assert.equal(b.summit.z,end.z);
 assert.equal(b.start.y,b.rawHeight(start.x,start.z));assert.equal(b.summit.y,b.rawHeight(end.x,end.z));
 for(let i=0;i<32;i++){const x=end.x+1.5*Math.cos(i*Math.PI/16),z=end.z+1.5*Math.sin(i*Math.PI/16);assert.ok(Math.abs(b.height(x,z)-b.summit.y)<1e-7);}

});

test('destination landing stays level across its three-metre disk for every seed',()=>{
 for(const w of worlds)for(let r=0;r<=1.5;r+=.25)for(let i=0;i<32;i++){
  const x=w.summit.x+r*Math.cos(i*Math.PI/16),z=w.summit.z+r*Math.sin(i*Math.PI/16);
  assert.ok(Math.abs(w.height(x,z)-w.summit.y)<1e-7,`seed ${w.config.seed}: landing at ${x},${z}`);
  assert.ok(w.normal(x,z).slope<1e-5);
 }
});
