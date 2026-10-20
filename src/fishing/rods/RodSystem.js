import {terrainHeight} from '../height.mjs';
import {waterLevel} from '../water.mjs';
import {FishingRod} from './FishingRod.js';
import {createRodControls,updateRodControls,rodTrigger} from './RodControls.mjs';
export class RodSystem {
 constructor(renderer,scene,rig,terrain=null){
  const surface=terrain?(x,z)=>terrainHeight(x,z,terrain):null;
  this.controls=createRodControls();this.slots=[];this.activeSlot=null;
  for(let i=0;i<2;i++){
   const grip=renderer.xr.getControllerGrip(i),rod=new FishingRod(scene,{surface,water:terrain?()=>waterLevel(terrain):null}),slot={grip,rod,source:null};rig.add(grip);grip.add(rod.root);
   grip.addEventListener('connected',event=>{slot.source=event.data;});
   grip.addEventListener('disconnected',()=>{if(slot.source?.handedness&&this.controls[slot.source.handedness]){const c=this.controls[slot.source.handedness];c.shown=c.held=false;}slot.source=null;rod.update(false);});
   this.slots.push(slot);
  }
 }
 update(session,frame,referenceSpace,tracked,dt=0,worldX=0,worldZ=0,ground=0){
  updateRodControls(this.controls,session,tracked);
  const selected=this.slots.find(slot=>this.controls[slot.source?.handedness]?.shown);
  if(selected&&this.activeSlot&&selected!==this.activeSlot){
   const physics=selected.rod.physics;selected.rod.physics=this.activeSlot.rod.physics;this.activeSlot.rod.physics=physics;
   selected.rod.setBend(this.activeSlot.rod.bend);
   selected.rod.physics.synchronizeTrigger(rodTrigger(selected.source));
  }
  this.activeSlot=selected??null;
  for(const slot of this.slots){
   const source=slot.source,control=this.controls[source?.handedness];
   const pose=control?.shown&&tracked&&session?.visibilityState==='visible'&&source.gripSpace&&frame&&referenceSpace?frame.getPose(source.gripSpace,referenceSpace):null;
   const castingZoneEntries=slot.rod.physics.castingZoneEntries;
   slot.rod.update(!!pose&&slot.grip.visible,dt,worldX,worldZ,ground,rodTrigger(source,slot.rod.physics.triggerHeld));
   if(pose&&slot.grip.visible&&slot.rod.physics.castingZoneEntries>castingZoneEntries){
    const actuator=source?.gamepad?.hapticActuators?.[0];
    if(typeof actuator?.pulse==='function'){
     try{Promise.resolve(actuator.pulse(0.12,50)).catch(()=>{});}catch{}
    }
   }
  }
 }
 resetPhysics(){for(const slot of this.slots)slot.rod.physics.initialized=false;}
 setBend(hand,tension){for(const slot of this.slots)if(slot.source?.handedness===hand)slot.rod.setBend(tension);}
}
