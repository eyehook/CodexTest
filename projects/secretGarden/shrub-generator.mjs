import {shrubSurface} from './shrub-profile.mjs?v=193';
// One upright trunk and one continuous canopy; flower stalks are not woody branches.
export function generateShrub(parameters,bloom,random){
 const range=(a,b)=>a+(b-a)*random(),parts=[],add=part=>{part.id=parts.length;parts.push(part);return part;};
 const shape=random()<.5?'shrubSphere':'shrubDrop',drop=shape==='shrubDrop';
 const height=range(drop?2.5:2,drop?3.5:3)*.3048,clearance=range(.08,.16);
 const vertical=(height-clearance)/2,radius=vertical/(drop?1.35:1);
 const center=[0,vertical+clearance,0];
 parameters.canopyCount=1;parameters.shrubShape=shape;parameters.height=center[1]+vertical;parameters.primaryStems=1;
 const root=add({kind:'stem',parent:null,attachment:1,start:[0,0,0],end:center,radius:.025,taper:.58,begin:0,duration:.3});
 const canopy=add({kind:'foliage',shape,parent:root.id,attachment:1,scale:[radius,vertical,radius],yaw:0,tilt:0,hue:parameters.leafHue,light:parameters.leafLight,begin:.3,duration:.45});
 if(parameters.flowers)for(let i=0,n=Math.floor(range(8,15));i<n;i++){
  const surface=shrubSurface(shape,range(.65,2.1),range(0,Math.PI*2));
  const normal=surface.normal.map((v,j)=>v/canopy.scale[j]),length=Math.hypot(...normal);for(let j=0;j<3;j++)normal[j]/=length;
  const position=surface.position.map((v,j)=>center[j]+v*canopy.scale[j]+normal[j]*.006);
  const stalk=add({kind:'stem',parent:root.id,attachment:1,start:[...center],end:position,radius:.003,taper:.48,begin:.65,duration:.1});
  add({kind:'flower',canopy:canopy.id,parent:stalk.id,attachment:1,position,yaw:range(0,Math.PI*2),size:parameters.flowerSize*range(.4,.65),petals:parameters.petals,shape:parameters.bloomIndex,layers:bloom.layers,normal,centerScale:bloom.center,hue:parameters.flowerHue,saturation:parameters.flowerSaturation,brightness:parameters.flowerBrightness,begin:.75,duration:.25});
 }
 return parts;
}
