import {hash,terrainHeight} from '../height.mjs';
import {bands} from '../bands.mjs';
export const GRASS_LIMIT=50000,GRASS_RADIUS=45.72,GENERATION_BUDGET=128;
export const PATCH_SIZE=8,BLADES_PER_PATCH=320,PATCH_SLOTS=Math.floor(GRASS_LIMIT/BLADES_PER_PATCH),STRIDE=10;
// A fixed pool, including a conservative margin for a 2 m movement tile.
export class GrassPopulation {
 constructor(terrain){
  this.terrain=terrain;this.patches=Array.from({length:PATCH_SLOTS},(_,slot)=>({slot,cx:NaN,cz:NaN,epoch:0,cursor:0,count:0,generatedCount:0,data:new Float32Array(BLADES_PER_PATCH*STRIDE)}));
  this.requestX=new Float64Array(PATCH_SLOTS);this.requestZ=new Float64Array(PATCH_SLOTS);this.requestSlot=new Int16Array(PATCH_SLOTS);
  this.free=new Int16Array(PATCH_SLOTS);this.dirty=new Uint8Array(PATCH_SLOTS);this.epoch=0;this.qx=NaN;this.qz=NaN;this.pending=0;this.count=0;this.generatedLastFrame=0;
  this.timings={selection:0,generation:0};
 }
 invalidate(){
  this.qx=NaN;this.qz=NaN;this.count=0;this.pending=0;
  for(const p of this.patches){p.cx=p.cz=NaN;p.epoch=0;p.count=p.cursor=p.generatedCount=0;p.data.fill(0);this.dirty[p.slot]=1;}
 }
 select(x,z,qx,qz){
  const centerX=qx*2+1,centerZ=qz*2+1,r=GRASS_RADIUS+Math.SQRT2,epoch=++this.epoch;let requests=0;
  for(let cx=Math.floor((centerX-r)/PATCH_SIZE);cx<=Math.floor((centerX+r)/PATCH_SIZE);cx++)for(let cz=Math.floor((centerZ-r)/PATCH_SIZE);cz<=Math.floor((centerZ+r)/PATCH_SIZE);cz++){
   const dx=Math.max(Math.abs(cx*PATCH_SIZE+PATCH_SIZE/2-centerX)-PATCH_SIZE/2,0),dz=Math.max(Math.abs(cz*PATCH_SIZE+PATCH_SIZE/2-centerZ)-PATCH_SIZE/2,0);
   if(dx*dx+dz*dz>=r*r)continue;
   if(requests===PATCH_SLOTS)throw new Error('Grass patch pool cannot cover visibility range');
   this.requestX[requests]=cx;this.requestZ[requests]=cz;this.requestSlot[requests]=-1;
   for(const p of this.patches)if(p.cx===cx&&p.cz===cz){p.epoch=epoch;this.requestSlot[requests]=p.slot;break;}
   requests++;
  }
  let freeCount=0;
  for(const p of this.patches)if(p.epoch!==epoch){
   if(p.count){this.count-=p.count;p.data.fill(0);this.dirty[p.slot]=1;}
   p.count=p.cursor=p.generatedCount=0;p.cx=p.cz=NaN;this.free[freeCount++]=p.slot;
  }
  for(let i=0;i<requests;i++)if(this.requestSlot[i]<0){
   const p=this.patches[this.free[--freeCount]];p.cx=this.requestX[i];p.cz=this.requestZ[i];p.epoch=epoch;
   p.seed=hash(p.cx,p.cz,this.terrain.seed^0x671ab);p.data.fill(0);this.dirty[p.slot]=1;
  }
  this.pending=0;for(const p of this.patches)if(p.epoch===epoch&&p.cursor<BLADES_PER_PATCH)this.pending++;
 }
 generate(p,budget){
  let seed=p.seed;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  let count=p.generatedCount;const start=p.cursor,end=Math.min(BLADES_PER_PATCH,start+budget);
  for(let i=start;i<end;i++){
   const lx=(i%16+random())*.5,lz=(Math.floor(i/16)+random())*.4,y=terrainHeight(p.cx*PATCH_SIZE+lx,p.cz*PATCH_SIZE+lz,this.terrain),angle=random()*Math.PI*2,height=.09+random()*.12,width=.035+random()*.045,tint=random();
   if(y<=this.terrain.amplitude*bands.beachEnd||y>=this.terrain.amplitude*bands.snowStart)continue;
   const j=count++*STRIDE,d=p.data;d[j]=lx;d[j+1]=y;d[j+2]=lz;d[j+3]=width;d[j+4]=height;d[j+5]=.10+.18*tint;d[j+6]=.22+.21*tint;d[j+7]=.035+.045*tint;d[j+8]=Math.cos(angle);d[j+9]=Math.sin(angle);
  }
  p.seed=seed;p.cursor=end;p.generatedCount=count;
  if(end===BLADES_PER_PATCH){p.count=count;this.count+=count;this.dirty[p.slot]=1;this.pending--;}
  return end-start;
 }
 update(x,z){
  const start=performance.now(),qx=Math.floor(x/2),qz=Math.floor(z/2);
  if(qx!==this.qx||qz!==this.qz){this.qx=qx;this.qz=qz;this.select(x,z,qx,qz);}
  const generationStart=performance.now();this.timings.selection=generationStart-start;this.generatedLastFrame=0;
  for(let budget=GENERATION_BUDGET;this.pending&&budget>0;){
   let nearest=null,best=Infinity;
   for(const p of this.patches)if(p.epoch===this.epoch&&p.cursor<BLADES_PER_PATCH){const d=(p.cx*PATCH_SIZE+PATCH_SIZE/2-x)**2+(p.cz*PATCH_SIZE+PATCH_SIZE/2-z)**2;if(d<best){best=d;nearest=p;}}
   if(!nearest)break;const used=this.generate(nearest,budget);this.generatedLastFrame+=used;budget-=used;
  }
  this.timings.generation=performance.now()-generationStart;
 }
}
