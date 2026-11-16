import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createWorld} from '../world.mjs';
import {cachedWorld} from './helpers/world-fixture.mjs';
import {createTerrainSampler} from '../terrain-sampler.mjs';
import {SlopeSlide} from '../movement.mjs';
const world=createWorld();
test('seed reproduces terrain, route and summit independent of query order',async()=>{
 const other=createWorld();assert.deepEqual(world.route,other.route);
 const samples=[[-390,220],[10,50],[270,-100],[0,260],[0,-470]];
 const expected=samples.map(([x,z])=>world.height(x,z));
 for(const [x,z] of [...samples].reverse())other.height(x,z);
 assert.deepEqual(samples.map(([x,z])=>other.height(x,z)),expected);
 assert.notEqual((await cachedWorld({seed:42})).rawHeight(270,-100),world.rawHeight(270,-100));
});
test('validated routes remain continuous, grounded and walkable for multiple seeds',async()=>{
 for(const seed of [41729,1,42,999,123456]){
  const w=await cachedWorld({seed}),slide=new SlopeSlide(w);assert.ok(w.totalLength>=1300&&w.totalLength<=2000);assert.ok(w.maxGrade<=.301);
  assert.ok(w.totalLength/1.4/60>15&&w.totalLength/1.4/60<24);
  for(let i=0;i<w.route.length;i++){
   const p=w.route[i];assert.ok(Math.abs(w.height(p.x,p.z)-p.y)<1e-8);
   const n=w.normal(p.x,p.z);assert.ok(Number.isFinite(n.slope));assert.ok(n.slope<30,`seed ${seed} slope ${n.slope} at ${i}`);
   assert.equal(slide.update(p.x,p.z,1/72,35,14).active,false,`trail slides ${seed}:${i}`);
  }
 }
});
test('flat outer continuation, independent height queries and sensible normals',()=>{
 assert.equal(world.height(2100,2100),world.boundaryHeight);assert.equal(world.height(-2100,0),world.boundaryHeight);
 const n=world.normal(2100,2100);assert.equal(n.slope,0);assert.equal(n.y,1);
 for(let x=-400;x<400;x+=70)for(let z=-400;z<450;z+=70){const n=world.normal(x,z);assert.ok(Math.abs(Math.hypot(n.x,n.y,n.z)-1)<1e-10);}
});
test('trail distance queries cover both ends and intermediate route points',()=>{
 for(const i of [0,50,200,400,799,800]){const p=world.route[i],q=world.trail(p.x,p.z,{},true);assert.ok(q.distance<1e-7);assert.ok(Math.abs(q.along-p.distance)<1e-6);}
});
test('default endpoints use the selected bench and lowered summit at the same map position',()=>{
 assert.deepEqual({x:world.start.x,y:world.start.y,z:world.start.z},world.landscape.start);
 assert.equal(world.summit.x,world.landscape.summit.x);assert.equal(world.summit.z,world.landscape.summit.z);
 assert.equal(world.summit.y,world.summitCut.level);assert.ok(world.summit.y<world.landscape.summit.y);
 assert.ok(Math.hypot(world.start.x-world.summit.x,world.start.z-world.summit.z)<950);
});

test('worker snapshot reproduces authoritative height, normals and trail projection',()=>{
 const sampler=createTerrainSampler(structuredClone(world.samplingData)),a={},b={},pa={},pb={};
 const points=[[-2100,10],[2100,0],[0,0],[-1920,-1920],[world.summit.x+1.5,world.summit.z]];
 for(let i=0;i<world.route.length;i+=7){const p=world.route[i];for(const d of [0,.125,1,2.5,5,15])points.push([p.x+d,p.z-d*.4]);}
 for(const [x,z] of points){assert.equal(sampler.height(x,z),world.height(x,z));sampler.normal(x,z,a);world.normal(x,z,b);assert.deepEqual(a,b);sampler.trail(x,z,pa);world.trail(x,z,pb);assert.equal(pa.distance,pb.distance);assert.equal(pa.along,pb.along);}
});

test('cached world faithfully restores a freshly generated world and its queries',async()=>{
 const cached=await cachedWorld();
 assert.deepEqual(cached.landscape.heights,world.landscape.heights);
 assert.deepEqual(cached.route,world.route);
 assert.deepEqual(cached.surface.vertices,world.surface.vertices);
 assert.deepEqual(cached.surface.walking,world.surface.walking);
 assert.equal(cached.mountain,cached.landscape);
 const points=[[-2100,0],[2100,0],[-1920,-1920],[0,0]];
 for(let i=0;i<world.route.length;i+=13){const p=world.route[i];for(const d of [0,.125,2.5,5,15])points.push([p.x+d,p.z-d*.4]);}
 for(const [x,z] of points){
  assert.equal(cached.rawHeight(x,z),world.rawHeight(x,z));
  assert.equal(cached.landscape.height(x,z),world.landscape.height(x,z));
  assert.equal(cached.height(x,z),world.height(x,z));
  assert.deepEqual(cached.normal(x,z),world.normal(x,z));
  assert.deepEqual(cached.trail(x,z),world.trail(x,z));
  assert.deepEqual(cached.trail(x,z,{},true),world.trail(x,z,{},true));
 }
 for(let i=0;i<world.surface.walking.length;i+=137)assert.equal(cached.surface.slope(cached.surface.walking[i]),world.surface.slope(world.surface.walking[i]));
});


test('lowered summits retain a level 3 m landing without building up the crest',async()=>{
 for(const seed of [41729,1,42,999,123456,1435171212]){
  const w=await cachedWorld({seed});assert.ok(w.summit.y<w.rawHeight(w.summit.x,w.summit.z));
  for(let z=-3;z<=3;z+=.25)for(let x=-3;x<=3;x+=.25){
   const wx=w.summit.x+x,wz=w.summit.z+z,y=w.height(wx,wz);
   assert.ok(y<=w.rawHeight(wx,wz)+1e-6,`raised crest seed ${seed} at ${x},${z}`);
   if(Math.hypot(x,z)<=1.5)assert.ok(Math.abs(y-w.summit.y)<1e-6,`landing seed ${seed}`);
  }
 }
});
