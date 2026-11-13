import {createTerrainSampler} from './terrain-sampler.mjs?v=numeric-1';
import {rockCell} from './rock-cells.mjs?v=4';
let world;
self.onmessage=({data})=>{
 try{
  if(data.type==='init')world={...createTerrainSampler(data.samplingData),extent:data.extent,summit:data.summit};
  else if(data.type==='cells'){
   if(!world)throw Error('Rock worker is not initialized');
   const cells=data.cells.map(record=>({...record,...rockCell(world,record.cx,record.cz)}));
   self.postMessage({type:'cells',id:data.id,cells},cells.map(cell=>cell.data.buffer));
  }
 }catch(error){self.postMessage({type:'error',message:error.message});}
};
