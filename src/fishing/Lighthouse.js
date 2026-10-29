import * as THREE from '../../shared/vendor/three-r180/three.module.js';
import {GLTFLoader} from '../../shared/vendor/three-r180/addons/GLTFLoader.js';
import {lighthouseSite} from './lighthouse-placement.mjs';

// Resolve the authored contact point through the full exported node hierarchy.
export function anchorLighthouse(model){
 model.scale.setScalar(2);model.updateMatrixWorld(true);
 const base=model.getObjectByName('Base');
 if(!base)throw new Error('Lighthouse model is missing its Base node');
 const contact=base.getWorldPosition(new THREE.Vector3());
 model.position.sub(contact);model.updateMatrixWorld(true);
 return model.position.clone();
}
export class Lighthouse {
 constructor(scene,config){
  this.config=config;this.group=new THREE.Group();scene.add(this.group);this.group.visible=false;
  this.ready=new GLTFLoader().loadAsync(new URL('./assets/Lighthouse.glb',import.meta.url).href).then(gltf=>{
   this.model=gltf.scene;this.anchorOffset=anchorLighthouse(this.model);
   this.group.add(this.model);this.relocate();
  });
 }
 relocate(){
  if(!this.model)return;this.site=lighthouseSite(this.config);
  this.model.position.copy(this.anchorOffset);this.model.position.y+=this.site.y;
  this.group.visible=true;
 }
 update(worldX,worldZ,ground){
  if(!this.site)return;this.group.position.set(this.site.x-worldX,-ground,this.site.z-worldZ);
  this.group.visible=Math.hypot(this.site.x-worldX,this.site.z-worldZ)<this.config.radius*0.9;
 }
}
