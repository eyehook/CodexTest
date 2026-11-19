import * as T from '../vendor/three-r180/three.module.js';

// Pointer-independent gesture state. A cancelled press cannot re-arm until release.
export class ButtonGesture {
 constructor(){this.previous=new Map();this.hovered=new Set();this.owner=null;}
 reset(){this.previous.clear();this.hovered.clear();this.owner=null;}
 remove(id){this.previous.delete(id);this.hovered.delete(id);if(this.owner===id)this.owner=null;}
 retain(ids){for(const id of this.previous.keys())if(!Array.prototype.includes.call(ids,id))this.remove(id);}
 sample(id,hover,down,seed=false){
  const known=this.previous.has(id),before=this.previous.get(id);this.previous.set(id,!!down);
  if(hover)this.hovered.add(id);else this.hovered.delete(id);
  if(seed||!known){if(this.owner===id)this.owner=null;return false;}
  if(this.owner===id){
   if(!hover){this.owner=null;return false;}
   if(!down){this.owner=null;return true;}
  }else if(this.owner===null&&hover&&down&&!before)this.owner=id;
  return false;
 }
}

// Host owns raycasts and supplies one sample per pointer per frame.
export class BeveledButton {
 constructor({label='Button',width=.42,height=.12,onActivate=()=>{}}={}){
  if(!(width>0&&height>0))throw new RangeError('Button dimensions must be positive');
  this.mesh=new T.Group();this.mesh.name='beveled-button';this.gesture=new ButtonGesture();this.onActivate=onActivate;this.enabled=true;this.disposed=false;
  const shape=new T.Shape(),w=width/2,h=height/2;shape.moveTo(-w,-h);shape.lineTo(w,-h);shape.lineTo(w,h);shape.lineTo(-w,h);shape.closePath();
  this.face=new T.Group();this.mesh.add(this.face);
  this.material=new T.MeshStandardMaterial({color:'#245778',roughness:.4,metalness:.12});
  this.cap=new T.Mesh(new T.ExtrudeGeometry(shape,{depth:.018,bevelEnabled:true,bevelSegments:1,steps:1,bevelSize:.007,bevelThickness:.007}),this.material);this.face.add(this.cap);
  this.base=new T.Mesh(new T.BoxGeometry(width+.025,height+.025,.022),new T.MeshStandardMaterial({color:'#091e2b',roughness:.6}));this.base.position.z=-.022;this.mesh.add(this.base);
  this.canvas=document.createElement('canvas');this.canvas.width=768;this.canvas.height=192;const c=this.canvas.getContext('2d');c.fillStyle='white';c.font='bold 88px system-ui';c.textAlign='center';c.textBaseline='middle';c.fillText(label,384,100,710);
  this.texture=new T.CanvasTexture(this.canvas);this.texture.colorSpace=T.SRGBColorSpace;
  this.label=new T.Mesh(new T.PlaneGeometry(width*.9,height*.82),new T.MeshBasicMaterial({map:this.texture,transparent:true,depthWrite:false,toneMapped:false}));this.label.position.z=.026;this.face.add(this.label);
  // A fixed hit volume prevents the visual depression from shifting the target.
  this.hitMesh=new T.Mesh(new T.BoxGeometry(width+.014,height+.014,.06),new T.MeshBasicMaterial({visible:false}));this.hitMesh.position.z=.004;this.mesh.add(this.hitMesh);
 }
 get active(){if(this.disposed||!this.enabled)return false;for(let p=this.mesh;p;p=p.parent)if(!p.visible)return false;return true;}
 sample(id,hover,down,{seed=false}={}){
  const active=this.active,activate=this.gesture.sample(id,active&&hover,down,seed||!active);this.sync();
  if(activate&&active){this.onActivate();return true;}return false;
 }
 sync(){const pressed=this.gesture.owner!==null;this.face.position.z=pressed?-.014:0;this.material.color.set(pressed?'#347896':this.gesture.hovered.size?'#438eb3':'#245778');}
 cancel(){this.gesture.reset();this.sync();}
 retain(ids){this.gesture.retain(ids);this.sync();}
 dispose(){if(this.disposed)return;this.disposed=true;this.cancel();this.mesh.removeFromParent();for(const m of [this.cap,this.base,this.label,this.hitMesh]){m.geometry.dispose();m.material.dispose();}this.texture.dispose();}
}
