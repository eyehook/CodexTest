import * as THREE from '../../shared/vendor/three-r180/three.module.js';
import {sliderValue} from '../../shared/ui/slider.mjs';
export const BEE_LEVELS=['Off','Low','Medium','High'];
// Host supplies its existing ray hit UV; this widget owns no input listeners/rays.
export class BeeSlider {
 constructor(model){
  this.model=model;this.hover=false;this.canvas=document.createElement('canvas');this.canvas.width=1024;this.canvas.height=300;
  this.texture=new THREE.CanvasTexture(this.canvas);this.texture.colorSpace=THREE.SRGBColorSpace;
  this.mesh=new THREE.Mesh(new THREE.PlaneGeometry(1.16,.34),new THREE.MeshBasicMaterial({map:this.texture,toneMapped:false}));this.mesh.name='bees-density-slider';this.mesh.userData.control=this;
  this.unsubscribe=model.subscribe(()=>this.draw());this.draw();
 }
 activate({uv,source='vr'}={}){return this.drag({uv,source});}
 drag({uv,source='vr'}={}){
  if(this.disposed||!Number.isFinite(uv?.x))return false;
  for(let object=this.mesh;object;object=object.parent)if(!object.visible)return false;
  return this.model.set('bees',sliderValue(this.model.definition('bees'),uv.x*1024,100,824),{source});
 }
 setHover(value){value=!!value;if(value!==this.hover){this.hover=value;this.draw();}}
 draw(){
  const c=this.canvas.getContext('2d'),level=this.model.value('bees');c.fillStyle=this.hover?'#63452f':'#252e32';c.fillRect(0,0,1024,300);
  c.fillStyle='#eef1e7';c.font='54px system-ui';c.textAlign='left';c.textBaseline='middle';c.fillText('Bees',45,53);c.textAlign='right';c.fillText(BEE_LEVELS[level],979,53);
  c.fillStyle='#566466';c.fillRect(100,144,824,12);c.fillStyle='#e2bd79';c.fillRect(100,144,level/3*824,12);
  BEE_LEVELS.forEach((label,i)=>{const x=100+i/3*824;c.fillStyle=i===level?'#e2bd79':'#c7d1ce';c.beginPath();c.arc(x,150,i===level?23:9,0,Math.PI*2);c.fill();c.font='39px system-ui';c.textAlign='center';c.fillText(label,x,235);});this.texture.needsUpdate=true;
 }
 dispose(){this.disposed=true;this.unsubscribe();this.mesh.removeFromParent();this.mesh.geometry.dispose();this.mesh.material.dispose();this.texture.dispose();}
}
