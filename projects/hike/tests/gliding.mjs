import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../../../shared/vendor/three-r180/three.module.js';
import {Glider,LandingRunout,GLIDE_DEFAULTS} from '../gliding.mjs';
import {FlightButtons} from '../flight-input.mjs';
import {FlightView} from '../flight-view.mjs';
const flat={height:()=>0},advance=(g,seconds,pitch=0,tilt=0,hz=120)=>{for(let i=0;i<Math.round(seconds*hz)&&g.active;i++)g.update(1/hz,g.position.x,g.position.y,g.position.z,tilt,pitch);};
function airborne(speed=14,options={}){const g=new Glider(flat,options);g.launch(0,300,0,0,0,-speed);return g;}
test('stationary launch gains about 0.9 m with modest forward speed and no relaunch boost',()=>{
 const g=new Glider(flat);assert.equal(g.launch(0,0,0,0),true);assert.equal(g.velocity.z,-4);const velocity=g.velocity,position=g.position,vy=g.velocity.y;
 assert.equal(g.launch(0,0,0,0),false);assert.equal(g.velocity.y,vy);let peak=0;
 for(let i=0;i<240&&g.active;i++){g.update(1/120,g.position.x,g.position.y,g.position.z,0,0);peak=Math.max(peak,g.position.y);}
 assert.ok(Math.abs(peak-.9)<.02,`launch gain ${peak}`);assert.equal(g.velocity,velocity);assert.equal(g.position,position);
});
test('walking momentum, including uphill rise, carries smoothly into launch',()=>{
 const world={height:x=>x*.3},g=new Glider(world);g.launch(0,0,0,-Math.PI/2,14,0,4.2);
 assert.equal(g.velocity.x,14);assert.equal(g.velocity.z,0);advance(g,.4,0,0);assert.equal(g.active,true);assert.ok(g.position.y-world.height(g.position.x,g.position.z)>.7);
});
test('level flight approaches an 8:1 descent and naturally sheds fast launch speed',()=>{
 const g=airborne();advance(g,25);assert.equal(g.active,true);assert.ok(g.position.y<300);assert.ok(g.speed<14);
 assert.ok(Math.abs(Math.hypot(g.velocity.x,g.velocity.z)/-g.velocity.y-8)<.02);
 const a=airborne(),b=airborne();advance(a,4,.03);advance(b,4,0);assert.deepEqual(a.position,b.position);
});
test('dives build retained momentum; climbs trade speed for height and cannot hover indefinitely',()=>{
 const level=airborne(),dive=airborne(),climb=airborne();advance(level,5);advance(dive,5,-.7);advance(climb,5,.6);
 assert.ok(dive.speed>level.speed+5);assert.ok(dive.position.y<level.position.y-20);assert.ok(climb.position.y>300);assert.ok(climb.speed<level.speed);
 const fast=dive.speed;advance(dive,.5,0);assert.ok(dive.speed>level.speed+4);assert.ok(dive.speed>fast*.7);
 const height=climb.position.y;advance(climb,40,.8);assert.ok(climb.position.y<height);assert.ok(climb.velocity.y<0);
 const capped=airborne(10,{maxSpeed:12});advance(capped,20,-1.2);assert.ok(capped.speed<=12+1e-8);
});
test('flight thumbstick steering is capped and inertial; release coasts to rest and bank can be disabled',()=>{
 const small=airborne(),large=airborne(14,{bankMax:5*Math.PI/180}),neutral=airborne();advance(small,.4,0,.2);advance(large,.4,0,1.2);advance(neutral,.4,0,.04);
 assert.ok(large.heading<small.heading&&small.heading<0);assert.equal(neutral.heading,0);assert.ok(Math.abs(large.turnRate)<=GLIDE_DEFAULTS.maxTurnRate);assert.ok(large.position.x>0);assert.ok(large.bank>0);assert.ok(Math.abs(large.bank)<=large.settings.bankMax);
 const rate=Math.abs(large.turnRate),heading=large.heading;
 large.update(.05,large.position.x,large.position.y,large.position.z,0,0);
 assert.ok(Math.abs(large.turnRate)>rate*.8&&Math.abs(large.turnRate)<rate);assert.ok(large.heading<heading);
 for(let i=0;i<480;i++)large.update(1/120,large.position.x,large.position.y,large.position.z,0,0);assert.equal(large.turnRate,0);
 for(let i=0;i<240;i++)large.settle(1/120);assert.ok(Math.abs(large.bank)<1e-5);
 large.bank=.08;large.settings.bankEnabled=false;large.settle(.01);assert.equal(large.bank,0);large.settings.bankEnabled=true;large.settings.bankMax=0;large.bank=.08;large.settle(.01);assert.equal(large.bank,0);
});
test('short swept steps catch high-speed ground/ridge contact, clear velocity and preserve reset semantics',()=>{
 const g=airborne(50,{maxSpeed:80});g.position.y=1;g.boostTime=0;g.pathPitch=-1.2;Object.assign(g.velocity,{x:0,y:-50,z:-20});advance(g,2,-1.2);
 assert.equal(g.active,false);assert.equal(g.position.y,0);assert.equal(g.speed,0);assert.equal(g.landed,true);
 const ridge={height:(x,z)=>Math.max(0,3*(1-Math.abs(z+1)/.3))},r=new Glider(ridge,{maxSpeed:80,drag:0});r.launch(0,1,0,0,0,-60);r.boostTime=0;r.pathPitch=0;r.velocity.y=0;
 r.update(.05,0,1,0,0,0);assert.equal(r.landed,true);assert.ok(r.position.z> -1.1&&r.position.z<-.7);assert.equal(r.position.y,ridge.height(r.position.x,r.position.z));
 r.reset();assert.equal(r.active,false);assert.equal(r.speed,0);assert.equal(r.bank,0);
});
test('integration is stable across frame rates; pauses preserve velocity and live tracked offsets',()=>{
 const runs=[];for(const hz of [30,72,120]){const g=airborne();advance(g,5,-.3,.6,hz);runs.push(g);}
 for(const g of runs.slice(1)){assert.ok(Math.hypot(g.position.x-runs[0].position.x,g.position.y-runs[0].position.y,g.position.z-runs[0].position.z)<.15);assert.ok(Math.abs(g.speed-runs[0].speed)<.1);}
 const g=airborne(),velocity={...g.velocity};g.update(0,1,301,2,0,0);assert.deepEqual(g.velocity,velocity);assert.deepEqual(g.position,{x:1,y:301,z:2});
 const a=airborne(),b=airborne();a.update(10,0,300,0,0,0);b.update(.05,0,300,0,0,0);assert.deepEqual(a.position,b.position);
});
function source(hand){return {handedness:hand,targetRaySpace:{},gamepad:{mapping:'xr-standard',buttons:Array.from({length:6},()=>({pressed:false,value:0})),axes:[0,0,0,0]}};}
test('A and X are equivalent fresh presses; held buttons never reactivate after landing or tracking changes',()=>{
 const right=source('right'),left=source('left'),sources=[right,left],buttons=new FlightButtons(),state={resumed:false,isTracked:()=>true};const result=buttons.update(sources,state);
 right.gamepad.buttons[4].pressed=true;assert.equal(buttons.update(sources,state).launch,true);assert.equal(buttons.update(sources,state).launch,false);
 left.gamepad.buttons[4].pressed=true;assert.equal(buttons.update(sources,state).launch,true);assert.equal(buttons.update(sources,state).launch,false);
 assert.equal(buttons.result,result);right.gamepad.buttons[4].pressed=false;left.gamepad.buttons[4].pressed=false;buttons.update(sources,state);
 right.gamepad.buttons[4].pressed=true;state.resumed=true;assert.equal(buttons.update(sources,state).launch,false);state.resumed=false;assert.equal(buttons.update(sources,state).launch,false);
 right.gamepad.buttons[5].pressed=true;assert.equal(buttons.update(sources,state).settings,true);assert.equal(buttons.update(sources,state).settings,false);
 buttons.update([],state);assert.equal(buttons.update(sources,state).launch,false);right.gamepad.buttons[4].pressed=false;buttons.update(sources,state);right.gamepad.buttons[4].pressed=true;assert.equal(buttons.update(sources,state).launch,true);
 state.isTracked=()=>false;buttons.update(sources,state);state.isTracked=()=>true;assert.equal(buttons.update(sources,state).launch,false);
});
test('world-space steering composes rig/head once; bank pivots at the physical head without modifying tracking',()=>{
 const scene=new T.Scene(),rig=new T.Group(),bank=new T.Group(),camera=new T.Object3D();scene.add(rig);rig.add(bank);bank.add(camera);rig.position.set(120,13,-70);rig.rotation.y=.8;
 const viewer={position:new T.Vector3(1.1,1.65,-.4),orientation:new T.Quaternion().setFromEuler(new T.Euler(-.2,.4,.1,'YXZ'))};camera.position.copy(viewer.position);camera.quaternion.copy(viewer.orientation);
 const originalPosition=viewer.position.clone(),originalOrientation=viewer.orientation.clone(),view=new FlightView(bank);view.sample(rig,viewer);const before=view.head.clone(),forward=new T.Vector3(0,0,-1).applyQuaternion(rig.quaternion.clone().multiply(viewer.orientation)),heading=view.heading;
 assert.ok(view.forward.distanceTo(forward)<1e-10);view.bank(viewer,.087);rig.updateMatrixWorld(true);const actual=camera.getWorldPosition(new T.Vector3());assert.ok(actual.distanceTo(before)<1e-9);
 view.sample(rig,viewer);assert.ok(Math.abs(view.heading-heading)<1e-10);assert.deepEqual(viewer.position,originalPosition);assert.deepEqual(viewer.orientation,originalOrientation);
 view.reset();rig.updateMatrixWorld(true);assert.ok(camera.getWorldPosition(actual).distanceTo(before)<1e-9);assert.equal(bank.quaternion.angleTo(new T.Quaternion()),0);
});
test('landing beneath a translated, yawed, banked head preserves live standing height',()=>{
 for(const height of [1.2,1.7,2]){
  const world={height:(x,z)=>x*.04+z*.02},rig=new T.Group(),bank=new T.Group(),camera=new T.Object3D();rig.add(bank);bank.add(camera);rig.position.set(100,20,40);rig.rotation.y=.7;
  const viewer={position:new T.Vector3(1.2,height,.6),orientation:new T.Quaternion()},view=new FlightView(bank),g=new Glider(world);camera.position.copy(viewer.position);view.sample(rig,viewer);
  g.launch(view.head.x,rig.position.y,view.head.z,view.heading,0,-8);g.boostTime=0;g.pathPitch=-1;Object.assign(g.velocity,{x:0,y:-20,z:-8});
  for(let i=0;i<500&&g.active;i++){view.sample(rig,viewer);const p=g.update(1/72,view.head.x,rig.position.y,view.head.z,0,-1);rig.position.x+=p.x-view.head.x;rig.position.z+=p.z-view.head.z;rig.position.y=p.y;view.bank(viewer,.05);rig.updateMatrixWorld(true);}
  view.sample(rig,viewer);const ground=world.height(view.head.x,view.head.z),actual=camera.getWorldPosition(new T.Vector3());assert.equal(g.active,false);assert.ok(Math.abs(rig.position.y-ground)<1e-8);assert.ok(Math.abs(actual.y-ground-height)<1e-8);
 }
});

