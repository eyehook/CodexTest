import * as THREE from '../../shared/vendor/three-r180/three.module.js';
import {DEBUG_PLANT_TYPES} from './debug-plant-types.mjs?v=89';
export function leftPalmUp(q,wasOpen=false){return 2*(q.x*q.y+q.w*q.z)>(wasOpen ? .55 : .75);}
export class DebugMenu {
 constructor(scene,choose){
  this.choose=choose;this.selected=null;this.group=new THREE.Group();this.group.name='palm-debug-menu';scene.add(this.group);this.group.visible=false;
  this.canvas=document.createElement('canvas');this.canvas.width=768;this.canvas.height=16+DEBUG_PLANT_TYPES.length*64;
  this.texture=new THREE.CanvasTexture(this.canvas);this.texture.colorSpace=THREE.SRGBColorSpace;
  this.width=.48;this.height=this.width*this.canvas.height/768;
  this.mesh=new THREE.Mesh(new THREE.PlaneGeometry(this.width,this.height),new THREE.MeshBasicMaterial({map:this.texture,alphaTest:.05,toneMapped:false}));this.mesh.renderOrder=20;this.mesh.userData.control=this;this.group.add(this.mesh);
  this.highlight=new THREE.Mesh(new THREE.PlaneGeometry(this.width-.02,this.width*60/768),new THREE.MeshBasicMaterial({color:0xdfbd79,transparent:true,opacity:.16,depthWrite:false,toneMapped:false}));this.highlight.position.z=.001;this.highlight.renderOrder=21;this.highlight.visible=false;this.group.add(this.highlight);
  this.position=new THREE.Vector3();this.head=new THREE.Vector3();this.quaternion=new THREE.Quaternion();this.localQuaternion=new THREE.Quaternion();this.rigQuaternion=new THREE.Quaternion();this.draw();
 }
 get visible(){return this.group.visible;}
 get targets(){return this.visible?[this.mesh]:[];}
 hide(){this.group.visible=false;this.highlight.visible=false;this.justOpened=false;}
 update(pose,rig,headPosition){
  const wasOpen=this.visible;if(!pose){this.hide();return;}
  rig.updateMatrixWorld(true);rig.getWorldQuaternion(this.rigQuaternion);this.localQuaternion.copy(pose.transform.orientation);this.quaternion.copy(this.rigQuaternion).multiply(this.localQuaternion);
  if(!leftPalmUp(this.quaternion,wasOpen)){this.hide();return;}
  this.group.visible=true;this.justOpened=!wasOpen;
  this.position.copy(pose.transform.position).applyMatrix4(rig.matrixWorld);this.position.y+=.32;this.group.position.copy(this.position);
  this.head.copy(headPosition).applyMatrix4(rig.matrixWorld);this.group.lookAt(this.head);this.group.updateMatrixWorld(true);
 }
 rowAt(uv){if(!uv||!Number.isFinite(uv.x)||!Number.isFinite(uv.y)||uv.x<.025||uv.x>.975)return -1;const y=(1-uv.y)*this.canvas.height,row=Math.floor((y-8)/64);return row>=0&&row<DEBUG_PLANT_TYPES.length?row:-1;}
 setHover(uv){const row=this.visible?this.rowAt(uv):-1;this.highlight.visible=row>=0;if(row>=0)this.highlight.position.y=this.height/2-(8+row*64+32)*this.width/768;}
 activate({uv}={}){
  if(!this.visible||this.justOpened)return false;const row=this.rowAt(uv);if(row<0)return false;const type=DEBUG_PLANT_TYPES[row];
  try{this.choose(type.id);this.selected=type.id;}catch{return false;}
  this.draw();return true;
 }
 draw(){
  const c=this.canvas.getContext('2d');c.clearRect(0,0,768,this.canvas.height);c.fillStyle='#1d2e27';c.beginPath();c.roundRect(0,0,768,this.canvas.height,20);c.fill();c.textAlign='left';c.textBaseline='middle';
  DEBUG_PLANT_TYPES.forEach((type,i)=>{const y=8+i*64;c.fillStyle=i%2?'#293e35':'#263a32';c.fillRect(16,y+2,736,60);c.fillStyle=type.id===this.selected?'#dfbd79':'#edf2e8';c.font='30px system-ui';c.fillText(type.label,36,y+32);if(type.id===this.selected){c.textAlign='right';c.fillText('•',726,y+32);c.textAlign='left';}});
  this.texture.needsUpdate=true;
 }
}
