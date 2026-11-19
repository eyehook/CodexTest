import * as T from '../../shared/vendor/three-r180/three.module.js';
import {ButtonEdges} from '../../shared/xr/input.mjs';
// Placement uses the off-hand's current grip pose, never its menu ray.
export class ServeInput {
 constructor(rig,game){this.rig=rig;this.game=game;this.edges=new ButtonEdges();this.point=new T.Vector3();this.source=null;this.enabled=false;this.tracked=false;}
 reset(){this.edges.reset();this.source=null;this.enabled=false;this.tracked=false;}
 update(session,frame,reference,mainHand,enabled){
  let source=null;for(const s of session.inputSources)if(s.handedness!==mainHand&&['left','right'].includes(s.handedness)&&s.gripSpace&&s.gamepad){source=s;break;}
  this.edges.retain(session.inputSources);const pose=source&&frame.getPose(source.gripSpace,reference);
  const active=enabled&&this.game.state==='placing'&&!!pose;
  const edge=source?this.edges.sample(source,0,!active||!this.enabled||source!==this.source):null;
  this.source=source;this.enabled=active;this.tracked=!!pose;
  if(!active)return false;
  this.rig.updateMatrixWorld(true);this.point.copy(pose.transform.position).applyMatrix4(this.rig.matrixWorld);
  this.game.previewServe(this.point.x-this.game.tableX,this.point.z-this.game.tableZ);
  if(edge.pressed)return this.game.placeServe();return false;
 }
}
