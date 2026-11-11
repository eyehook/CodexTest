import {Vector3,Quaternion} from '../../shared/vendor/three-r180/three.module.js';
// Gameplay samples the raw reference-space pose composed with the yaw rig once.
// Presentation roll is excluded from steering and pivoted around the live head.
export class FlightView {
 constructor(bankGroup){this.bankGroup=bankGroup;this.head=new Vector3();this.forward=new Vector3();this.right=new Vector3();this.up=new Vector3();this.tilt=0;this.rigRotation=new Quaternion();this.orientation=new Quaternion();this.axis=new Vector3();this.pivot=new Vector3();this.heading=0;this.pitch=0;}
 sample(rig,viewer){
  rig.updateMatrixWorld(true);this.head.copy(viewer.position).applyMatrix4(rig.matrixWorld);rig.getWorldQuaternion(this.rigRotation);this.orientation.copy(this.rigRotation).multiply(viewer.orientation);
  this.forward.set(0,0,-1).applyQuaternion(this.orientation);const horizontal=Math.hypot(this.forward.x,this.forward.z);
  if(horizontal>1e-6)this.heading=Math.atan2(-this.forward.x,-this.forward.z);this.pitch=Math.atan2(this.forward.y,horizontal);
  // Gravity projected onto the head's right/up axes gives ear-to-shoulder
  // tilt independent of compass yaw. Fade out near vertical gaze, where roll
  // relative to gravity is ambiguous, rather than introducing sudden turns.
  this.right.set(1,0,0).applyQuaternion(this.orientation);this.up.set(0,1,0).applyQuaternion(this.orientation);
  this.tilt=horizontal<.05?0:Math.atan2(this.right.y,this.up.y)*Math.min(1,(horizontal-.05)/.1);return this;
 }
 advance(glider,rig,viewer,dt){
  this.sample(rig,viewer);
  const before=glider.heading;
  // Tilt controls turn rate; looking sideways does not command rotation.
  const point=glider.update(dt,this.head.x,rig.position.y,this.head.z,this.tilt,this.pitch);
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
