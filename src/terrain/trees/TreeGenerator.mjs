import {hash,terrainHeight} from '../height.mjs';
import {bands} from '../bands.mjs';

export const treeDefaults=Object.freeze({
 enabled:true,seed:74921,cellSize:64,clusterProbability:0.55,clusterRadius:20,
 treesPerCluster:48,minElevation:null,maxElevation:null,minHeight:3,maxHeight:8,
 widthRatio:0.52,visibilityDistance:800,cutoffDistance:700,baseSink:0.25
});
const palette=[[0.028,0.13,0.018],[0.045,0.19,0.028],[0.065,0.16,0.022],
 [0.035,0.115,0.045],[0.075,0.21,0.035]];
function randomForCell(x,z,seed){
 let state=hash(x,z,seed);
 return ()=>{
  state=(state+0x9e3779b9)>>>0;
  let n=state;n=Math.imul(n^(n>>>16),0x21f0aaad);n=Math.imul(n^(n>>>15),0x735a2d97);
  return ((n^(n>>>15))>>>0)/4294967296;
 };
}
export function elevationLimits(terrain,trees){
 return {min:Math.max(terrain.amplitude*bands.beachEnd,trees.minElevation??-Infinity),
  max:trees.maxElevation??terrain.amplitude*bands.snowStart};
}
export function generateCell(cellX,cellZ,terrain,trees=treeDefaults){
 const random=randomForCell(cellX,cellZ,trees.seed),result=[];
 if(random()>=trees.clusterProbability||trees.treesPerCluster===0)return result;
 const clusters=1+(random()<0.22?1:0),limits=elevationLimits(terrain,trees);
 for(let cluster=0;cluster<clusters;cluster++){
  const cx=(cellX+random())*trees.cellSize,cz=(cellZ+random())*trees.cellSize;
  const radius=trees.clusterRadius*(0.6+random()*0.4);
  for(let i=0;i<trees.treesPerCluster;i++){
   const angle=random()*Math.PI*2,distance=Math.sqrt(random())*radius;
   const x=cx+Math.cos(angle)*distance,z=cz+Math.sin(angle)*distance;
   const height=trees.minHeight+random()*(trees.maxHeight-trees.minHeight);
   const width=height*trees.widthRatio*(0.8+random()*0.4);
   const baseColor=palette[Math.floor(random()*palette.length)],tint=0.88+random()*0.24;
   // Consume the same random sequence for every candidate, including rejected trees.
   const y=terrainHeight(x,z,terrain);
   if(y<limits.min||y>=limits.max)continue;
   result.push({x,y,z,height,width,color:baseColor.map(channel=>channel*tint)});
  }
 }
 return result;
}
// Doubles retain absolute coordinates; only small anchor-relative values reach the GPU.
export class TreePopulation {
 constructor(terrain,config={...treeDefaults}){
  this.terrain=terrain;this.config=config;this.cells=new Map();
  this.cellX=null;this.cellZ=null;this.anchorX=0;this.anchorZ=0;
  this.treeCount=0;this.version=0;this.generatedCellCount=0;
 }
 invalidate(){this.cells.clear();this.cellX=null;this.cellZ=null;}
 update(x,z){
  const {cellSize,visibilityDistance,clusterRadius}=this.config;
  const cx=Math.floor(x/cellSize),cz=Math.floor(z/cellSize);
  if(cx===this.cellX&&cz===this.cellZ)return false;
  // Retain extra source cells because clusters extend beyond their source boundaries.
  const reach=Math.ceil((visibilityDistance+clusterRadius)/cellSize)+1;
  for(const [key,cell]of this.cells){
   if(Math.abs(cell.x-cx)>reach||Math.abs(cell.z-cz)>reach)this.cells.delete(key);
  }
  for(let ix=cx-reach;ix<=cx+reach;ix++)for(let iz=cz-reach;iz<=cz+reach;iz++){
   const key=`${ix},${iz}`;
   if(!this.cells.has(key)){
    this.cells.set(key,{x:ix,z:iz,trees:generateCell(ix,iz,this.terrain,this.config)});
    this.generatedCellCount++;
   }
  }
  this.cellX=cx;this.cellZ=cz;this.anchorX=cx*cellSize;this.anchorZ=cz*cellSize;
  this.treeCount=0;for(const cell of this.cells.values())this.treeCount+=cell.trees.length;
  this.version++;return true;
 }
}
