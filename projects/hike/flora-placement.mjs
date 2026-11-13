import {PINE_VARIANTS} from './pine-config.mjs?v=1';
import {randomSource} from './geology.mjs?v=generation-1';
import {AveragedHeightmap} from './averaged-heightmap.mjs';
export const TREE_STRIDE=9;
// Normalized elevations follow each world's actual geology range.
export const PINE_RULES=Object.freeze({gridSpacing:4,jitter:1,noiseScale:32,noiseThreshold:.7,cellSize:32,boundaryMargin:120,trailMargin:3.5,lowFade:[.03,.12],treeline:[.64,.82],slopeFade:[24,32],maxAverageDifference:.65});
export const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
export function cellSeed(seed,x,z){let h=Math.imul(x,374761393)^Math.imul(z,668265263)^seed;h=Math.imul(h^(h>>>13),1274126177);return (h^(h>>>16))>>>0;}
// Smooth 48 m color patches with smaller per-tree variation. Multipliers are
// linear RGB for the existing instance-color attribute, shared by trunk/foliage.
export function pineTint(seed,x,z,brightness,variation,out,offset=0){
 const px=x/48,pz=z/48,cx=Math.floor(px),cz=Math.floor(pz);
 const u=smooth(0,1,px-cx),v=smooth(0,1,pz-cz);
 const sample=(dx,dz)=>cellSeed(seed^0x74696e74,cx+dx,cz+dz)/4294967296;
 const a=sample(0,0),b=sample(1,0),c=sample(0,1),d=sample(1,1);
 const patch=(a+(b-a)*u)*(1-v)+(c+(d-c)*u)*v;
 const blend=Math.max(0,Math.min(1,patch*.8+variation*.2));
 // Yellow-green -> olive/deep green -> cool blue-green. No shader changes.
 let r,g,blue;
 if(blend<.5){const t=blend*2;r=1.32+( .90-1.32)*t;g=1.12+(1.02-1.12)*t;blue=.62+( .88-.62)*t;}
 else {const t=(blend-.5)*2;r=.90+(.72-.90)*t;g=1.02+(1.06-1.02)*t;blue=.88+(1.25-.88)*t;}
 out[offset]=r*brightness;out[offset+1]=g*brightness;out[offset+2]=blue*brightness;return out;
}
export function elevationRange(world){
 let min=Infinity,max=-Infinity;for(const y of world.landscape.heights){min=Math.min(min,y);max=Math.max(max,y);}return {min,max};
}
export function plantSuitability(height,slope,range,rules=PINE_RULES){
 const elevation=(height-range.min)/Math.max(1,range.max-range.min);
 return smooth(...rules.lowFade,elevation)*(1-smooth(...rules.treeline,elevation))*(1-smooth(...rules.slopeFade,slope));
}
// Smooth value noise, independent of tree appearance and terrain thinning.
export function forestNoise(seed,x,z,scale=PINE_RULES.noiseScale){
 const gx=x/scale,gz=z/scale,ix=Math.floor(gx),iz=Math.floor(gz);
 const u=smooth(0,1,gx-ix),v=smooth(0,1,gz-iz);
 const value=(dx,dz)=>cellSeed(seed^0x666f7265,ix+dx,iz+dz)/4294967296;
 const a=value(0,0),b=value(1,0),c=value(0,1),d=value(1,1);
 return (a+(b-a)*u)*(1-v)+(c+(d-c)*u)*v;
}
export function generatePines(world,options={},onProgress=()=>{}){
 const began=performance.now(),rules={...PINE_RULES,...options},range=elevationRange(world);
 const {gridSpacing:step,jitter,cellSize:size,noiseScale,noiseThreshold}=rules;
 if(![step,jitter,size,noiseScale,noiseThreshold].every(Number.isFinite)||step<=0||jitter<0||jitter>=step/2||size<=0||!Number.isInteger(size/step)||noiseScale<=0||noiseThreshold<0||noiseThreshold>1)throw Error('Invalid pine grid/noise settings');
 // These buckets only group output for rendering/shadows; they never select
 // woodland patches or impose a minimum population. Grid/noise is map-wide.
 const minCell=Math.floor(-world.extent/size),maxCell=Math.ceil(world.extent/size)-1,columns=maxCell-minCell+1;
 const cells=new Uint32Array(columns*columns*2),trees=[],normal={},near={},averaged=new AveragedHeightmap((x,z)=>world.height(x,z));
 const perCell=size/step,minGrid=Math.floor(-world.extent/step),seed=world.config.seed;
 let candidates=0,noiseCandidates=0;
 for(let cz=minCell;cz<=maxCell;cz++)for(let cx=minCell;cx<=maxCell;cx++){
  const cell=((cz-minCell)*columns+cx-minCell)*2,start=trees.length/TREE_STRIDE;cells[cell]=start;
  if(cx===minCell)onProgress((cz-minCell)/columns);
  for(let dz=0;dz<perCell;dz++)for(let dx=0;dx<perCell;dx++){
   const gx=cx*perCell+dx,gz=cz*perCell+dz,ix=gx-minGrid,iz=gz-minGrid;
   const centerX=(gx+.5)*step,centerZ=(gz+.5)*step;
   if(centerX < -world.extent||centerX>=world.extent||centerZ < -world.extent||centerZ>=world.extent)continue;
   candidates++;
   const x=centerX+(cellSeed(seed^0x6a697478,ix,iz)/4294967296*2-1)*jitter,z=centerZ+(cellSeed(seed^0x6a69747a,ix,iz)/4294967296*2-1)*jitter;
   if(Math.abs(x)>world.extent-rules.boundaryMargin||Math.abs(z)>world.extent-rules.boundaryMargin)continue;
   if(forestNoise(seed,x,z,noiseScale)<noiseThreshold)continue;
   noiseCandidates++;
   const y=world.height(x,z),density=cellSeed(seed^0x64656e73,ix,iz)/4294967296;
   if(density>plantSuitability(y,0,range,rules))continue;
   world.trail(x,z,near);if(near.distance<world.config.trailWidth/2+rules.trailMargin)continue;
   world.normal(x,z,normal);if(density>plantSuitability(y,normal.slope,range,rules))continue;
   if(Math.abs(averaged.sample(x,z)-y)>rules.maxAverageDifference)continue;
   const random=randomSource(cellSeed(seed^0x61707072,ix,iz));
   trees.push(x,y,z,.78+random()*.45,.72+random()*.65,random()*Math.PI*2,.75+random()*1.25,Math.floor(random()*PINE_VARIANTS),random());
  }
  cells[cell+1]=trees.length/TREE_STRIDE-start;
 }
 const tints=new Float32Array(trees.length/TREE_STRIDE*3);
 for(let id=0;id<tints.length/3;id++){const k=id*TREE_STRIDE;pineTint(seed,trees[k],trees[k+2],trees[k+6],trees[k+8],tints,id*3);}
 onProgress(1);
 return {tints,trees:new Float32Array(trees),cells,minCell,columns,cellSize:size,count:trees.length/TREE_STRIDE,candidates,noiseCandidates,range,rules,generationMs:performance.now()-began};
}
