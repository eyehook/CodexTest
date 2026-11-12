import * as T from '../../shared/vendor/three-r180/three.module.js';
import {BLADES_PER_CELL,TRIANGLE_FIELD,TRIANGLE_CAP,fieldCell} from './field-cells.mjs?v=worker-3';
export {BLADES_PER_CELL,TRIANGLE_FIELD,TRIANGLE_CAP,fieldCell} from './field-cells.mjs?v=worker-3';
const vertexShader=`
#include <common>
#include <fog_pars_vertex>
uniform vec3 fieldViewer;
attribute vec3 fieldRoot;
attribute vec4 fieldShape;
attribute vec3 fieldColor;
varying vec3 vFieldColor;
varying vec3 vFieldPattern;
varying float vFieldDistance;
void main(){
 vec3 blade=vec3(position.x*fieldShape.x,position.y*fieldShape.y,position.z*fieldShape.y);
 vec3 rotated=vec3(blade.x*fieldShape.w+blade.z*fieldShape.z,blade.y,-blade.x*fieldShape.z+blade.z*fieldShape.w);
 vec3 world=fieldRoot+rotated;
 vFieldDistance=length(fieldRoot.xz-fieldViewer.xz);vFieldPattern=world;
 vFieldColor=fieldColor;
 vec4 mvPosition=modelViewMatrix*vec4(world,1.0);gl_Position=projectionMatrix*mvPosition;
 #ifdef USE_FOG
 vFogDepth=length(mvPosition.xyz);
 #endif
}`;
const fragmentShader=`
#include <common>
#include <fog_pars_fragment>
uniform float fieldCoverageStep;
varying vec3 vFieldColor;
varying vec3 vFieldPattern;
varying float vFieldDistance;
void main(){
 float alpha=1.0-smoothstep(40.0,50.0,vFieldDistance);if(alpha<=0.0)discard;
 if(alpha<1.0){
  float threshold=fract(sin(dot(floor(vFieldPattern*16.0),vec3(12.9898,78.233,37.719)))*43758.5453);
  #ifdef ALPHA_TO_COVERAGE
  alpha=clamp(alpha+(threshold-.5)*fieldCoverageStep,0.0,1.0);
  #else
  if(alpha<threshold)discard;
  #endif
 }
 gl_FragColor=vec4(vFieldColor,alpha);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
 #include <fog_fragment>
}`;
export class TriangleField {
 constructor(scene,world,flora,{workerFactory=typeof window!=='undefined'||typeof Worker!=='undefined'?()=>new Worker(new URL('./field-worker.mjs?v=worker-3',import.meta.url),{type:'module'}):null}={}){
  this.world=world;this.flora=flora;this.settings=TRIANGLE_FIELD;this.capacity=(2*TRIANGLE_FIELD.halfWindow+1)**2;this.maxTriangles=this.capacity*TRIANGLE_FIELD.bladesPerCell;
  if(this.maxTriangles>TRIANGLE_CAP)throw Error('Triangle field exceeds budget');
  this.viewer={value:new T.Vector3()};this.geometry=new T.InstancedBufferGeometry();
  this.geometry.setAttribute('position',new T.Float32BufferAttribute([-.5,0,0,.5,0,0,.12,1,.1],3));
  this.attributes={};for(const [name,size] of [['fieldRoot',3],['fieldShape',4],['fieldColor',3]]){const attribute=new T.InstancedBufferAttribute(new Float32Array(this.maxTriangles*size),size).setUsage(T.DynamicDrawUsage);this.geometry.setAttribute(name,attribute);this.attributes[name]=attribute;}
  this.geometry.instanceCount=0;
  this.material=new T.ShaderMaterial({uniforms:{...T.UniformsUtils.clone(T.UniformsLib.fog),fieldViewer:this.viewer,fieldCoverageStep:flora.coverageStep},vertexShader,fragmentShader,side:T.DoubleSide,alphaToCoverage:flora.coverageSamples>1,fog:true});
  this.mesh=new T.Mesh(this.geometry,this.material);this.mesh.name='Capped triangle surface field';this.mesh.castShadow=false;this.mesh.receiveShadow=false;this.mesh.frustumCulled=false;this.mesh.visible=false;scene.add(this.mesh);
  this.cells=new Map();this.slots=[];this.queue=[];this.next=0;this.cellX=Infinity;this.cellZ=Infinity;this.instanceCount=0;this.updateMs=0;this.disposed=false;this.minDirty=Infinity;this.maxDirty=0;
  this.worker=null;this.inFlight=false;this.completed=null;this.requestId=0;this.pendingCells=[];this.recycle=null;this.error=null;this.workerMs=0;
  if(workerFactory)try{
   this.worker=workerFactory();
   this.worker.onmessage=({data})=>this.receive(data);
   this.worker.onerror=event=>{event.preventDefault?.();this.fail(new Error(event.message||'Grass worker failed'));};
   this.worker.onmessageerror=()=>this.fail(new Error('Could not read grass worker result'));
   this.worker.postMessage({type:'init',samplingData:world.samplingData,extent:world.extent,summit:world.summit,landscapeSummit:world.landscape.summit,range:world.flora.range});
  }catch(error){this.fail(error);}

 }
 remove(record){
  const slot=record.slot,last=this.slots.length-1;
  if(slot!==last){const moved=this.slots[last];this.slots[slot]=moved;moved.slot=slot;
   for(const attribute of Object.values(this.attributes)){const stride=BLADES_PER_CELL*attribute.itemSize;attribute.array.copyWithin(slot*stride,last*stride,(last+1)*stride);}
   this.minDirty=Math.min(this.minDirty,slot*BLADES_PER_CELL);this.maxDirty=Math.max(this.maxDirty,(slot+1)*BLADES_PER_CELL);
  }
  this.slots.pop();this.instanceCount-=record.count;
 }
 plan(cx,cz){
  const half=this.settings.halfWindow;
  for(const [key,record] of this.cells)if(Math.abs(record.cx-cx)>half||Math.abs(record.cz-cz)>half){this.remove(record);this.cells.delete(key);}
  this.queue=[];this.next=0;
  for(let z=cz-half;z<=cz+half;z++)for(let x=cx-half;x<=cx+half;x++){const key=`${x},${z}`;if(!this.cells.has(key))this.queue.push({key,cx:x,cz:z,distance:(x-cx)**2+(z-cz)**2});}
  this.queue.sort((a,b)=>a.distance-b.distance);this.cellX=cx;this.cellZ=cz;
 }
 update(viewer,allowWork=true){
  if(this.disposed||this.error)return;this.viewer.value.copy(viewer);
  const coverage=this.flora.coverageSamples>1;if(coverage!==this.material.alphaToCoverage){this.material.alphaToCoverage=coverage;this.material.needsUpdate=true;}
  if(!allowWork){this.updateMs=0;return;}
  const began=performance.now(),s=this.settings,cx=Math.floor(viewer.x/s.cellSize),cz=Math.floor(viewer.z/s.cellSize);
  if(cx!==this.cellX||cz!==this.cellZ)this.plan(cx,cz);
  if(this.completed){
   const result=this.completed;this.completed=null;this.workerMs=result.workerMs;this.recycle=result.cells.map(record=>record.data);
   for(const record of result.cells)if(Math.abs(record.cx-cx)<=s.halfWindow&&Math.abs(record.cz-cz)<=s.halfWindow&&!this.cells.has(record.key))this.applyCell(record,record.data);
  }
  if(this.worker){
   if(!this.inFlight){
    const cells=[];while(this.next<this.queue.length&&cells.length<s.maxCellsPerFrame){const record=this.queue[this.next++];if(!this.cells.has(record.key))cells.push(record);}
    if(cells.length){this.inFlight=true;this.pendingCells=cells;try{const buffers=this.recycle,transfer=buffers?buffers.flatMap(cell=>[cell.root.buffer,cell.shape.buffer,cell.color.buffer]):[];this.worker.postMessage({type:'cells',id:++this.requestId,cells,buffers},transfer);this.recycle=null;}catch(error){this.fail(error);return;}}
   }
  }else{
   // Synchronous adapter for dependency-free Node tests; browsers use the worker.
   for(let done=0;this.next<this.queue.length&&done<s.maxCellsPerFrame;done++){
    const record=this.queue[this.next++];if(!this.cells.has(record.key))this.applyCell(record,fieldCell(this.world,record.cx,record.cz));
    if(performance.now()-began>=s.budgetMs)break;
   }
  }
  this.geometry.instanceCount=this.slots.length*BLADES_PER_CELL;this.mesh.visible=this.instanceCount>0;
  const end=Math.min(this.maxDirty,this.geometry.instanceCount);
  if(end>this.minDirty)for(const attribute of Object.values(this.attributes)){
   const stride=attribute.itemSize,pending=attribute.updateRanges[0],start=Math.min(this.minDirty*stride,pending?.start??Infinity),last=Math.max(end*stride,pending?pending.start+pending.count:0);
   attribute.clearUpdateRanges();attribute.addUpdateRange(start,last-start);attribute.needsUpdate=true;
  }
  this.minDirty=Infinity;this.maxDirty=0;this.updateMs=performance.now()-began;
 }
 applyCell(record,data){
  record.slot=this.slots.length;record.count=data.count;this.slots.push(record);this.cells.set(record.key,record);
  for(const [name,source] of [['fieldRoot',data.root],['fieldShape',data.shape],['fieldColor',data.color]]){const attribute=this.attributes[name];attribute.array.set(source,record.slot*BLADES_PER_CELL*attribute.itemSize);}
  delete record.data;this.instanceCount+=data.count;this.minDirty=Math.min(this.minDirty,record.slot*BLADES_PER_CELL);this.maxDirty=Math.max(this.maxDirty,(record.slot+1)*BLADES_PER_CELL);
 }
 receive(data){
  if(this.disposed||this.error)return;
  if(data.type==='error'){this.fail(new Error(data.message));return;}
  if(data.type!=='cells'||data.id!==this.requestId||!this.inFlight)return;
  try{
   if(!Array.isArray(data.cells)||data.cells.length!==this.pendingCells.length)throw Error('Invalid grass worker batch');
   for(let i=0;i<data.cells.length;i++){
    const cell=data.cells[i],expected=this.pendingCells[i],result=cell.data;
    if(cell.key!==expected.key||cell.cx!==expected.cx||cell.cz!==expected.cz||!result||!Number.isInteger(result.count)||result.count<0||result.count>BLADES_PER_CELL)throw Error('Invalid grass worker cell');
    for(const [name,size] of [['root',3],['shape',4],['color',3]])if(!(result[name] instanceof Float32Array)||result[name].length!==BLADES_PER_CELL*size)throw Error('Invalid grass worker buffer');
   }
   this.completed=data;this.inFlight=false;
  }catch(error){this.fail(error);}
 }
 fail(error){if(this.disposed||this.error)return;this.error=error;this.worker?.terminate();this.inFlight=false;this.completed=null;this.recycle=null;this.mesh.visible=false;this.geometry.instanceCount=0;}
 async initialize(viewer){this.update(viewer);while(!this.error&&(this.next<this.queue.length||this.inFlight||this.completed)&&!this.disposed){await new Promise(resolve=>requestAnimationFrame(resolve));this.update(viewer);}}
 dispose(){if(this.disposed)return;this.disposed=true;this.worker?.terminate();this.completed=null;this.recycle=null;this.inFlight=false;this.mesh.removeFromParent();this.geometry.dispose();this.material.dispose();this.cells.clear();this.slots.length=0;this.queue.length=0;}
}
