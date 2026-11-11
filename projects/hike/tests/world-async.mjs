import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Worker as NodeWorker} from 'node:worker_threads';
import {createWorldAsync} from '../world-async.mjs';
import {cachedWorld} from './helpers/world-fixture.mjs';
class FakeWorker {
 postMessage(data){this.request=data;}terminate(){this.terminated=true;}
 send(data){this.onmessage({data});}
}
test('asynchronous generation forwards progress and stops failed workers',async()=>{
 const worker=new FakeWorker(),progress=[],promise=createWorldAsync({seed:1},{workerFactory:()=>worker,onProgress:(...v)=>progress.push(v)});
 assert.deepEqual(worker.request,{type:'generate',options:{seed:1}});
 worker.send({type:'progress',value:.45,label:'Planning the trail'});assert.deepEqual(progress,[[.45,'Planning the trail']]);
 worker.send({type:'error',message:'No route'});await assert.rejects(promise,/No route/);assert.equal(worker.terminated,true);
 worker.send({type:'progress',value:1});assert.equal(progress.length,1);
});
test('cancellation, worker launch, runtime and message errors reject cleanly',async()=>{
 for(const kind of ['abort','runtime','message','launch']){
  const worker=new FakeWorker(),controller=new AbortController(),promise=createWorldAsync({}, {signal:controller.signal,workerFactory:()=>{if(kind==='launch')throw Error('launch failed');return worker;}});
  if(kind==='abort')controller.abort();
  if(kind==='runtime')worker.onerror({message:'runtime failed'});
  if(kind==='message')worker.onmessageerror();
  await assert.rejects(promise);if(kind!=='launch')assert.equal(worker.terminated,true);
 }
 let created=false;const controller=new AbortController();controller.abort();
 await assert.rejects(createWorldAsync({}, {signal:controller.signal,workerFactory:()=>{created=true;}}),{name:'AbortError'});assert.equal(created,false);
});
function realWorker(){
 const url=new URL('../generation-worker.mjs',import.meta.url).href;
 const code=`const {parentPort}=require('node:worker_threads');globalThis.self={postMessage:(...args)=>parentPort.postMessage(...args)};(async()=>{await import(${JSON.stringify(url)});parentPort.on('message',data=>self.onmessage({data}));})();`;
 const node=new NodeWorker(code,{eval:true}),adapter={postMessage:data=>node.postMessage(data),terminate:()=>{adapter.terminated=true;node.terminate();}};
 node.on('message',data=>adapter.onmessage({data}));node.on('error',error=>adapter.onerror({message:error.message}));return adapter;
}
test('real generation worker remains asynchronous and restores deterministic gameplay queries',async()=>{
 let ticks=0;const timer=setInterval(()=>ticks++,5),progress=[],worker=realWorker();let world;
 try{world=await createWorldAsync({seed:41729},{workerFactory:()=>worker,onProgress:(value,label)=>progress.push({value,label})});}finally{clearInterval(timer);worker.terminate();}
 assert.ok(ticks>20,'main event loop must keep servicing timers');assert.equal(worker.terminated,true);
 assert.ok(progress.some(p=>p.label==='Eroding the mountain'));assert.equal(progress.at(-1).value,.92);
 assert.equal(world.renderGrid.vertexCount,150057);assert.equal(world.renderGrid.indices.length/3,299612);
 for(let i=1;i<progress.length;i++)assert.ok(progress[i].value>=progress[i-1].value);
 const reference=await cachedWorld();assert.deepEqual(world.route,reference.route);assert.deepEqual(world.landscape.heights,reference.landscape.heights);
 for(const i of [0,100,400,700,800])for(const delta of [0,2,20,200]){
  const p=world.route[i],x=p.x+delta,z=p.z-delta;
  assert.equal(world.height(x,z),reference.height(x,z));assert.equal(world.rawHeight(x,z),reference.rawHeight(x,z));
  assert.deepEqual(world.normal(x,z,{}),reference.normal(x,z,{}));assert.deepEqual(world.trail(x,z,{},true),reference.trail(x,z,{},true));
 }
});
