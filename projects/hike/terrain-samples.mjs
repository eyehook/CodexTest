import {RenderTerrainHeight} from './averaged-heightmap.mjs';
import {surfaceColor} from './surface.mjs';
import {vertexKey} from './terrain-grid.mjs?v=rings-300k-1';
// Event-driven sampling; retained previous values reuse overlapping world points.
// Output layout: heights, normals, colors. No renderer/DOM dependency.
export class TerrainSamples {
 constructor(world,coordinates,{averaged=true,onProgress,...options}={}){
  this.onProgress=onProgress;this.renderHeight=averaged?new RenderTerrainHeight(world,options):null;
  this.world=world;this.coordinates=coordinates;this.count=coordinates.length/2;this.previous=new Float32Array(this.count*7);this.lookup=new Map();
  for(let i=0;i<this.count;i++)this.lookup.set(vertexKey(coordinates[i*2],coordinates[i*2+1]),i);
  // Only the moving blend annulus needs extra retained detailed source data.
  this.regions=new Uint8Array(this.count);this.sourceSlots=new Int32Array(this.count).fill(-1);let slots=0;
  if(this.renderHeight)for(let i=0;i<this.count;i++){
   const r=Math.hypot(coordinates[i*2]/4-8,coordinates[i*2+1]/4-8),{blendStart,blendEnd}=this.renderHeight.settings;
   this.regions[i]=r<=blendStart-.35?0:r>=blendEnd+.35?2:1;
   if(this.regions[i]===1)this.sourceSlots[i]=slots++;
  }
  this.sourcePrevious=new Float32Array(slots*4);this.sourceNext=new Float32Array(slots*4);this.detailNormal={};
  this.originX=Infinity;this.originZ=Infinity;this.normal={};this.near={};this.color={r:0,g:0,b:0};
 }
 fill(ox,oz,out){
  const began=performance.now(),count=this.count,{world,coordinates,lookup,previous:old}=this,dx=(ox-this.originX)*4,dz=(oz-this.originZ)*4;
  const cx=ox+8,cz=oz+8,previousX=this.originX+8,previousZ=this.originZ+8,render=this.renderHeight;
  const reuse=Number.isFinite(dx)&&Math.abs(dx)<8192&&Math.abs(dz)<8192;let sampled=0,min=Infinity,max=-Infinity;
  for(let i=0;i<count;i++){
   if(i%8192===0)this.onProgress?.(i/count);
   const qx=coordinates[i*2],qz=coordinates[i*2+1],wx=ox+qx/4,wz=oz+qz/4,px=qx+dx,pz=qz+dz,j=count+i*3,k=count*4+i*3;
   const source=reuse&&px>=-4096&&px<=4096&&pz>=-4096&&pz<=4096?lookup.get(vertexKey(px,pz)):undefined;
   if(source!==undefined&&(!render||this.regions[i]!==1&&this.regions[i]===this.regions[source])){
    const a=count+source*3,b=count*4+source*3;out[i]=old[source];out[j]=old[a];out[j+1]=old[a+1];out[j+2]=old[a+2];out[k]=old[b];out[k+1]=old[b+1];out[k+2]=old[b+2];
   }else{
    let y;
    if(render){
     const slot=this.sourceSlots[i],oldSlot=source===undefined?-1:this.sourceSlots[source],detail=this.detailNormal;
     let detailed;
     if(Math.hypot(wx-cx,wz-cz)<render.settings.blendEnd){
      if(source!==undefined&&oldSlot>=0){const k=oldSlot*4;detailed=this.sourcePrevious[k];detail.x=this.sourcePrevious[k+1];detail.y=this.sourcePrevious[k+2];detail.z=this.sourcePrevious[k+3];detail.slope=Math.atan(Math.hypot(detail.x,detail.z)/detail.y)*180/Math.PI;}
      else if(source!==undefined&&Math.hypot(wx-previousX,wz-previousZ)<=render.settings.blendStart-.35){const k=count+source*3;detailed=old[source];detail.x=old[k];detail.y=old[k+1];detail.z=old[k+2];detail.slope=Math.atan(Math.hypot(detail.x,detail.z)/detail.y)*180/Math.PI;}
      else {detailed=world.height(wx,wz);world.normal(wx,wz,detail);}
     }
     // Store detailed source values even just beyond the blend for the next snap.
     if(slot>=0){
      if(detailed===undefined){detailed=world.height(wx,wz);world.normal(wx,wz,detail);}
      const k=slot*4;this.sourceNext[k]=detailed;this.sourceNext[k+1]=detail.x;this.sourceNext[k+2]=detail.y;this.sourceNext[k+3]=detail.z;
     }
     render.sample(wx,wz,cx,cz,this.normal,detailed,detailed===undefined?undefined:detail);y=this.normal.height;
    }else {y=world.height(wx,wz);world.normal(wx,wz,this.normal);}
    out[i]=y;
    out[j]=this.normal.x;out[j+1]=this.normal.y;out[j+2]=this.normal.z;
    surfaceColor(wx,wz,y,this.normal.slope,world.landscape.summit.y,world.config.seed,this.color);world.trail(wx,wz,this.near);
    const blend=Math.max(0,Math.min(1,(world.config.trailWidth/2+1-this.near.distance)/1.3))*.92;
    out[k]=this.color.r+(.19-this.color.r)*blend;out[k+1]=this.color.g+(.115-this.color.g)*blend;out[k+2]=this.color.b+(.052-this.color.b)*blend;sampled++;
   }
   min=Math.min(min,out[i]);max=Math.max(max,out[i]);
  }
  old.set(out);const swap=this.sourcePrevious;this.sourcePrevious=this.sourceNext;this.sourceNext=swap;this.originX=ox;this.originZ=oz;
  return {originX:ox,originZ:oz,min,max,sampled,sampleMs:performance.now()-began,heightmapNodes:render?.map.nodeCount??0,heightmapBytes:render?.map.byteLength??0};
 }
}
