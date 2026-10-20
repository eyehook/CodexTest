import {test} from 'node:test';
import assert from 'node:assert/strict';
import {LinePhysics,LINE_SEGMENTS,LINE_STEP} from '../../src/fishing/rods/LinePhysics.mjs';
import {rodTrigger} from '../../src/fishing/rods/RodControls.mjs';
import {RodSystem} from '../../src/fishing/rods/RodSystem.js';
import * as THREE from '../../projects/forest/vendor/three.module.js';
const end=LINE_SEGMENTS*3;
function cast(fps=120,surface=()=>0){
 const p=new LinePhysics(.8,{surface});p.reset(0,2,0);p.setTrigger(true);assert.equal(p.phase,'armed');
 for(let i=1;i<=fps/2;i++)p.update(i/fps*6,2,0,1/fps);
 const v=new Float64Array(3);p.bobberVelocity(v);p.setTrigger(false);assert.equal(p.phase,'cast');assert.deepEqual(p.velocity,v);return p;
}
test('trigger release casts using measured momentum, pays out line and stops on water',()=>{
 const p=cast();assert.ok(p.velocity[0]>1);
 for(let i=0;i<1200&&!p.landed;i++)p.update(3,2,0,LINE_STEP);
 assert.ok(p.landed);assert.ok(p.length>2);assert.ok(p.position[end]>5);assert.ok(Math.abs(p.position[end+1]-.045)<1e-8);
 const landed=p.position.slice(end);for(let i=0;i<240;i++)p.update(3,2,0,LINE_STEP);assert.deepEqual(p.position.slice(end),landed);assert.deepEqual([...p.velocity],[0,0,0]);
});
test('swept collision catches raised terrain before water, including fast casts',()=>{
 const p=new LinePhysics(.8,{surface:x=>x>=1&&x<=1.5?3:0});p.reset(0,2,0);p.setTrigger(true);
 p.previous[end]=p.position[end]-300*LINE_STEP;p.setTrigger(false);p.update(0,2,0,LINE_STEP);
 assert.ok(p.landed);assert.ok(p.position[end]>=1-1e-5&&p.position[end]<1.01);assert.ok(Math.abs(p.position[end+1]-3.045)<1e-6);
});
test('hold trigger to reel, release to pause, then finish and reset without accidentally arming',()=>{
 const p=cast();for(let i=0;i<1200&&!p.landed;i++)p.update(3,2,0,LINE_STEP);
 const distance=Math.hypot(p.position[end]-3,p.position[end+1]-2);p.setTrigger(true);assert.equal(p.phase,'reeling');
 for(let i=0;i<60;i++)p.update(3,2,0,LINE_STEP);
 assert.ok(Math.hypot(p.position[end]-3,p.position[end+1]-2)<distance);
 p.setTrigger(false);assert.equal(p.phase,'cast');p.setTrigger(true);
 for(let i=0;i<1200&&p.phase!=='ready';i++)p.update(3,2,0,LINE_STEP);
 assert.equal(p.phase,'ready');assert.equal(p.length,.8);assert.equal(p.triggerHeld,true);p.setTrigger(true);assert.equal(p.phase,'ready');p.setTrigger(false);assert.equal(p.phase,'ready');p.setTrigger(true);assert.equal(p.phase,'armed');
});
test('casting and landing remain consistent across display rates and world rebasing',()=>{
 const results=[];
 for(const fps of [30,72,90,120]){const p=cast(fps);for(let i=0;i<fps*10&&!p.landed;i++)p.update(3,2,0,1/fps);assert.ok(p.landed);results.push(p.position[end]);}
 assert.ok(Math.max(...results)-Math.min(...results)<.25);
 const p=new LinePhysics(.8,{surface:()=>0});p.reset(1e9,2,-1e9);p.setTrigger(true);p.previous[end]=p.position[end]-5*LINE_STEP;p.setTrigger(false);
 for(let i=0;i<1200&&!p.landed;i++)p.update(1e9,2,-1e9,LINE_STEP);assert.ok(p.landed);assert.ok(p.position[end]>1e9+1);
});
test('low rod near ground can finish reeling, and teleports cancel casts',()=>{
 const p=cast();for(let i=0;i<1200&&!p.landed;i++)p.update(3,2,0,LINE_STEP);p.setTrigger(true);
 for(let i=0;i<1200&&p.phase!=='ready';i++)p.update(3,.2,0,LINE_STEP);assert.equal(p.phase,'ready');
 const q=cast();q.update(1000,20,0,LINE_STEP);assert.equal(q.phase,'ready');assert.equal(q.length,.8);
});
test('only equipped controller trigger arms or casts; held trigger on showing rod is ignored',()=>{
 const grips=[new THREE.Group(),new THREE.Group()],scene=new THREE.Scene(),rig=new THREE.Group();scene.add(rig);
 const system=new RodSystem({xr:{getControllerGrip:i=>grips[i]}},scene,rig),source=(hand,b=false)=>({handedness:hand,gripSpace:{},gamepad:{mapping:'xr-standard',buttons:[{pressed:false},{},{},{},{},{pressed:b}]}});
 const right=source('right',true),left=source('left'),s={visibilityState:'visible',inputSources:[right,left]},frame={getPose:()=>({})};
 grips[0].dispatchEvent({type:'connected',data:right});grips[1].dispatchEvent({type:'connected',data:left});system.update(s,frame,{},true,LINE_STEP);
 left.gamepad.buttons[0].pressed=true;system.update(s,frame,{},true,LINE_STEP);assert.equal(system.slots[0].rod.physics.phase,'ready');
 right.gamepad.buttons[0].pressed=true;system.update(s,frame,{},true,LINE_STEP);assert.equal(system.slots[0].rod.physics.phase,'armed');right.gamepad.buttons[0].pressed=false;system.update(s,frame,{},true,LINE_STEP);assert.equal(system.slots[0].rod.physics.phase,'cast');
 system.resetPhysics();right.gamepad.buttons[0].pressed=true;system.update(s,frame,{},true,LINE_STEP);assert.equal(system.slots[0].rod.physics.phase,'ready');right.gamepad.buttons[0].pressed=false;system.update(s,frame,{},true,LINE_STEP);assert.equal(system.slots[0].rod.physics.phase,'ready');
 assert.equal(rodTrigger({gamepad:{mapping:'',buttons:[{pressed:true}]}}),false);
 for(const slot of system.slots)slot.rod.dispose();
});

