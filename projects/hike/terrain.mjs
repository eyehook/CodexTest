import * as T from '../../shared/vendor/three-r180/three.module.js';
import {createDetailTexture,DETAIL_TILE_METERS} from './detail-texture.mjs';
import {createTileGeometry,TILE_SIZE} from './tile-mesh.mjs?v=trail-detail-3';
// Radial fog matches the 1 km distance cull, including wide desktop/XR views.
const radialFog=shader=>{shader.vertexShader=shader.vertexShader.replace('#include <fog_vertex>','#ifdef USE_FOG\nvFogDepth = length(mvPosition.xyz);\n#endif');};
export class Terrain {
 constructor(scene,world,settings){
  const began=performance.now();this.world=world;this.settings=settings;this.tiles=[];this.triangles=0;this.updateMs=0;this.lastX=Infinity;this.lastZ=Infinity;this.extent=world.extent;this.count=Math.round(world.extent*2/TILE_SIZE);
  this.detailTexture=createDetailTexture();this.material=new T.MeshLambertMaterial({vertexColors:true,map:this.detailTexture});this.material.onBeforeCompile=radialFog;
  for(let iz=0;iz<this.count;iz++)for(let ix=0;ix<this.count;ix++){
   const x=-this.extent+ix*TILE_SIZE,z=-this.extent+iz*TILE_SIZE;let distance=Infinity;
   for(const p of world.route)distance=Math.min(distance,Math.hypot(Math.max(x-p.x,0,p.x-x-TILE_SIZE),Math.max(z-p.z,0,p.z-z-TILE_SIZE)));
   const pinned=distance<16||world.landmarks.some(p=>p.x>=x-24&&p.x<=x+TILE_SIZE+24&&p.z>=z-24&&p.z<=z+TILE_SIZE+24);
   this.tiles.push({x,z,ix,iz,distance,pinned,nativeStep:pinned||distance<160?2:distance<384?8:32,step:0});
  }
  for(const t of this.tiles){
   t.edges=[t.ix===0?2:Math.min(t.nativeStep,this.at(t.ix-1,t.iz).nativeStep),t.ix===this.count-1?2:Math.min(t.nativeStep,this.at(t.ix+1,t.iz).nativeStep),t.iz===0?2:Math.min(t.nativeStep,this.at(t.ix,t.iz-1).nativeStep),t.iz===this.count-1?2:Math.min(t.nativeStep,this.at(t.ix,t.iz+1).nativeStep)];
   const {geometry,patterns,walking}=createTileGeometry(world,t);t.walkingIndices=walking;t.patterns=patterns;t.mesh=new T.Mesh(geometry,this.material);scene.add(t.mesh);
  }
  // This outer flat continuation is beyond the unified generation domain, never
  // a second terrain layer under it. Fine perimeter vertices match exactly.
  const limit=7000,edge=this.extent,positions=[],uv=[],indices=[];
  const vertex=(x,z)=>{const i=positions.length/3;positions.push(x,world.boundaryHeight,z);uv.push(x/DETAIL_TILE_METERS,z/DETAIL_TILE_METERS);return i;};
  const triangle=(a,b,c)=>{const cross=(positions[c*3]-positions[a*3])*(positions[b*3+2]-positions[a*3+2])-(positions[b*3]-positions[a*3])*(positions[c*3+2]-positions[a*3+2]);indices.push(a,cross>=0?b:c,cross>=0?c:b);};
  for(let side=0;side<4;side++){
   const point=(u,v)=>side===0?vertex(u,-v):side===1?vertex(v,u):side===2?vertex(-u,v):vertex(-v,-u),center=point(0,limit);let prev=point(-edge,limit);
   for(let u=-edge;u<=edge;u+=2){const current=point(u,edge);triangle(center,prev,current);prev=current;}triangle(center,prev,point(edge,limit));
  }
  for(const sx of [-1,1])for(const sz of [-1,1]){const a=vertex(sx*edge,sz*edge),b=vertex(sx*limit,sz*edge),c=vertex(sx*edge,sz*limit),d=vertex(sx*limit,sz*limit);triangle(a,b,c);triangle(b,d,c);}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();
  this.ground=new T.Mesh(g,new T.MeshLambertMaterial({color:new T.Color(.075,.16,.055),map:this.detailTexture}));this.ground.material.onBeforeCompile=radialFog;scene.add(this.ground);
  this.update(world.start.x,world.start.z,true);this.generationMs=performance.now()-began;this.updateMs=0;
  this.vertexCount=this.tiles.reduce((sum,t)=>sum+t.mesh.geometry.attributes.position.count,0);
 }
 at(x,z){return x<0||z<0||x>=this.count||z>=this.count?null:this.tiles[z*this.count+x];}
 update(x,z,force=false){
  if(!force&&Math.hypot(x-this.lastX,z-this.lastZ)<16)return false;
  const began=performance.now();this.lastX=x;this.lastZ=z;let changed=0,triangles=0,active=0;
  for(const t of this.tiles){
   const d=Math.hypot(t.x+64-x,t.z+64-z),bias=!force&&t.step<=4?24:0;
   const requested=d<this.settings.radius+bias?(this.settings.quality>=2?2:4):d<this.settings.radius+this.settings.transition?8:32;
   const next=t.pinned?2:Math.max(t.nativeStep,requested);
   if(next!==t.step){const data=t.patterns.get(next),g=t.mesh.geometry;g.index.array.set(data);g.setDrawRange(0,data.length);g.index.clearUpdateRanges();g.index.addUpdateRange(0,data.length);g.index.needsUpdate=true;t.step=next;changed++;}
   const dx=Math.max(t.x-x,0,x-t.x-128),dz=Math.max(t.z-z,0,z-t.z-128);t.mesh.visible=Math.hypot(dx,dz)<1000;if(t.mesh.visible)active++;
   triangles+=t.mesh.geometry.drawRange.count/3;
  }
  this.ground.visible=Math.min(this.extent-Math.abs(x),this.extent-Math.abs(z))<1000;
  this.triangles=triangles;this.activeTiles=active;this.changed=changed;if(changed)this.updateMs=performance.now()-began;return !!changed;
 }
}
