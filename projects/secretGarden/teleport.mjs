import * as THREE from '../../shared/vendor/three-r180/three.module.js';
import {constrainPosition,DOOR_Z} from './garden-layout.mjs?v=46';
export class Teleport {
 constructor(scene){
  this.marker=new THREE.Mesh(new THREE.CylinderGeometry(.18,.18,1.6,16),new THREE.MeshBasicMaterial({color:0x83d59a,transparent:true,opacity:.5,depthWrite:false}));
  this.marker.name='teleport-target';this.marker.castShadow=this.marker.receiveShadow=false;scene.add(this.marker);
  this.destination=new THREE.Vector3();this.normal=new THREE.Vector3();this.viewer=new THREE.Vector3();this.normalMatrix=new THREE.Matrix3();this.sticks=new Map();this.reset();
 }
 reset(){this.sticks.clear();this.source=null;this.ready=false;this.active=false;this.releasing=false;this.valid=false;this.doorRoom=null;this.marker.visible=false;}
 sample(source,resumed=false){
  const y=source?.gamepad?.axes[3];
  if(!source||!Number.isFinite(y)){this.reset();return;}
  if(resumed||source!==this.source){this.reset();this.source=source;this.ready=Math.abs(y)<=.2;return;}
  if(this.active){this.releasing=y>=-.2;return;}
  if(Math.abs(y)<=.2)this.ready=true;
  if(this.ready&&y<=-.65){this.active=true;this.ready=false;this.valid=false;}
 }
 sampleSources(sources,resumed=false,isTracked=()=>true){
  if(resumed)this.reset();
  const available=new Set();let candidate=null;
  for(const source of sources){
   if(!['left','right'].includes(source.handedness)||source.gamepad?.mapping!=='xr-standard'||!isTracked(source))continue;
   const y=source.gamepad.axes[3];if(!Number.isFinite(y))continue;available.add(source);
   let state=this.sticks.get(source);if(!state){state={ready:Math.abs(y)<=.2};this.sticks.set(source,state);}
   if(Math.abs(y)<=.2)state.ready=true;
   if(state.ready&&y<=-.65){state.ready=false;if(!candidate||source.handedness==='left')candidate=source;}
  }
  for(const source of this.sticks.keys())if(!available.has(source))this.sticks.delete(source);
  if(this.active){if(available.has(this.source))this.sample(this.source);else this.reset();return;}
  if(candidate){this.source=candidate;this.active=true;this.releasing=false;this.valid=false;}
 }
 aim(hit,doorOpen,room=null){
  this.valid=false;this.doorRoom=null;this.marker.visible=!!hit;
  if(!hit)return;
  this.destination.copy(hit.point);
  if(room&&hit.object.userData.teleportDoor){this.destination.set(0,0,DOOR_Z);this.valid=true;this.doorRoom=room;}
  this.marker.position.copy(this.destination);this.marker.position.y+=.8;
  if(!this.doorRoom&&hit.face){this.normalMatrix.getNormalMatrix(hit.object.matrixWorld);this.normal.copy(hit.face.normal).applyMatrix3(this.normalMatrix).normalize();
   const allowed=constrainPosition(hit.point.x,hit.point.z,doorOpen);
   this.valid=this.normal.y>.9&&Math.abs(hit.point.y)<.06&&Math.hypot(allowed.x-hit.point.x,allowed.z-hit.point.z)<1e-5;
  }
  this.marker.material.color.set(this.valid?0x83d59a:0xe05b4b);
 }
 finish(rig,headPosition){
  if(!this.active||!this.releasing)return false;
  const valid=this.valid;
  if(valid){rig.updateMatrixWorld(true);this.viewer.copy(headPosition).applyMatrix4(rig.matrixWorld);this.doorRoom?.openFully(this.viewer);rig.position.x+=this.destination.x-this.viewer.x;rig.position.z+=this.destination.z-this.viewer.z;rig.updateMatrixWorld(true);}
  this.active=false;this.releasing=false;this.valid=false;this.doorRoom=null;this.marker.visible=false;return valid;
 }
}
