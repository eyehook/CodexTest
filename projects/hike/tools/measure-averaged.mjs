// Offline desktop measurements; not a Quest benchmark. Optional first argument: seed.
// Snap deltas compare identical world coordinates, isolating blend movement from
// changing grid interpolation. The probe range is 96–208 m, not the entire mesh.
import {cachedWorld} from '../tests/helpers/world-fixture.mjs';
import {TerrainSamples} from '../terrain-samples.mjs';
import {createTerrainGrid} from '../terrain-grid.mjs';
import {RenderTerrainHeight} from '../averaged-heightmap.mjs';
const world=await cachedWorld({seed:Number(process.argv[2]??41729)}),grid=createTerrainGrid(),out=new Float32Array(grid.vertexCount*7),ox=Math.floor(world.start.x/16)*16,oz=Math.floor(world.start.z/16)*16;
const summary=values=>{const s=values.toSorted((a,b)=>a-b);return {mean:values.reduce((a,b)=>a+b,0)/values.length,p95:s[Math.floor(s.length*.95)],max:s.at(-1)};};
for(const averaged of [false,true]){
 const sampler=new TerrainSamples(world,grid.coordinates,{averaged}),first=sampler.fill(ox,oz,out),times=[],newNodes=[];
 for(let i=1;i<=8;i++){const result=sampler.fill(ox+16*i,oz,out);times.push(result.sampleMs);newNodes.push(result.heightmapNodes);}
 const warm=[];for(let i=7;i>=0;i--)warm.push(sampler.fill(ox+i*16,oz,out).sampleMs);
 console.log(JSON.stringify({averaged,startupMs:first.sampleMs,snapsMs:summary(times),warmMs:summary(warm),initialNodes:first.heightmapNodes,finalNodes:newNodes.at(-1),allocatedBytes:sampler.renderHeight?.map.byteLength??0,sourceCacheBytes:sampler.sourcePrevious.byteLength+sampler.sourceNext.byteLength+sampler.sourceSlots.byteLength+sampler.regions.byteLength}));
}
const render=new RenderTerrainHeight(world),changes=[],errors=[];
for(const index of [0,200,400,600,800]){
 const at=world.route[index],cx=Math.floor(at.x/16)*16+8,cz=Math.floor(at.z/16)*16+8;
 for(let x=-208;x<=208;x+=8)for(let z=-208;z<=208;z+=8){
  const r=Math.hypot(x,z);if(r<96||r>208)continue;
  const wx=cx+x,wz=cz+z,before=render.height(wx,wz,cx,cz);errors.push(Math.abs(before-world.height(wx,wz)));
  for(const [dx,dz] of [[16,0],[-16,0],[0,16],[0,-16],[16,16],[-16,-16]])changes.push(Math.abs(render.height(wx,wz,cx+dx,cz+dz)-before));
 }
}
console.log(JSON.stringify({sampledSnapBlendChangesM:summary(changes),sampledRenderDeviationM:summary(errors),comparisons:changes.length}));
