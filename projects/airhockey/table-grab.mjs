import * as T from '../../shared/vendor/three-r180/three.module.js';
import {ButtonEdges} from '../../shared/xr/input.mjs';
// A single grip owns translation. Physics remains in table-local X/Z coordinates.
export class TableGrab {
 constructor(rig,game){this.rig=rig;this.game=game;this.edges=new ButtonEdges();this.owner=null;this.point=new T.Vector3();this.previous=new T.Vector3();this.start=new T.Vector3();this.origin=new T.Vector3();}
 cancel(){this.owner=null;}
 reset(){this.cancel();this.edges.reset();}
 sample(session,frame,reference,{seed=false,enabled=true}={}){
  if(seed||!enabled)this.cancel();
  this.edges.retain(session.inputSources);this.rig.updateMatrixWorld(true);
  if(this.owner&&!Array.prototype.includes.call(session.inputSources,this.owner))this.cancel();
  for(const source of session.inputSources){
   const edge=this.edges.sample(source,1,seed||!enabled);
   const pose=source.gripSpace&&frame.getPose(source.gripSpace,reference);
   if(source===this.owner){
    if(!edge.down||!pose){this.cancel();continue;}
    this.point.copy(pose.transform.position).applyMatrix4(this.rig.matrixWorld);
    if(this.point.distanceTo(this.previous)>.32){this.cancel();continue;}
    this.previous.copy(this.point);
    this.game.tableX=this.origin.x+this.point.x-this.start.x;
    this.game.tableZ=this.origin.z+this.point.z-this.start.z;
    this.game.height=this.origin.y+this.point.y-this.start.y;
   }else if(enabled&&!this.owner&&edge.pressed&&pose){
    this.point.copy(pose.transform.position).applyMatrix4(this.rig.matrixWorld);
    this.owner=source;this.start.copy(this.point);this.previous.copy(this.point);this.origin.set(this.game.tableX,this.game.height,this.game.tableZ);
   }
  }
  return !!this.owner;
 }
}
