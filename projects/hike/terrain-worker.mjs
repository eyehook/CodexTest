import {createTerrainSampler} from './terrain-sampler.mjs?v=numeric-1';
import {TerrainSamples} from './terrain-samples.mjs?v=overlap-2';
let samples,initialized=false;
self.onmessage=({data})=>{
 try{
  if(data.type==='init'){samples=new TerrainSamples(createTerrainSampler(data.world),data.coordinates,{onProgress:value=>{if(!initialized)self.postMessage({type:'progress',value});}});return;}
  if(data.type==='sample'){
   const output=new Float32Array(data.buffer),result=samples.fill(data.originX,data.originZ,output);
   initialized=true;self.postMessage({...result,buffer:data.buffer},[data.buffer]);
  }
 }catch(error){self.postMessage({error:error.message});}
};
