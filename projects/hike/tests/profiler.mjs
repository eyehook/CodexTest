import test from 'node:test';
import assert from 'node:assert/strict';
import {Worker as NodeWorker} from 'node:worker_threads';
import {HikeProfiler} from '../profiler.mjs';
import {GpuTimer} from '../gpu-timer.mjs';
import {buildProfileReport,COLUMNS,COLUMN} from '../profiler-report.mjs';
const metadata={seed:41729,appVersion:'test',mode:'immersive-vr',xrFrameRate:100,settings:{shadows:true}};
const info={server:'CodexTest VR',version:1,maxCaptureBytes:32*1024*1024};
function memoryStore(){let value=null;return {async load(){return structuredClone(value);},async save(next){value=structuredClone(next);}};}
const success=async path=>({ok:true,status:path==='/__debug/info'?200:201,json:async()=>path==='/__debug/info'?info:{ok:true,file:'hike/test.json'}});
async function until(predicate){const began=Date.now();while(!predicate()){if(Date.now()-began>3000)throw Error('Timed out');await new Promise(resolve=>setTimeout(resolve,1));}}
function frame(profiler,time){assert.equal(profiler.beginFrame(time,'immersive-vr'),true);profiler.set('navigationMs',1);profiler.set('renderSubmitMs',2);profiler.set('terrainSnaps',0);profiler.set('grassJobs',0);profiler.endFrame(time+4);}
test('capture records active gameplay only, pauses without counting gaps, persists and auto-uploads',async()=>{
 const store=memoryStore(),notices=[],profiler=new HikeProfiler({store,fetcher:success,durationMs:100,onNotice:value=>notices.push(value)});
 assert.ok(profiler.start(metadata));profiler.noteTerrain({updateMs:2,sampleMs:7,latencyMs:12});frame(profiler,0);frame(profiler,10);profiler.pause();profiler.noteTerrain({updateMs:99,sampleMs:99,latencyMs:99});
 frame(profiler,10000);frame(profiler,10090);assert.equal(profiler.running,false);await until(()=>profiler.last&&!profiler.busy);
 const report=JSON.parse(profiler.last.json);assert.equal(report.schemaVersion,1);assert.equal(report.metadata.seed,41729);assert.equal(report.metadata.pauses,1);assert.equal(report.summary.activeSeconds,.1);assert.equal(report.samples[0][COLUMN.terrainApplyMs],2);assert.equal(report.samples[2][COLUMN.terrainApplyMs],0);assert.equal(report.samples[2][COLUMN.intervalMs],0);assert.equal(report.summary.timing.gpuMs.samples,0);assert.equal(report.samples[0][COLUMN.gpuMs],null);assert.equal(profiler.last.uploadedFile,'hike/test.json');assert.ok(notices.includes('Capture saved to computer'));
 const restored=new HikeProfiler({store,fetcher:success});await restored.restore();assert.equal(restored.last.captureId,profiler.last.captureId);profiler.dispose();restored.dispose();
});
test('failed upload retains the capture for retry; failed report worker has a lossless fallback',async()=>{
 const store=memoryStore(),profiler=new HikeProfiler({store,durationMs:10,finalize:async()=>{throw Error('worker failed');},fetcher:async()=>({ok:false,status:404})});
 profiler.start(metadata);frame(profiler,0);frame(profiler,10);await until(()=>profiler.last&&!profiler.busy);
 const original=profiler.last.json;assert.equal(profiler.status,'Retry or export JSON');assert.equal((await store.load()).json,original);
 profiler.fetcher=success;assert.equal(await profiler.upload(),true);assert.equal(profiler.last.json,original);assert.equal(profiler.status,'Saved to computer');profiler.dispose();
});
test('mode changes pause recording; cancel is safe; upload byte estimates ignore unchanged buffers',()=>{
 const profiler=new HikeProfiler({store:memoryStore(),fetcher:success});profiler.start(metadata);assert.equal(profiler.beginFrame(0,'desktop'),false);assert.equal(profiler.count,0);
 const attr={array:new Float32Array(128),version:0,updateRanges:[]};profiler.seedUpload(attr);profiler.beginFrame(10,'immersive-vr');attr.version=1;attr.updateRanges=[{start:4,count:8}];profiler.noteUpload(attr);profiler.noteUpload(attr);profiler.endFrame(12);assert.equal(profiler.data[COLUMN.estimatedUploadBytes],32);assert.equal(profiler.data[COLUMN.cpuMs],2);
 profiler.cancel();assert.equal(profiler.running,false);assert.equal(profiler.status,'Capture cancelled');profiler.dispose();
});
test('summary labels callback timing and reports percentile/spike context without fake GPU values',()=>{
 const buffer=new Float64Array(COLUMNS.length*3);buffer.fill(NaN);
 for(let i=0;i<3;i++){const offset=i*COLUMNS.length;buffer[offset+COLUMN.activeMs]=i*10;buffer[offset+COLUMN.intervalMs]=(i+1)*10;buffer[offset+COLUMN.cpuMs]=i+1;buffer[offset+COLUMN.terrainSnaps]=i===2?1:0;}
 const result=buildProfileReport({metadata,buffer:buffer.buffer,count:3,reason:'completed'}),report=JSON.parse(result.json);assert.equal(result.summary.timing.cpuMs.p95,3);assert.equal(result.summary.timing.intervalMs.max,30);assert.equal(result.summary.lateCallbacks,2);assert.equal(result.summary.terrainSnaps,1);assert.equal(result.summary.worstFrames[0].frame,2);assert.equal(result.summary.timing.gpuMs.p95,null);assert.match(report.notes.cadence,/not compositor/);
});
function fakeGL(supported=true){let active=null;const queries=[];return {CURRENT_QUERY:1,QUERY_RESULT_AVAILABLE:2,QUERY_RESULT:3,disjoint:false,queries,getExtension:()=>supported?{TIME_ELAPSED_EXT:4,GPU_DISJOINT_EXT:5}:null,createQuery(){const query={ready:false,value:4000000};queries.push(query);return query;},deleteQuery(query){query.deleted=true;},getQuery:()=>active,beginQuery(target,query){active=query;},endQuery(){active=null;},getParameter(){return this.disjoint;},getQueryParameter(query,key){return key===2?query.ready:query.value;},isContextLost:()=>false};}
test('GPU timers are asynchronous, bounded and discard disjoint results',()=>{
 const gl=fakeGL(),values=[],timer=new GpuTimer(gl,(row,value)=>values.push([row,value]));timer.start();timer.begin(0);timer.end();timer.poll();assert.equal(values.length,0);gl.queries[0].ready=true;timer.poll();assert.deepEqual(values,[[0,4]]);
 timer.begin(4);timer.end();gl.disjoint=true;timer.poll();assert.equal(values.length,1);assert.equal(timer.disjoint,1);timer.dispose();assert.ok(gl.queries.every(query=>query.deleted));
 const unsupported=new GpuTimer(fakeGL(false),()=>assert.fail());unsupported.start();unsupported.begin(0);unsupported.end();unsupported.poll();assert.equal(unsupported.info().extension,false);unsupported.dispose();
});

test('real report worker handles transferred samples and matches the pure report',async()=>{
 const url=new URL('../profiler-report-worker.mjs',import.meta.url).href;
 const code=`const {parentPort}=require('node:worker_threads');globalThis.self={postMessage:(...args)=>parentPort.postMessage(...args)};(async()=>{await import(${JSON.stringify(url)});parentPort.on('message',data=>self.onmessage({data}));})();`;
 const worker=new NodeWorker(code,{eval:true}),samples=new Float64Array(COLUMNS.length*2);samples.fill(NaN);samples[COLUMN.cpuMs]=2;samples[COLUMNS.length+COLUMN.cpuMs]=4;
 const input={metadata,buffer:samples.buffer,count:2,reason:'completed'},reference=buildProfileReport({...input,buffer:samples.slice().buffer});
 try{
  const result=await new Promise((resolve,reject)=>{worker.once('message',resolve);worker.once('error',reject);worker.postMessage(input,[input.buffer]);});
  assert.equal(samples.byteLength,0);assert.equal(result.ok,true);assert.equal(result.json,reference.json);
 }finally{await worker.terminate();}
});
