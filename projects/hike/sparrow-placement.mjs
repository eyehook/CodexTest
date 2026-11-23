import {cellSeed,TREE_STRIDE} from './flora-placement.mjs?v=noise32-2';
import {randomSource} from './geology.mjs?v=bench-1';
// IDs come from the world-aligned pine candidate grid, never renderer slots.
export function generateSparrowEncounters(world){
 const records=[],seed=world.config.seed,normal={};
 const trees=world.flora?.trees??[];
 for(let k=0;k<trees.length;k+=TREE_STRIDE){
  const x=trees[k],z=trees[k+2],gx=Math.floor(x/4),gz=Math.floor(z/4),h=cellSeed(seed^0x73706172,gx,gz);
  if(h/4294967296>=.01)continue;
  records.push({id:`t:${gx}:${gz}`,kind:'tree',x,z,y:trees[k+1],canopy:3.5*trees[k+4],count:2+(h%4),seed:h});
 }
 const random=randomSource(seed^0x67726e64),route=world.route;let i=1,index=0;
 for(let along=90+random()*100;along<world.totalLength-30;along+=150+random()*150,index++){
  while(i<route.length-1&&route[i].distance<along)i++;
  const a=route[i-1],b=route[i],t=(along-a.distance)/(b.distance-a.distance),dx=b.x-a.x,dz=b.z-a.z,len=Math.hypot(dx,dz)||1;
  const side=random()<.5?-1:1;
  for(let attempt=0;attempt<6;attempt++){
   const offset=side*(world.config.trailWidth/2+.5+attempt*.45),x=a.x+dx*t-dz/len*offset,z=a.z+dz*t+dx/len*offset;
   if(Math.abs(x)>world.extent-120||Math.abs(z)>world.extent-120)continue;
   const y=world.height(x,z);let valid=y<world.summit.y*.78;
   // Validate the whole foraging disk, including short hops and bank edges.
   for(let p=0;p<9&&valid;p++){const angle=p*Math.PI/4,px=x+(p?Math.cos(angle)*1.6:0),pz=z+(p?Math.sin(angle)*1.6:0);world.normal(px,pz,normal);valid=normal.slope<24&&Math.abs(world.height(px,pz)-y)<.65;}
   if(!valid)continue;
   records.push({id:`g:${index}`,kind:'ground',x,y,z,canopy:0,count:3+Math.floor(random()*5),seed:cellSeed(seed^0x67726f75,index,0)});break;
  }
 }
 // Choose across all suitable locations rather than keeping only early encounters.
 const ground=records.filter(r=>r.kind==='ground');
 ground.sort((a,b)=>cellSeed(a.seed,17,0)-cellSeed(b.seed,17,0));
 const chosen=new Set(ground.slice(0,1+(cellSeed(seed^0x67726e64,17,0)%2)));
 return records.filter(r=>r.kind==='tree'||chosen.has(r));
}
