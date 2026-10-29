import * as THREE from '../../../shared/vendor/three-r180/three.module.js';
import {TreePopulation} from './TreeGenerator.mjs';
import {createTreeMaterial} from './TreeMaterial.js';

export class TreeSystem {
 constructor(scene,terrain,config){
  this.population=new TreePopulation(terrain,config);this.config=config;this.terrain=terrain;
  this.geometry=new THREE.InstancedBufferGeometry();
  this.geometry.setAttribute('position',new THREE.Float32BufferAttribute([-.5,0,0,.5,0,0,0,1,0],3));
  this.geometry.instanceCount=0;this.capacity=0;this.bufferUpdates=0;this.drawCalls=0;
  this.material=createTreeMaterial();this.mesh=new THREE.Mesh(this.geometry,this.material);
  this.mesh.frustumCulled=false;
  this.mesh.onBeforeRender=()=>{this.drawCalls++;};scene.add(this.mesh);
 }
 invalidate(){this.population.invalidate();}
 upload(){
  const p=this.population,count=p.treeCount;
  if(count>this.capacity){
   this.capacity=2**Math.ceil(Math.log2(Math.max(1,count)));
   // Release obsolete GPU buffers when capacity grows, never during ordinary frames.
   this.geometry.dispose();
   for(const [name,size]of [['treeBase',3],['treeSize',2],['treeColor',3]]){
    this.geometry.setAttribute(name,new THREE.InstancedBufferAttribute(new Float32Array(this.capacity*size),size).setUsage(THREE.DynamicDrawUsage));
   }
  }
  if(this.capacity){
   const base=this.geometry.attributes.treeBase,size=this.geometry.attributes.treeSize,color=this.geometry.attributes.treeColor;
   let i=0;
   for(const cell of p.cells.values())for(const tree of cell.trees){
    base.setXYZ(i,tree.x-p.anchorX,tree.y,tree.z-p.anchorZ);
    size.setXY(i,tree.width,tree.height);color.setXYZ(i,...tree.color);i++;
   }
   for(const attribute of [base,size,color]){attribute.clearUpdateRanges();attribute.addUpdateRange(0,count*attribute.itemSize);attribute.needsUpdate=true;}
  }
  this.geometry.instanceCount=count;this.bufferUpdates++;
 }
 update(x,z,ground,meshX,meshZ){
  this.drawCalls=0;this.mesh.visible=this.config.enabled;
  if(!this.config.enabled)return;
  if(this.population.update(x,z))this.upload();
  this.mesh.visible=this.population.treeCount>0;
  const u=this.material.uniforms;
  u.playerOffset.value.set(x-this.population.anchorX,z-this.population.anchorZ);
  u.ground.value=ground;u.baseSink.value=this.config.baseSink;
  u.cutoffDistance.value=Math.min(this.config.cutoffDistance,this.terrain.radius*0.95);
  u.fogStart.value=this.terrain.fogStart;u.fogEnd.value=this.terrain.fogEnd;
  if(this.fogColor!==this.terrain.fogColor){u.fogColor.value.set(this.terrain.fogColor);this.fogColor=this.terrain.fogColor;}
  this.mesh.position.set(meshX,0,meshZ);
 }
 dispose(){this.mesh.removeFromParent();this.geometry.dispose();this.material.dispose();}
}
