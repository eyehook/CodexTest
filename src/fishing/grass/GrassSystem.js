import * as THREE from '../../../projects/forest/vendor/three.module.js';
import {GrassPopulation,GRASS_RADIUS,PATCH_SIZE,PATCH_SLOTS,BLADES_PER_PATCH,STRIDE} from './GrassPopulation.mjs';
export class GrassSystem {
 constructor(scene,terrain){
  this.terrain=terrain;this.population=new GrassPopulation(terrain);this.enabled=true;this.uploads=0;this.uploadedBlades=0;this.anchorX=0;this.anchorZ=0;
  this.timings={selection:0,generation:0,preparation:0,total:0,peak:0};
  const g=this.geometry=new THREE.InstancedBufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute([-.5,0,0,.5,0,0,.15,1,0],3));
  this.buffer=new THREE.InstancedInterleavedBuffer(new Float32Array(PATCH_SLOTS*BLADES_PER_PATCH*STRIDE),STRIDE).setUsage(THREE.DynamicDrawUsage);
  for(const [name,size,offset]of [['bladeBase',3,0],['bladeShape',2,3],['bladeColor',3,5],['bladeRight',2,8]])g.setAttribute(name,new THREE.InterleavedBufferAttribute(this.buffer,size,offset));
  g.instanceCount=PATCH_SLOTS*BLADES_PER_PATCH;
  this.material=new THREE.ShaderMaterial({glslVersion:THREE.GLSL3,side:THREE.DoubleSide,depthWrite:true,
   uniforms:{offset:{value:new THREE.Vector2()},ground:{value:0},radius:{value:GRASS_RADIUS},fogColor:{value:new THREE.Color(terrain.fogColor)},fogStart:{value:terrain.fogStart},fogEnd:{value:terrain.fogEnd}},
   vertexShader:`attribute vec3 bladeBase;attribute vec2 bladeShape;attribute vec3 bladeColor;attribute vec2 bladeRight;
   uniform vec2 offset;uniform float ground;uniform float radius;
   out vec3 colorV;out float fogDistance;
   void main(){
    vec3 base=vec3(bladeBase.x-offset.x,bladeBase.y-ground-0.025,bladeBase.z-offset.y);
    float distance=length(base.xz);
    float growth=1.0-smoothstep(radius-2.0,radius,distance);
    vec3 right=vec3(bladeRight.x,0.0,bladeRight.y);
    vec3 vertex=base+right*position.x*bladeShape.x*growth+vec3(0,position.y*bladeShape.y*growth,0);
    vec4 view=modelViewMatrix*vec4(vertex,1);gl_Position=projectionMatrix*view;fogDistance=length(view.xyz);
    colorV=bladeColor*(0.7+0.3*position.y);
   }`,
   fragmentShader:`precision highp float;in vec3 colorV;in float fogDistance;uniform vec3 fogColor;uniform float fogStart;uniform float fogEnd;out vec4 outColor;
   void main(){outColor=linearToOutputTexel(vec4(mix(colorV,fogColor,smoothstep(fogStart,fogEnd,fogDistance)),1));}`});
  this.mesh=new THREE.Mesh(g,this.material);this.mesh.frustumCulled=false;scene.add(this.mesh);
 }
 invalidate(){this.population.invalidate();}
 update(x,z,ground,meshX,meshZ){
  if(!this.enabled){this.mesh.visible=false;this.timings.selection=this.timings.generation=this.timings.preparation=this.timings.total=0;return;}
  const start=performance.now(),p=this.population;
  p.update(x,z);
  const preparationStart=performance.now(),rebase=Math.abs(x-this.anchorX)>1024||Math.abs(z-this.anchorZ)>1024;
  if(rebase){this.anchorX=Math.floor(x/PATCH_SIZE)*PATCH_SIZE;this.anchorZ=Math.floor(z/PATCH_SIZE)*PATCH_SIZE;p.dirty.fill(1);}
  let low=PATCH_SLOTS,high=-1;
  for(let slot=0;slot<PATCH_SLOTS;slot++)if(p.dirty[slot]){
   const patch=p.patches[slot],offset=slot*BLADES_PER_PATCH*STRIDE;
   if(patch.cursor===BLADES_PER_PATCH)this.buffer.array.set(patch.data,offset);
   else this.buffer.array.fill(0,offset,offset+BLADES_PER_PATCH*STRIDE);
   if(Number.isFinite(patch.cx))for(let i=0;i<patch.count;i++){
    const j=offset+i*STRIDE;this.buffer.array[j]+=patch.cx*PATCH_SIZE-this.anchorX;this.buffer.array[j+2]+=patch.cz*PATCH_SIZE-this.anchorZ;
   }
   p.dirty[slot]=0;low=Math.min(low,slot);high=Math.max(high,slot);
  }
  if(high>=0){
   // One packed upload range, including any earlier changes not yet rendered.
   let first=low*BLADES_PER_PATCH*STRIDE,last=(high+1)*BLADES_PER_PATCH*STRIDE;
   for(const range of this.buffer.updateRanges){first=Math.min(first,range.start);last=Math.max(last,range.start+range.count);}
   this.buffer.clearUpdateRanges();this.buffer.addUpdateRange(first,last-first);this.buffer.needsUpdate=true;
   this.uploads++;this.uploadedBlades+=(high-low+1)*BLADES_PER_PATCH;
  }
  const u=this.material.uniforms;u.offset.value.set(x-this.anchorX,z-this.anchorZ);u.ground.value=ground;
  if(this.fogColor!==this.terrain.fogColor){u.fogColor.value.set(this.terrain.fogColor);this.fogColor=this.terrain.fogColor;}
  u.fogStart.value=this.terrain.fogStart;u.fogEnd.value=this.terrain.fogEnd;
  this.mesh.position.set(meshX,0,meshZ);this.mesh.visible=p.count>0;
  this.timings.selection=p.timings.selection;this.timings.generation=p.timings.generation;this.timings.preparation=performance.now()-preparationStart;this.timings.total=performance.now()-start;this.timings.peak=Math.max(this.timings.peak,this.timings.total);
 }
}
