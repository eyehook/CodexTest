import * as T from '../../shared/vendor/three-r180/three.module.js';
import {ButtonEdges} from '../../shared/xr/input.mjs';
// Current-frame grip poses composed with the rig once. Height/orientation never drive the mallet.
export class HandInput {
  constructor(rig,controllers){this.rig=rig;this.controllers=controllers;this.edges=new ButtonEdges();this.active=null;this.point=new T.Vector3();this.discontinuous=true;this.tracked=false;this.previous=new T.Vector3();}
  reset(){this.edges.reset();this.active=null;this.discontinuous=true;this.tracked=false;}
  sample(session,frame,reference,seed=false){
    this.discontinuous=seed;this.edges.retain(session.inputSources);
    if(this.active&&!Array.prototype.includes.call(session.inputSources,this.active)){this.active=null;this.discontinuous=true;}
    for(const c of this.controllers){const source=c.userData.inputSource;const pose=source&&frame.getPose(source.targetRaySpace,reference);c.visible=!!pose;if(pose){c.position.copy(pose.transform.position);c.quaternion.copy(pose.transform.orientation);c.updateMatrix();c.updateMatrixWorld(true);}}
    for(const source of session.inputSources){if(!source.gripSpace||!source.gamepad)continue;const edge=this.edges.sample(source,0,seed);if(edge.pressed){if(source!==this.active)this.discontinuous=true;this.active=source;}}
    const pose=this.active?.gripSpace?frame.getPose(this.active.gripSpace,reference):null;
    if(!pose){this.tracked=false;return false;}
    this.rig.updateMatrixWorld(true);this.point.copy(pose.transform.position).applyMatrix4(this.rig.matrixWorld);
    if(!this.tracked||this.point.distanceTo(this.previous)>.32)this.discontinuous=true;
    this.previous.copy(this.point);this.tracked=true;return true;
  }
}
