import {terrainHeight} from './height.mjs';
import {bands} from './bands.mjs';
// Amplitude is the configured nominal maximum, rather than a sampled local peak.
export function waterLevel(config){return config.amplitude*bands.water;}
export function localWaterHeight(config,groundHeight){return waterLevel(config)-groundHeight;}
export function drySpawn(config){
 const level=waterLevel(config)+2;
 if(terrainHeight(0,0,config)>level)return {x:0,z:0};
 for(let radius=25;radius<=1000;radius+=25){
  for(let i=0;i<16;i++){
   const angle=i*Math.PI/8,x=Math.cos(angle)*radius,z=Math.sin(angle)*radius;
   if(terrainHeight(x,z,config)>level)return {x,z};
  }
 }
 // Flat/low-amplitude terrain may have no dry land; preserve terrain-following.
 return {x:0,z:0};
}

// Find an inland point with a measured water sample nearby, rather than any hill.
// This runs only when applying a new seed, not while moving.
export function coastalSpawn(config){
 if(config.amplitude<=0)return null;
 const level=waterLevel(config),clearance=Math.min(1,config.amplitude*0.02),target=level+clearance;
 const directions=32,wetX=new Float64Array(directions),wetZ=new Float64Array(directions);
 const wet=new Uint8Array(directions);if(terrainHeight(0,0,config)<=level)wet.fill(1);
 for(let radius=16;radius<=8000;radius+=16)for(let i=0;i<directions;i++){
  const angle=i*Math.PI*2/directions,x=Math.cos(angle)*radius,z=Math.sin(angle)*radius,h=terrainHeight(x,z,config);
  if(h<=level){wet[i]=1;wetX[i]=x;wetZ[i]=z;continue;}
  if(!wet[i]||h<target||Math.hypot(x-wetX[i],z-wetZ[i])>96)continue;
  let lowX=wetX[i],lowZ=wetZ[i],highX=x,highZ=z;
  for(let j=0;j<28;j++){
   const midX=(lowX+highX)/2,midZ=(lowZ+highZ)/2;
   if(terrainHeight(midX,midZ,config)>=target){highX=midX;highZ=midZ;}else{lowX=midX;lowZ=midZ;}
  }
  return {x:highX,z:highZ,shoreX:wetX[i],shoreZ:wetZ[i]};
 }
 return null;
}
