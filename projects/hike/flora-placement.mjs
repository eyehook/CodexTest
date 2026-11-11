import {randomSource} from './geology.mjs?v=generation-1';
import {AveragedHeightmap} from './averaged-heightmap.mjs';
export const TREE_STRIDE=9;
// Normalized elevations follow each world's actual geology range.
export const PINE_RULES=Object.freeze({densityMultiplier:11.5,cellSize:72,clusterChance:.72,minTrees:5,maxTrees:20,minSpacing:5.5,trailMargin:3.5,lowFade:[.03,.12],treeline:[.64,.82],slopeFade:[24,32],maxAverageDifference:.65});
export const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
export function cellSeed(seed,x,z){let h=Math.imul(x,374761393)^Math.imul(z,668265263)^seed;h=Math.imul(h^(h>>>13),1274126177);return (h^(h>>>16))>>>0;}
export function elevationRange(world){
 let min=Infinity,max=-Infinity;for(const y of world.landscape.heights){min=Math.min(min,y);max=Math.max(max,y);}return {min,max};
}
export function plantSuitability(height,slope,range,rules=PINE_RULES){
 const elevation=(height-range.min)/Math.max(1,range.max-range.min);
 return smooth(...rules.lowFade,elevation)*(1-smooth(...rules.treeline,elevation))*(1-smooth(...rules.slopeFade,slope));
}
export function generatePines(world,options={},onProgress=()=>{}){
 const began=performance.now(),rules={...PINE_RULES,...options},range=elevationRange(world);
 if(!Number.isFinite(rules.densityMultiplier)||rules.densityMultiplier<=0)throw Error('Invalid pine density multiplier');
 const densityScale=Math.sqrt(rules.densityMultiplier),clusterScale=1/densityScale,size=rules.cellSize*clusterScale;
 const minSpacing=rules.minSpacing/densityScale;
 const minCell=Math.floor(-world.extent/size),maxCell=Math.floor(world.extent/size),columns=maxCell-minCell+1;
 const cells=new Uint32Array(columns*columns*2),trees=[],spacing=new Map(),normal={},near={},averaged=new AveragedHeightmap((x,z)=>world.height(x,z));
 let clusters=0,candidates=0;
 function occupied(x,z){const bx=Math.floor(x/minSpacing),bz=Math.floor(z/minSpacing);
  for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++)for(const id of spacing.get((bx+dx)+','+(bz+dz))??[]){const k=id*TREE_STRIDE;if((trees[k]-x)**2+(trees[k+2]-z)**2<minSpacing**2)return true;}return false;}
 for(let cz=minCell;cz<=maxCell;cz++)for(let cx=minCell;cx<=maxCell;cx++){
  const cell=((cz-minCell)*columns+cx-minCell)*2,start=trees.length/TREE_STRIDE;cells[cell]=start;
  if(cx===minCell)onProgress((cz-minCell)/columns);
  const random=randomSource(cellSeed(world.config.seed^0x70696e65,cx,cz));if(random()>rules.clusterChance)continue;
  const centerX=(cx+.18+random()*.64)*size,centerZ=(cz+.18+random()*.64)*size,angle=random()*Math.PI*2,rx=(15+random()*19)*clusterScale,rz=(12+random()*18)*clusterScale;
  const target=rules.minTrees+Math.floor(random()*(rules.maxTrees-rules.minTrees+1));
  for(let attempt=0;attempt<target*3&&trees.length/TREE_STRIDE-start<target;attempt++){
   const t=random()*Math.PI*2,r=Math.sqrt(random()),a=Math.cos(t)*r*rx,b=Math.sin(t)*r*rz;
   const x=centerX+a*Math.cos(angle)-b*Math.sin(angle),z=centerZ+a*Math.sin(angle)+b*Math.cos(angle);candidates++;
   if(Math.abs(x)>world.extent-120||Math.abs(z)>world.extent-120||occupied(x,z))continue;
   const y=world.height(x,z),density=random();if(density>plantSuitability(y,0,range,rules))continue;
   world.trail(x,z,near);if(near.distance<world.config.trailWidth/2+rules.trailMargin)continue;
   world.normal(x,z,normal);if(density>plantSuitability(y,normal.slope,range,rules))continue;
   // Fixed roots must agree with both terrain height sources. Reject rough sites
   // rather than moving trees with the snapped mesh. Trunk skirts cover residuals.
   if(Math.abs(averaged.sample(x,z)-y)>rules.maxAverageDifference)continue;
   const id=trees.length/TREE_STRIDE;
   trees.push(x,y,z,.78+random()*.45,.72+random()*.65,random()*Math.PI*2,.82+random()*.29,Math.floor(random()*4),random());
   const key=Math.floor(x/minSpacing)+','+Math.floor(z/minSpacing);if(!spacing.has(key))spacing.set(key,[]);spacing.get(key).push(id);
  }
  // Keep coherent woodland groups instead of isolated failed-cluster remnants.
  if(trees.length/TREE_STRIDE-start<rules.minTrees){
   for(let id=start;id<trees.length/TREE_STRIDE;id++){
    const k=id*TREE_STRIDE,key=Math.floor(trees[k]/minSpacing)+','+Math.floor(trees[k+2]/minSpacing),bucket=spacing.get(key);
    if(!bucket)continue;while(bucket.length&&bucket.at(-1)>=start)bucket.pop();if(!bucket.length)spacing.delete(key);
   }
   trees.length=start*TREE_STRIDE;
  }
  cells[cell+1]=trees.length/TREE_STRIDE-start;if(cells[cell+1])clusters++;
 }
 onProgress(1);
 return {trees:new Float32Array(trees),cells,minCell,columns,cellSize:size,minSpacing,count:trees.length/TREE_STRIDE,clusters,candidates,range,rules,generationMs:performance.now()-began};
}