test('thumbstick rotates the body with travel around the head and eases out on release',()=>{
 for(const side of [-1,1]){
  const rig=new T.Group(),bank=new T.Group();rig.add(bank);rig.position.set(120,300,-70);rig.rotation.y=3.1;
  const viewer={position:new T.Vector3(1.2,1.65,-.6),orientation:new T.Quaternion().setFromEuler(new T.Euler(-.2,1.1,side*.5,'YXZ'))};
  const view=new FlightView(bank),g=new Glider(flat);view.sample(rig,viewer);g.launch(view.head.x,300,view.head.z,3.1,-Math.sin(3.1)*14,-Math.cos(3.1)*14);
  const startYaw=rig.rotation.y,raw=viewer.orientation.clone();
  for(let i=0;i<240;i++){
   view.advance(g,rig,viewer,1/120,-side);view.bank(viewer,g.bank);view.sample(rig,viewer);
   assert.ok(Math.hypot(view.head.x-g.position.x,view.head.z-g.position.z)<1e-9);
   assert.ok(Math.abs(Math.atan2(Math.sin(g.heading-rig.rotation.y),Math.cos(g.heading-rig.rotation.y)))<1e-9);
  }
  assert.ok(side*(rig.rotation.y-startYaw)>.7);assert.deepEqual(viewer.orientation,raw);
  const rate=Math.abs(g.turnRate);viewer.orientation.identity();for(let i=0;i<240;i++)view.advance(g,rig,viewer,1/120);
  assert.ok(Math.abs(g.turnRate)<rate*.003);
  const yaw=rig.rotation.y;view.advance(g,rig,viewer,0);assert.equal(rig.rotation.y,yaw);
 }
});

