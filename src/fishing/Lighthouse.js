import * as THREE from '../../projects/forest/vendor/three.module.js';
import {GLTFLoader} from '../../projects/forest/vendor/GLTFLoader.js';
import {lighthouseSite,foundationBounds} from './lighthouse-placement.mjs';
export class Lighthouse {
 constructor(scene,config){
  this.config=config;this.group=new THREE.Group();scene.add(this.group);
  this.foundation=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshStandardMaterial({color:0x777971,roughness:1}));
  this.group.add(this.foundation);this.group.visible=false;
  this.ready=new GLTFLoader().loadAsync(new URL('./assets/Lighthouse.glb',import.meta.url).href).then(gltf=>{
   const model=gltf.scene;model.scale.setScalar(2);
   const box=new THREE.Box3().setFromObject(model),size=box.getSize(new THREE.Vector3());
   // Double the exported dimensions and center the scaled footprint.
   model.position.set(-(box.min.x+box.max.x)/2,-box.min.y,-(box.min.z+box.max.z)/2);
   this.modelBottom=box.min.y;this.width=Math.max(size.x,size.z)+1.5;this.model=model;this.group.add(model);this.relocate();
  });
 }
 relocate(){
  if(!this.model)return;this.site=lighthouseSite(this.config);
  const bounds=foundationBounds(this.site,this.width,this.config);
  this.base=bounds.needed?bounds.top:this.site.y;this.model.position.y=this.base-this.modelBottom;
  this.foundation.visible=bounds.needed;this.foundation.scale.set(this.width,bounds.top-bounds.bottom,this.width);
  this.foundation.position.y=(bounds.top+bounds.bottom)/2;this.group.visible=true;
 }
 update(worldX,worldZ,ground){
  if(!this.site)return;this.group.position.set(this.site.x-worldX,-ground,this.site.z-worldZ);
  this.group.visible=Math.hypot(this.site.x-worldX,this.site.z-worldZ)<this.config.radius*0.9;
 }
}
