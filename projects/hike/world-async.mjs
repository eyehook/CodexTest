import {restoreWorld} from './world-snapshot.mjs';
// A dedicated worker owns the expensive synchronous generator. Wrapping the
// generator in a Promise on the main thread would still block the loading UI.
export function createWorldAsync(options={}, {onProgress=()=>{},signal,workerFactory=()=>new Worker(new URL('./generation-worker.mjs?v=pines-dense-1',import.meta.url),{type:'module'})}={}){
 return new Promise((resolve,reject)=>{
  let worker,settled=false;
  const finish=(error,world)=>{
   if(settled)return;settled=true;signal?.removeEventListener('abort',abort);worker?.terminate();
   if(error)reject(error);else resolve(world);
  };
  const abort=()=>finish(new DOMException('Generation cancelled','AbortError'));
  if(signal?.aborted){abort();return;}
  try{
   worker=workerFactory();signal?.addEventListener('abort',abort,{once:true});
   worker.onmessage=({data})=>{
    if(settled)return;
    try{
     if(data.type==='progress')onProgress(data.value,data.label);
     else if(data.type==='error')finish(new Error(data.message));
     else if(data.type==='ready')finish(null,restoreWorld(data.snapshot));
    }catch(error){finish(error);}
   };
   worker.onerror=event=>{event.preventDefault?.();finish(new Error(event.message||'Mountain generation worker failed'));};
   worker.onmessageerror=()=>finish(new Error('Could not read the generated mountain'));
   worker.postMessage({type:'generate',options});
  }catch(error){finish(error);}
 });
}
