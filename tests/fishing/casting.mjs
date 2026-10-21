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
 const landed=p.position.slice(end);for(let i=0;i<240;i++)p.update(3,2,0,LINE_STEP);assert.deepEqual(p.position.slice(end),landed);assert.ok(Math.hypot(...p.velocity)<1e-6);
});
test('swept collision catches raised terrain before water, including fast casts',()=>{
 const p=new LinePhysics(.8,{surface:x=>x>=1&&x<=1.5?3:0});p.reset(0,2,0);p.setTrigger(true);
 p.previous[end]=p.position[end]-300*LINE_STEP;p.setTrigger(false);p.update(0,2,0,LINE_STEP);
 assert.ok(p.landed);assert.ok(p.position[end]>=1-1e-5&&p.position[end]<1.01);assert.ok(Math.abs(p.position[end+1]-3.045)<1e-6);
});
test('hold trigger to reel, release to pause, then stop at minimum length without accidentally arming',()=>{
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
  assert.ok(before-p.position[end]>.2&&before-p.position[end]<2.5);
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
 const p=new LinePhysics(.8,{surface});p.reset(0,tipY,0);p.position[end]=x;p.position[end+1]=y;p.position[end+2]=0;p.previous.set(p.position);p.phase='cast';p.spoolOpen=true;p.landed=!!surface&&y<=surface(x,0)+p.radius+.001;p.length=Math.hypot(x,y-tipY)+.05;return p;
}
test('slack line reels onto the spool without driving the bobber until taut',()=>{
 const p=placedBobber(null,10,5,8);p.length=30;p.setTrigger(true);
 for(let i=0;i<60;i++)p.update(0,8,0,LINE_STEP);
 assert.equal(p.position[end],10);assert.ok(p.position[end+1]<4);assert.ok(p.velocity[1]<-4);assert.ok(p.length<30);assert.equal(p.tension,0);
});
test('taut retrieval changes bobber velocity and lifts through line tension',()=>{
 const p=placedBobber(null,10,1,3);p.setTrigger(true);
 for(let i=0;i<240;i++)p.update(0,3,0,LINE_STEP);
 assert.ok(p.position[end]<8);assert.ok(p.tension>0);assert.ok(p.velocity[0]<0);
});
test('water impact submerges the bobber then buoyancy returns it to equilibrium',()=>{
 for(const fps of [30,72,90,120])for(const impactSpeed of [5,10,15]){
 const p=new LinePhysics(.8,{surface:()=>-10,water:()=>0});p.reset(0,3,0);p.phase='cast';p.length=20;
 p.position[end]=5;p.position[end+1]=1;p.previous.set(p.position);p.velocity[1]=-impactSpeed;
 let minimum=Infinity;
 for(let i=0;i<fps*10;i++){p.update(0,3,0,1/fps);minimum=Math.min(minimum,p.position[end+1]);assert.ok(Number.isFinite(p.position[end+1]));}
 assert.ok(minimum<0);assert.ok(minimum>-.11,`dip ${minimum} m at ${impactSpeed} m/s, ${fps} Hz`);assert.ok(Math.abs(p.position[end+1]-.025)<.005);assert.ok(Math.abs(p.velocity[1])<.01);
 }
});
test('open spool retains slack and pays out only when pulled',()=>{
 const p=placedBobber(null,5,2,3);p.length=20;
 for(let i=0;i<30;i++)p.update(0,3,0,LINE_STEP);
 assert.equal(p.length,20);assert.equal(p.spoolSpeed,0);
 p.length=6;p.velocity[0]=12;const before=p.length;
 for(let i=0;i<30;i++)p.update(0,3,0,LINE_STEP);
 assert.ok(p.length>before);assert.ok(p.spoolSpeed>0);
});
test('reel speed reaches 10 m/s after five seconds and resets after release',async()=>{
 const {REEL_MIN_SPEED,REEL_MAX_SPEED}=await import('../../src/fishing/rods/LinePhysics.mjs');
 const p=placedBobber(()=>0,35,.045);p.setTrigger(true);
 // Move away while retrieving so the bobber cannot reach home before the full ramp.
 for(let i=1;i<=660;i++){
  p.setTrigger(true);p.update(-i/120*15,3,0,LINE_STEP);
  assert.ok(Math.abs(p.reelSpeed-Math.min(10,.5+1.9*i/120))<1e-8);
 }
 assert.equal(p.reelSpeed,REEL_MAX_SPEED);p.setTrigger(false);assert.equal(p.reelSpeed,0);p.setTrigger(true);assert.equal(p.reelSpeed,REEL_MIN_SPEED);
});

test('floating bobber reels across water and onto shore without terrain penetration',()=>{
 const terrain=x=>x<4?(4-x)*.2:-2;
 const p=new LinePhysics(.8,{surface:terrain,water:()=>0});p.reset(0,3,0);p.phase='cast';p.length=12;p.position[end]=10;p.position[end+1]=0;p.previous.set(p.position);p.setTrigger(true);
 let crossed=false;
 for(let i=0;i<1800&&p.phase!=='ready';i++){
  p.update(0,3,0,LINE_STEP);
  assert.ok(p.position[end+1]>=terrain(p.position[end])+p.radius-1e-6);
  if(p.position[end]<4)crossed=true;
 }
 assert.ok(crossed);assert.equal(p.phase,'ready');
});

test('rod responds smoothly to simulated tension without adding geometry',async()=>{
 const {FishingRod}=await import('../../src/fishing/rods/FishingRod.js');
 const rod=new FishingRod(new THREE.Scene());rod.update(true,LINE_STEP);
 const count=rod.mesh.geometry.attributes.position.count;
 rod.physics.tension=1;rod.update(true,LINE_STEP);
 assert.ok(rod.bend>0&&rod.bend<1);assert.ok(rod.localTip.z<0);
 assert.equal(rod.mesh.geometry.attributes.position.count,count);rod.dispose();
});

test('minimum-length retrieval preserves bobber position, momentum and continuous physics',()=>{
 const p=new LinePhysics(.8);p.reset(0,3,0);p.phase='reeling';p.length=.8001;p.triggerHeld=true;
 p.position[end]=.65;p.position[end+1]=2.6;p.velocity[2]=1;
 p.previous.set(p.position);const nodes=p.position,previous=p.previous;
 p.reset=()=>{throw new Error('Retrieval must not reset the physical state');};
 p.update(0,3,0,LINE_STEP);
 assert.equal(p.phase,'ready');assert.equal(p.length,.8);assert.equal(p.deployed,true);
 assert.equal(p.position,nodes);assert.equal(p.previous,previous);
 assert.ok(p.position[end]>.6);assert.ok(p.velocity[2]>.9);
 const z=p.position[end+2];p.setTrigger(true);p.update(0,3,0,LINE_STEP);
 assert.equal(p.phase,'ready');assert.ok(p.position[end+2]>z);
 for(let i=0;i<240;i++){p.setTrigger(true);p.update(0,3,0,LINE_STEP);assert.equal(p.length,.8);assert.ok(Math.hypot(p.position[end],p.position[end+1]-3,p.position[end+2])<=.8+1e-7);}
 p.setTrigger(false);p.setTrigger(true);assert.equal(p.phase,'armed');p.setTrigger(false);assert.equal(p.phase,'cast');
});

test('trigger chooses from line length and retrieval release never launches a cast',()=>{
 const p=placedBobber(null,4,2);p.phase='ready';p.setTrigger(true);
 assert.equal(p.phase,'reeling');assert.equal(p.triggerAction,'reel');
 p.velocity.set([1,-2,3]);p.previous[end]=p.position[end]-99;
 const velocity=p.velocity.slice();p.setTrigger(false);
 assert.deepEqual(p.velocity,velocity);assert.equal(p.spoolOpen,false);assert.equal(p.triggerAction,null);assert.notEqual(p.phase,'armed');
 p.length=p.homeLength;p.phase='cast';p.setTrigger(true);
 assert.equal(p.phase,'armed');assert.equal(p.triggerAction,'cast');p.setTrigger(false);assert.equal(p.phase,'cast');
});
test('a retrieval hold reaching minimum stays retrieval until released and pressed again',()=>{
 const p=placedBobber(null,.6,2.6);p.length=.915;p.setTrigger(true);while(p.phase==='reeling')p.update(0,3,0,LINE_STEP);
 assert.equal(p.length,p.homeLength);assert.equal(p.triggerAction,'reel');
 for(let i=0;i<60;i++){p.setTrigger(true);p.update(0,3,0,LINE_STEP);assert.notEqual(p.phase,'armed');}
 const v=p.velocity.slice();p.setTrigger(false);assert.deepEqual(p.velocity,v);assert.equal(p.phase,'ready');
 p.setTrigger(true);assert.equal(p.phase,'armed');
});
test('repeated retrieval and recasting transfer controller swing into launch momentum',()=>{
 for(const fps of [30,72,90,120]){
 const p=cast(fps);let tipX=3;
 for(let cycle=0;cycle<3;cycle++){
  for(let i=0;i<fps*4;i++)p.update(tipX,2,0,1/fps);
  p.setTrigger(true);
  for(let i=0;i<fps*30&&p.length>p.homeLength;i++){p.setTrigger(true);p.update(tipX,2,0,1/fps);}
  assert.equal(p.length,p.homeLength);p.setTrigger(false);
  for(let i=0;i<fps*2;i++)p.update(tipX,2,0,1/fps);
  p.setTrigger(true);assert.equal(p.phase,'armed');
  const start=tipX;
  for(let i=1;i<=fps/2;i++){tipX=start+i/fps*6;p.setTrigger(true);p.update(tipX,2,0,1/fps);}
  p.setTrigger(false);assert.ok(p.velocity[0]>1,`repeat launch ${p.velocity[0]} at ${fps} Hz`);
  for(let i=0;i<fps;i++)p.update(tipX,2,0,1/fps);
  assert.ok(p.length>p.homeLength+.5);
 }
 }
});

test('retrieval slows in the final 2 metres and reaches minimum without a snap',()=>{
 const p=placedBobber(null,1.6,3);p.length=1.6;p.setTrigger(true);p.reelTime=5;
 const speeds=[];
 for(let i=0;i<1200&&p.phase==='reeling';i++){p.update(0,3,0,LINE_STEP);if(p.phase==='reeling')speeds.push(p.reelSpeed);}
 assert.equal(p.length,p.homeLength);assert.equal(p.phase,'ready');assert.ok(speeds[0]<10);assert.ok(Math.abs(speeds.at(-1)-.30)<1e-9);assert.ok(p.settleTime>=0);
});
test('settling fades in and is completely removed at the start of a cast',()=>{
 for(const fps of [30,72,90,120]){
 const p=placedBobber(null,.6,2.6);p.length=.915;p.setTrigger(true);
 while(p.phase==='reeling')p.update(0,3,0,1/fps);
 p.setTrigger(false);for(let i=0;i<fps*3;i++)p.update(0,3,0,1/fps);
 assert.ok(p.settleTime>2);assert.ok(Math.hypot(...p.velocity)<.2);
 // Identical physical states must evolve identically during arm/swing and flight,
 // regardless of whether one has previously settled after retrieval.
 const q=new LinePhysics(.8);Object.assign(q,p);q.position=p.position.slice();q.previous=p.previous.slice();q.target=p.target.slice();q.velocity=p.velocity.slice();q.settleTime=-1;
 const nodes=p.position.slice(),velocity=p.velocity.slice();p.setTrigger(true);q.setTrigger(true);
 assert.equal(p.settleTime,-1);assert.deepEqual(p.position,nodes);assert.deepEqual(p.velocity,velocity);
 for(let i=1;i<=fps/2;i++){p.update(i/fps*6,3,0,1/fps);q.update(i/fps*6,3,0,1/fps);}
 p.setTrigger(false);q.setTrigger(false);
 for(let i=0;i<fps;i++){p.update(3,3,0,1/fps);q.update(3,3,0,1/fps);}
 assert.deepEqual(p.position,q.position);assert.deepEqual(p.velocity,q.velocity);assert.equal(p.length,q.length);assert.equal(p.settleTime,-1);
 }
});

test('final two-metre approach damps momentum while distant retrieval does not',()=>{
 const near=placedBobber(null,1,3),far=placedBobber(null,1,3);
 near.length=1.8;far.length=8;
 for(const p of [near,far]){p.velocity[2]=2;p.setTrigger(true);}
 for(let i=0;i<30;i++){near.update(0,3,0,LINE_STEP);far.update(0,3,0,LINE_STEP);}
 assert.ok(near.velocity[2]<far.velocity[2]*.85);
 near.length=near.homeLength;near.setTrigger(false);near.setTrigger(true);
 assert.equal(near.phase,'armed');assert.equal(near.settleTime,-1);
});

test('two-foot minimum and inclusive three-foot cast threshold choose the correct trigger action',()=>{
 const p=new LinePhysics();assert.equal(p.homeLength,.6096);
 for(const length of [.6096,.7,.9144]){
 p.reset(0,3,0);p.triggerHeld=false;p.length=length;p.phase='cast';p.settleTime=1;
 p.setTrigger(true);assert.equal(p.phase,'armed');assert.equal(p.settleTime,-1);assert.equal(p.length,length);
 p.setTrigger(false);assert.equal(p.phase,'cast');assert.ok(p.spoolOpen);
 }
 p.reset(0,3,0);p.triggerHeld=false;p.length=.9145;p.setTrigger(true);assert.equal(p.phase,'reeling');
 while(p.length>.6096){p.setTrigger(true);p.update(0,3,0,LINE_STEP);assert.notEqual(p.phase,'armed');}
 assert.equal(p.length,.6096);assert.equal(p.triggerAction,'reel');p.setTrigger(false);assert.equal(p.spoolOpen,false);
 p.setTrigger(true);assert.equal(p.phase,'armed');
});

test('paused retrieval keeps damping across the entire casting zone until cast begins',()=>{
 for(const length of [.6096,.7,.8,.9144]){
 const p=new LinePhysics();p.reset(0,3,0);p.length=length;p.deployed=true;
 p.phase='reeling';p.triggerHeld=true;p.triggerAction='reel';p.velocity[2]=1;
 const damping=p.settlingDamping();assert.ok(damping>2);
 const velocity=p.velocity.slice();p.setTrigger(false);
 assert.equal(p.settlingDamping(),damping);assert.deepEqual(p.velocity,velocity);
 for(let i=0;i<30;i++)p.update(0,3,0,LINE_STEP);
 assert.equal(p.length,length);assert.ok(p.settlingDamping()>2);
 p.setTrigger(true);assert.equal(p.phase,'armed');assert.equal(p.settlingDamping(),0);
 p.update(0,3,0,LINE_STEP);assert.equal(p.settlingDamping(),0);
 p.setTrigger(false);assert.equal(p.phase,'cast');assert.equal(p.settlingDamping(),0);
 }
});
