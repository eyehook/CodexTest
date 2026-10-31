import {placeCanopyFlowers,canopyRotation} from './canopy-flowers.mjs?v=75';
// Random circular gaps, each at least 30 degrees, with no rejection/fixed-spacing fallback.
export function shrubBranchAngles(count,random){
 if(!count)return [];
 const phase=random()*Math.PI*2;if(count===1)return [phase];
 const minimum=Math.PI/6,remaining=Math.PI*2-count*minimum,weights=Array.from({length:count},()=>-Math.log(Math.max(1e-12,1-random()))),total=weights.reduce((sum,w)=>sum+w,0);
 const angles=[phase];for(let i=1;i<count;i++)angles.push(angles[i-1]+minimum+remaining*(total?weights[i-1]/total:1/count));return angles.map(a=>a%(Math.PI*2));
}
// Visible structural stems connect growing crowns and their surface flowers.
export function generateShrub(parameters,bloom,random){
 const range=(a,b)=>a+(b-a)*random(),integer=(a,b)=>Math.floor(range(a,b+1)),parts=[];
 const add=part=>{part.id=parts.length;parts.push(part);return part;};
 const count=integer(1,5),radius=range(.48,.72),vertical=range(.28,.43),angles=shrubBranchAngles(count-1,random);
 parameters.canopyCount=count;parameters.height=vertical*2;parameters.primaryStems=1;
 const root=add({kind:'stem',parent:null,attachment:1,start:[0,0,0],end:[0,vertical*.9,0],radius:.025,taper:.58,begin:0,duration:.25});
 let baseCanopy=null;
 for(let i=0;i<count;i++){
  const angle=i===0?0:angles[i-1],elevation=i===0?0:range(0,Math.PI/6),height=vertical*range(.85,1.1);
  let spread=i===0?0:radius*range(.45,.65);
  if(baseCanopy){const direction=canopyRotation([Math.cos(angle),Math.tan(elevation),Math.sin(angle)],baseCanopy,true);const edge=1/Math.sqrt(direction.reduce((sum,v,j)=>sum+(v/baseCanopy.scale[j])**2,0));spread=Math.min(spread,edge*.85);}
  const center=[Math.cos(angle)*spread,root.end[1]+spread*Math.tan(elevation),Math.sin(angle)*spread];
  const node=i===0?root:add({kind:'stem',parent:root.id,attachment:1,start:root.end,end:center,radius:.018,taper:.58,begin:.25,duration:.15});
  const canopy=add({kind:'foliage',shape:'crown',parent:node.id,attachment:1,scale:[radius*range(.9,1.15),i===0?vertical:height,radius*range(.8,1.05)],yaw:range(0,Math.PI*2),tilt:range(-.045,.045),hue:parameters.leafHue,light:parameters.leafLight+range(-.04,.04),begin:node.begin+node.duration+.02,duration:.25});
  if(i===0)baseCanopy=canopy;
  if(parameters.flowers)for(let j=0,n=integer(4,7);j<n;j++){
   const stalk=add({kind:'stem',parent:node.id,attachment:1,start:node.end,end:[...node.end],radius:.003,taper:.48,begin:.52,duration:.1});
   add({kind:'flower',canopy:canopy.id,parent:stalk.id,attachment:1,position:stalk.end,yaw:range(0,Math.PI*2),size:parameters.flowerSize*range(.4,.65),petals:parameters.petals,shape:parameters.bloomIndex,layers:bloom.layers,volume:bloom.volume??false,normal:[0,1,0],centerScale:bloom.center,hue:parameters.flowerHue,saturation:parameters.flowerSaturation,brightness:parameters.flowerBrightness,begin:.69+range(0,.02),duration:.25});
  }
 }
 placeCanopyFlowers(parts,random);return parts;
}
