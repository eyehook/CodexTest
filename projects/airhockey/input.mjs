import * as T from '../../shared/vendor/three-r180/three.module.js';
// Current-frame grip poses composed with the rig once. Height/orientation never drive the mallet.
export class HandInput {
  constructor(rig,controllers){this.rig=rig;this.controllers=controllers;this.mainHand='right';this.active=null;this.point=new T.Vector3();this.discontinuous=true;this.tracked=false;this.previous=new T.Vector3();}
  reset(){this.active=null;this.discontinuous=true;this.tracked=false;}
  setHand(hand){if(hand===this.mainHand)return;this.mainHand=hand;this.reset();}
  sample(session,frame,reference,seed=false){
    this.discontinuous=seed;
    for(const c of this.controllers){const source=c.userData.inputSource;const pose=source&&frame.getPose(source.targetRaySpace,reference);c.visible=!!pose;if(pose){c.position.copy(pose.transform.position);c.quaternion.copy(pose.transform.orientation);c.updateMatrix();c.updateMatrixWorld(true);}}
    let selected=null;for(const source of session.inputSources){if(source.handedness===this.mainHand&&source.gripSpace&&source.gamepad){selected=source;break;}}
    if(selected!==this.active){this.active=selected;this.discontinuous=true;}
    const pose=this.active?.gripSpace?frame.getPose(this.active.gripSpace,reference):null;
    if(!pose){this.tracked=false;return false;}
    this.rig.updateMatrixWorld(true);this.point.copy(pose.transform.position).applyMatrix4(this.rig.matrixWorld);
    if(!this.tracked||this.point.distanceTo(this.previous)>.32)this.discontinuous=true;
    this.previous.copy(this.point);this.tracked=true;return true;
  }
}
