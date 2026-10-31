import * as THREE from '../../shared/vendor/three-r180/three.module.js';
import {sliderValue} from '../../shared/ui/slider.mjs';
export const BEE_LEVELS=['Off','Low','Medium','High'];
// Host supplies its existing ray hit UV; this widget owns no input listeners/rays.
export class SettingsSlider {
 constructor(model,id){
  this.model=model;this.id=id;this.hover=false;this.canvas=document.createElement('canvas');this.canvas.width=1024;this.canvas.height=300;
  this.texture=new THREE.CanvasTexture(this.canvas);this.texture.colorSpace=THREE.SRGBColorSpace;
  this.mesh=new THREE.Mesh(new THREE.PlaneGeometry(1.16,.34),new THREE.MeshBasicMaterial({map:this.texture,toneMapped:false}));this.mesh.name='bees-density-slider';this.mesh.userData.control=this;
  this.unsubscribe=model.subscribe(()=>this.draw());this.draw();
 }
 activate({uv,source='vr'}={}){return this.drag({uv,source});}
 drag({uv,source='vr'}={}){
  if(this.disposed||!Number.isFinite(uv?.x))return false;
  for(let object=this.mesh;object;object=object.parent)if(!object.visible)return false;
  return this.model.set(this.id,sliderValue(this.model.definition(this.id),uv.x*1024,100,824),{source});
 }
 setHover(value){value=!!value;if(value!==this.hover){this.hover=value;this.draw();}}
 draw(){
  const c=this.canvas.getContext('2d'),d=this.model.definition(this.id),level=this.model.value(this.id),fraction=(level-d.min)/(d.max-d.min),disabled=this.model.disabled(d);c.globalAlpha=1;c.fillStyle=this.hover&&!disabled?'#63452f':'#252e32';c.fillRect(0,0,1024,300);c.globalAlpha=disabled?.35:1;
  c.fillStyle='#eef1e7';c.font='54px system-ui';c.textAlign='left';c.textBaseline='middle';c.fillText(this.model.label(d),45,53);c.textAlign='right';c.fillText(this.model.format(d),979,53);
  c.fillStyle='#566466';c.fillRect(100,144,824,12);c.fillStyle='#e2bd79';c.fillRect(100,144,fraction*824,12);
  if(this.id==='bees')BEE_LEVELS.forEach((label,i)=>{const x=100+i/3*824;c.fillStyle=i===level?'#e2bd79':'#c7d1ce';c.beginPath();c.arc(x,150,i===level?23:9,0,Math.PI*2);c.fill();c.font='39px system-ui';c.textAlign='center';c.fillText(label,x,235);});
  else if(d.stops){d.stops.forEach(value=>{const x=100+(value-d.min)/(d.max-d.min)*824;c.fillStyle=value===level?'#e2bd79':'#c7d1ce';c.beginPath();c.arc(x,150,value===level?23:9,0,Math.PI*2);c.fill();c.font='39px system-ui';c.textAlign='center';c.fillText(value+'°',x,235);});}
  else {c.fillStyle='#e2bd79';c.beginPath();c.arc(100+fraction*824,150,23,0,Math.PI*2);c.fill();c.font='35px system-ui';c.textAlign='left';c.fillText(d.min+' '+d.unit,100,235);c.textAlign='right';c.fillText(d.max+' '+d.unit,924,235);}
  c.globalAlpha=1;this.texture.needsUpdate=true;
 }
 dispose(){this.disposed=true;this.unsubscribe();this.mesh.removeFromParent();this.mesh.geometry.dispose();this.mesh.material.dispose();this.texture.dispose();}
}

export class BeeSlider extends SettingsSlider {constructor(model){super(model,'bees');}}
