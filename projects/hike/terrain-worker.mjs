import {createTerrainSampler} from './terrain-sampler.mjs';
import {TerrainSamples} from './terrain-samples.mjs?v=snapped-1';
let samples;
self.onmessage=({data})=>{
 try{
  if(data.type==='init'){samples=new TerrainSamples(createTerrainSampler(data.world),data.coordinates);return;}
  if(data.type==='sample'){
   const output=new Float32Array(data.buffer),result=samples.fill(data.originX,data.originZ,output);
   self.postMessage({...result,buffer:data.buffer},[data.buffer]);
  }
 }catch(error){self.postMessage({error:error.message});}
};