test('upward flight loses speed at half the original rate; level and descent are unchanged',()=>{
 for(const pitch of [.35,0,-.35]){
  const make=scale=>{const g=airborne(14,{climbDeceleration:scale,pitchResponse:0});g.boostTime=0;g.pathPitch=pitch;Object.assign(g.velocity,{x:0,y:14*Math.sin(pitch),z:-14*Math.cos(pitch)});return g;};
  const original=make(1),tuned=make(.5),initial=original.speed;
  original.update(1/120,0,300,0,0,0);tuned.update(1/120,0,300,0,0,0);
  if(pitch>0)assert.ok(Math.abs((initial-tuned.speed)/(initial-original.speed)-.5)<1e-9);
  else assert.deepEqual(tuned.velocity,original.velocity);
 }
});

test('landing captures forward momentum; friction reaches exact rest consistently across frame rates',()=>{
 const g=airborne();g.velocity.x=3;g.velocity.z=-12;g.land(0,0,0);
 assert.deepEqual(g.landingVelocity,{x:3,z:-12});assert.equal(g.speed,0);
 for(const hz of [30,72,120]){
  const world={height:(x,z)=>x*.1-z*.05},r=new LandingRunout(world),v=r.velocity,p=r.position;r.start(12,0);
  let x=0,z=0,prior=12;
  for(let i=0;i<2*hz;i++){const next=r.update(1/hz,x,z);x=next.x;z=next.z;assert.ok(r.speed<=prior);prior=r.speed;assert.equal(next.y,world.height(x,z));}
  assert.equal(r.active,false);assert.equal(r.speed,0);assert.ok(Math.abs(x-9)<1e-8);assert.equal(z,0);assert.equal(r.velocity,v);assert.equal(r.position,p);
  r.start(10,-3);r.update(0,x,z);assert.equal(r.speed,Math.hypot(10,3));r.reset();assert.equal(r.speed,0);assert.equal(r.active,false);
 }
});

