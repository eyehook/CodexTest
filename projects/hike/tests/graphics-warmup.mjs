import test from 'node:test';
import assert from 'node:assert/strict';
import {GraphicsWarmup} from '../graphics-warmup.mjs';
function fixture(options={}){
 let time=0,status=0,resolve,reject,deleted=0,finished=0;
 const mesh={isMesh:true,frustumCulled:true},scene={traverse:fn=>fn(mesh)};
 const gl={SYNC_GPU_COMMANDS_COMPLETE:1,ALREADY_SIGNALED:2,CONDITION_SATISFIED:3,WAIT_FAILED:4,fenceSync:()=>({}),flush(){},clientWaitSync:()=>status,deleteSync(){deleted++;}};
 const renderer={getContext:()=>gl,extensions:{has:()=>true},compileAsync:()=>new Promise((a,b)=>{resolve=a;reject=b;})};
 const warmup=new GraphicsWarmup(renderer,scene,{}, {now:()=>time,onFinish:()=>finished++,...options});
 return {warmup,mesh,gl,renderer,advance:n=>time+=n,resolve:()=>resolve(),reject:()=>reject(Error('compile failed')),signal:n=>status=n,get deleted(){return deleted;},get finished(){return finished;}};
}
test('warmup waits for compilation, two real draws and an asynchronous GPU fence',async()=>{
 const f=fixture(),w=f.warmup;w.begin('desktop');assert.equal(f.mesh.frustumCulled,false);
 w.afterRender();assert.equal(w.frames,0);f.advance(12);f.resolve();await Promise.resolve();
 assert.equal(w.record.compileMs,12);w.afterRender();assert.equal(w.phase,'render');w.afterRender();assert.equal(w.phase,'gpu');
 assert.equal(w.update(),true);f.signal(3);f.advance(8);assert.equal(w.update(),false);
 assert.equal(f.finished,1);assert.equal(f.deleted,1);assert.equal(f.mesh.frustumCulled,true);assert.equal(w.history[0].status,'ready');assert.equal(w.history[0].totalMs,20);
 assert.equal(w.begin('desktop'),false);assert.equal(w.begin('immersive-vr'),true);w.cancel();
});
test('timeouts, absent fences, failed waits and compile errors release loading without blocking',async()=>{
 for(const failure of ['timeout','absent','wait','compile']){
  const f=fixture({timeoutMs:100}),w=f.warmup;w.begin(failure);
  if(failure==='timeout'){f.advance(101);w.update();}
  else{
   if(failure==='compile')f.reject();else f.resolve();await Promise.resolve();
   if(failure==='absent')f.gl.fenceSync=()=>null;
   w.afterRender();w.afterRender();f.signal(failure==='wait'?4:3);w.update();
  }
  assert.equal(w.active,false);assert.equal(f.finished,1);assert.equal(f.mesh.frustumCulled,true);assert.equal(w.history[0].status,failure==='timeout'?'timeout':'fallback');
 }
});
test('session cancellation and context invalidation reject stale async completion and clear fences',async()=>{
 const f=fixture(),w=f.warmup;w.begin('desktop');f.resolve();w.cancel();await Promise.resolve();assert.equal(w.active,false);assert.equal(f.finished,0);
 w.begin('xr');f.resolve();await Promise.resolve();w.afterRender();w.afterRender();w.cancel();assert.equal(f.deleted,1);assert.equal(w.ready.size,0);
 w.begin('xr');f.resolve();await Promise.resolve();w.afterRender();w.afterRender();f.signal(2);w.update();assert.equal(w.ready.size,1);w.invalidate();assert.equal(w.ready.size,0);assert.equal(f.mesh.frustumCulled,true);
});
