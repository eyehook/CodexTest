import * as T from '../../shared/vendor/three-r180/three.module.js';
// A brief completion notice only; no extra draw or canvas updates while recording.
export class CaptureNotice {
 constructor(scene){
  this.canvas=document.createElement('canvas');this.canvas.width=768;this.canvas.height=128;this.texture=new T.CanvasTexture(this.canvas);this.texture.colorSpace=T.SRGBColorSpace;
  this.mesh=new T.Mesh(new T.PlaneGeometry(.85,.14),new T.MeshBasicMaterial({map:this.texture,depthTest:false,depthWrite:false}));this.mesh.visible=false;this.mesh.renderOrder=999;scene.add(this.mesh);this.until=0;this.offset=new T.Vector3();
 }
 show(message){const ctx=this.canvas.getContext('2d');ctx.fillStyle='#18221f';ctx.fillRect(0,0,768,128);ctx.fillStyle='#ffffff';ctx.font='32px system-ui';ctx.textAlign='center';ctx.fillText(message,384,76);this.texture.needsUpdate=true;this.until=performance.now()+4000;this.placed=false;}
 update(head,orientation,recording){
  if(!this.until)return;
  this.mesh.visible=!recording&&performance.now()<this.until;
  if(performance.now()>=this.until)this.until=0;
  if(this.mesh.visible&&!this.placed){this.offset.set(0,-.3,-1.25).applyQuaternion(orientation);this.mesh.position.copy(head).add(this.offset);this.mesh.lookAt(head);this.placed=true;}
 }
 hide(){this.until=0;this.mesh.visible=false;}
 dispose(){this.mesh.removeFromParent();this.mesh.geometry.dispose();this.mesh.material.dispose();this.texture.dispose();}
}
