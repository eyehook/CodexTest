import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../forest/vendor/three.module.js';
import { WeatherParameters, snowParameters } from '../src/parameters.js';
import { VRControlPanel } from '../src/controls.js';
const context = new Proxy({}, { get: () => () => {} });
globalThis.document = { createElement: () => ({ getContext: () => context }) };
function setup() {
 const scene = new THREE.Scene(), view = new THREE.PerspectiveCamera();view.position.set(0,1.65,0);scene.add(view);
 const controllers = [new THREE.Group(), new THREE.Group()]; controllers.forEach(c=>scene.add(c));
 const player = {view,controllers,getWorldPose(position,direction) { view.getWorldPosition(position);view.getWorldDirection(direction); }}, parameters = new WeatherParameters();parameters.register(snowParameters);
 const panel = new VRControlPanel(scene,player,parameters);scene.updateMatrixWorld(true);
 return {scene,player,parameters,panel};
}
test('panel opens at 45 degrees right / 1.2 m, stays world-fixed, and repositions on reopening',()=>{
 const {scene,player,panel}=setup();panel.toggle();
 assert.ok(Math.abs(panel.mesh.position.x - 1.2/Math.sqrt(2))<1e-6);
 assert.ok(Math.abs(panel.mesh.position.z + 1.2/Math.sqrt(2))<1e-6);
 const original=panel.mesh.position.clone();player.view.position.x=10;scene.updateMatrixWorld(true);
 panel.update({inputSources:[]});assert.ok(panel.mesh.position.equals(original));
 panel.toggle();panel.toggle();assert.ok(Math.abs(panel.mesh.position.x-original.x-10)<1e-6);panel.dispose();
});
test('B/Y toggles on rising edges, holding does not repeat, session exit hides panel',()=>{
 const {panel}=setup(), source={gamepad:{buttons:Array.from({length:6},()=>({pressed:false}))}};
 const session={inputSources:[source]};source.gamepad.buttons[5].pressed=true;panel.update(session);assert.equal(panel.mesh.visible,true);
 panel.update(session);assert.equal(panel.mesh.visible,true);source.gamepad.buttons[5].pressed=false;panel.update(session);
 source.gamepad.buttons[5].pressed=true;panel.update(session);assert.equal(panel.mesh.visible,false);
 panel.toggle();panel.update(null);assert.equal(panel.mesh.visible,false);assert.equal(panel.previousButtons.size,0);panel.dispose();
});
test('trigger ray drags a generated slider and input-source mapping survives reordered sources',()=>{
 const {scene,player,parameters,panel}=setup();panel.toggle();
 const source={gamepad:{buttons:Array.from({length:6},()=>({pressed:false}))}},other={gamepad:{buttons:[]}};
 // Deliberately map controller 0 to input source 1, as can happen after reconnecting.
 const controller=player.controllers[0];controller.userData.inputSource=source;controller.position.copy(player.view.position);
 const target=new THREE.Vector3();
 function aim(x,row=0){target.set((x/1024-.5)*.9,(.5-(223+row*138)/panel.canvas.height)*(.9*panel.canvas.height/1024),0).applyMatrix4(panel.mesh.matrixWorld);controller.lookAt(target);controller.rotateY(Math.PI);scene.updateMatrixWorld(true);}
 aim(512);source.gamepad.buttons[0].pressed=true;panel.update({inputSources:[other,source]});assert.ok(Math.abs(parameters.values.count-25000)<2);
 aim(944);panel.update({inputSources:[other,source]});assert.equal(parameters.values.count,50000);
 source.gamepad.buttons[0].pressed=false;panel.update({inputSources:[other,source]});assert.equal(panel.dragRows.size,0);
 aim(944,3);source.gamepad.buttons[0].pressed=true;panel.update({inputSources:[other,source]});assert.equal(parameters.values.size,10);
 panel.dispose();assert.equal(parameters.listeners.size,0);
});

test('live FPS updates readable panel text and closed panels defer texture redraw',()=>{
 const {panel}=setup();const text=[];panel.ctx={fillRect(){},fillText(value){text.push(value);},beginPath(){},arc(){},fill(){}};
 panel.setFPS(89.7);assert.equal(panel.fps,90);assert.equal(text.length,0);
 panel.toggle();assert.ok(text.includes('FPS  90'));text.length=0;
 panel.setFPS(119.8);assert.ok(text.includes('FPS  120'));text.length=0;
 panel.setFPS(120);assert.equal(text.length,0);panel.setFPS(null);assert.ok(text.includes('FPS  —'));panel.dispose();
});

test('panel opens once on first tracked session update, consumes held buttons and reopens on next session',()=>{
 const {scene,player,panel}=setup(),source={gamepad:{buttons:Array.from({length:6},()=>({pressed:false}))}},session={inputSources:[source]};
 player.view.position.set(20,1.7,-30);scene.updateMatrixWorld(true);source.gamepad.buttons[5].pressed=true;source.gamepad.buttons[0].pressed=true;
 panel.beginSession();assert.equal(panel.mesh.visible,false);panel.update(session);assert.equal(panel.mesh.visible,true);assert.ok(panel.mesh.position.x>20);assert.ok(panel.mesh.position.z<-30);
 panel.update(session);assert.equal(panel.mesh.visible,true);panel.toggle();panel.update(session);assert.equal(panel.mesh.visible,false);
 panel.update(null);player.view.position.x=40;scene.updateMatrixWorld(true);panel.beginSession();panel.update(session);assert.equal(panel.mesh.visible,true);assert.ok(panel.mesh.position.x>40);panel.dispose();
});
