import {createTerrainSampler} from './terrain-sampler.mjs?v=numeric-1';
import {fieldCell} from './field-cells.mjs?v=green-1';
let world;
self.onmessage=({data})=>{
 try{
  if(data.type==='init'){
   const sampler=createTerrainSampler(data.samplingData);
   world={...sampler,extent:data.extent,summit:data.summit,landscape:{summit:data.landscapeSummit},flora:{range:data.range}};
  }else if(data.type==='cells'){
   if(!world)throw Error('Grass worker is not initialized');
   const began=performance.now(),buffers=[];
   const cells=data.cells.map((record,i)=>{const generated=fieldCell(world,record.cx,record.cz,data.buffers?.[i]);buffers.push(generated.root.buffer,generated.shape.buffer,generated.color.buffer);return {...record,data:generated};});
   self.postMessage({type:'cells',id:data.id,cells,workerMs:performance.now()-began},buffers);
  }
 }catch(error){self.postMessage({type:'error',message:error.message});}
};
