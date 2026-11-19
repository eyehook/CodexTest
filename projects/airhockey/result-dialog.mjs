import * as T from '../../shared/vendor/three-r180/three.module.js';
import {BeveledButton} from '../../shared/ui/beveled-button.mjs?v=1.0.25';
import {ControllerPointer,createPointerLine} from '../../shared/xr/pointer.mjs';

export class ResultDialog {
 constructor(scene,controllers,canvas,camera,onNewGame){
  this.scene=scene;this.controllers=controllers;this.camera=camera;this.pointer=new ControllerPointer({far:4});this.desktopRay=new T.Raycaster();this.desktopHits=[];this.mouse=new T.Vector2(2,2);this.down=false;
  this.mesh=new T.Group();this.mesh.visible=false;scene.add(this.mesh);
  const back=new T.Mesh(new T.BoxGeometry(.74,.4,.035),new T.MeshStandardMaterial({color:'#11283b',roughness:.7}));this.mesh.add(back);
  this.canvas=document.createElement('canvas');this.canvas.width=1024;this.canvas.height=256;this.texture=new T.CanvasTexture(this.canvas);this.texture.colorSpace=T.SRGBColorSpace;
  const title=new T.Mesh(new T.PlaneGeometry(.64,.16),new T.MeshBasicMaterial({map:this.texture,transparent:true,depthWrite:false,toneMapped:false}));title.position.set(0,.085,.022);this.mesh.add(title);
  this.button=new BeveledButton({label:'New Game',onActivate:onNewGame});this.button.mesh.position.set(0,-.105,.025);this.mesh.add(this.button.mesh);
  this.lines=controllers.map(c=>{const line=createPointerLine({length:2});line.visible=false;c.add(line);return line;});
  this.forward=new T.Vector3();
  canvas.addEventListener('pointermove',e=>{const r=canvas.getBoundingClientRect();this.mouse.set((e.clientX-r.left)/r.width*2-1,1-(e.clientY-r.top)/r.height*2);});
  canvas.addEventListener('pointerdown',e=>{if(e.button===0)this.down=true;});
  window.addEventListener('pointerup',()=>{this.down=false;});
  canvas.addEventListener('pointerleave',()=>{this.mouse.set(2,2);this.down=false;this.button.cancel();});
  canvas.addEventListener('pointercancel',()=>{this.down=false;this.button.cancel();});
 }
 get visible(){return this.mesh.visible;}
 showOnTable(won,table){this.show(won,null,null,table);}
 show(won,position,orientation,table=null){
  const c=this.canvas.getContext('2d');c.clearRect(0,0,1024,256);c.fillStyle=won?'#8ad9ff':'#ff9bac';c.font='bold 120px system-ui';c.textAlign='center';c.textBaseline='middle';this.titleText=won?'You Won!':'You Lost!';c.fillText(this.titleText,512,128);this.texture.needsUpdate=true;
  if(table){table.add(this.mesh);this.mesh.position.set(0,.0508+.4/2,0);this.mesh.rotation.set(0,0,0);}
  else {this.scene.add(this.mesh);this.forward.set(0,0,-1).applyQuaternion(orientation);this.mesh.position.copy(position).addScaledVector(this.forward,1.15);this.mesh.quaternion.copy(orientation);}
  this.mesh.visible=true;this.button.cancel();this.mesh.updateMatrixWorld(true);
 }
 hide(){this.mesh.visible=false;this.cancel();}
 cancel(){this.button.cancel();for(const line of this.lines)line.visible=false;}
 update(session,enabled,seed=false){
  if(!this.visible||!enabled){this.cancel();return;}
  this.mesh.updateMatrixWorld(true);
  if(!session){
   this.desktopRay.setFromCamera(this.mouse,this.camera);this.desktopHits.length=0;this.desktopRay.intersectObject(this.button.hitMesh,false,this.desktopHits);const hover=this.desktopHits.length>0;this.button.sample('mouse',hover,this.down,{seed});return;
  }
  const sources=session.inputSources;this.button.retain(sources);
  for(let i=0;i<this.controllers.length;i++){
   const c=this.controllers[i],s=c.userData.inputSource,line=this.lines[i];line.visible=this.visible&&c.visible&&Array.prototype.includes.call(sources,s)&&!!s?.gamepad;
   if(!line.visible){if(s)this.button.sample(s,false,!!s.gamepad?.buttons[0]?.pressed,{seed:true});continue;}
   const hit=this.pointer.cast(c,this.button.hitMesh);line.scale.z=hit?hit.distance:2;line.material.color.set(hit?'#8ad9ff':'#b5bfcc');
   this.button.sample(s,!!hit,!!s.gamepad.buttons[0]?.pressed,{seed});
   if(!this.visible)break;
  }
 }
}
