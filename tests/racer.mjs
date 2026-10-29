import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../shared/vendor/three-r180/three.module.js';
import {CONFIG} from '../src/racer/config.mjs';
import {createSimulation,stepSimulation,steeringAxis,segmentZ} from '../src/racer/simulation.mjs';
import {controllerSteering} from '../src/racer/input.mjs';
import {createWorld} from '../src/racer/world.mjs';
import {createCockpit} from '../src/racer/cockpit.mjs';
import {alignAnchors} from '../src/racer/xr.mjs';
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
test('five-second acceleration, capped cruise and independent frame rate',()=>{
 for(const fps of [30,72,90,120]){
  const state=createSimulation();for(let i=0;i<fps*5;i++)stepSimulation(state,1/fps,0);
  close(state.speed,CONFIG.cruiseSpeed);close(state.distance,CONFIG.cruiseSpeed*2.5);
  stepSimulation(state,5,0);close(state.distance,CONFIG.cruiseSpeed*7.5);close(state.speed,CONFIG.cruiseSpeed);
 }
});
test('progressive steering, release preserves position, road limits',()=>{
 const state=createSimulation();stepSimulation(state,.1,1);close(state.lateral,.38);
 stepSimulation(state,1,0);close(state.lateral,.38);
 stepSimulation(state,100,1);close(state.lateral,CONFIG.lateralLimit);
 stepSimulation(state,100,-1);close(state.lateral,-CONFIG.lateralLimit);
 const before={...state};stepSimulation(state,0,1);assert.deepEqual(state,before);
});
test('deadzone, left stick mapping, absent/disconnected controllers',()=>{
 assert.equal(steeringAxis(.1),0);assert.equal(steeringAxis(NaN),0);close(steeringAxis(1),1);close(steeringAxis(-1),-1);
 assert.equal(controllerSteering([]),0);assert.equal(controllerSteering([{handedness:'left',gamepad:null}]),0);
 assert.equal(controllerSteering([{handedness:'left',gamepad:{mapping:'xr-standard'}}]),0);
 assert.equal(controllerSteering([{handedness:'right',gamepad:{axes:[0,0,1,0]}}]),0);
 assert.equal(controllerSteering([{handedness:'left',gamepad:{mapping:'xr-standard',axes:[0,0,-1,0]}}]),-1);
});
test('road ring is contiguous at wraps and after long travel',()=>{
 for(const distance of [0,.1,19.999,20,399.999,400,401,1e7]){
  const zs=Array.from({length:CONFIG.segmentCount},(_,i)=>segmentZ(i,distance)).sort((a,b)=>a-b);
  for(let i=1;i<zs.length;i++)close(zs[i]-zs[i-1],CONFIG.segmentLength);
  assert.ok(zs[0]<-CONFIG.fogFar);assert.ok(zs.at(-1)>=CONFIG.behindDistance-1.5*CONFIG.segmentLength);
 }
 close(segmentZ(4,.1)-segmentZ(4,0),.1);
});
test('fixed object population; all environment parts share opposite lateral movement',()=>{
 const world=createWorld(),count=world.environment.children.length,ids=world.environment.children.map(m=>m.uuid);
 assert.equal(count,9);const state=createSimulation();
 for(let i=0;i<3000;i++){stepSimulation(state,.05,Math.sin(i));world.update(state);}
 assert.equal(world.environment.children.length,count);assert.deepEqual(world.environment.children.map(m=>m.uuid),ids);
 close(world.environment.position.x,-state.lateral);
 for(const mesh of world.environment.children)assert.ok(mesh.instanceMatrix.array.every(Number.isFinite));
});
test('initial seated alignment anchors the world and cockpit; driving leaves camera and cockpit fixed',()=>{
 const cockpit=createCockpit(),world=createWorld(),camera=new THREE.PerspectiveCamera();
 const p=new THREE.Vector3(2,1.4,-3),q=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),.6);
 alignAnchors(cockpit.group,world.anchor,p,q,CONFIG.seatedEyeHeight);
 close(cockpit.group.rotation.y,.6);close(world.anchor.position.y,1.4-CONFIG.seatedEyeHeight);
 assert.ok(cockpit.group.position.equals(p));
 cockpit.group.updateMatrix();const matrix=cockpit.group.matrix.clone(),cam=camera.matrix.clone();
 const state=createSimulation();stepSimulation(state,5,1);world.update(state);cockpit.update(1,.05);cockpit.group.updateMatrix();
 assert.deepEqual(cockpit.group.matrix.elements,matrix.elements);assert.deepEqual(camera.matrix.elements,cam.elements);
});
