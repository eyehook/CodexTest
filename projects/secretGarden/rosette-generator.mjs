import {flowerHue} from './flower-colors.mjs?v=82';
export function generateRosette(random,blooms){
 const range=(a,b)=>a+(b-a)*random(),integer=(a,b)=>Math.floor(range(a,b+1)),tau=Math.PI*2;
 const parameters={form:'rosette',flowers:random()<.4,leafCount:integer(10,16),leafSize:range(.36,.62),leafHue:range(.24,.38),leafLight:range(.28,.43)};
 const parts=[],add=p=>{p.id=parts.length;parts.push(p);return p;},phase=range(0,tau);
 for(let i=0;i<parameters.leafCount;i++){
  const inner=i>=Math.ceil(parameters.leafCount*.65);
  add({kind:'leaf',shape:9,parent:null,start:[0,.025,0],position:[0,.025,0],size:parameters.leafSize*range(inner?.6:.85,inner?.85:1.15),
   orientation:[range(inner?.6:.95,inner?.95:1.35),phase+i*2.399963,0,'YXZ'],hue:parameters.leafHue+range(-.015,.015),light:parameters.leafLight+range(-.035,.035),begin:range(0,.12),duration:range(.35,.5)});
 }
 parameters.spikeCount=parameters.flowers?integer(1,3):0;
 if(parameters.flowers){
  const roll=random(),preferred=roll<.3?'bell':roll<.6?'lily':null;
  const others=blooms.map((b,index)=>({b,index})).filter(({b})=>!['bell','lily'].includes(b.name));
  const bloomIndex=preferred?blooms.findIndex(b=>b.name===preferred):others[Math.min(others.length-1,Math.floor((roll-.6)/.4*others.length))].index,bloom=blooms[bloomIndex];parameters.bloomForm=bloom.name;
  const hue=flowerHue(random()),saturation=range(.3,.85),brightness=range(.55,1);
  Object.assign(parameters,{flowerHue:hue,flowerSaturation:saturation,flowerBrightness:brightness});
  for(let i=0;i<parameters.spikeCount;i++){
   const yaw=phase+i*2.399963,height=range(.8,1.25),start=[Math.cos(yaw)*.035,.025,Math.sin(yaw)*.035],end=[start[0]+Math.cos(yaw)*.07,height,start[2]+Math.sin(yaw)*.07];
   const spike=add({kind:'stem',role:'flower-spike',parent:null,attachment:1,start,end,radius:.007,taper:.58,hue:parameters.leafHue,light:.4,begin:.18,duration:.4});
   // End at the final branch, preserving existing branch positions.
   spike.end=start.map((v,k)=>v+(end[k]-v)*.95);
   const count=integer(5,9);
   for(let j=0;j<count;j++){
    const attachment=.45+j/(count-1)*.5,angle=yaw+j*2.399963;
    const progress=j/(count-1),branchTilt=(75-55*progress)*Math.PI/180;
    const reach=.062,horizontal=reach*Math.sin(branchTilt),rise=reach*Math.cos(branchTilt);
    const base=start.map((v,k)=>v+(end[k]-v)*attachment),tip=base.map((v,k)=>v+(k===0?Math.cos(angle)*horizontal:k===2?Math.sin(angle)*horizontal:rise));
    const stalk=add({kind:'stem',role:'flower-stalk',parent:spike.id,attachment:j===count-1?1:attachment/.95,start:base,end:tip,radius:.0025,taper:.58,hue:parameters.leafHue,light:.4,begin:spike.begin+spike.duration,duration:.06});
    const normal=tip.map((v,k)=>(v-base[k])/reach);
    add({kind:'flower',parent:stalk.id,attachment:1,position:tip,normal,yaw:angle,size:range(.045,.065),petals:integer(...bloom.petals),shape:bloomIndex,layers:bloom.layers,centerScale:bloom.center,hue,saturation,brightness,begin:.68+j/count*.08,duration:.18});
   }
  }
 }
 return {parameters,parts};
}