test('one continuous trigger hold retrieves all the way home at the slower reel speed',()=>{
 for(const fps of [30,72,90,120]){
  const p=cast(fps);for(let i=0;i<fps*10&&!p.landed;i++)p.update(3,2,0,1/fps);
  const before=p.position[end];p.setTrigger(true);
  for(let i=0;i<fps;i++){p.setTrigger(true);p.update(3,2,0,1/fps);assert.equal(p.phase,'reeling');}
  assert.ok(before-p.position[end]>.5&&before-p.position[end]<1.6);
  for(let i=0;i<fps*30&&p.phase!=='ready';i++){p.setTrigger(true);p.update(3,2,0,1/fps);}
  assert.equal(p.phase,'ready');assert.equal(p.length,.8);
 }
});
test('125 foot line cap restrains powerful casts and stays capped when the player moves away',async()=>{
 const {MAX_LINE_LENGTH}=await import('../../src/fishing/rods/LinePhysics.mjs');assert.equal(MAX_LINE_LENGTH,38.1);
 for(const fps of [30,72,90,120]){
  const p=new LinePhysics(.8,{surface:()=>0});p.reset(0,10,0);p.setTrigger(true);p.previous[end]-=60*LINE_STEP;p.previous[end+1]-=12*LINE_STEP;p.setTrigger(false);
  let max=0;
  for(let i=0;i<fps*15;i++){
   p.update(0,10,0,1/fps);const distance=Math.hypot(p.position[end],p.position[end+1]-10,p.position[end+2]);max=Math.max(max,distance);
   assert.ok(p.length<=MAX_LINE_LENGTH);assert.ok(distance<=MAX_LINE_LENGTH+1e-7);
  }
  assert.ok(max>MAX_LINE_LENGTH-.1);assert.ok(p.landed);
  for(let i=1;i<=fps*2;i++){const x=-i/fps*4;p.update(x,10,0,1/fps);assert.ok(p.length<=MAX_LINE_LENGTH);assert.ok(Math.hypot(p.position[end]-x,p.position[end+1]-10,p.position[end+2])<=MAX_LINE_LENGTH+1e-7);}
 }
});
test('analog trigger hysteresis keeps reeling engaged through pressure fluctuations',()=>{
 const source={gamepad:{mapping:'xr-standard',buttons:[{value:.8,pressed:false}]}};let held=rodTrigger(source);
 assert.equal(held,true);for(const value of [.55,.4,.25,.16]){source.gamepad.buttons[0].value=value;held=rodTrigger(source,held);assert.equal(held,true);}
 source.gamepad.buttons[0].value=.1;assert.equal(rodTrigger(source,held),false);
});

