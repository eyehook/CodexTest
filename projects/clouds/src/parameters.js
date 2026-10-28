export const cloudScales = [25,35,50,75,100];
export const definitions = [];
const add = (section,id,label,value,min,max,step,format=v=>String(v),extra={
}) => definitions.push({
  section,id,label,default:value,min,max,step,format,...extra
});
add('Cloud','density','Density',1,.1,5,.1,v=>v.toFixed(1));
add('Cloud','threshold','Threshold',.4,0,1,.01,v=>v.toFixed(2));
add('Cloud','octaves','Noise octaves',2,1,6,1);
add('Cloud','resolution','Noise texture',1,0,2,1,v=>`${[32,64,128][v]}³`);
add('Cloud','scale','Cloud scale',1,.25,4,.05,v=>v.toFixed(2)+'×');
add('Rendering','steps','Ray-march steps',16,4,128,1);
add('Rendering','cloudResolution','Cloud resolution',4,0,4,1,v=> `${cloudScales[v]}%`);
add('Rendering','termination','Early termination',.02,.001,.1,.001,v=>v.toFixed(3));
add('Rendering','foveation','Foveation (session support)',0,0,1,.05,v=>v.toFixed(2),{
  disabled:true
});
add('Diagnostics','mode','Rendering mode',0,0,2,1,v=>['Normal','Density','Sample Count'][v]);
add('Diagnostics','cloud','Cloud visibility',1,0,1,1,v=>v?'On':'Off',{
  kind:'toggle'
});
add('Diagnostics','columns','Reference columns',1,0,1,1,v=>v?'On':'Off',{
  kind:'toggle'
});
add('Performance','budgets','72 / 90 / 120 Hz budgets',0,0,0,1,()=> '13.89 / 11.11 / 8.33 ms',{
  disabled:true
});
add('Performance','timing','Timing source',0,0,0,1,()=> 'App cadence, not GPU time',{
  disabled:true
});
export class Parameters {
  constructor(){
    this.definitions=definitions.map(d=>({
      ...d
    }));
    this.values=Object.fromEntries(definitions.map(d=>[d.id,d.default]));
    this.listeners=new Set();
  }
  set(id,value){
    const d=this.definitions.find(d=>d.id===id);
    if(!d||d.disabled||!Number.isFinite(Number(value)))return;
    const next=Math.max(d.min,Math.min(d.max,Math.round(Number(value)/d.step)*d.step));
    if(next===this.values[id])return;
    this.values[id]=next;
    for(const fn of this.listeners)fn(id,next);
  }
  subscribe(fn){
    this.listeners.add(fn);
    return()=>this.listeners.delete(fn);
  }
}
