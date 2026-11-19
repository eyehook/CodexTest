import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../../../shared/vendor/three-r180/three.module.js';
import {HandInput} from '../input.mjs';
const source=()=>({gripSpace:{},targetRaySpace:{},gamepad:{buttons:[{pressed:false,value:0}]}});
const pose=(x=.2,y=1.1,z=.3)=>({transform:{position:{x,y,z},orientation:{x:0,y:0,z:0,w:1}}});
test('current grip pose includes rig yaw/translation/height exactly once',()=>{
 const rig=new T.Group(),controller=new T.Group(),s=source();rig.position.set(2,.25,-3);rig.rotation.y=Math.PI/2;rig.add(controller);controller.matrixAutoUpdate=false;controller.userData.inputSource=s;
 const input=new HandInput(rig,[controller]),session={inputSources:[s]},frame={getPose:()=>pose()};input.sample(session,frame,{},true);s.gamepad.buttons[0]={pressed:true,value:1};assert.equal(input.sample(session,frame,{}),true);
 assert.ok(input.point.distanceTo(new T.Vector3(2.3,1.35,-3.2))<1e-9);assert.ok(new T.Vector3().setFromMatrixPosition(controller.matrixWorld).distanceTo(input.point)<1e-9);
});
test('hand choice persists on release, transfers once and absorbs held triggers on resume',()=>{
 const a=source(),b=source(),session={inputSources:[a,b]},input=new HandInput(new T.Group(),[]),frame={getPose:()=>pose()};input.sample(session,frame,{},true);a.gamepad.buttons[0]={pressed:true,value:1};input.sample(session,frame,{});assert.equal(input.active,a);a.gamepad.buttons[0]={pressed:false,value:0};input.sample(session,frame,{});assert.equal(input.active,a);b.gamepad.buttons[0]={pressed:true,value:1};input.sample(session,frame,{});assert.equal(input.active,b);assert.ok(input.discontinuous);input.sample(session,frame,{});assert.equal(input.discontinuous,false);input.reset();input.sample(session,frame,{},true);assert.equal(input.active,null);
});
test('tracking loss/recovery, disconnect and pose jumps suppress collision impulses',()=>{
 const s=source(),session={inputSources:[s]},input=new HandInput(new T.Group(),[]),frame={getPose:()=>pose()};s.gamepad.buttons[0]={pressed:true,value:1};input.sample(session,frame,{});assert.ok(input.tracked);assert.equal(input.sample(session,{getPose:()=>null},{}),false);input.sample(session,frame,{});assert.ok(input.discontinuous);input.sample(session,{getPose:()=>pose(2)},{});assert.ok(input.discontinuous);session.inputSources=[];input.sample(session,frame,{});assert.equal(input.active,null);assert.equal(input.tracked,false);
});
