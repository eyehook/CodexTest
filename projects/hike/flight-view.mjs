import {Vector3,Quaternion} from '../../shared/vendor/three-r180/three.module.js';
// Gameplay samples the raw reference-space pose composed with the yaw rig once.
// Presentation roll is excluded from steering and pivoted around the live head.
export class FlightView {
 constructor(bankGroup){this.bankGroup=bankGroup;this.head=new Vector3();this.forward=new Vector3();this.rigRotation=new Quaternion();this.orientation=new Quaternion();this.axis=new Vector3();this.pivot=new Vector3();this.heading=0;this.pitch=0;}
 sample(rig,viewer){
  rig.updateMatrixWorld(true);this.head.copy(viewer.position).applyMatrix4(rig.matrixWorld);rig.getWorldQuaternion(this.rigRotation);this.orientation.copy(this.rigRotation).multiply(viewer.orientation);
  this.forward.set(0,0,-1).applyQuaternion(this.orientation);const horizontal=Math.hypot(this.forward.x,this.forward.z);
  if(horizontal>1e-6)this.heading=Math.atan2(-this.forward.x,-this.forward.z);this.pitch=Math.atan2(this.forward.y,horizontal);return this;
 }
 advance(glider,rig,viewer,dt){
  this.sample(rig,viewer);
  const before=glider.heading;
  // Head yaw relative to the body controls turn rate. Rotate body and trajectory
  // together so a held sideways look continues turning, without feedback from
  // the accumulated world-space rig yaw.
  const localYaw=Math.atan2(Math.sin(this.heading-rig.rotation.y),Math.cos(this.heading-rig.rotation.y));
  const point=glider.update(dt,this.head.x,rig.position.y,this.head.z,before+localYaw,this.pitch);
  rig.position.x+=point.x-this.head.x;rig.position.z+=point.z-this.head.z;rig.position.y=point.y;
  rig.rotation.y+=Math.atan2(Math.sin(glider.heading-before),Math.cos(glider.heading-before));
  rig.updateMatrixWorld(true);this.pivot.copy(viewer.position).applyMatrix4(rig.matrixWorld);
  // Preserve the moved head X/Z while yawing, even with a physical room offset.
  rig.position.x+=point.x-this.pivot.x;rig.position.z+=point.z-this.pivot.z;
  rig.updateMatrixWorld(true);
 }
 bank(viewer,angle){
  const group=this.bankGroup;
  if(Math.abs(angle)<1e-8){this.reset();return;}
  this.axis.set(0,0,-1).applyQuaternion(viewer.orientation);group.quaternion.setFromAxisAngle(this.axis,angle);
  group.position.copy(viewer.position).sub(this.pivot.copy(viewer.position).applyQuaternion(group.quaternion));
 }
 reset(){this.bankGroup.quaternion.identity();this.bankGroup.position.set(0,0,0);}
}
