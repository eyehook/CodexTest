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
