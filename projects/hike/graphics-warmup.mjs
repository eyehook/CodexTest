// Frame-driven startup gate. No gl.finish(), blocking fence waits or fixed sleeps.
export class GraphicsWarmup {
 constructor(renderer,scene,camera,{now=()=>performance.now(),timeoutMs=8000,onFinish=()=>{}}={}){
  Object.assign(this,{renderer,scene,camera,now,timeoutMs,onFinish});this.gl=renderer.getContext();this.active=false;this.serial=0;this.history=[];this.ready=new Set();
 }
 begin(key){
  if(this.ready.has(key))return false;
  this.cancel();this.active=true;this.key=key;this.started=this.now();this.phase='compile';this.frames=0;this.sync=null;
  this.record={key,status:'pending',compileMs:0,renderMs:0,gpuMs:0,totalMs:0,parallelCompile:!!this.renderer.extensions?.has('KHR_parallel_shader_compile'),fence:false};
  this.bounds=[];this.scene.traverse(object=>{if(object.isMesh){this.bounds.push([object,object.frustumCulled]);object.frustumCulled=false;}});
  const serial=this.serial;
  try{Promise.resolve(this.renderer.compileAsync(this.scene,this.camera)).then(()=>this.compiled(serial),error=>this.compiled(serial,error));}
  catch(error){this.compiled(serial,error);}
  return true;
 }
 compiled(serial,error){
  if(!this.active||serial!==this.serial)return;
  this.record.compileMs=this.now()-this.started;if(error)this.record.error=String(error.message??error);
  this.phase='render';this.renderStarted=this.now();
 }
 update(){
  if(!this.active)return false;
  if(this.now()-this.started>=this.timeoutMs){this.finish('timeout');return false;}
  if(this.phase==='gpu'){
   let status;try{status=this.gl.clientWaitSync(this.sync,0,0);}catch{this.finish('fallback');return false;}
   if(status===this.gl.ALREADY_SIGNALED||status===this.gl.CONDITION_SATISFIED)this.finish(this.record.error?'fallback':'ready');
   else if(status===this.gl.WAIT_FAILED)this.finish('fallback');
  }
  return this.active;
 }
 afterRender(){
  if(!this.active||this.phase!=='render'||++this.frames<2)return;
  this.record.renderMs=this.now()-this.renderStarted;this.gpuStarted=this.now();
  try{this.sync=this.gl.fenceSync(this.gl.SYNC_GPU_COMMANDS_COMPLETE,0);if(this.sync)this.gl.flush();}catch{this.sync=null;}
  if(this.sync){this.record.fence=true;this.phase='gpu';}else this.finish('fallback');
 }
 finish(status){
  if(!this.active)return;
  const record=this.record;record.status=status;record.totalMs=this.now()-this.started;
  if(this.phase==='gpu')record.gpuMs=this.now()-this.gpuStarted;
  if(this.phase==='compile')record.compileMs=record.totalMs;
  this.ready.add(this.key);this.history.push(record);this.cancel();this.onFinish(record);
 }
 cancel(){
  this.serial++;this.active=false;
  if(this.sync){try{this.gl.deleteSync(this.sync);}catch{}this.sync=null;}
  for(const [object,value] of this.bounds??[])object.frustumCulled=value;this.bounds=[];
 }
 invalidate(){this.cancel();this.ready.clear();}
}