test('movement takes over landing once requested walking speed matches or exceeds slide speed',()=>{
 const r=new LandingRunout(flat);r.start(12,0);
 assert.equal(r.takeOver(0),false);assert.equal(r.takeOver(6),false);assert.equal(r.takeOver(NaN),false);assert.equal(r.active,true);assert.equal(r.speed,12);
 assert.equal(r.takeOver(12),true);assert.equal(r.active,false);assert.equal(r.speed,0);
 r.start(5,0);assert.equal(r.takeOver(14),true);
 r.start(12,0);r.update(.05,0,0);assert.equal(r.takeOver(11.5),false);assert.equal(r.takeOver(11.6),true);
 r.start(.01,0);assert.equal(r.takeOver(0),false);
});

test('head yaw and roll never steer without thumbstick; pitch continues to control flight',()=>{
 for(const rigYaw of [-2,0,2])for(const yaw of [-2.8,0,2.8]){
  const rig=new T.Group(),bank=new T.Group();rig.add(bank);rig.rotation.y=rigYaw;rig.position.y=300;
  const viewer={position:new T.Vector3(1,1.7,-.4),orientation:new T.Quaternion()},view=new FlightView(bank),g=new Glider(flat);
  view.sample(rig,viewer);g.launch(view.head.x,300,view.head.z,view.heading);const heading=g.heading;
  for(const roll of [-.5,0,.5]){viewer.orientation.setFromEuler(new T.Euler(0,yaw,roll,'YXZ'));view.advance(g,rig,viewer,1/120);assert.ok(Math.abs(g.heading-heading)<1e-10);assert.equal(g.turnRate,0);}
  viewer.orientation.setFromEuler(new T.Euler(-.6,yaw,0,'YXZ'));view.sample(rig,viewer);assert.ok(Math.abs(view.pitch+.6)<1e-9);
 }
 const left=airborne(),right=airborne();advance(left,1,0,-1);advance(right,1,0,1);
 assert.ok(Math.abs(left.heading+right.heading)<1e-9);assert.ok(left.heading>0&&left.heading<Math.PI/3);assert.ok(Math.abs(right.turnRate)<Math.PI/3);
 const partial=airborne();advance(partial,1,0,.575);assert.ok(Math.abs(partial.heading-right.heading*.5)<1e-9);
});
