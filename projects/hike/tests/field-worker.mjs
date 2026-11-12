import test from 'node:test';
import assert from 'node:assert/strict';
import {Worker as NodeWorker} from 'node:worker_threads';
import * as T from '../../../shared/vendor/three-r180/three.module.js';
import {TriangleField,fieldCell,BLADES_PER_CELL} from '../triangle-field.mjs';
import {cachedWorld} from './helpers/world-fixture.mjs';
import {elevationRange} from '../flora-placement.mjs';
const flora={coverageSamples:0,coverageStep:{value:1}};
function synthetic(){return {config:{seed:41729,trailWidth:5},extent:1920,flora:{range:{min:0,max:100}},landscape:{summit:{y:100}},summit:{x:1000,z:1000},height:()=>30,normal:(x,z,out)=>Object.assign(out,{slope:0}),trail:(x,z,out)=>Object.assign(out,{distance:100})};}
class FakeWorker{
 postMessage(data,transfer){this.request=data;this.transfer=transfer;this.requests=(this.requests??0)+1;}terminate(){this.terminated=true;}
 complete(world){const data=this.request;this.onmessage({data:{type:'cells',id:data.id,workerMs:2,cells:data.cells.map(record=>({...record,data:fieldCell(world,record.cx,record.cz)}))}});}
}
test('grass worker owns generation; results apply only during updates and stale cells do not teleport back',()=>{
 const reference=synthetic(),world=synthetic(),worker=new FakeWorker();world.height=world.normal=world.trail=()=>{throw Error('Main thread generated grass');};
 const field=new TriangleField(new T.Scene(),world,flora,{workerFactory:()=>worker}),viewer=new T.Vector3(0,32,0);
 assert.equal(worker.request.type,'init');field.update(viewer);assert.equal(worker.request.cells.length,4);assert.equal(field.cells.size,0);const requests=worker.requests;
 field.update(viewer);assert.equal(worker.requests,requests);worker.complete(reference);assert.equal(field.cells.size,0);
 field.update(viewer,false);assert.equal(field.cells.size,0);field.update(viewer);assert.equal(field.cells.size,4);assert.ok(worker.request.buffers.length===4);assert.equal(worker.transfer.length,12);
 field.update(new T.Vector3(500,32,500));worker.complete(reference);field.update(new T.Vector3(500,32,500));assert.equal(field.cells.size,0);assert.ok(worker.request.cells.every(c=>Math.abs(c.cx-62)<=7&&Math.abs(c.cz-62)<=7));
 field.dispose();worker.complete(reference);assert.equal(field.cells.size,0);assert.equal(worker.terminated,true);
});
test('worker launch, runtime, message and malformed-result failures disable the field without synchronous fallback',()=>{
 for(const kind of ['launch','runtime','message','invalid']){
  const worker=new FakeWorker(),field=new TriangleField(new T.Scene(),synthetic(),flora,{workerFactory:()=>{if(kind==='launch')throw Error('launch');return worker;}});
  if(kind==='runtime')worker.onerror({message:'runtime'});if(kind==='message')worker.onmessageerror();
  if(kind==='invalid'){field.update(new T.Vector3());worker.onmessage({data:{type:'cells',id:field.requestId,cells:[]}});}
  assert.ok(field.error);assert.equal(field.mesh.visible,false);assert.equal(field.geometry.instanceCount,0);if(kind!=='launch')assert.equal(worker.terminated,true);field.dispose();
 }
});
function realWorker(){
 const url=new URL('../field-worker.mjs',import.meta.url).href;
 const code=`const {parentPort}=require('node:worker_threads');globalThis.self={postMessage:(...args)=>parentPort.postMessage(...args)};(async()=>{await import(${JSON.stringify(url)});parentPort.on('message',data=>self.onmessage({data}));})();`;
 const node=new NodeWorker(code,{eval:true}),adapter={postMessage:(...args)=>node.postMessage(...args),terminate:()=>node.terminate()};node.on('message',data=>adapter.onmessage({data}));node.on('error',error=>adapter.onerror({message:error.message}));return adapter;
}
test('real grass worker matches exact synchronous cell data and keeps the main event loop responsive',async()=>{
 const world=await cachedWorld();world.flora={range:elevationRange(world)};
 const worker=realWorker(),field=new TriangleField(new T.Scene(),world,flora,{workerFactory:()=>worker});let ticks=0;const timer=setInterval(()=>ticks++,1);
 try{
  const point=world.route[200],viewer=new T.Vector3(point.x,point.y,point.z);
  const began=performance.now();
  do{field.update(viewer);if(field.error)throw field.error;await new Promise(resolve=>setTimeout(resolve,1));if(performance.now()-began>10000)throw Error('Worker timed out');}while(field.cells.size<12);
  assert.ok(ticks>5);assert.ok(field.workerMs>=0);
  for(const record of field.cells.values()){
   const expected=fieldCell(world,record.cx,record.cz);assert.equal(record.count,expected.count);
   for(const [name,data] of [['fieldRoot',expected.root],['fieldShape',expected.shape],['fieldColor',expected.color]]){const attribute=field.attributes[name],size=attribute.itemSize;for(let i=0;i<record.count;i++){const offset=record.bladeSlots[i]*size;assert.deepEqual(attribute.array.slice(offset,offset+size),data.slice(i*size,(i+1)*size));}}
  }
 }finally{clearInterval(timer);field.dispose();}
});
