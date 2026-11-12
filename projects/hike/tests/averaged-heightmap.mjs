import {test} from 'node:test';
import assert from 'node:assert/strict';
import {AveragedHeightmap,RenderTerrainHeight} from '../averaged-heightmap.mjs';
import {TerrainSamples} from '../terrain-samples.mjs';
const plane=(x,z)=>40+x*.25-z*.125;
function world(height=plane){return {height,normal(x,z,out){Object.assign(out,{x:-.240771706,y:.963086825,z:.120385853,slope:15.616});return out;},landscape:{summit:{y:200}},config:{seed:1,trailWidth:5},trail(x,z,out){out.distance=100;return out;}};}
test('averages nine deterministic samples in a centered 16 m footprint',()=>{
 const calls=[],map=new AveragedHeightmap((x,z)=>{calls.push([x,z]);return x*x+z*z;});
 const value=map.node(-2,3);
 assert.equal(calls.length,9);assert.ok(calls.every(([x,z])=>Math.abs(x+32)<=8&&Math.abs(z-48)<=8));
 assert.ok(Math.abs(calls.reduce((sum,[x])=>sum+x,0)/9+32)<1e-12);
 assert.equal(value,Math.fround(calls.reduce((sum,[x,z])=>sum+x*x+z*z,0)/9));
 assert.equal(map.node(-2,3),value);assert.equal(calls.length,9);
 const other=new AveragedHeightmap((x,z)=>x*x+z*z);other.node(50,-50);assert.equal(other.node(-2,3),value);
});
test('world-aligned bilinear samples preserve planes across negative and tile boundaries',()=>{
 const map=new AveragedHeightmap(plane);
 for(const [x,z] of [[-1,-1],[-256.1,255.9],[16.5,-32.25],[2048.5,-1024.75]])assert.ok(Math.abs(map.sample(x,z)-plane(x,z))<1e-5);
 const nodes=map.nodeCount,bytes=map.byteLength;
 for(let i=0;i<10;i++)map.sample(16.5,-32.25);
 assert.equal(map.nodeCount,nodes);assert.equal(map.byteLength,bytes);
 map.sample(4000,-4000);assert.ok(map.nodeCount>nodes);
});
test('averaging attenuates narrow periodic detail while retaining broad shape',()=>{
 const height=(x,z)=>plane(x,z)+10*Math.cos(x*Math.PI/8),map=new AveragedHeightmap(height);
 for(let x=-64;x<=64;x+=2)assert.ok(Math.abs(map.sample(x,5)-plane(x,5))<1e-4);
});
test('nearby rendering is authoritative and cached distant queries avoid detailed terrain',()=>{
 let calls=0;const w=world((x,z)=>{calls++;return plane(x,z)+Math.sin(x);}),render=new RenderTerrainHeight(w),normal={};
 assert.equal(render.height(4,5,0,0),w.height(4,5));render.normal(4,5,0,0,normal);for(const k of ['x','y','z','slope'])assert.equal(normal[k],w.normal(4,5,{})[k]);
 render.height(400,5,0,0);render.normal(400,5,0,0,normal);const before=calls;
 for(let i=0;i<10;i++){render.height(400,5,0,0);render.normal(400,5,0,0,normal);}
 assert.equal(calls,before);
});
test('height sources and normals meet continuously at both blend boundaries',()=>{
 const w=world((x,z)=>plane(x,z)+8*Math.cos(x*.3)*Math.cos(z*.2)),render=new RenderTerrainHeight(w);
 // Use finite-difference authoritative normals for this curved fixture.
 w.normal=(x,z,out)=>{const e=.35,dx=(w.height(x+e,z)-w.height(x-e,z))/(2*e),dz=(w.height(x,z+e)-w.height(x,z-e))/(2*e),s=Math.hypot(dx,1,dz);Object.assign(out,{x:-dx/s,y:1/s,z:-dz/s});return out;};
 for(const radius of [120,336]){
  assert.ok(Math.abs(render.height(radius-1e-5,0,0,0)-render.height(radius+1e-5,0,0,0))<.001);
  const a=render.normal(radius-1e-5,0,0,0,{}),b=render.normal(radius+1e-5,0,0,0,{});
  for(const k of ['x','y','z'])assert.ok(Math.abs(a[k]-b[k])<.001);
 }
});
test('snapped samples refresh shared blend vertices and retain stable detailed/distant values',()=>{
 const w=world((x,z)=>plane(x,z)+10*Math.cos(x*Math.PI/8)),coordinates=[];
 for(let x=-32;x<=400;x++)coordinates.push(x*4,32);
 const samples=new TerrainSamples(w,new Int16Array(coordinates)),out=new Float32Array(samples.count*7),reference=new RenderTerrainHeight(w);
 samples.fill(0,0,out);const first=out.slice();samples.fill(16,0,out);let changed=0;
 for(let x=0;x<coordinates.length;x+=2){
  const wx=16+coordinates[x]/4,wz=8;
  assert.ok(Math.abs(out[x/2]-reference.height(wx,wz,24,8))<2e-5);
  if(wx>=144&&wx<=168&&out[x/2]!==first[x/2+16])changed++;
 }
 assert.ok(changed>0,'shared blend heights follow the new mesh center');
 const nodes=samples.renderHeight.map.nodeCount;samples.fill(0,0,out);
 for(let i=0;i<out.length;i++)assert.ok(Math.abs(out[i]-first[i])<2e-5);assert.equal(samples.renderHeight.map.nodeCount,nodes);
});

test('transition normals include the spatial derivative of the blend',()=>{
 const w=world((x,z)=>.01*x*x+.02*z*z);
 w.normal=(x,z,out)=>{const dx=.02*x,dz=.04*z,length=Math.hypot(dx,1,dz);Object.assign(out,{x:-dx/length,y:1/length,z:-dz/length});return out;};
 const render=new RenderTerrainHeight(w),x=151,z=33,e=.001,n=render.normal(x,z,0,0,{});
 const dx=(render.height(x+e,z,0,0)-render.height(x-e,z,0,0))/(2*e),dz=(render.height(x,z+e,0,0)-render.height(x,z-e,0,0))/(2*e);
 assert.ok(Math.abs(-n.x/n.y-dx)<.0001);assert.ok(Math.abs(-n.z/n.y-dz)<.0001);
});

test('overlap plans reuse snap directions, stay bounded and preserve uncached output',()=>{
 const coordinates=[];for(let z=-20;z<=20;z++)for(let x=-20;x<=20;x++)coordinates.push(x*4,z*4);
 const w=world(),cached=new TerrainSamples(w,new Int16Array(coordinates)),reference=new TerrainSamples(w,new Int16Array(coordinates));
 const a=new Float32Array(cached.count*7),b=a.slice();
 for(const [x,z] of [[0,0],[16,0],[32,0],[16,16],[-16,-16],[0,0],[2000,2000],[0,0]]){
  reference.overlapPlans.clear();cached.fill(x,z,a);reference.fill(x,z,b);assert.deepEqual(a,b);
 }
 const plan=cached.overlapPlan(64,0),builds=cached.overlapPlanBuilds;assert.equal(cached.overlapPlan(64,0),plan);assert.equal(cached.overlapPlanBuilds,builds);
 for(let i=1;i<20;i++)cached.overlapPlan(i*64,0);assert.equal(cached.overlapPlans.size,8);
});
