import {randomSource} from './geology.mjs?v=generation-1';
import {cellSeed} from './flora-placement.mjs?v=dense-1';
import {surfaceColor} from './surface.mjs';
export const BLADES_PER_CELL=352;
export const TRIANGLE_FIELD=Object.freeze({cellSize:8,halfWindow:7,bladesPerCell:BLADES_PER_CELL,fadeStart:40,far:50,budgetMs:.5,maxCellsPerFrame:4});
export const TRIANGLE_CAP=80000;
export function fieldCell(world,cx,cz,buffers=null){
 const random=randomSource(cellSeed(world.config.seed^0x74756674,cx,cz)),range=(a,b)=>a+(b-a)*random();
 const root=buffers?.root??new Float32Array(BLADES_PER_CELL*3),shape=buffers?.shape??new Float32Array(BLADES_PER_CELL*4),color=buffers?.color??new Float32Array(BLADES_PER_CELL*3);
 root.fill(0);shape.fill(0);color.fill(0);
 const x=(cx+range(.3,.7))*8,z=(cz+range(.3,.7))*8;
 if(random()>.85||Math.abs(x)>world.extent-8||Math.abs(z)>world.extent-8)return {root,shape,color,count:0};
 const rx=range(1.1,2.1),rz=range(.8,1.8),phase=range(0,Math.PI*2),normal={},near={},tint={};let count=0;
 for(let i=0;i<BLADES_PER_CELL;i++){
  const radius=Math.sqrt(random()),angle=range(0,Math.PI*2),u=Math.cos(angle)*radius*rx,v=Math.sin(angle)*radius*rz;
  const bx=x+u*Math.cos(phase)-v*Math.sin(phase),bz=z+u*Math.sin(phase)+v*Math.cos(phase);
  world.trail(bx,bz,near);if(near.distance<world.config.trailWidth/2+.18||Math.hypot(bx-world.summit.x,bz-world.summit.z)<4)continue;
  const y=world.height(bx,bz);world.normal(bx,bz,normal);
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
