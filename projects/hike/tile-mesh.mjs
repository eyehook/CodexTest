import * as T from '../../shared/vendor/three-r180/three.module.js';
import {surfaceColor} from './surface.mjs';
import {DETAIL_TILE_METERS} from './detail-texture.mjs';
export const TILE_SIZE=128;
// Allocate only this tile's planned route density, plus vertices needed to join
// its neighbors. Cache all index patterns once; movement never allocates buffers.
export function createTileGeometry(world,tile){
 const road=world.surface?.tiles.get(tile.x+','+tile.z),walking=[];
 const coords=[],vertices=new Map(),patterns=new Map(),size=TILE_SIZE;
 function vertex(x,z){const key=x+','+z;let i=vertices.get(key);if(i===undefined){i=coords.length/2;coords.push(x,z);vertices.set(key,i);}return i;}
 for(let step=tile.nativeStep;step<=32;step*=2){
  if(road&&step!==2)continue;
  const indices=[],rawTri=(a,b,c)=>indices.push(a,b,c),tri=rawTri;
  for(let z=0;z<size;z+=step)for(let x=0;x<size;x+=step){
   if(road&&road.cells.has((tile.x+x)+','+(tile.z+z)))continue;
   const a=vertex(x,z),b=vertex(x+step,z),d=vertex(x,z+step),e=vertex(x+step,z+step);
   if(step===2&&world.surface){
    const wx=tile.x+x,wz=tile.z+z,keys=['v:'+wx+':'+wz,'h:'+(wz+2)+':'+wx,'v:'+(wx+2)+':'+wz,'h:'+wz+':'+wx],lists=keys.map(key=>Array.from(world.surface.edges.get(key)??[]).map(id=>world.surface.vertices[id]));
    if(lists.some(list=>list.some(p=>p.x>wx&&p.x<wx+2||p.z>wz&&p.z<wz+2))){
     const center=vertex(x+1,z+1),starts=[[x,z],[x,z+2],[x+2,z+2],[x+2,z]],ends=[[x,z+2],[x+2,z+2],[x+2,z],[x,z]];
     for(let side=0;side<4;side++){const [ax,az]=starts[side],[bx,bz]=ends[side],dx=bx-ax,dz=bz-az,points=lists[side].map(p=>({x:p.x-tile.x,z:p.z-tile.z})).filter(p=>(p.x-ax)*dx+(p.z-az)*dz>1e-8&&(p.x-bx)*dx+(p.z-bz)*dz<-1e-8).sort((p,q)=>(p.x-q.x)*dx+(p.z-q.z)*dz),ids=[vertex(ax,az),...points.map(p=>vertex(p.x,p.z)),vertex(bx,bz)];for(let i=1;i<ids.length;i++)tri(center,ids[i-1],ids[i]);}
     continue;
    }
   }
   const left=x===0?tile.edges[0]:step,right=x+step===size?tile.edges[1]:step,top=z===0?tile.edges[2]:step,bottom=z+step===size?tile.edges[3]:step;
   if(Math.min(left,right,top,bottom)>=step){tri(a,d,b);tri(b,d,e);continue;}
   const center=vertex(x+step/2,z+step/2);
   function edge(x0,z0,x1,z1,spacing){const count=step/Math.min(step,spacing);for(let j=0;j<count;j++)tri(center,vertex(x0+(x1-x0)*j/count,z0+(z1-z0)*j/count),vertex(x0+(x1-x0)*(j+1)/count,z0+(z1-z0)*(j+1)/count));}
   edge(x,z,x,z+step,left);edge(x,z+step,x+step,z+step,bottom);edge(x+step,z+step,x+step,z,right);edge(x+step,z,x,z,top);
  }
  if(road)for(const triangle of road.triangles){const ids=triangle.ids.map(i=>{const p=world.surface.vertices[i];return vertex(p.x-tile.x,p.z-tile.z);});rawTri(...ids);if(triangle.walking)walking.push(...ids);}
  patterns.set(step,new Uint32Array(indices));
 }
 const count=coords.length/2,positions=new Float32Array(count*3),normals=new Float32Array(count*3),colors=new Float32Array(count*3),uv=new Float32Array(count*2);
 const normal={},near={},color=new T.Color(),tread=new T.Color(.19,.115,.052);
 for(let i=0;i<count;i++){
  const x=tile.x+coords[i*2],z=tile.z+coords[i*2+1],y=world.height(x,z),k=i*3;positions[k]=x;positions[k+1]=y;positions[k+2]=z;
  world.normal(x,z,normal);normals[k]=normal.x;normals[k+1]=normal.y;normals[k+2]=normal.z;
  surfaceColor(x,z,y,normal.slope,world.landscape.summit.y,world.config.seed,color);world.trail(x,z,near);
  color.lerp(tread,Math.max(0,Math.min(1,(world.config.trailWidth/2+1-near.distance)/1.3))*.92);colors[k]=color.r;colors[k+1]=color.g;colors[k+2]=color.b;uv[i*2]=x/DETAIL_TILE_METERS;uv[i*2+1]=z/DETAIL_TILE_METERS;
 }
 const geometry=new T.BufferGeometry();
 for(const [name,array,width] of [['position',positions,3],['normal',normals,3],['color',colors,3],['uv',uv,2]])geometry.setAttribute(name,new T.BufferAttribute(array,width));
 const capacity=Math.max(...Array.from(patterns.values(),p=>p.length)),Index=count<65536?Uint16Array:Uint32Array;for(const [step,data] of patterns)patterns.set(step,new Index(data));geometry.setIndex(new T.BufferAttribute(new Index(capacity),1).setUsage(T.DynamicDrawUsage));geometry.computeBoundingBox();geometry.computeBoundingSphere();
 return {geometry,patterns,walking:new Uint32Array(walking)};
}
