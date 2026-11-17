import * as T from '../../shared/vendor/three-r180/three.module.js';
import {ButtonEdges} from '../../shared/xr/input.mjs';
import {ControllerPointer} from '../../shared/xr/pointer.mjs';

import {particlePointer} from './particle-pointer.mjs?v=stream3';

import {NoteSwirl} from './note-swirl.mjs?v=bright1';

export class Conductor {
  constructor(scene,renderer) {
    this.scene=scene;this.edges=new ButtonEdges();this.owner=null;this.selection=null;
    this.pointer=new ControllerPointer({far:4});this.sources=new Map();
    this.controllers=[0,1].map(i=>{
      const ray=renderer.xr.getController(i),grip=renderer.xr.getControllerGrip(i);
      scene.add(ray,grip);
      ray.addEventListener('connected',e=>{
        const source=e.data;
        if(this.owner && !this.sources.has(this.owner) && source.handedness===this.owner.handedness){
          this.owner=source;
        }
        this.sources.set(source,{ray,grip});
      });
      ray.addEventListener('disconnected',e=>{this.sources.delete(e.data);});
      return {ray,grip};
    });
    this.stream=particlePointer();
    this.color=new T.Color();
    this.notePlane=new T.Plane();this.planeNormal=new T.Vector3();this.endpoint=new T.Vector3();
    this.panel=new T.Group();this.panel.visible=false;scene.add(this.panel);
    const geometry=new T.CircleGeometry(.065*1.10,32);
    this.targets=Array.from({length:5},(_,i)=>{
      const circle=new T.Mesh(geometry,new T.MeshBasicMaterial({color:0x6c929c,side:T.DoubleSide,transparent:true,opacity:.5}));
      circle.position.y=(i-2)*.18;circle.userData.choice=i;this.panel.add(circle);return circle;
    });
    this.swirl=new NoteSwirl(this.panel);
    this.forward=new T.Vector3();this.side=new T.Vector3();this.head=new T.Vector3();
    this.orientation=new T.Quaternion();
  }
  exit(){this.owner=null;this.selection=null;this.stream.removeFromParent();this.panel.visible=false;this.swirl.reset();}
  update(session,state,beat=0,hue=0,seconds=performance.now()/1000) {
    if(!session){this.exit();this.edges.reset();return null;}
    if(!state.active)return this.selection;
    const sources=session.inputSources;this.edges.retain(sources);
    let pressed;
    for(const source of sources) {
      const edge=this.edges.sample(source,4,state.resumed || !this.edges.sources.has(source));
      if(edge.pressed && !pressed && ['left','right'].includes(source.handedness) &&
        state.isTracked(source.targetRaySpace) && state.isTracked(source.gripSpace))pressed=source;
    }
    if(pressed) {
      if(this.owner)this.exit();
      else if(this.sources.has(pressed)){
        this.owner=pressed;
        const pose=state.pose.transform;
        this.head.set(pose.position.x,pose.position.y,pose.position.z);
        this.orientation.set(pose.orientation.x,pose.orientation.y,pose.orientation.z,pose.orientation.w);
        this.forward.set(0,0,-1).applyQuaternion(this.orientation);this.forward.y=0;this.forward.normalize();
        this.side.crossVectors(this.forward,new T.Vector3(0,1,0));
        this.panel.position.copy(this.head).addScaledVector(this.forward,1.2)
          .addScaledVector(this.side,pressed.handedness==='right' ? .42 : -.42);
        this.panel.position.y-=.12;
        this.panel.quaternion.setFromAxisAngle(new T.Vector3(0,1,0),Math.atan2(-this.forward.x,-this.forward.z));
        this.scene.add(this.stream);
      }
    }
    const controls=this.sources.get(this.owner);
    const tracked=controls && Array.from(sources).includes(this.owner) && state.isTracked(this.owner.targetRaySpace) && state.isTracked(this.owner.gripSpace);
    this.stream.visible=!!this.owner;this.panel.visible=!!this.owner;
    if(tracked){
      this.selection=null;
      this.panel.updateMatrixWorld(true);
      // Restore hit geometry before casting: highlighting must not expand hit regions.
      for(const circle of this.targets)circle.scale.setScalar(1);
      this.panel.updateMatrixWorld(true);
      const hit=this.pointer.cast(controls.ray,this.targets);
      // The stream lives at scene root, independent of WebXR's controller
      // visibility/pose resets. Copy only a currently tracked world pose.
      this.stream.position.setFromMatrixPosition(controls.ray.matrixWorld);
      this.stream.quaternion.setFromRotationMatrix(controls.ray.matrixWorld);
      if(hit)this.selection=hit.object.userData.choice;
      this.planeNormal.set(0,0,1).applyQuaternion(this.panel.quaternion);
      this.notePlane.setFromNormalAndCoplanarPoint(this.planeNormal,this.panel.position);
      const crossing=this.pointer.raycaster.ray.intersectPlane(this.notePlane,this.endpoint);
      const reach=hit?hit.distance:crossing?
        this.pointer.raycaster.ray.origin.distanceTo(crossing):
        this.pointer.raycaster.ray.origin.distanceTo(this.panel.position);
      this.stream.material.uniforms.reach.value=Math.max(.1,Math.min(4,reach));
    }
    // Same cosine palette as the sculpture, sampled halfway through its layers.
    const color=this.color;
    color.setRGB(.54+.43*Math.cos(6.283*(hue+.19)),
      .54+.43*Math.cos(6.283*(hue+.51)),
      .54+.43*Math.cos(6.283*(hue+.65)));
    for(const circle of this.targets){
      const selected=circle.userData.choice===this.selection;
      circle.scale.setScalar(selected?1.25:1);
      circle.material.color.copy(color).multiplyScalar(selected?1.35:1);
      circle.material.opacity=.5;
    }
    this.stream.material.uniforms.tint.value.copy(color);
    this.stream.material.uniforms.clock.value=seconds;
    this.swirl.update(this.selection,color,seconds);
    return this.selection;
  }
}
