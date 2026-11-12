import * as T from '../../shared/vendor/three-r180/three.module.js';
import {readMovementAxes} from '../../shared/xr/input.mjs';

export const TELEPORT_RANGE=15;
// Ground-only interaction policy. Shared Locomotion owns head-pivot turns.
export class GroundNavigation {
 constructor(scene,world){
  this.world=world;this.axes={};this.normal={};this.surfaceNormal=new T.Vector3();this.markerAxis=new T.Vector3(0,0,1);this.head=new T.Vector3();this.origin=new T.Vector3();this.direction=new T.Vector3();this.point=new T.Vector3();this.previous=new T.Vector3();this.destination=new T.Vector3();
  this.positions=new Float32Array(65*3);
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.BufferAttribute(this.positions,3));
  this.arc=new T.Line(geometry,new T.LineBasicMaterial({color:0x83d59a}));this.arc.frustumCulled=false;
  this.marker=new T.Mesh(new T.RingGeometry(.22,.35,32),new T.MeshBasicMaterial({color:0x83d59a,side:T.DoubleSide,depthWrite:false}));this.marker.rotation.x=-Math.PI/2;
  this.sticks=new Map();
  scene.add(this.arc,this.marker);this.reset();
 }
 reset(){this.sticks.clear();this.source=null;this.active=false;this.valid=false;this.arc.visible=this.marker.visible=false;}
 update(navigation,dt,sources,viewer,settings,isTracked,getRay){
  const available=Array.from(sources).filter(s=>s.gamepad?.mapping==='xr-standard'&&['left','right'].includes(s.handedness)&&isTracked(s)&&Number.isFinite(s.gamepad.axes[2])&&Number.isFinite(s.gamepad.axes[3]));
  for(const source of this.sticks.keys())if(!available.includes(source))this.sticks.delete(source);
  readMovementAxes(available,this.axes);
  let turn=0,snap=0,candidate=null;
  for(const source of available){
   const x=source.gamepad.axes[2],y=source.gamepad.axes[3];
   let stick=this.sticks.get(source);
   if(!stick){stick={turnReady:false,teleportReady:false};this.sticks.set(source,stick);}
   if(source.handedness==='right'||settings.teleport){
    // Strongest input wins; equal opposing inputs cancel, never doubling speed.
    if(Math.abs(x)>Math.abs(turn))turn=x;else if(Math.abs(x)===Math.abs(turn)&&x!==turn)turn=0;
    if((settings.teleport?Math.abs(x):Math.hypot(x,y))<=.2)stick.turnReady=true;
    else if(stick.turnReady&&Math.abs(x)>=.65&&dt>0){stick.turnReady=false;snap+=Math.sign(x);}
   }
   if(!settings.snapTurn)stick.turnReady=false;
   if(!settings.teleport){stick.teleportReady=false;continue;}
   if(Math.abs(y)<=.2)stick.teleportReady=true;
   if(stick.teleportReady&&y<=-.65){stick.teleportReady=false;if(!candidate||source.handedness==='left')candidate=source;}
  }
  navigation.settings.turnSpeed=(settings.turnSpeed??90)*Math.PI/180;
  navigation.move(dt,settings.teleport?0:this.axes.x,settings.teleport?0:this.axes.z,settings.snapTurn?0:turn,viewer);
  if(settings.snapTurn&&snap){const speed=navigation.settings.turnSpeed;try{navigation.settings.turnSpeed=settings.snapAngle*Math.PI/180/navigation.settings.maxDelta;navigation.move(navigation.settings.maxDelta,0,0,snap,viewer);}finally{navigation.settings.turnSpeed=speed;}}
  if(!settings.teleport){this.source=null;this.active=false;this.valid=false;this.arc.visible=this.marker.visible=false;return false;}
  if(this.active&&!available.includes(this.source)){this.reset();return false;}
  if(!this.active&&candidate){this.source=candidate;this.active=true;this.valid=false;}
  if(!this.active)return false;
  const y=this.source.gamepad.axes[3];
  navigation.rig.updateMatrixWorld(true);this.head.copy(viewer.position).applyMatrix4(navigation.rig.matrixWorld);
  if(getRay(this.source,this.origin,this.direction))this.aim(this.origin,this.direction,this.head,navigation.rig.position.y);else {this.valid=false;this.arc.visible=this.marker.visible=false;}
  if(y<-.2)return false;
  const moved=this.valid;
  if(moved){const rig=navigation.rig;rig.position.x+=this.destination.x-this.head.x;rig.position.z+=this.destination.z-this.head.z;rig.position.y=this.destination.y;rig.updateMatrixWorld(true);}
  this.active=false;this.arc.visible=this.marker.visible=false;return moved;
 }
 aim(origin,direction,head,floor){
  this.valid=false;this.arc.visible=true;this.marker.visible=false;this.previous.copy(origin);
  origin.toArray(this.positions,0);let count=1;
  // Bounded ballistic arc, intersected against authoritative walking terrain.
  let previousClear=origin.y-this.world.height(origin.x,origin.z);
  for(let i=1;i<=64;i++){
   const t=i*.025;this.point.copy(origin).addScaledVector(direction,12*t);this.point.y-=4.9*t*t;
   const height=this.world.height(this.point.x,this.point.z),clear=this.point.y-height;
   if(clear<=0&&previousClear>0){
    let lo=0,hi=1;
    for(let j=0;j<10;j++){const f=(lo+hi)/2,x=T.MathUtils.lerp(this.previous.x,this.point.x,f),z=T.MathUtils.lerp(this.previous.z,this.point.z,f),y=T.MathUtils.lerp(this.previous.y,this.point.y,f);if(y>this.world.height(x,z))lo=f;else hi=f;}
    this.point.lerpVectors(this.previous,this.point,hi);this.point.y=this.world.height(this.point.x,this.point.z);this.destination.copy(this.point);
    const distance=Math.hypot(this.point.x-head.x,this.point.y-floor,this.point.z-head.z);
    this.valid=distance<=TELEPORT_RANGE&&Math.abs(this.point.x)<=this.world.extent&&Math.abs(this.point.z)<=this.world.extent&&this.world.normal(this.point.x,this.point.z,this.normal).slope<=35;
    this.world.normal(this.point.x,this.point.z,this.normal);
    this.surfaceNormal.set(this.normal.x,this.normal.y,this.normal.z).normalize();
    this.marker.quaternion.setFromUnitVectors(this.markerAxis,this.surfaceNormal);
    this.marker.position.copy(this.point).addScaledVector(this.surfaceNormal,.04);this.marker.visible=true;
    this.point.toArray(this.positions,count++*3);break;
   }
   this.point.toArray(this.positions,count++*3);this.previous.copy(this.point);previousClear=clear;
  }
  const color=this.valid?0x83d59a:0xe05b4b;this.arc.material.color.setHex(color);this.marker.material.color.setHex(color);
  this.arc.geometry.setDrawRange(0,count);this.arc.geometry.attributes.position.needsUpdate=true;
 }
}
