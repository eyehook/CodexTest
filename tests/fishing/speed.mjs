import {test} from 'node:test';import assert from 'node:assert/strict';
import {updateTravelSpeed} from '../../src/fishing/player.mjs';
const source=(hand,value)=>({handedness:hand,gamepad:{mapping:'xr-standard',buttons:[{value,pressed:value>0.5},{},{},{},{pressed:true}]}});
const session=(right=0,left=0)=>({visibilityState:'visible',inputSources:[source('right',right),source('left',left)]});
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-10,`${a} != ${b}`);
test('triggers adjust retained horizontal speed by analog pressure with independent A/X buttons',()=>{
 close(updateTravelSpeed(6,session(1),true,1),9);close(updateTravelSpeed(6,session(0,1),true,1),3);
 close(updateTravelSpeed(6,session(0.5),true,1),7.5);close(updateTravelSpeed(6,session(1,1),true,1),6);
 close(updateTravelSpeed(6,session(0.04),true,1),6);close(updateTravelSpeed(9,session(),true,1),9);
 close(updateTravelSpeed(6,session(1,0.5),true,1),7.5);
});
test('trigger speed adjustment respects bounds and stays frame-rate independent',()=>{
 for(const fps of [30,72,90,120]){
  let speed=6;for(let i=0;i<fps;i++)speed=updateTravelSpeed(speed,session(1),true,1/fps);close(speed,9);
  for(let i=0;i<fps;i++)speed=updateTravelSpeed(speed,session(0,1),true,1/fps);close(speed,6);
 }
 close(updateTravelSpeed(24,session(1),true,10),25);close(updateTravelSpeed(1,session(0,1),true,10),0.5);
});
test('speed control pauses when untracked/hidden and ignores unsupported controllers',()=>{
 for(const s of [null,{...session(1),visibilityState:'hidden'},{...session(1),visibilityState:'visible-blurred'}])close(updateTravelSpeed(6,s,true,1),6);
 close(updateTravelSpeed(6,session(1),false,1),6);close(updateTravelSpeed(6,session(1),true,0),6);
 const s=session(1);s.inputSources[0].gamepad.mapping='';close(updateTravelSpeed(6,s,true,1),6);
 close(updateTravelSpeed(6,{visibilityState:'visible',inputSources:[{handedness:'right'}]},true,1),6);
});