test('controller-to-rod integration continuously reels during a single analog trigger hold',()=>{
 const grips=[new THREE.Group(),new THREE.Group()],scene=new THREE.Scene(),rig=new THREE.Group();scene.add(rig);
 const system=new RodSystem({xr:{getControllerGrip:i=>grips[i]}},scene,rig),source={handedness:'right',gripSpace:{},gamepad:{mapping:'xr-standard',buttons:[{value:0},{},{},{},{},{pressed:true}]}},s={visibilityState:'visible',inputSources:[source]},frame={getPose:()=>({})};
 grips[0].dispatchEvent({type:'connected',data:source});system.update(s,frame,{},true,1/72);
 const rod=system.slots[0].rod;rod.root.rotation.set(0,0,0);rod.root.position.set(3,-.1,0);
 const p=cast();for(let i=0;i<1200&&!p.landed;i++)p.update(3,2,0,LINE_STEP);rod.physics=p;
 source.gamepad.buttons[0].value=.8;
 for(let i=0;i<1440&&p.phase!=='ready';i++)system.update(s,frame,{},true,1/72);
 assert.equal(p.phase,'ready');assert.equal(p.length,.8);
 for(const slot of system.slots)slot.rod.dispose();
});

function placedBobber(surface,x,y,tipY=3){
 const p=new LinePhysics(.8,{surface});p.reset(0,tipY,0);p.position[end]=x;p.position[end+1]=y;p.position[end+2]=0;p.previous.set(p.position);p.phase='cast';p.landed=!!surface&&y<=surface(x,0)+p.radius+.001;p.length=Math.hypot(x,y-tipY)+.05;return p;
}
test('reeling skims water and follows rising or falling terrain instead of lifting early',()=>{
 for(const surface of [()=>0,x=>Math.max(0,(8-x)*.15),x=>x*.1]){
  const p=placedBobber(surface,10,surface(10,0)+.045);p.setTrigger(true);
  for(let i=0;i<240;i++){p.setTrigger(true);p.update(0,3,0,LINE_STEP);assert.ok(p.position[end]>.8);assert.ok(Math.abs(p.position[end+1]-surface(p.position[end],0)-.045)<1e-6);assert.ok(p.landed);}
  assert.ok(p.position[end]<8);
 }
});
test('gravity continues pulling an airborne bobber down during retrieval',()=>{
 const p=placedBobber(()=>0,10,5,8);p.landed=false;p.setTrigger(true);
 for(let i=0;i<60;i++)p.update(0,8,0,LINE_STEP);
 assert.ok(p.position[end+1]<4);assert.ok(p.velocity[1]<-4);assert.ok(p.position[end]<10);
});
test('reel speed reaches 10 m/s after five seconds and resets after release',async()=>{
 const {REEL_MIN_SPEED,REEL_MAX_SPEED}=await import('../../src/fishing/rods/LinePhysics.mjs');
 const p=placedBobber(()=>0,20,.045);p.setTrigger(true);
 // Move away while retrieving so the bobber cannot reach home before the full ramp.
 for(let i=1;i<=720;i++){
  p.setTrigger(true);p.update(-i/120*15,3,0,LINE_STEP);
  assert.ok(Math.abs(p.reelSpeed-Math.min(10,.5+1.9*i/120))<1e-8);
 }
 assert.equal(p.reelSpeed,REEL_MAX_SPEED);p.setTrigger(false);assert.equal(p.reelSpeed,0);p.setTrigger(true);assert.equal(p.reelSpeed,REEL_MIN_SPEED);
});
