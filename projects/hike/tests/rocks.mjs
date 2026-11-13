import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Worker} from 'node:worker_threads';
import * as T from '../../../shared/vendor/three-r180/three.module.js';
import {Rocks,createRockGeometry} from '../rocks.mjs';
import {ROCKS,ROCK_STRIDE,rockCell} from '../rock-cells.mjs';
import {surfaceColor} from '../surface.mjs';
import {cachedWorld} from './helpers/world-fixture.mjs';
const flora={coverageSamples:0,coverageStep:{value:1}};
const synthetic=()=>({config:{seed:42,trailWidth:5},extent:1920,landscape:{summit:{y:220}},summit:{x:0,z:0},height:()=>30,normal:(x,z,out)=>Object.assign(out,{slope:10}),trail:(x,z,out)=>Object.assign(out,{distance:Math.abs(z)})});
test('seeded rocks keep trails and landing clear, use bounded natural colors/sizes and remain buried',()=>{
 const world=synthetic();let count=0,small=0,large=0;const largest=new Set();
 for(let cz=-6;cz<=6;cz++)for(let cx=-6;cx<=6;cx++){
  const a=rockCell(world,cx,cz);assert.deepEqual(a,rockCell(world,cx,cz));
  for(let i=0;i<a.count;i++){
   count++;const k=i*ROCK_STRIDE,d=a.data,size=Math.max(d[k+6],d[k+7],d[k+8]);if(d[k+6]<.5)small++;if(d[k+6]>1.5)large++;
   largest.add([d[k+6],d[k+7],d[k+8]].indexOf(size));
   assert.ok(size/Math.min(d[k+6],d[k+7],d[k+8])<=1.100001,'axis variation preserves original proportions');
   assert.ok(size>=.099&&size<=2.2);for(let j=6;j<9;j++)assert.ok(d[k+j]>=.099&&d[k+j]<=2.2);
   assert.ok(d[k+1]<world.height());assert.ok(Math.abs(d[k+2])>=3.5+size*.5-1e-5);assert.ok(Math.hypot(d[k],d[k+2])>=6+size*.5-1e-5);
   for(let j=3;j<6;j++)assert.ok(d[k+j]>=0&&d[k+j]<=Math.PI*2);
   for(let j=9;j<12;j++)assert.ok(d[k+j]>0&&d[k+j]<1);
  }
 }
 assert.equal(largest.size,3);assert.ok(count>100);assert.ok(small>large*3);
 const a=rockCell(world,4,4);world.config.seed++;assert.notDeepEqual(a,rockCell(world,4,4));
 world.normal=(x,z,out)=>Object.assign(out,{slope:50});assert.equal(rockCell(world,4,4).count,0);
});
test('one shared rock geometry has forty finite nondegenerate triangles',()=>{
 const g=createRockGeometry(),p=g.attributes.position;assert.equal(p.count,120);
 const edges=new Map(),key=v=>v.toArray().map(n=>n.toFixed(6)).join(',');
 for(const n of p.array)assert.ok(Number.isFinite(n));
 for(let i=0;i<p.count;i+=3)for(let j=0;j<3;j++){const a=new T.Vector3().fromBufferAttribute(p,i+j),b=new T.Vector3().fromBufferAttribute(p,i+(j+1)%3),id=[key(a),key(b)].sort().join('|');edges.set(id,(edges.get(id)??0)+1);}
 for(const count of edges.values())assert.equal(count,2,'closed rock mesh');
 for(let i=0;i<p.count;i+=3){const a=new T.Vector3().fromBufferAttribute(p,i),b=new T.Vector3().fromBufferAttribute(p,i+1),c=new T.Vector3().fromBufferAttribute(p,i+2);assert.ok(b.sub(a).cross(c.sub(a)).length()>.01);}
 g.dispose();
});
function settle(rocks,viewer){for(let i=0;i<30;i++){rocks.update(viewer);if(!rocks.queue.length)return;}throw Error('Did not settle');}
test('cell residency stays bounded, preserves retained matrices and reproduces rocks after distant travel',()=>{
 const rocks=new Rocks(new T.Scene(),synthetic(),flora,{workerFactory:null}),viewer=new T.Vector3(40,32,40);
 settle(rocks,viewer);assert.equal(rocks.cells.size,81);const record=rocks.cells.get('2,2'),start=record.slot*ROCKS.perCell*16,original=rocks.mesh.instanceMatrix.array.slice(start,start+ROCKS.perCell*16);
 settle(rocks,new T.Vector3(56,32,40));assert.equal(rocks.cells.get('2,2'),record);assert.deepEqual(rocks.mesh.instanceMatrix.array.slice(start,start+ROCKS.perCell*16),original);
 settle(rocks,new T.Vector3(-900,32,700));assert.equal(rocks.cells.size,81);assert.ok(rocks.instanceCount<=81*ROCKS.perCell);
 settle(rocks,viewer);const back=rocks.cells.get('2,2'),offset=back.slot*ROCKS.perCell*16;assert.deepEqual(rocks.mesh.instanceMatrix.array.slice(offset,offset+ROCKS.perCell*16),original);
 flora.coverageSamples=4;rocks.update(viewer,false);assert.equal(rocks.material.alphaToCoverage,true);flora.coverageSamples=0;
 rocks.dispose();assert.equal(rocks.mesh.parent,null);
});
class FakeWorker{
 postMessage(data){this.request=data;}terminate(){this.terminated=true;}
 complete(world){const q=this.request;this.onmessage({data:{type:'cells',id:q.id,cells:q.cells.map(c=>({...c,...rockCell(world,c.cx,c.cz)}))}});}
}
test('rock jobs apply during maintenance only, reject stale locations and disable on malformed results',()=>{
 const worker=new FakeWorker(),world=synthetic(),rocks=new Rocks(new T.Scene(),world,flora,{workerFactory:()=>worker}),viewer=new T.Vector3(40,32,40);
 rocks.update(viewer);assert.equal(worker.request.cells.length,4);worker.complete(world);rocks.update(viewer,false);assert.equal(rocks.cells.size,0);
 rocks.update(new T.Vector3(500,32,500));assert.equal(rocks.cells.size,0);worker.complete(world);rocks.update(new T.Vector3(500,32,500));assert.equal(rocks.cells.size,4);
 worker.onmessage({data:{type:'cells',id:rocks.id,cells:[]}});assert.ok(rocks.error);assert.equal(rocks.mesh.visible,false);assert.ok(worker.terminated);rocks.dispose();
});
test('real rock worker matches terrain placement and transfers deterministic cell data',async()=>{
 const world=await cachedWorld(),url=new URL('../rock-worker.mjs',import.meta.url).href;
 const code=`const {parentPort}=require('node:worker_threads');globalThis.self={postMessage:(...args)=>parentPort.postMessage(...args)};(async()=>{await import(${JSON.stringify(url)});parentPort.on('message',data=>self.onmessage({data}));})();`;
 const worker=new Worker(code,{eval:true});
 try{
  const result=new Promise((resolve,reject)=>{worker.once('message',resolve);worker.once('error',reject);});
  worker.postMessage({type:'init',samplingData:world.samplingData,extent:world.extent,summit:world.summit});
  const cx=Math.floor(world.start.x/16),cz=Math.floor(world.start.z/16),cells=[{key:`${cx},${cz}`,cx,cz}];
  worker.postMessage({type:'cells',id:1,cells});const reply=await result;assert.equal(reply.type,'cells');assert.deepEqual(reply.cells[0].data,rockCell(world,cx,cz).data);
 }finally{await worker.terminate();}
});

test('stone luminance follows local terrain within ten percent',()=>{
 const low=synthetic(),high=synthetic();high.height=()=>150;
 const a=rockCell(low,5,5),b=rockCell(high,5,5);assert.ok(a.count>0&&b.count>0);
 for(const [world,cell] of [[low,a],[high,b]])for(let i=0;i<cell.count;i++){
  const k=i*ROCK_STRIDE,d=cell.data,ground=surfaceColor(d[k],d[k+2],world.height(),10,220,world.config.seed,{});
  const expected=.2126*ground.r+.7152*ground.g+.0722*ground.b,actual=.2126*d[k+9]+.7152*d[k+10]+.0722*d[k+11];
  assert.ok(actual/expected>=.89999&&actual/expected<=1.10001);
  if(world===high){
   for(let j=0;j<a.count;j++){const offset=j*ROCK_STRIDE;if(d[k]===a.data[offset]&&d[k+2]===a.data[offset+2])assert.ok(actual>(.2126*a.data[offset+9]+.7152*a.data[offset+10]+.0722*a.data[offset+11])*1.5);}
  }
 }
});
