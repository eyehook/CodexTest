import {generatePines} from './flora-placement.mjs?v=noise32-2';
import {createWorld} from './world.mjs?v=numeric-1';
import {createTerrainGrid} from './terrain-grid.mjs?v=rings-300k-1';
import {snapshotWorld} from './world-snapshot.mjs?v=numeric-1';
self.onmessage=({data})=>{
 if(data.type!=='generate')return;
 try{
  const world=createWorld(data.options,(value,label)=>self.postMessage({type:'progress',value,label}));
  world.flora=generatePines(world,{},value=>self.postMessage({type:'progress',value:.9+value*.015,label:'Planting woodland'}));
  self.postMessage({type:'progress',value:.918,label:'Building terrain topology'});
  const snapshot=snapshotWorld(world);snapshot.renderGrid=createTerrainGrid();
  self.postMessage({type:'progress',value:.92,label:'Preparing the landscape view'});
  // The geology array is shared by snapshot fields: transfer its storage once.
  self.postMessage({type:'ready',snapshot},[snapshot.landscape.heights.buffer,snapshot.renderGrid.coordinates.buffer,snapshot.renderGrid.indices.buffer,snapshot.flora.trees.buffer,snapshot.flora.cells.buffer,snapshot.flora.tints.buffer]);
 }catch(error){self.postMessage({type:'error',message:error.message});}
};
