// Bounded, asynchronous timer queries. Never wait for the GPU or nest a query.
export class GpuTimer {
 constructor(gl,onResult){this.gl=gl;this.onResult=onResult;this.slots=[];this.active=null;this.disjoint=0;this.failure=null;try{this.extension=gl?.getExtension('EXT_disjoint_timer_query_webgl2')??null;}catch{this.extension=null;}}
 start(){this.dispose();this.disjoint=0;this.failure=null;if(!this.extension)return;try{if(this.gl.getQuery(this.extension.TIME_ELAPSED_EXT,this.extension.QUERY_COUNTER_BITS_EXT)===0){this.failure='GPU timer precision unavailable';return;}for(let i=0;i<8;i++)this.slots.push({query:this.gl.createQuery(),row:-1});}catch{this.failure='Query allocation failed';this.dispose();}}
 begin(row){
  if(!this.extension||this.failure||row%4!==0)return;
  const gl=this.gl,ext=this.extension,slot=this.slots.find(slot=>slot.row<0);
  if(!slot)return;
  try{if(gl.isContextLost?.()||gl.getQuery(ext.TIME_ELAPSED_EXT,gl.CURRENT_QUERY))return;gl.beginQuery(ext.TIME_ELAPSED_EXT,slot.query);slot.row=row;this.active=slot;}catch{this.failure='Timer query unavailable';}
 }
 end(){if(this.active){try{this.gl.endQuery(this.extension.TIME_ELAPSED_EXT);}catch{this.failure='Timer query failed';}this.active=null;}}
 poll(){
  if(!this.extension||this.failure||!this.slots.some(slot=>slot.row>=0))return;
  const gl=this.gl,ext=this.extension;
  try{
   if(gl.getParameter(ext.GPU_DISJOINT_EXT)){this.disjoint++;for(const slot of this.slots)slot.row=-1;return;}
   for(const slot of this.slots)if(slot.row>=0&&gl.getQueryParameter(slot.query,gl.QUERY_RESULT_AVAILABLE)){
    const milliseconds=gl.getQueryParameter(slot.query,gl.QUERY_RESULT)/1e6;
    if(Number.isFinite(milliseconds)&&milliseconds>=0)this.onResult(slot.row,milliseconds);slot.row=-1;
   }
  }catch{this.failure='GPU results unavailable';}
 }
 info(){return {extension:!!this.extension,sampleEveryFrames:4,invalidatedBatches:this.disjoint,error:this.failure,pendingSamples:this.slots.filter(slot=>slot.row>=0).length};}
 dispose(){this.end();for(const slot of this.slots)try{this.gl.deleteQuery(slot.query);}catch{}this.slots.length=0;}
}
