import {randomSource} from './geology.mjs?v=generation-1';
import {cellSeed,smooth} from './flora-placement.mjs?v=dense-1';
import {surfaceColor,surfaceAltitude,SNOW_LINE} from './surface.mjs?v=snow-line-1';
// 30 × 50 jittered candidates per 8 m cell; no clump objects or noise texture.
export const BLADES_PER_CELL=1500;
export const TRIANGLE_FIELD=Object.freeze({cellSize:8,halfWindow:7,bladesPerCell:BLADES_PER_CELL,fadeStart:40,far:50,budgetMs:.5,maxCellsPerFrame:4});
export const TRIANGLE_CAP=337500;
// Four world-aligned lattice values are computed once per cell. Adjacent cells
// share edge values; smooth interpolation also gives zero slope at each edge.
export function fieldHillCorners(seed,cx,cz){
 const value=(x,z)=>cellSeed(seed^0x68696c6c,x,z)/4294967296;
 return [value(cx,cz),value(cx+1,cz),value(cx,cz+1),value(cx+1,cz+1)];
}
export function fieldHill(corners,u,v){
 const x=u*u*(3-2*u),z=v*v*(3-2*v);
 return (corners[0]+(corners[1]-corners[0])*x)*(1-z)+(corners[2]+(corners[3]-corners[2])*x)*z;
}
// Independent 32 m hue lattice: broad patches, unrelated to density/height.
export function fieldHuePatch(seed,cx,cz){
 const x=Math.floor(cx/4),z=Math.floor(cz/4);
 return {corners:fieldHillCorners(seed^0x68756573,x,z),u:cx/4-x,v:cz/4-z};
}
export function fieldHueOffset(patch,u,v){return (fieldHill(patch.corners,patch.u+u/4,patch.v+v/4)-.5)*60;}
// Rotate only hue; retain RGB extrema (and hence HSL lightness/saturation).
// Operates in place on the existing terrain tint, without a per-blade object.
export function shiftGrassHue(tint,degrees){
 const {r,g,b}=tint,max=Math.max(r,g,b),min=Math.min(r,g,b),chroma=max-min;
 if(chroma===0)return tint;
 let hue=max===r?(g-b)/chroma:max===g?(b-r)/chroma+2:(r-g)/chroma+4;
 hue=((hue+degrees/60)%6+6)%6;
 const x=chroma*(1-Math.abs(hue%2-1));
 if(hue<1){tint.r=chroma;tint.g=x;tint.b=0;}
 else if(hue<2){tint.r=x;tint.g=chroma;tint.b=0;}
 else if(hue<3){tint.r=0;tint.g=chroma;tint.b=x;}
 else if(hue<4){tint.r=0;tint.g=x;tint.b=chroma;}
 else if(hue<5){tint.r=x;tint.g=0;tint.b=chroma;}
 else {tint.r=chroma;tint.g=0;tint.b=x;}
 tint.r+=min;tint.g+=min;tint.b+=min;return tint;
}
export function fieldCell(world,cx,cz,buffers=null){
 const random=randomSource(cellSeed(world.config.seed^0x626c6164,cx,cz)),range=(a,b)=>a+(b-a)*random();
 const root=buffers?.root??new Float32Array(BLADES_PER_CELL*3),shape=buffers?.shape??new Float32Array(BLADES_PER_CELL*4),color=buffers?.color??new Float32Array(BLADES_PER_CELL*3);
 root.fill(0);shape.fill(0);color.fill(0);
 const corners=fieldHillCorners(world.config.seed,cx,cz),huePatch=fieldHuePatch(world.config.seed,cx,cz),normal={},near={},tint={};let count=0;
 for(let i=0;i<BLADES_PER_CELL;i++){
  const u=(i%30+random())/30,v=(Math.floor(i/30)+random())/50;
  const bx=(cx+u)*8,bz=(cz+v)*8,hill=fieldHill(corners,u,v);
  // Bald below .45; density fills in by .55 while height rises from zero.
  // Cheap density/edge rejection precedes authoritative terrain queries.
  if(random()>smooth(.45,.55,hill)||Math.abs(bx)>world.extent-8||Math.abs(bz)>world.extent-8)continue;
  world.trail(bx,bz,near);if(near.distance<world.config.trailWidth/2+.18||Math.hypot(bx-world.summit.x,bz-world.summit.z)<4)continue;
  const y=world.height(bx,bz);
  if(surfaceAltitude(bx,bz,y,world.landscape.summit.y,world.config.seed)>=SNOW_LINE)continue;
  world.normal(bx,bz,normal);
  if(normal.slope>30||y>world.flora.range.min+.9*(world.flora.range.max-world.flora.range.min))continue;
  const yaw=range(0,Math.PI*2),height=(1.28*smooth(.45,.9,hill))*range(.85,1),width=range(.016,.035);
  surfaceColor(bx,bz,y,normal.slope,world.landscape.summit.y,world.config.seed,tint);
  shiftGrassHue(tint,fieldHueOffset(huePatch,u,v));
  // Fixed, inexpensive baked light variation; no light/shadow sampling at runtime.
  const light=.68*range(.82,1.12);
  root.set([bx,y-.012,bz],count*3);shape.set([width,height,Math.sin(yaw),Math.cos(yaw)],count*4);
  color.set([tint.r*light,tint.g*light,tint.b*light],count*3);count++;
 }
 return {root,shape,color,count};
}
