import * as T from '../../shared/vendor/three-r180/three.module.js';
import {createDetailTexture,DETAIL_TILE_METERS} from './detail-texture.mjs';
import {createTerrainGrid,CELL_SIZE,TERRAIN_RADIUS} from './terrain-grid.mjs?v=rings-300k-1';
import {TerrainSamples} from './terrain-samples.mjs?v=rings-300k-1';
const radialFog=shader=>{shader.vertexShader=shader.vertexShader.replace('#include <fog_vertex>','#ifdef USE_FOG\nvFogDepth = length(mvPosition.xyz);\n#endif');};
export class Terrain {
 constructor(scene,world,{workerFactory}={}){
  this.began=performance.now();this.grid=createTerrainGrid();this.vertexCount=this.grid.vertexCount;this.triangles=this.grid.indices.length/3;
  this.originX=Infinity;this.originZ=Infinity;this.requestedX=Infinity;this.requestedZ=Infinity;this.updateMs=0;this.sampleMs=0;this.latencyMs=0;this.snapCount=0;this.sampledVertices=0;this.inFlight=false;this.disposed=false;this.error=null;
  this.ready=new Promise((resolve,reject)=>{this.resolveReady=resolve;this.rejectReady=reject;});
  const geometry=new T.BufferGeometry();
  for(const [name,size] of [['position',3],['normal',3],['color',3],['uv',2]])geometry.setAttribute(name,new T.BufferAttribute(new Float32Array(this.vertexCount*size),size).setUsage(T.DynamicDrawUsage));
  const p=geometry.attributes.position.array;
  for(let i=0;i<this.vertexCount;i++){p[i*3]=this.grid.coordinates[i*2]/4;p[i*3+2]=this.grid.coordinates[i*2+1]/4;}
  geometry.setIndex(new T.BufferAttribute(this.grid.indices,1));geometry.computeBoundingBox();geometry.computeBoundingSphere();this.geometry=geometry;
  this.buffer=new Float32Array(this.vertexCount*7);
  this.detailTexture=createDetailTexture();this.material=new T.MeshLambertMaterial({vertexColors:true,map:this.detailTexture});this.material.onBeforeCompile=radialFog;
  this.mesh=new T.Mesh(geometry,this.material);this.mesh.name='Snapped terrain';this.mesh.visible=false;scene.add(this.mesh);
  // Browser sampling is off-thread. Node's synchronous adapter exercises the
  // identical sampling path in deterministic tests without a browser worker.
  const factory=workerFactory??(typeof Worker!=='undefined'?()=>new Worker(new URL('./terrain-worker.mjs?v=rings-300k-1',import.meta.url),{type:'module'}):null);
  if(factory){
   this.worker=factory();this.worker.onmessage=({data})=>this.receive(data);this.worker.onerror=event=>this.fail(new Error(event.message||'Terrain sampling worker failed'));
   this.worker.postMessage({type:'init',world:world.samplingData,coordinates:this.grid.coordinates});
  }else this.samples=new TerrainSamples(world,this.grid.coordinates);
  this.update(world.start.x,world.start.z);
 }
 update(x,z){
  if(this.disposed||this.error)return false;
  const ox=Math.floor(x/CELL_SIZE)*CELL_SIZE,oz=Math.floor(z/CELL_SIZE)*CELL_SIZE;
  // During a distant teleport, never display an old coarse patch underfoot.
  // Ordinary walking stays within the old 48 m core while the worker finishes.
  this.mesh.visible=this.snapCount>0&&x>=this.originX-16&&x<=this.originX+32&&z>=this.originZ-16&&z<=this.originZ+32;
  if(ox===this.requestedX&&oz===this.requestedZ)return false;
  this.requestedX=ox;this.requestedZ=oz;this.requestedAt=performance.now();
  if(!this.inFlight&&(ox!==this.originX||oz!==this.originZ))this.request();
  return true;
 }
 request(){
  this.inFlight=true;
  if(this.worker){const buffer=this.buffer.buffer;this.buffer=null;this.worker.postMessage({type:'sample',originX:this.requestedX,originZ:this.requestedZ,buffer},[buffer]);}
  else {const result=this.samples.fill(this.requestedX,this.requestedZ,this.buffer);this.receive({...result,buffer:this.buffer.buffer});}
 }
 receive(data){
  if(this.disposed||this.error)return;
  if(data.error){this.fail(new Error(data.error));return;}
  this.inFlight=false;this.buffer=new Float32Array(data.buffer);
  // Coalesce rapid moves. A late response must never move the mesh backwards.
  if(data.originX===this.requestedX&&data.originZ===this.requestedZ)this.apply(data);
  if(this.originX!==this.requestedX||this.originZ!==this.requestedZ)this.request();
 }
 apply(data){
  const began=performance.now(),count=this.vertexCount,p=this.geometry.attributes.position.array,uv=this.geometry.attributes.uv.array;
  for(let i=0;i<count;i++){p[i*3+1]=this.buffer[i];uv[i*2]=(data.originX+p[i*3])/DETAIL_TILE_METERS;uv[i*2+1]=(data.originZ+p[i*3+2])/DETAIL_TILE_METERS;}
  this.geometry.attributes.normal.array.set(this.buffer.subarray(count,count*4));this.geometry.attributes.color.array.set(this.buffer.subarray(count*4));
  this.originX=data.originX;this.originZ=data.originZ;this.mesh.position.set(this.originX,0,this.originZ);this.mesh.visible=true;
  for(const attribute of Object.values(this.geometry.attributes))attribute.needsUpdate=true;
  // X/Z bounds/topology never change; only the sampled height extent does.
  const box=this.geometry.boundingBox,sphere=this.geometry.boundingSphere;
  box.min.y=data.min;box.max.y=data.max;sphere.center.set(8,(data.min+data.max)/2,8);sphere.radius=Math.hypot(TERRAIN_RADIUS+Math.SQRT2*8,(data.max-data.min)/2);
  this.sampledVertices=data.sampled;this.sampleMs=data.sampleMs;this.snapCount++;this.updateMs=performance.now()-began;this.latencyMs=performance.now()-this.requestedAt;
  if(this.snapCount===1){this.generationMs=performance.now()-this.began;this.resolveReady();}
 }
 fail(error){this.error=error;this.inFlight=false;this.mesh.visible=false;this.worker?.terminate();this.rejectReady(error);this.onError?.(error);}
 dispose(){this.disposed=true;this.worker?.terminate();this.mesh.removeFromParent();this.geometry.dispose();this.material.dispose();this.detailTexture.dispose();}
}
