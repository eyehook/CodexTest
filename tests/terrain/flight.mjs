import {test} from 'node:test';
import assert from 'node:assert/strict';
import {updateTerrainFlight} from '../../src/terrain/flight.mjs';
const source=(hand,pressed)=>({handedness:hand,gamepad:{mapping:'xr-standard',buttons:[{},{},{},{},{pressed}]}});
const session=(a=false,x=false)=>({visibilityState:'visible',inputSources:[source('right',a),source('left',x)]});
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-10,`${a} != ${b}`);

test('Terrain flight uses either A or X, with no additive thrust',()=>{
 const states=[];
 for(const s of [session(true,false),session(false,true),session(true,true)]){
  const state={height:0,velocity:0};updateTerrainFlight(state,s,true,1);states.push(state);
  close(state.height,1.125);close(state.velocity,1.5);
 }
 assert.deepEqual(states[0],states[1]);assert.deepEqual(states[1],states[2]);
});
test('Terrain flight preserves release momentum, reaches an apex, descends and lands across frame rates',()=>{
 for(const fps of [30,72,90,120]){
  const state={height:0,velocity:0};
  for(let i=0;i<fps;i++)updateTerrainFlight(state,session(true),true,1/fps);
  const releaseHeight=state.height;
  for(let i=0;i<fps;i++)updateTerrainFlight(state,session(),true,1/fps);
  close(state.height-releaseHeight,0.75);close(state.velocity,0);
  for(let i=0;i<fps*4;i++)updateTerrainFlight(state,session(),true,1/fps);
  assert.deepEqual(state,{height:0,velocity:0,altitude:0});
 }
});
test('Terrain flight pauses on hidden/untracked frames and ignores non-Quest input',()=>{
 const state={height:8,velocity:1.5},before={...state};
 updateTerrainFlight(state,session(true),false,1);
 updateTerrainFlight(state,{...session(true),visibilityState:'hidden'},true,1);
 updateTerrainFlight(state,{...session(true),visibilityState:'visible-blurred'},true,1);
 updateTerrainFlight(state,null,true,1);assert.deepEqual(state,before);
 const unsupported=session(true,true);for(const s of unsupported.inputSources)s.gamepad.mapping='';
 updateTerrainFlight(state,unsupported,true,1);close(state.velocity,0);close(state.height,8.75);
 const absent={height:0,velocity:0};updateTerrainFlight(absent,{visibilityState:'visible',inputSources:[]},true,1);assert.deepEqual(absent,{height:0,velocity:0,altitude:0});
});

test('airborne world altitude is independent of ravines and lower terrain',()=>{
 const state={height:10,velocity:1.5,altitude:110};
 // Holding ascent at its cap adds the same 1.5 m over a valley as over flat land.
 updateTerrainFlight(state,session(true),true,1,-40);
 close(state.altitude,111.5);close(state.height,151.5);close(state.velocity,1.5);
 updateTerrainFlight(state,session(),true,1,-80);
 close(state.altitude,112.25);close(state.height,192.25);close(state.velocity,0);
 updateTerrainFlight(state,session(),true,1,-100);
 close(state.altitude,111.5);close(state.height,211.5);close(state.velocity,-1.5);
});
test('world-altitude flight handles negative elevations, rising-ground landing and grounded walking',()=>{
 const state={height:0,velocity:0,altitude:null};
 updateTerrainFlight(state,session(),true,1,-50);close(state.altitude,-50);close(state.height,0);
 updateTerrainFlight(state,session(),true,1,-60);close(state.altitude,-60);close(state.height,0);
 updateTerrainFlight(state,session(true),true,1,-60);close(state.altitude,-58.875);close(state.height,1.125);
 updateTerrainFlight(state,session(),true,0,-100);close(state.altitude,-58.875);close(state.height,41.125);
 updateTerrainFlight(state,session(),true,0.1,-40);close(state.altitude,-40);close(state.height,0);close(state.velocity,0);
 updateTerrainFlight(state,session(),true,1,-35);close(state.altitude,-35);close(state.height,0);
});
test('equal airborne inputs produce equal world altitude over different terrain profiles',()=>{
 const flat={height:20,velocity:0,altitude:120},ravine={...flat};
 for(let i=0;i<90;i++){
  updateTerrainFlight(flat,session(true),true,1/90,100);
  updateTerrainFlight(ravine,session(true),true,1/90,100-i*2);
  close(flat.altitude,ravine.altitude);
 }
 assert.ok(ravine.height>flat.height+170);
});
