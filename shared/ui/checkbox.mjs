import {CanvasTexture,Mesh,MeshBasicMaterial,PlaneGeometry,SRGBColorSpace} from '../vendor/three-r180/three.module.js';
import {createTheme} from './theme.mjs';

// A model-bound world-space checkbox. The host owns raycasting and activation.
export class VRCheckbox {
 constructor(model,id,{width=1.16,height=.24,theme={}}={}) {
  this.definition=model.definition(id);
  if(this.definition.kind!=='toggle')throw new TypeError('VRCheckbox requires a toggle control');
  if(!(width>0&&height>0))throw new RangeError('Checkbox dimensions must be positive');
  this.model=model;this.id=id;this.theme=createTheme(theme);this.hover=false;this.disposed=false;
  this.canvas=document.createElement('canvas');this.canvas.width=1024;this.canvas.height=212;
  this.texture=new CanvasTexture(this.canvas);this.texture.colorSpace=SRGBColorSpace;
  this.mesh=new Mesh(new PlaneGeometry(width,height),new MeshBasicMaterial({map:this.texture,toneMapped:false}));
  this.mesh.name=`checkbox-${id}`;
  this.unsubscribe=model.subscribe(()=>this.draw());this.draw();
 }
 activate({source='vr'}={}) {
  if(this.disposed||!this.mesh.visible||!this.mesh.material.visible)return false;
  for(let parent=this.mesh.parent;parent;parent=parent.parent)if(!parent.visible)return false;
  return this.model.activate(this.id,{source});
 }
 setHover(value){value=!!value;if(value===this.hover||this.disposed)return;this.hover=value;this.draw();}
 draw(){
  const c=this.canvas.getContext('2d'),t=this.theme,disabled=this.model.disabled(this.definition);
  c.clearRect(0,0,1024,212);c.fillStyle=this.hover&&!disabled?t.hover:t.row;c.fillRect(0,0,1024,212);
  c.globalAlpha=disabled?.45:1;c.strokeStyle=t.text;c.lineWidth=8;c.strokeRect(45,51,110,110);
  if(this.model.value(this.id)){c.beginPath();c.moveTo(65,105);c.lineTo(94,135);c.lineTo(139,76);c.stroke();}
  c.fillStyle=t.text;c.font='64px system-ui';c.textBaseline='middle';c.fillText(this.model.label(this.definition,'vr'),200,108,790);c.globalAlpha=1;
  this.texture.needsUpdate=true;
 }
 dispose(){if(this.disposed)return;this.disposed=true;this.unsubscribe();this.mesh.removeFromParent();this.mesh.geometry.dispose();this.mesh.material.dispose();this.texture.dispose();}
}
