import {placeCanopyFlowers} from './canopy-flowers.mjs?v=75';
// Visible structural stems connect growing crowns and their surface flowers.
export function generateShrub(parameters,bloom,random){
 const range=(a,b)=>a+(b-a)*random(),integer=(a,b)=>Math.floor(range(a,b+1)),parts=[];
 const add=part=>{part.id=parts.length;parts.push(part);return part;};
 const count=integer(1,5),radius=range(.48,.72),vertical=range(.28,.43),phase=range(0,Math.PI*2);
 parameters.canopyCount=count;parameters.height=vertical*2;parameters.primaryStems=1;
 const root=add({kind:'stem',parent:null,attachment:1,start:[0,0,0],end:[0,vertical*.9,0],radius:.025,taper:.58,begin:0,duration:.25});
 for(let i=0;i<count;i++){
  const angle=phase+(i-1)*Math.PI*2/Math.max(1,count-1),spread=i===0?0:radius*range(.45,.65),height=vertical*range(.85,1.1);
  const center=[Math.cos(angle)*spread,height*.9,Math.sin(angle)*spread*.85];
  const node=i===0?root:add({kind:'stem',parent:root.id,attachment:1,start:root.end,end:center,radius:.018,taper:.58,begin:.25,duration:.15});
  const canopy=add({kind:'foliage',shape:'crown',parent:node.id,attachment:1,scale:[radius*range(.9,1.15),i===0?vertical:height,radius*range(.8,1.05)],yaw:range(0,Math.PI*2),tilt:range(-.045,.045),hue:parameters.leafHue,light:parameters.leafLight+range(-.04,.04),begin:node.begin+node.duration+.02,duration:.25});
  if(parameters.flowers)for(let j=0,n=integer(4,7);j<n;j++){
   const stalk=add({kind:'stem',parent:node.id,attachment:1,start:node.end,end:[...node.end],radius:.003,taper:.48,begin:.52,duration:.1});
   add({kind:'flower',canopy:canopy.id,parent:stalk.id,attachment:1,position:stalk.end,yaw:range(0,Math.PI*2),size:parameters.flowerSize*range(.4,.65),petals:parameters.petals,shape:parameters.bloomIndex,layers:bloom.layers,volume:bloom.volume??false,normal:[0,1,0],centerScale:bloom.center,hue:parameters.flowerHue,saturation:parameters.flowerSaturation,brightness:parameters.flowerBrightness,begin:.69+range(0,.02),duration:.25});
  }
 }
 placeCanopyFlowers(parts,random);return parts;
}
