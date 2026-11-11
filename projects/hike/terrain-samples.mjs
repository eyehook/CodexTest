import {surfaceColor} from './surface.mjs';
import {vertexKey} from './terrain-grid.mjs?v=snapped-1';
// Event-driven sampling; retained previous values reuse overlapping world points.
// Output layout: heights, normals, colors. No renderer/DOM dependency.
export class TerrainSamples {
 constructor(world,coordinates){
  this.world=world;this.coordinates=coordinates;this.count=coordinates.length/2;this.previous=new Float32Array(this.count*7);this.lookup=new Map();
  for(let i=0;i<this.count;i++)this.lookup.set(vertexKey(coordinates[i*2],coordinates[i*2+1]),i);
  this.originX=Infinity;this.originZ=Infinity;this.normal={};this.near={};this.color={r:0,g:0,b:0};
 }
 fill(ox,oz,out){
  const began=performance.now(),count=this.count,{world,coordinates,lookup,previous:old}=this,dx=(ox-this.originX)*4,dz=(oz-this.originZ)*4;
  const reuse=Number.isFinite(dx)&&Math.abs(dx)<8192&&Math.abs(dz)<8192;let sampled=0,min=Infinity,max=-Infinity;
  for(let i=0;i<count;i++){
   const qx=coordinates[i*2],qz=coordinates[i*2+1],wx=ox+qx/4,wz=oz+qz/4,px=qx+dx,pz=qz+dz,j=count+i*3,k=count*4+i*3;
   const source=reuse&&px>=-4096&&px<=4096&&pz>=-4096&&pz<=4096?lookup.get(vertexKey(px,pz)):undefined;
   if(source!==undefined){
    const a=count+source*3,b=count*4+source*3;out[i]=old[source];out[j]=old[a];out[j+1]=old[a+1];out[j+2]=old[a+2];out[k]=old[b];out[k+1]=old[b+1];out[k+2]=old[b+2];
   }else{
    const y=world.height(wx,wz);out[i]=y;world.normal(wx,wz,this.normal);
    out[j]=this.normal.x;out[j+1]=this.normal.y;out[j+2]=this.normal.z;
    surfaceColor(wx,wz,y,this.normal.slope,world.landscape.summit.y,world.config.seed,this.color);world.trail(wx,wz,this.near);
    const blend=Math.max(0,Math.min(1,(world.config.trailWidth/2+1-this.near.distance)/1.3))*.92;
    out[k]=this.color.r+(.19-this.color.r)*blend;out[k+1]=this.color.g+(.115-this.color.g)*blend;out[k+2]=this.color.b+(.052-this.color.b)*blend;sampled++;
   }
   min=Math.min(min,out[i]);max=Math.max(max,out[i]);
  }
  old.set(out);this.originX=ox;this.originZ=oz;
  return {originX:ox,originZ:oz,min,max,sampled,sampleMs:performance.now()-began};
 }
}
