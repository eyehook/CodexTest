import * as T from '../../shared/vendor/three-r180/three.module.js';
import {TREE_STRIDE} from './flora-placement.mjs?v=dense-1';
import {createPineVariants} from './pine-geometry.mjs?v=3d-only-1';
export const FLORA_RENDER=Object.freeze({fadeStart:450,far:500,prefetch:16,hysteresis:8,updateStep:1.5,budgetMs:.75,maxWorkItems:2048});
export function selectPineVisibility(distance,previous=0,settings=FLORA_RENDER){
 return distance<=settings.far+settings.prefetch+(previous?settings.hysteresis:0)?1:0;
}
export function pineFadeShader(shader,viewer,fadeRange,coverageStep){
 shader.uniforms.pineViewer=viewer;shader.uniforms.pineFadeRange=fadeRange;shader.uniforms.pineCoverageStep=coverageStep;
 shader.vertexShader='uniform vec3 pineViewer; varying float vPineDistance; varying vec3 vPinePattern;\n'+shader.vertexShader;
 shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
 vec3 pineRoot=(modelMatrix*instanceMatrix[3]).xyz;
 vPineDistance=length(pineViewer.xz-pineRoot.xz);
 vPinePattern=position+pineRoot;`);
 shader.fragmentShader='uniform vec2 pineFadeRange; uniform float pineCoverageStep; varying float vPineDistance; varying vec3 vPinePattern;\n'+shader.fragmentShader;
 shader.fragmentShader=shader.fragmentShader.replace('#include <alphatest_fragment>',`float pineAlpha=1.0-smoothstep(pineFadeRange.x,pineFadeRange.y,vPineDistance);
 if(pineAlpha<=0.0)discard;
 if(pineAlpha<1.0){
  // A stable tree-anchored pattern smooths MSAA's few coverage levels. There
  // is no time or per-eye screen coordinate in this pattern.
  vec3 pineCell=floor(vPinePattern*8.0);
  float pineThreshold=fract(sin(dot(pineCell,vec3(12.9898,78.233,37.719)))*43758.5453);
  #ifdef ALPHA_TO_COVERAGE
  diffuseColor.a*=clamp(pineAlpha+(pineThreshold-0.5)*pineCoverageStep,0.0,1.0);
  #else
  if(pineAlpha<pineThreshold)discard;
  #endif
 }
 #include <alphatest_fragment>`);
}
function prepareInstances(mesh,capacity){
 mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
 mesh.instanceColor=new T.InstancedBufferAttribute(new Float32Array(capacity*3),3).setUsage(T.DynamicDrawUsage);
 mesh.userData.pineIds=new Uint32Array(capacity);
 mesh.userData.pineRanges={matrix:{start:0,count:0},color:{start:0,count:0},min:Infinity,max:0};
 mesh.boundingSphere=new T.Sphere();mesh.visible=false;
}
function dirty(mesh,index){const r=mesh.userData.pineRanges;r.min=Math.min(r.min,index);r.max=Math.max(r.max,index+1);}
function markUpdated(attribute,range,start,count){
 const pending=attribute.updateRanges[0],end=Math.max(start+count,pending?pending.start+pending.count:0);
 if(pending)start=Math.min(start,pending.start);
 attribute.clearUpdateRanges();range.start=start;range.count=end-start;attribute.updateRanges.push(range);attribute.needsUpdate=true;
}
function uploadInstances(mesh){
 const ranges=mesh.userData.pineRanges,end=Math.min(ranges.max,mesh.count);
 if(end>ranges.min){
  markUpdated(mesh.instanceMatrix,ranges.matrix,ranges.min*16,(end-ranges.min)*16);
  markUpdated(mesh.instanceColor,ranges.color,ranges.min*3,(end-ranges.min)*3);
 }
 ranges.min=Infinity;ranges.max=0;
}
export class Flora {
 constructor(scene,data,renderer,options={}){
  this.data=data;this.settings={...FLORA_RENDER,...options};this.variants=createPineVariants();this.states=new Uint8Array(data.count);this.lastX=Infinity;this.lastZ=Infinity;
  this.slots=new Int32Array(data.count).fill(-1);this.activeSnapshot=new Uint32Array(data.count);
  this.job={active:false,x:0,z:0,phase:0,index:0,count:0,cx:0,cz:0,minX:0,maxX:0,maxZ:0,tree:0,end:0};
  this.bounds=new T.Sphere();this.completedPasses=0;this.changedInstances=0;this.peakUpdateMs=0;
  this.viewer={value:new T.Vector3()};this.matrix=new T.Matrix4();this.position=new T.Vector3();this.scale=new T.Vector3();this.rotation=new T.Quaternion();this.axis=new T.Vector3(0,1,0);
  this.fadeRange={value:new T.Vector2(this.settings.fadeStart,this.settings.far)};this.coverageStep={value:.25};
  this.material=new T.MeshLambertMaterial({vertexColors:true,flatShading:true,alphaToCoverage:true});this.material.onBeforeCompile=shader=>pineFadeShader(shader,this.viewer,this.fadeRange,this.coverageStep);
  this.group=new T.Group();this.group.name='Pine forest';scene.add(this.group);const counts=new Uint32Array(4);
  for(let i=0;i<data.count;i++)counts[data.trees[i*TREE_STRIDE+7]]++;
  this.batches=this.variants.map((variant,i)=>{const mesh=new T.InstancedMesh(variant.geometry,this.material,Math.max(1,counts[i]));mesh.count=0;prepareInstances(mesh,Math.max(1,counts[i]));this.group.add(mesh);return mesh;});
  const gl=renderer?.getContext?.();this.desktopSamples=gl?gl.getParameter(gl.SAMPLES):0;this.setCoverageSamples(this.desktopSamples);
  let minY=Infinity,maxY=-Infinity;
  for(let id=0;id<data.count;id++){const k=id*TREE_STRIDE,h=data.trees[k+4],v=this.variants[data.trees[k+7]];minY=Math.min(minY,data.trees[k+1]-.65*h);maxY=Math.max(maxY,data.trees[k+1]+(v.height+.1)*h);}
  this.boundsY=data.count?(minY+maxY)/2:0;this.boundsHalfHeight=data.count?(maxY-minY)/2+1:1;
  this.total=data.count;this.instanceCount=0;this.drawCalls=0;this.updateMs=0;this.disposed=false;
 }
 setCoverageSamples(samples){
  this.coverageSamples=samples;const enabled=samples>1;this.coverageStep.value=enabled?1/samples:1;
  if(this.material.alphaToCoverage!==enabled){this.material.alphaToCoverage=enabled;this.material.needsUpdate=true;}
 }
 batch(id){return this.batches[this.data.trees[id*TREE_STRIDE+7]];}
 remove(id){
  const mesh=this.batch(id),slot=this.slots[id],last=--mesh.count,ids=mesh.userData.pineIds;
  if(slot!==last){
   const moved=ids[last];ids[slot]=moved;this.slots[moved]=slot;
   mesh.instanceMatrix.array.copyWithin(slot*16,last*16,last*16+16);mesh.instanceColor.array.copyWithin(slot*3,last*3,last*3+3);
   dirty(mesh,slot);
  }
  this.states[id]=0;this.slots[id]=-1;this.changedInstances++;
 }
 add(id,lod){
  const trees=this.data.trees,k=id*TREE_STRIDE,width=trees[k+3],height=trees[k+4],mesh=this.batch(id),slot=mesh.count++;
  this.position.set(trees[k],trees[k+1],trees[k+2]);
  this.rotation.setFromAxisAngle(this.axis,trees[k+5]);this.scale.set(width,height,width);
  this.matrix.compose(this.position,this.rotation,this.scale);mesh.setMatrixAt(slot,this.matrix);
  const color=mesh.instanceColor.array,tint=trees[k+6];color[slot*3]=color[slot*3+1]=color[slot*3+2]=tint;
  mesh.userData.pineIds[slot]=id;this.slots[id]=slot;this.states[id]=lod;dirty(mesh,slot);this.changedInstances++;
 }
 consider(id){
  const k=id*TREE_STRIDE,t=this.data.trees,j=this.job,lod=selectPineVisibility(Math.hypot(t[k]-j.x,t[k+2]-j.z),this.states[id],this.settings);
  if(lod===this.states[id])return;
  if(this.states[id])this.remove(id);if(lod)this.add(id,lod);
 }
 beginJob(x,z){
  const j=this.job,{minCell,columns,cellSize}=this.data,s=this.settings,radius=s.far+s.prefetch+s.hysteresis;
  j.active=true;j.x=x;j.z=z;j.phase=0;j.index=0;j.count=0;j.tree=j.end=0;
  // Only IDs are snapshotted. Matrices/colors remain cached in their live slots.
  for(const mesh of this.batches){const ids=mesh.userData.pineIds;for(let i=0;i<mesh.count;i++)this.activeSnapshot[j.count++]=ids[i];}
  j.minX=Math.max(minCell,Math.floor((x-radius)/cellSize)-1);j.maxX=Math.min(minCell+columns-1,Math.floor((x+radius)/cellSize)+1);
  j.cx=j.minX;j.cz=Math.max(minCell,Math.floor((z-radius)/cellSize)-1);j.maxZ=Math.min(minCell+columns-1,Math.floor((z+radius)/cellSize)+1);
  this.bounds.center.set(x,this.boundsY,z);this.bounds.radius=Math.hypot(radius+12,this.boundsHalfHeight);
  // Enclose both the previous and pending member regions until the pass ends.
  for(const mesh of this.batches){if(mesh.count)mesh.boundingSphere.union(this.bounds);else mesh.boundingSphere.copy(this.bounds);}
 }
 workItem(){
  const j=this.job;
  if(j.phase===0){if(j.index<j.count){this.consider(this.activeSnapshot[j.index++]);return;}j.phase=1;}
  if(j.tree<j.end){const id=j.tree++;if(this.states[id]===0)this.consider(id);return;}
  if(j.cx<=j.maxX&&j.cz<=j.maxZ){
   const {cells,minCell,columns}=this.data,index=((j.cz-minCell)*columns+j.cx-minCell)*2;j.tree=cells[index];j.end=j.tree+cells[index+1];
   if(++j.cx>j.maxX){j.cx=j.minX;j.cz++;}return;
  }
  j.active=false;this.lastX=j.x;this.lastZ=j.z;this.completedPasses++;
  for(const mesh of this.batches)mesh.boundingSphere.copy(this.bounds);
 }
 update(viewer,force=false,allowWork=true){
  if(this.disposed)return false;this.viewer.value.copy(viewer);this.changedInstances=0;
  if(!allowWork&&!force){this.updateMs=0;return false;}
  const began=performance.now(),j=this.job,s=this.settings;
  if(force||(!j.active&&(viewer.x-this.lastX)**2+(viewer.z-this.lastZ)**2>=s.updateStep**2)||(j.active&&(viewer.x-j.x)**2+(viewer.z-j.z)**2>64**2))this.beginJob(viewer.x,viewer.z);
  if(!j.active){this.updateMs=0;return false;}
  let items=0;
  do{this.workItem();items++;}while(j.active&&(force||(items<s.maxWorkItems&&(items%64!==0||performance.now()-began<s.budgetMs))));
  this.instanceCount=0;this.drawCalls=0;
  for(const mesh of this.batches){mesh.visible=mesh.count>0;this.instanceCount+=mesh.count;if(mesh.visible){this.drawCalls++;uploadInstances(mesh);}}
  this.updateMs=performance.now()-began;this.peakUpdateMs=Math.max(this.peakUpdateMs,this.updateMs);return true;
 }
 async initialize(viewer){
  this.update(viewer);while(this.job.active&&!this.disposed){await new Promise(resolve=>requestAnimationFrame(resolve));this.update(viewer);}
 }
 dispose(){if(this.disposed)return;this.disposed=true;this.group.removeFromParent();for(const mesh of this.batches)mesh.dispose();for(const v of this.variants)v.geometry.dispose();this.material.dispose();}
}
