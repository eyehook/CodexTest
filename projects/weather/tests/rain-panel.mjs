import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../../shared/vendor/three-r180/three.module.js';
import { VRControlPanel } from '../src/controls.js';
import { WeatherModes } from '../src/weather-modes.js';
import { weatherDefinitions } from '../src/weather-catalog.js';
globalThis.document={createElement:()=>({getContext:()=>new Proxy({},{get:()=>()=>{}})})};
test('VR mode button changes effect in-place, retains world position/FPS and suppresses held-trigger edits',()=>{
 const scene=new THREE.Scene(),controller=new THREE.Group(),view=new THREE.PerspectiveCamera();view.position.set(4,1.7,-6);scene.add(view,controller);
 const player={controllers:[controller],getWorldPose(p,d){view.getWorldPosition(p);view.getWorldDirection(d);}};
 const modes=new WeatherModes(scene,weatherDefinitions),snow=modes.select('snow');snow.parameters.set('size',7);
 let switches=0;const panel=new VRControlPanel(scene,player,snow.parameters,{mode:'snow',modes:weatherDefinitions,onSelect(id){switches++;const state=modes.select(id);panel.setEffect(state.parameters,id);}});
 panel.setFPS(90);panel.toggle();const mesh=panel.mesh,position=mesh.position.clone(),quaternion=mesh.quaternion.clone();
 const source={gamepad:{buttons:Array.from({length:6},()=>({pressed:false}))}};controller.userData.inputSource=source;controller.position.copy(view.position);
 function aim(x,y){const target=new THREE.Vector3((x/1024-.5)*.9,(.5-y/panel.canvas.height)*(.9*panel.canvas.height/1024),0).applyMatrix4(panel.mesh.matrixWorld);controller.lookAt(target);controller.rotateY(Math.PI);scene.updateMatrixWorld(true);}
 aim(750,170);source.gamepad.buttons[0].pressed=true;panel.update({inputSources:[source]});assert.equal(panel.mode,'rain');assert.equal(switches,1);
 assert.equal(panel.mesh,mesh);assert.ok(panel.mesh.position.equals(position));assert.ok(panel.mesh.quaternion.equals(quaternion));assert.equal(panel.mesh.visible,true);assert.equal(panel.fps,90);
 assert.equal(panel.parameters.definitions.length,10);assert.equal(panel.canvas.height,1146);
 aim(944,223+panel.controlOffset);panel.update({inputSources:[source]});assert.equal(panel.parameters.values.count,2000);
 source.gamepad.buttons[0].pressed=false;panel.update({inputSources:[source]});source.gamepad.buttons[0].pressed=true;panel.update({inputSources:[source]});assert.equal(panel.parameters.values.count,50000);
 source.gamepad.buttons[0].pressed=false;panel.update({inputSources:[source]});aim(250,170);source.gamepad.buttons[0].pressed=true;panel.update({inputSources:[source]});assert.equal(panel.mode,'snow');assert.equal(panel.parameters.values.size,7);assert.equal(panel.parameters.definitions.length,4);assert.equal(switches,2);
 assert.equal(modes.states.get('rain').parameters.listeners.size,2); // Only RainEffect remains subscribed while inactive.
 panel.dispose();modes.dispose();assert.equal(snow.parameters.listeners.size,0);
});
test('generic VR mode row works with a third future catalog entry',()=>{
 const entries=[...weatherDefinitions,{...weatherDefinitions[1],id:'dust',label:'Dust'}],scene=new THREE.Scene(),view=new THREE.PerspectiveCamera(),controller=new THREE.Group();view.position.y=1.7;scene.add(view,controller);
 const modes=new WeatherModes(scene,entries),snow=modes.select('snow');let selected;
 const panel=new VRControlPanel(scene,{controllers:[controller],getWorldPose(p,d){view.getWorldPosition(p);view.getWorldDirection(d);}},snow.parameters,{modes:entries,onSelect(id){selected=id;}});panel.toggle();
 const source={gamepad:{buttons:[{pressed:true}]}};controller.userData.inputSource=source;controller.position.copy(view.position);
 const target=new THREE.Vector3((820/1024-.5)*.9,(.5-170/panel.canvas.height)*(.9*panel.canvas.height/1024),0).applyMatrix4(panel.mesh.matrixWorld);controller.lookAt(target);controller.rotateY(Math.PI);scene.updateMatrixWorld(true);panel.update({inputSources:[source]});assert.equal(selected,'dust');panel.dispose();modes.dispose();
});
