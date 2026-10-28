import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../forest/vendor/three.module.js';
import { VRControlPanel } from '../src/controls.js';
import { WeatherModes } from '../src/weather-modes.js';
import { weatherDefinitions } from '../src/weather-catalog.js';
globalThis.document={createElement:()=>({getContext:()=>new Proxy({},{get:()=>()=>{}})})};
test('VR Ground Effects page toggles and probabilities work via rays and preserve panel pose/FPS',()=>{
 const scene=new THREE.Scene(),controller=new THREE.Group(),view=new THREE.PerspectiveCamera();view.position.set(4,1.7,-6);scene.add(view,controller);
 const player={controllers:[controller],getWorldPose(p,d){view.getWorldPosition(p);view.getWorldDirection(d);}};
 const modes=new WeatherModes(scene,weatherDefinitions),rain=modes.select('rain'),panel=new VRControlPanel(scene,player,rain.parameters,{mode:'rain',modes:weatherDefinitions});panel.setFPS(90);panel.toggle();
 const position=panel.mesh.position.clone(),rotation=panel.mesh.quaternion.clone(),source={gamepad:{buttons:[{pressed:false}]}};controller.userData.inputSource=source;controller.position.copy(view.position);
 function aim(x,y){const target=new THREE.Vector3((x/1024-.5)*.9,(.5-y/panel.canvas.height)*(.9*panel.canvas.height/1024),0).applyMatrix4(panel.mesh.matrixWorld);controller.lookAt(target);controller.rotateY(Math.PI);scene.updateMatrixWorld(true);}
 function click(x,y){source.gamepad.buttons[0].pressed=false;panel.update({inputSources:[source]});aim(x,y);source.gamepad.buttons[0].pressed=true;panel.update({inputSources:[source]});}
 click(750,245);assert.equal(panel.section,'Ground Effects');assert.equal(panel.visibleDefinitions[0].id,'groundEffects');assert.equal(panel.visibleDefinitions.length,5);
 assert.ok(panel.mesh.position.equals(position));assert.ok(panel.mesh.quaternion.equals(rotation));assert.equal(panel.fps,90);
 rain.effect.groundEffects.splashes.spawn(1,0,2);click(500,223+panel.controlOffset);assert.equal(rain.parameters.values.groundEffects,0);assert.equal(rain.effect.groundEffects.splashObject.visible,false);assert.equal(rain.effect.groundEffects.splashes.freeCount,300);
 panel.update({inputSources:[source]});assert.equal(rain.parameters.values.groundEffects,0);click(500,223+panel.controlOffset);assert.equal(rain.parameters.values.groundEffects,1);
 click(944,223+panel.controlOffset+3*138);assert.equal(rain.parameters.values.splashProbability,100);click(80,223+panel.controlOffset+4*138);assert.equal(rain.parameters.values.rippleProbability,0);
 click(250,245);assert.equal(panel.section,'Weather');assert.equal(panel.visibleDefinitions[0].id,'count');assert.equal(rain.parameters.values.splashProbability,100);
 panel.dispose();modes.dispose();
});
