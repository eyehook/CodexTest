import {randomSource} from './geology.mjs?v=generation-1';
import {cellSeed} from './flora-placement.mjs?v=dense-1';
import {surfaceColor,surfaceAltitude,SNOW_LINE} from './surface.mjs?v=snow-line-1';
export const BLADES_PER_CLUMP=352;
export const BLADES_PER_CELL=BLADES_PER_CLUMP*3;
export const TRIANGLE_FIELD=Object.freeze({cellSize:8,halfWindow:7,bladesPerCell:BLADES_PER_CELL,fadeStart:40,far:50,budgetMs:.5,maxCellsPerFrame:4});
export const TRIANGLE_CAP=240000;
export function fieldClumps(world,cx,cz){
 const random=randomSource(cellSeed(world.config.seed^0x74756674,cx,cz)),range=(a,b)=>a+(b-a)*random();
 if(random()>=.75)return [];
 const count=1+Math.floor(random()*3),clumps=[];
 for(let i=0;i<count;i++){
  const x=(cx+range(.2,.8))*8,z=(cz+range(.2,.8))*8;
  if(Math.abs(x)>world.extent-8||Math.abs(z)>world.extent-8)continue;
  clumps.push({x,z,rx:range(1.1,2.1),rz:range(.8,1.8),phase:range(0,Math.PI*2)});
 }
 return clumps;
}
export function fieldCell(world,cx,cz,buffers=null){
 const random=randomSource(cellSeed(world.config.seed^0x626c6164,cx,cz)),range=(a,b)=>a+(b-a)*random();
 const root=buffers?.root??new Float32Array(BLADES_PER_CELL*3),shape=buffers?.shape??new Float32Array(BLADES_PER_CELL*4),color=buffers?.color??new Float32Array(BLADES_PER_CELL*3);
 root.fill(0);shape.fill(0);color.fill(0);
 const clumps=fieldClumps(world,cx,cz),normal={},near={},tint={};let count=0;
 for(let i=0;i<clumps.length*BLADES_PER_CLUMP;i++){
  const {x,z,rx,rz,phase}=clumps[Math.floor(i/BLADES_PER_CLUMP)];
  const radius=Math.sqrt(random()),angle=range(0,Math.PI*2),u=Math.cos(angle)*radius*rx,v=Math.sin(angle)*radius*rz;
  const bx=x+u*Math.cos(phase)-v*Math.sin(phase),bz=z+u*Math.sin(phase)+v*Math.cos(phase);
  world.trail(bx,bz,near);if(near.distance<world.config.trailWidth/2+.18||Math.hypot(bx-world.summit.x,bz-world.summit.z)<4)continue;
  const y=world.height(bx,bz);
  if(surfaceAltitude(bx,bz,y,world.landscape.summit.y,world.config.seed)>=SNOW_LINE)continue;
  world.normal(bx,bz,normal);
  if(normal.slope>30||y>world.flora.range.min+.9*(world.flora.range.max-world.flora.range.min))continue;
  const yaw=range(0,Math.PI*2),height=range(.24,1.28)*(.45+.55*(1-radius)),width=range(.016,.035);
  surfaceColor(bx,bz,y,normal.slope,world.landscape.summit.y,world.config.seed,tint);
  // Fixed, inexpensive baked light variation; no light/shadow sampling at runtime.
  const light=.68*range(.82,1.12);
  root.set([bx,y-.012,bz],count*3);shape.set([width,height,Math.sin(yaw),Math.cos(yaw)],count*4);
  color.set([tint.r*light,tint.g*light,tint.b*light],count*3);count++;
 }
 return {root,shape,color,count};
}
