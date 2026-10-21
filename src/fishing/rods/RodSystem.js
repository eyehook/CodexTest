import * as THREE from '../../../projects/forest/vendor/three.module.js';
import {terrainHeight} from '../height.mjs';
import {waterLevel} from '../water.mjs';
import {FishingRod} from './FishingRod.js';
import {AUTO_REEL_LENGTH} from './LinePhysics.mjs';
import {createRodControls,updateRodControls,rodTrigger} from './RodControls.mjs';
export class RodSystem {
 constructor(renderer,scene,rig,terrain=null){
  const surface=terrain?(x,z)=>terrainHeight(x,z,terrain):null;
  this.buzzActuator=null;this.buzzTime=0;
  this.controls=createRodControls();this.slots=[];this.activeSlot=null;this.activeHand=null;
  for(let i=0;i<2;i++){
   const grip=renderer.xr.getControllerGrip(i),rod=new FishingRod(scene,{surface,water:terrain?()=>waterLevel(terrain):null}),slot={grip,rod,source:null,hand:null,status:'hidden',hasPose:false,unavailable:false,hapticSource:null,lastWorld:new THREE.Vector3(),fallback:new THREE.Group()};rig.add(grip);scene.add(slot.fallback);grip.add(rod.root);
   grip.addEventListener('connected',event=>{slot.source=event.data;slot.hand=event.data.handedness;});
   grip.addEventListener('disconnected',()=>{slot.source=null;slot.status='source unavailable';});
   this.slots.push(slot);
  }
 }
 update(session,frame,referenceSpace,tracked,dt=0,worldX=0,worldZ=0,ground=0){
  updateRodControls(this.controls,session,tracked);
  const hand=this.controls.right.shown?'right':this.controls.left.shown?'left':null;
  // Controller indices can reorder when WebXR replaces its input sources.
  // Keep the physical tackle in its old slot until the equipped hand returns.
  const selected=hand?(this.slots.find(slot=>slot.source?.handedness===hand)??(this.activeHand===hand?this.activeSlot:null)??this.slots.find(slot=>slot.hand===hand)):null;
  if(selected&&this.activeSlot&&selected!==this.activeSlot){
   const physics=selected.rod.physics;selected.rod.physics=this.activeSlot.rod.physics;this.activeSlot.rod.physics=physics;
   const leader=selected.rod.leaderPhysics;selected.rod.leaderPhysics=this.activeSlot.rod.leaderPhysics;this.activeSlot.rod.leaderPhysics=leader;
   const encounter=selected.rod.encounter;selected.rod.encounter=this.activeSlot.rod.encounter;this.activeSlot.rod.encounter=encounter;
   const label=selected.rod.biteLabel;selected.rod.biteLabel=this.activeSlot.rod.biteLabel;this.activeSlot.rod.biteLabel=label;
   selected.rod.bobber.add(selected.rod.biteLabel);this.activeSlot.rod.bobber.add(label);
   selected.hasPose=this.activeSlot.hasPose;selected.lastWorld.copy(this.activeSlot.lastWorld);selected.fallback.quaternion.copy(this.activeSlot.fallback.quaternion);selected.fallback.scale.copy(this.activeSlot.fallback.scale);selected.hapticSource=this.activeSlot.hapticSource;
   selected.rod.setBend(this.activeSlot.rod.bend);
   selected.rod.physics.synchronizeTrigger(rodTrigger(selected.source));
  }
  this.activeSlot=selected??null;this.activeHand=hand;
  let feedbackActuator=null,feedbackEvent=null,buzz=false;
  for(const slot of this.slots){
   const source=slot.source,equipped=slot===selected&&!!hand,matches=source?.handedness===hand;
   const pose=equipped&&matches&&tracked&&session?.visibilityState==='visible'&&source.gripSpace&&frame&&referenceSpace?frame.getPose(source.gripSpace,referenceSpace):null;
   const available=!!pose&&slot.grip.visible;
   const fallback=session&&equipped&&!available&&slot.hasPose;
   if(fallback){
    if(!slot.unavailable)slot.rod.physics.synchronizeTrigger(false);
    slot.unavailable=true;slot.status=matches?'pose unavailable':'source unavailable';
    // The cached pose is in logical world coordinates, independent of the rig.
    slot.fallback.position.set(slot.lastWorld.x-worldX,slot.lastWorld.y-ground,slot.lastWorld.z-worldZ);
    if(slot.rod.root.parent!==slot.fallback)slot.fallback.add(slot.rod.root);
   }else if(available){
    if(slot.unavailable)slot.rod.physics.synchronizeTrigger(rodTrigger(source));
    slot.unavailable=false;slot.status='tracked';slot.hasPose=true;slot.hapticSource=source;
    slot.grip.getWorldPosition(slot.lastWorld);slot.lastWorld.x+=worldX;slot.lastWorld.y+=ground;slot.lastWorld.z+=worldZ;
    slot.grip.getWorldQuaternion(slot.fallback.quaternion);slot.grip.getWorldScale(slot.fallback.scale);
    if(slot.rod.root.parent!==slot.grip)slot.grip.add(slot.rod.root);
   }else slot.status='hidden';
   const completedRetrievals=slot.rod.physics.completedRetrievals;
   slot.rod.update(available||!!fallback,dt,worldX,worldZ,ground,available?rodTrigger(source,slot.rod.physics.triggerHeld):false);
   const event=slot.rod.fishingEvent;
   if(available||fallback){
    feedbackActuator=(available?source:slot.hapticSource)?.gamepad?.hapticActuators?.[0];
    feedbackEvent=event==='nibble'||event==='bite'?event:slot.rod.physics.completedRetrievals>completedRetrievals?'retrieved':null;
    buzz=slot.rod.encounter.phase==='hooked'&&slot.rod.physics.length>AUTO_REEL_LENGTH;
   }

  }
  this.updateFeedback(session?.visibilityState==='visible'?feedbackActuator:null,buzz,feedbackEvent,dt);
 }
 pulse(actuator,strength,duration){
  if(typeof actuator?.pulse==='function')try{Promise.resolve(actuator.pulse(strength,duration)).catch(()=>{});}catch{}
 }
 updateFeedback(actuator,buzz,event,dt){
  if(this.buzzActuator&&(!buzz||actuator!==this.buzzActuator)){this.pulse(this.buzzActuator,0,1);this.buzzActuator=null;this.buzzTime=0;}
  if(event&&actuator)this.pulse(actuator,event==='bite'?.8:.12,event==='bite'?300:50);
  if(buzz&&actuator){
   this.buzzTime-=Math.max(0,dt);
   if(this.buzzActuator!==actuator||this.buzzTime<=0){this.pulse(actuator,.3,120);this.buzzTime=.08;}
   this.buzzActuator=actuator;
  }
 }
 resetPhysics(){this.updateFeedback(null,false,null,0);for(const slot of this.slots)slot.rod.physics.initialized=false;}
 setBend(hand,tension){for(const slot of this.slots)if(slot.source?.handedness===hand)slot.rod.setBend(tension);}
}
