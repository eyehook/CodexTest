import {terrainHeight} from './height.mjs';
import {waterLevel,drySpawn} from './water.mjs';
// Search on explicit terrain changes, never during movement.
export function lighthouseSite(config){
 const spawn=drySpawn(config),level=waterLevel(config);let best=null;
 for(let dx=-240;dx<=240;dx+=12)for(let dz=-240;dz<=240;dz+=12){
  const distance=Math.hypot(dx,dz);if(distance<35||distance>240)continue;
  const x=spawn.x+dx,z=spawn.z+dz,y=terrainHeight(x,z,config);
  if(y<level+Math.max(3,config.amplitude*0.08))continue;
  let shoreDistance=Infinity;
  for(let radius=12;radius<=108;radius+=12){
   for(let i=0;i<16;i++){const a=i*Math.PI/8;if(terrainHeight(x+Math.cos(a)*radius,z+Math.sin(a)*radius,config)<=level){shoreDistance=radius;break;}}
   if(Number.isFinite(shoreDistance))break;
  }
  if(!Number.isFinite(shoreDistance))continue;
  const score=(y-level)*2-distance*0.09-shoreDistance*0.18+(dz<0?5:0);
  if(!best||score>best.score)best={x,z,y,distance,shoreDistance,score};
 }
 // No coast may exist with degenerate settings; retain a stable fallback.
 return best??{x:spawn.x,z:spawn.z-60,y:terrainHeight(spawn.x,spawn.z-60,config),distance:60,shoreDistance:null};
}
