import {cellSeed,forestNoise} from './flora-placement.mjs?v=noise32-2';
import {surfaceColor} from './surface.mjs?v=green-1';
import {randomSource} from './geology.mjs?v=bench-1';
export const ROCKS=Object.freeze({cellSize:16,halfWindow:4,perCell:32,fadeStart:40,far:50,batchSize:4});
// Position, Euler rotation, axis sizes and linear RGB. One 0.1–2 m base size
// favors small stones; independent 0–10% axis enlargement preserves the shape.
export const ROCK_STRIDE=12;
export function rockCell(world,cx,cz){
 const data=new Float32Array(ROCKS.perCell*ROCK_STRIDE),seed=world.config.seed,normal={},near={},ground={};let count=0;
 for(let i=0;i<ROCKS.perCell;i++){
  const local=i%16,layer=Math.floor(i/16);
  const random=randomSource(cellSeed(seed^0x726f636b^Math.imul(layer,0x45d9f3b),cx*4+local%4,cz*4+Math.floor(local/4)));
  const x=cx*16+(local%4+.2+random()*.6)*4,z=cz*16+(Math.floor(local/4)+.2+random()*.6)*4;
  if(Math.max(Math.abs(x),Math.abs(z))>world.extent-120)continue;
  const patch=forestNoise(seed^0x73746f6e,x,z,48),chance=random();
  if(chance>.12+patch*.55)continue;
  const base=.1+1.9*random()**3;
  const sx=base*(1+random()*.1),sy=base*(1+random()*.1),sz=base*(1+random()*.1),size=Math.max(sx,sy,sz);
  world.trail(x,z,near);
  // Radius is conservative for every rotation of the unit-diameter stone.
  if(near.distance<world.config.trailWidth/2+size*.5+1||Math.hypot(x-world.summit.x,z-world.summit.z)<6+size*.5)continue;
  const y=world.height(x,z);world.normal(x,z,normal);if(normal.slope>38)continue;
  // Favor exposed slopes while retaining some rocks on grassy low ground.
  if(random()>.45+normal.slope/70+Math.max(0,y/world.landscape.summit.y-.45)*.6)continue;
  const rx=random()*Math.PI*2,ry=random()*Math.PI*2,rz=random()*Math.PI*2;
  const warmth=random(),variation=.9+random()*.2;
  const r=.22+warmth*.10,g=.235+warmth*.045,b=.25-warmth*.045;
  surfaceColor(x,z,y,normal.slope,world.landscape.summit.y,seed,ground);
  // Match linear luminance, retaining the stone hue. Baked once in the worker;
  // ordinary Lambert lighting still shades the individual rock faces.
  const groundLuma=.2126*ground.r+.7152*ground.g+.0722*ground.b;
  const brightness=groundLuma*variation/(.2126*r+.7152*g+.0722*b);
  const k=count++*ROCK_STRIDE;
  // The stone's center is below the authoritative surface in every orientation.
  data.set([x,y-Math.min(sx,sy,sz)*.10,z,rx,ry,rz,sx,sy,sz,r*brightness,g*brightness,b*brightness],k);
 }
 return {count,data};
}
