import assert from 'node:assert/strict';
import {MOVE_SPEED,ascentPressed,updateFlight} from '../projects/forest/forest-flight.mjs';
const source=(hand,pressed)=>({handedness:hand,gamepad:{mapping:'xr-standard',buttons:[{pressed:true},{pressed:true},{pressed:true},{pressed:true},{pressed},{pressed:true}]}});
assert.equal(MOVE_SPEED,1.5);
for(const hand of ['left','right']){assert.equal(ascentPressed(source(hand,true)),true);assert.equal(ascentPressed(source(hand,false)),false);}
assert.equal(ascentPressed({handedness:'left'}),false);
assert.equal(ascentPressed(source('none',true)),false);
const unknown=source('left',true);unknown.gamepad.mapping='';assert.equal(ascentPressed(unknown),false);
assert.equal([source('left',true),source('right',true)].some(ascentPressed),true);
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-10,`${a} != ${b}`);
const state={height:0,velocity:0};
updateFlight(state,true,.25);close(state.velocity,.75);close(state.height,.09375);
updateFlight(state,true,.75);close(state.velocity,1.5);close(state.height,1.125);
const releaseHeight=state.height;
updateFlight(state,false,.5);close(state.velocity,.75);close(state.height-releaseHeight,.5625);
updateFlight(state,false,.5);close(state.velocity,0);close(state.height-releaseHeight,.75);
updateFlight(state,false,.5);close(state.velocity,-.75);close(state.height-releaseHeight,.5625);
updateFlight(state,false,10);assert.deepEqual(state,{height:0,velocity:0});
updateFlight(state,false,.05);assert.deepEqual(state,{height:0,velocity:0});
updateFlight(state,true,.1);assert.ok(state.height>0&&state.velocity>0);
const fast={height:10,velocity:-1.5};updateFlight(fast,false,.5);close(fast.velocity,-1.5);close(fast.height,9.25);
updateFlight(fast,true,.25);close(fast.velocity,-.75); // Repress brakes falling without snapping velocity.
for(const fps of [30,72,90,120]){
 const flight={height:10,velocity:0};
 for(let i=0;i<fps;i++)updateFlight(flight,true,1/fps);
 close(flight.height,11.125);close(flight.velocity,1.5);
 for(let i=0;i<fps;i++)updateFlight(flight,false,1/fps);
 close(flight.height,11.875);close(flight.velocity,0);
 const before={...flight};updateFlight(flight,false,0);assert.deepEqual(flight,before);
}
console.log('A/X input, smooth thrust, release momentum, apex, gravity, terminal descent, landing, and frame-rate independence pass.');
