import {test} from 'node:test';
import assert from 'node:assert/strict';
import {updateHorizontalMotion,FLIGHT_DRAG,FLIGHT_RESPONSE} from '../../src/fishing/player.mjs';
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`);
test('airborne release glides with frame-independent exponential drag',()=>{
 for(const fps of [30,72,90,120]){
  const world={x:0,z:0},motion={x:0,z:0};
  for(let i=0;i<fps;i++)updateHorizontalMotion(world,motion,0,-1,0,6,1/fps,true);
  const launchSpeed=6*(1-Math.exp(-FLIGHT_RESPONSE)),launchDistance=6*(1-(1-Math.exp(-FLIGHT_RESPONSE))/FLIGHT_RESPONSE);
  close(world.z,-launchDistance);
  for(let i=0;i<fps*2;i++)updateHorizontalMotion(world,motion,0,0,0,6,1/fps,true);
  close(world.z,-launchDistance-launchSpeed*(1-Math.exp(-FLIGHT_DRAG*2))/FLIGHT_DRAG);
  close(motion.z,-launchSpeed*Math.exp(-FLIGHT_DRAG*2));assert.ok(Math.abs(motion.z)>1&&Math.abs(motion.z)<1.3);
 }
});
test('ground release stops immediately and landing drops airborne momentum',()=>{
 const world={x:0,z:0},motion={x:0,z:0};
 updateHorizontalMotion(world,motion,0,-1,0,6,1,false);close(world.z,-6);
 updateHorizontalMotion(world,motion,0,0,0,6,1,false);close(world.z,-6);close(motion.z,0);
 motion.x=5;motion.z=-3;updateHorizontalMotion(world,motion,0,0,0,6,1,false);close(world.x,0);close(world.z,-6);assert.deepEqual(motion,{x:0,z:0});
});
test('glide retains world direction through turns and active input redirects it',()=>{
 const world={x:0,z:0},motion={x:0,z:0};updateHorizontalMotion(world,motion,0,-1,Math.PI/2,6,1,true);
 assert.ok(world.x<-4&&world.x>-6);close(world.z,0);
 updateHorizontalMotion(world,motion,0,0,-Math.PI/2,6,1,true);assert.ok(world.x<-6);close(world.z,0);
 updateHorizontalMotion(world,motion,0,-0.5,-Math.PI/2,6,1,true);assert.ok(motion.x>2&&motion.x<3);close(motion.z,0);
});
test('hidden or untracked frames pause glide without consuming momentum',()=>{
 const world={x:2,z:3},motion={x:4,z:-6};
 updateHorizontalMotion(world,motion,0,0,0,6,10,true,false);
 assert.deepEqual(world,{x:2,z:3});assert.deepEqual(motion,{x:4,z:-6});
 updateHorizontalMotion(world,motion,0,-1,0,6,0,true);assert.deepEqual(motion,{x:4,z:-6});
});

test('analog stick returning to centre preserves momentum instead of snapping to low input speed',()=>{
 const world={x:0,z:0},motion={x:0,z:-6};
 for(const amount of [0.75,0.5,0.25,0.05,0])updateHorizontalMotion(world,motion,0,-amount,0,6,1/72,true);
 assert.ok(motion.z<-5.6);assert.ok(world.z<-0.39);
});
test('airborne acceleration and steering change velocity gradually',()=>{
 const world={x:0,z:0},motion={x:0,z:0};
 updateHorizontalMotion(world,motion,0,-1,0,6,1/72,true);assert.ok(motion.z<0&&motion.z>-0.4);
 motion.z=-6;updateHorizontalMotion(world,motion,1,0,0,6,1/72,true);assert.ok(motion.z<-5);assert.ok(motion.x>0&&motion.x<0.4);
});
