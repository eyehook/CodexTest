import {COLUMNS,COLUMN,MAX_FRAMES,buildProfileReport} from './profiler-report.mjs?v=capture-1';
import {CaptureStore} from './capture-store.mjs?v=capture-1';
import {GpuTimer} from './gpu-timer.mjs?v=capture-1';
export function finishInWorker(input){
 if(typeof Worker==='undefined')return Promise.resolve(buildProfileReport(input));
 return new Promise((resolve,reject)=>{
  const worker=new Worker(new URL('./profiler-report-worker.mjs?v=capture-1',import.meta.url),{type:'module'});
  const timeout=setTimeout(()=>{worker.terminate();reject(Error('Report worker timed out'));},15000);
  const done=(error,value)=>{clearTimeout(timeout);worker.terminate();if(error)reject(error);else resolve(value);};
  worker.onmessage=({data})=>done(data.ok?null:Error(data.error),data);worker.onerror=event=>done(Error(event.message||'Report worker failed'));worker.onmessageerror=()=>done(Error('Invalid report result'));
  // Transfer the completed slice; the recorder retains its original fixed buffer.
  worker.postMessage(input,[input.buffer]);
 });
}
export class HikeProfiler {
 constructor({gl=null,store=new CaptureStore(),fetcher=(...args)=>fetch(...args),finalize=finishInWorker,clock=()=>performance.now(),durationMs=30000,onChange=()=>{},onNotice=()=>{}}={}){
  Object.assign(this,{store,fetcher,finalize,clock,durationMs,onChange,onNotice});this.data=new Float64Array(MAX_FRAMES*COLUMNS.length);this.phase='idle';this.uploading=false;this.last=null;this.statusMessage='Ready';this.disposed=false;this.count=0;this.activeMs=0;this.pendingTerrain={ms:0,snaps:0,bytes:0,worker:0,latency:0};
  this.gpu=new GpuTimer(gl,(row,ms)=>{if(row<this.count)this.data[row*COLUMNS.length+COLUMN.gpuMs]=ms;});
 }
 get running(){return this.phase==='recording';}
 get busy(){return this.phase==='processing'||this.uploading;}
 get status(){if(this.running)return `${this.paused?'Paused':'Recording'} ${Math.max(0,Math.ceil((this.durationMs-this.activeMs)/1000))}s`;if(this.phase==='processing')return 'Preparing result';if(this.uploading)return 'Sending to computer';return this.statusMessage;}
 async restore(){try{const saved=await this.store.load();if(!this.disposed&&this.phase==='idle'&&!this.uploading&&saved&&typeof saved.json==='string'&&saved.summary){this.last=saved;this.persisted=true;this.statusMessage=saved.uploadedFile?'Saved to computer':'Saved on headset';this.onChange();}}catch{} }
 start(metadata){
  if(this.running||this.busy||this.disposed)return false;
  this.metadata=JSON.parse(JSON.stringify(metadata));this.metadata.captureId=globalThis.crypto?.randomUUID?.()??`hike-${Date.now()}-${Math.random().toString(16).slice(2)}`;this.metadata.startedAt=new Date().toISOString();this.metadata.requestedActiveSeconds=this.durationMs/1000;
  this.lastError=null;this.metadata.pauses=0;this.data.fill(NaN);this.count=0;this.activeMs=0;this.lastTime=null;this.paused=false;this.phase='recording';this.uploadVersions=new WeakMap();this.pendingTerrain={ms:0,snaps:0,bytes:0,worker:0,latency:0};this.gpu.start();this.onChange();return true;
 }
 pause(){if(!this.running)return;if(!this.paused)this.metadata.pauses++;this.paused=true;this.lastTime=null;this.pendingTerrain.ms=this.pendingTerrain.snaps=this.pendingTerrain.bytes=this.pendingTerrain.worker=this.pendingTerrain.latency=0;}
 beginFrame(time,mode){
  if(!this.running)return false;
  if(mode!==this.metadata.mode){this.pause();return false;}
  this.gpu.poll();this.frameStart=time;this.paused=false;
  const interval=this.lastTime===null?0:Math.max(0,time-this.lastTime);this.lastTime=time;this.activeMs+=interval;this.offset=this.count*COLUMNS.length;
  this.set('activeMs',this.activeMs);this.set('intervalMs',interval);this.set('terrainApplyMs',this.pendingTerrain.ms);this.set('terrainSnaps',this.pendingTerrain.snaps);this.set('terrainWorkerMs',this.pendingTerrain.worker);this.set('terrainLatencyMs',this.pendingTerrain.latency);
  this.pendingTerrain.ms=this.pendingTerrain.snaps=this.pendingTerrain.worker=this.pendingTerrain.latency=0;this.uploadBytes=0;return true;
 }
 set(name,value){this.data[this.offset+COLUMN[name]]=Number.isFinite(value)?value:NaN;}
 noteTerrain(terrain){if(!this.running||this.paused)return;this.pendingTerrain.ms+=terrain.updateMs;this.pendingTerrain.snaps++;this.pendingTerrain.worker+=terrain.sampleMs;this.pendingTerrain.latency=Math.max(this.pendingTerrain.latency,terrain.latencyMs);}
 seedUpload(attribute){if(attribute)this.uploadVersions.set(attribute,attribute.version);}
 noteUpload(attribute){
  if(!attribute)return;const previous=this.uploadVersions.get(attribute);if(previous===attribute.version)return;
  const ranges=attribute.updateRanges;let bytes=attribute.array.byteLength;
  if(previous!==undefined&&ranges.length){bytes=0;for(const range of ranges)bytes+=range.count*attribute.array.BYTES_PER_ELEMENT;bytes=Math.min(bytes,attribute.array.byteLength);}
  this.uploadBytes+=bytes;this.uploadVersions.set(attribute,attribute.version);
 }
 beginRender(){this.gpu.begin(this.count);}
 endRender(){this.gpu.end();}
 endFrame(time){
  this.set('cpuMs',Math.max(0,time-this.frameStart));this.set('estimatedUploadBytes',this.uploadBytes);this.count++;
  if(this.activeMs>=this.durationMs||this.count>=MAX_FRAMES)this.stop(this.count>=MAX_FRAMES?'capacity':'completed');
 }
 cancel(){if(!this.running)return;this.gpu.dispose();this.phase='idle';this.statusMessage='Capture cancelled';this.onChange();}
 stop(reason='completed'){
  if(!this.running)return;
  this.gpu.poll();this.metadata.gpu=this.gpu.info();this.gpu.dispose();this.metadata.endedAt=new Date().toISOString();this.phase='processing';this.onChange();
  const input={metadata:this.metadata,count:this.count,reason,buffer:this.data.slice(0,this.count*COLUMNS.length).buffer};
  setTimeout(async()=>{
   if(this.disposed)return;
   try{
    let result;try{result=await this.finalize(input);}catch{result=buildProfileReport({...input,buffer:this.data.slice(0,input.count*COLUMNS.length).buffer});}
    if(this.disposed)return;this.last={json:result.json,summary:result.summary,captureId:result.captureId,uploadedFile:null};this.persisted=false;
    try{await this.store.save(this.last);this.persisted=true;}catch{}
    this.phase='idle';this.statusMessage=this.persisted?'Saved on headset':'Saved in memory';this.onChange();this.onNotice('Capture complete');await this.upload();
   }catch(error){this.phase='idle';this.statusMessage='Capture failed';this.lastError=error.message;this.onChange();}
  },0);
 }
 async request(path,options={}){
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),15000);
  try{return await this.fetcher(path,{...options,signal:controller.signal});}finally{clearTimeout(timeout);}
 }
 async upload(){
  if(!this.last||this.running||this.busy||this.disposed)return false;
  this.lastError=null;this.uploading=true;this.onChange();
  try{
   const infoResponse=await this.request('/__debug/info');if(!infoResponse.ok)throw Error('Local capture server unavailable');
   const info=await infoResponse.json();if(info.server!=='CodexTest VR'||info.version!==1)throw Error('Unsupported capture server');
   if(new Blob([this.last.json]).size>info.maxCaptureBytes)throw Error('Capture too large; export JSON instead');
   const response=await this.request('/__debug/captures/hike',{method:'POST',headers:{'Content-Type':'application/json'},body:this.last.json});
   if(response.status!==201)throw Error(`Upload failed (${response.status})`);const result=await response.json();if(!result.ok||typeof result.file!=='string')throw Error('Capture save was not confirmed');
   this.last.uploadedFile=result.file;this.statusMessage='Saved to computer';try{await this.store.save(this.last);}catch{}
   this.onNotice('Capture saved to computer');return true;
  }catch(error){this.lastError=error.message;this.statusMessage='Retry or export JSON';this.onNotice(this.persisted?'Capture saved on headset':'Capture retained in memory');return false;}
  finally{this.uploading=false;this.onChange();}
 }
 exportJSON(){
  if(!this.last||this.running||this.busy)return;
  const url=URL.createObjectURL(new Blob([this.last.json],{type:'application/json'})),anchor=document.createElement('a');anchor.href=url;anchor.download=`hike-profile-${this.last.captureId}.json`;document.body.append(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
 }
 dispose(){this.disposed=true;this.gpu.dispose();}
}
