import * as T from '../../shared/vendor/three-r180/three.module.js';
import {pineFadeShader} from './flora.mjs?v=noise32-2';
import {ROCKS,ROCK_STRIDE,rockCell} from './rock-cells.mjs?v=4';
export function createRockGeometry(){
 const base=new T.IcosahedronGeometry(1,0),source=base.attributes.position;
 const faces=Array.from({length:20},(_,i)=>Array.from({length:3},(_,j)=>new T.Vector3().fromBufferAttribute(source,i*3+j)));
 const key=v=>v.toArray().map(n=>n.toFixed(6)).join(','),edges=new Map();
 for(let face=0;face<20;face++)for(let edge=0;edge<3;edge++){
  const id=[key(faces[face][edge]),key(faces[face][(edge+1)%3])].sort().join('|');
  if(!edges.has(id))edges.set(id,[]);edges.get(id).push({face,edge});
 }
 // Pair neighboring faces, then split their common edge on both sides. This
 // doubles 20 faces to exactly 40 without cracks or a fourfold subdivision.
 const choices=Array.from({length:20},()=>[]),splits=new Int8Array(20).fill(-1);
 for(const pair of edges.values()){const [a,b]=pair;choices[a.face].push([a,b]);choices[b.face].push([b,a]);}
 function pairFaces(){
  const face=splits.indexOf(-1);if(face<0)return true;
  for(const [a,b] of choices[face])if(splits[b.face]<0){
   splits[a.face]=a.edge;splits[b.face]=b.edge;
   if(pairFaces())return true;splits[a.face]=splits[b.face]=-1;
  }
  return false;
 }
 if(!pairFaces())throw Error('Could not subdivide rock faces');
 const vertices=[];
 for(let i=0;i<20;i++){
  const face=faces[i],edge=splits[i],a=face[edge],b=face[(edge+1)%3],c=face[(edge+2)%3],mid=a.clone().add(b).normalize();
  for(const v of [a,mid,c,mid,b,c])vertices.push(v.x,v.y,v.z);
 }
 base.dispose();const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(vertices,3));
 const positions=geometry.attributes.position;
 // Deformation depends on the original coordinate, preserving shared corners.
 for(let i=0;i<positions.count;i++){
  const x=positions.getX(i),y=positions.getY(i),z=positions.getZ(i),r=.43+.055*Math.sin(x*13+y*7+z*19);
  positions.setXYZ(i,x*r,y*r*.82,z*r*.94);
 }
 geometry.computeVertexNormals();geometry.computeBoundingSphere();return geometry;
}
const slotCount=(ROCKS.halfWindow*2+1)**2;
export class Rocks {
 constructor(scene,world,flora,{workerFactory=typeof window!=='undefined'?()=>new Worker(new URL('./rock-worker.mjs?v=4',import.meta.url),{type:'module'}):null}={}){
  this.world=world;this.flora=flora;this.geometry=createRockGeometry();this.viewer={value:new T.Vector3()};
  this.material=new T.MeshLambertMaterial({flatShading:true,alphaToCoverage:flora.coverageSamples>1});
  const fade={value:new T.Vector2(ROCKS.fadeStart,ROCKS.far)};
  this.material.onBeforeCompile=shader=>pineFadeShader(shader,this.viewer,fade,flora.coverageStep);
  this.mesh=new T.InstancedMesh(this.geometry,this.material,slotCount*ROCKS.perCell);this.mesh.name='Nearby rocks';
  this.mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);this.mesh.instanceColor=new T.InstancedBufferAttribute(new Float32Array(this.mesh.count*3),3).setUsage(T.DynamicDrawUsage);
  this.mesh.instanceMatrix.array.fill(0);for(let i=0;i<this.mesh.count;i++)this.mesh.instanceMatrix.array[i*16+15]=1;this.mesh.frustumCulled=false;this.mesh.visible=false;scene.add(this.mesh);
  for(const attribute of [this.mesh.instanceMatrix,this.mesh.instanceColor])attribute.onUpload(()=>attribute.clearUpdateRanges());
  this.cells=new Map();this.free=Array.from({length:slotCount},(_,i)=>slotCount-1-i);this.queue=[];this.cx=Infinity;this.cz=Infinity;
  this.matrix=new T.Matrix4();this.position=new T.Vector3();this.rotation=new T.Quaternion();this.euler=new T.Euler();this.scale=new T.Vector3();
  this.inFlight=false;this.completed=null;this.pending=[];this.id=0;this.worker=null;this.error=null;this.disposed=false;this.instanceCount=0;
  if(workerFactory)try{
   this.worker=workerFactory();this.worker.onmessage=({data})=>this.receive(data);
   this.worker.onerror=event=>{event.preventDefault?.();this.fail(new Error(event.message||'Rock worker failed'));};
   this.worker.onmessageerror=()=>this.fail(new Error('Could not read rock worker result'));
   this.worker.postMessage({type:'init',samplingData:world.samplingData,extent:world.extent,summit:world.summit});
  }catch(error){this.fail(error);}
 }
 dirty(attribute,start,count){
  const previous=attribute.updateRanges[0],end=Math.max(start+count,previous?previous.start+previous.count:0);
  if(previous)start=Math.min(start,previous.start);attribute.clearUpdateRanges();attribute.addUpdateRange(start,end-start);attribute.needsUpdate=true;
 }
 clear(record){
  const start=record.slot*ROCKS.perCell*16;this.mesh.instanceMatrix.array.fill(0,start,start+ROCKS.perCell*16);
  for(let i=0;i<ROCKS.perCell;i++)this.mesh.instanceMatrix.array[start+i*16+15]=1;
  this.dirty(this.mesh.instanceMatrix,start,ROCKS.perCell*16);this.instanceCount-=record.count;this.free.push(record.slot);this.cells.delete(record.key);
 }
 plan(cx,cz){
  this.cx=cx;this.cz=cz;
  for(const record of this.cells.values())if(Math.abs(record.cx-cx)>ROCKS.halfWindow||Math.abs(record.cz-cz)>ROCKS.halfWindow)this.clear(record);
  this.queue=[];
  for(let z=cz-ROCKS.halfWindow;z<=cz+ROCKS.halfWindow;z++)for(let x=cx-ROCKS.halfWindow;x<=cx+ROCKS.halfWindow;x++){
   const key=`${x},${z}`;if(!this.cells.has(key))this.queue.push({key,cx:x,cz:z,distance:(x-cx)**2+(z-cz)**2});
  }
  this.queue.sort((a,b)=>a.distance-b.distance);
 }
 apply(record){
  if(this.cells.has(record.key)||Math.abs(record.cx-this.cx)>ROCKS.halfWindow||Math.abs(record.cz-this.cz)>ROCKS.halfWindow)return;
  if(!this.free.length)throw Error('Rock cell capacity exceeded');
  record.slot=this.free.pop();this.cells.set(record.key,record);this.instanceCount+=record.count;
  for(let i=0;i<record.count;i++){
   const k=i*ROCK_STRIDE,d=record.data,slot=record.slot*ROCKS.perCell+i;
   this.position.fromArray(d,k);this.rotation.setFromEuler(this.euler.set(d[k+3],d[k+4],d[k+5]));this.scale.fromArray(d,k+6);
   this.matrix.compose(this.position,this.rotation,this.scale);this.mesh.setMatrixAt(slot,this.matrix);
   this.mesh.instanceColor.array.set(d.subarray(k+9,k+12),slot*3);
  }
  const start=record.slot*ROCKS.perCell;
  this.dirty(this.mesh.instanceMatrix,start*16,ROCKS.perCell*16);this.dirty(this.mesh.instanceColor,start*3,ROCKS.perCell*3);
  delete record.data;
 }
 receive(data){
  if(this.disposed||this.error)return;
  if(data.type==='error'){this.fail(new Error(data.message));return;}
  if(data.type!=='cells'||!this.inFlight||data.id!==this.id)return;
  try{
   if(!Array.isArray(data.cells)||data.cells.length!==this.pending.length)throw Error('Invalid rock batch');
   for(let i=0;i<data.cells.length;i++){
    const cell=data.cells[i],expected=this.pending[i];
    if(cell.key!==expected.key||cell.cx!==expected.cx||cell.cz!==expected.cz||!Number.isInteger(cell.count)||cell.count<0||cell.count>ROCKS.perCell||!(cell.data instanceof Float32Array)||cell.data.length!==ROCKS.perCell*ROCK_STRIDE||!cell.data.every(Number.isFinite))throw Error('Invalid rock cell');
   }
   this.completed=data.cells;this.inFlight=false;
  }catch(error){this.fail(error);}
 }
 syncCoverage(){
  const coverage=this.flora.coverageSamples>1;if(coverage!==this.material.alphaToCoverage){this.material.alphaToCoverage=coverage;this.material.needsUpdate=true;}
 }
 update(viewer,allowWork=true){
  if(this.disposed||this.error)return;this.viewer.value.copy(viewer);this.syncCoverage();
  if(!allowWork)return;
  const cx=Math.floor(viewer.x/ROCKS.cellSize),cz=Math.floor(viewer.z/ROCKS.cellSize);
  if(cx!==this.cx||cz!==this.cz)this.plan(cx,cz);
  if(this.completed){for(const record of this.completed)this.apply(record);this.completed=null;}
  // A replan can contain a cell from the previous in-flight batch. Skip it
  // after applying the result, and discard results outside the current window.
  const cells=[];
  while(this.queue.length&&cells.length<ROCKS.batchSize){const record=this.queue.shift();if(!this.cells.has(record.key))cells.push(record);}
  if(this.worker){
   if(!this.inFlight&&cells.length){this.pending=cells;this.inFlight=true;try{this.worker.postMessage({type:'cells',id:++this.id,cells});}catch(error){this.fail(error);}}
   else this.queue.unshift(...cells);
  }else for(const record of cells)this.apply({...record,...rockCell(this.world,record.cx,record.cz)});
  this.mesh.visible=this.instanceCount>0&&!this.error;
 }
 async initialize(viewer){this.update(viewer);while(!this.error&&!this.disposed&&(this.queue.length||this.inFlight||this.completed)){await new Promise(resolve=>requestAnimationFrame(resolve));this.update(viewer);}}
 fail(error){this.error=error;this.worker?.terminate();this.inFlight=false;this.completed=null;this.mesh.visible=false;}
 dispose(){if(this.disposed)return;this.disposed=true;this.worker?.terminate();this.mesh.removeFromParent();this.geometry.dispose();this.material.dispose();this.cells.clear();this.queue=[];this.completed=null;}
}
