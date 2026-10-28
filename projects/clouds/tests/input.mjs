import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../forest/vendor/three.module.js';
import { Parameters } from '../src/parameters.js';
import { VRControlPanel } from '../src/controls.js';
import { PlayerController } from '../src/player.js';
globalThis.innerWidth=1000;
globalThis.innerHeight=800;
globalThis.window={
  addEventListener(){
  }
};
globalThis.document={
  createElement:()=>({
    getContext:()=>new Proxy({
    },{
      get:()=>()=>{
      }
    })
  })
};
function setup(){
  const scene=new THREE.Scene(),view=new THREE.PerspectiveCamera(),controller=new THREE.Group();
  view.position.set(0,1.65,0);
  scene.add(view,controller);
  const parameters=new Parameters(),player={
    controllers:[controller],getWorldPose(p,d){
      view.getWorldPosition(p);
      view.getWorldDirection(d);
    }
  };
  const panel=new VRControlPanel(scene,player,parameters);
  const source={
    gamepad:{
      buttons:Array.from({
        length:6
      },()=>({
        pressed:false
      }))
    }
  },session={
    inputSources:[source]
  };
  controller.userData.inputSource=source;
  controller.position.copy(view.position);
  panel.toggle();
  scene.updateMatrixWorld(true);
  function aim(x,y){
    const target=new THREE.Vector3((x/1024-.5)*.9,(.5-y/panel.canvas.height)*(.9*panel.canvas.height/1024),0).applyMatrix4(panel.mesh.matrixWorld);
    controller.lookAt(target);
    controller.rotateY(Math.PI);
    scene.updateMatrixWorld(true);
  }
  function click(x,y){
    source.gamepad.buttons[0].pressed=false;
    panel.update(session);
    aim(x,y);
    source.gamepad.buttons[0].pressed=true;
    panel.update(session);
  }
  return {
    scene,view,controller,parameters,panel,source,session,aim,click
  };
}
test('actual controller rays select all four tabs and live/disabled settings',()=>{
  const {
    panel,parameters,click
  }
  =setup();click(944,223+panel.controlOffset);assert.equal(parameters.values.density,5);click(350,165);assert.equal(panel.section,'Rendering');click(944,223+panel.controlOffset);assert.equal(parameters.values.steps,128);click(80,223+panel.controlOffset+138);assert.equal(parameters.values.cloudResolution,0);click(944,223+panel.controlOffset+138);assert.equal(parameters.values.cloudResolution,4);click(944,223+panel.controlOffset+3*138);assert.equal(parameters.values.foveation,0);click(600,165);assert.equal(panel.section,'Diagnostics');click(944,223+panel.controlOffset);assert.equal(parameters.values.mode,2);click(944,223+panel.controlOffset+138);assert.equal(parameters.values.cloud,0);click(850,165);assert.equal(panel.section,'Performance');panel.dispose();assert.equal(parameters.listeners.size,0);
});
test('B/Y edges, held-entry buttons and world-locked repositioning',()=>{
  const {
    scene,view,panel,source,session
  }
  =setup();panel.toggle();source.gamepad.buttons[5].pressed=true;panel.beginSession();panel.update(session);assert.equal(panel.mesh.visible,true);panel.update(session);assert.equal(panel.mesh.visible,true);const pos=panel.mesh.position.clone();view.position.x=10;scene.updateMatrixWorld(true);panel.update(session);assert.ok(panel.mesh.position.equals(pos));source.gamepad.buttons[5].pressed=false;panel.update(session);source.gamepad.buttons[5].pressed=true;panel.update(session);assert.equal(panel.mesh.visible,false);source.gamepad.buttons[5].pressed=false;panel.update(session);source.gamepad.buttons[5].pressed=true;panel.update(session);assert.ok(Math.abs(panel.mesh.position.x-pos.x-10)<1e-6);assert.ok(Math.abs(panel.mesh.position.z+1.2/Math.sqrt(2))<1e-6);panel.update(null);assert.equal(panel.mesh.visible,false);panel.dispose();
});
test('head-tracked movement is 3 m/s, turning pivots about head, tracking loss pauses',()=>{
  const scene=new THREE.Scene(),left={
    handedness:'left',gamepad:{
      mapping:'xr-standard',axes:[0,0,1,-1]
    }
  },right={
    handedness:'right',gamepad:{
      mapping:'xr-standard',axes:[0,0,0,0]
    }
  },session={
    inputSources:[left,right]
  },xr={
    isPresenting:true,getSession:()=>session,getReferenceSpace:()=>({
    }),getController:()=>new THREE.Group(),addEventListener(){
    },removeEventListener(){
    }
  };const renderer={
    xr,domElement:{
      addEventListener(){
      }
    }
  },player=new PlayerController(scene,renderer),pose={
    transform:{
      position:{
        x:.4,y:1.7,z:.2
      },orientation:{
        x:0,y:0,z:0,w:1
      }
    }
  },frame={
    getViewerPose:()=>pose
  };const start=player.update(0,frame).clone();player.update(1,frame);assert.ok(Math.abs(player.position.distanceTo(start)-3)<1e-6);left.gamepad.axes[2]=left.gamepad.axes[3]=0;right.gamepad.axes[2]=1;const pivot=player.position.clone();player.update(1,frame);assert.ok(player.position.distanceTo(pivot)<1e-6);assert.ok(Math.abs(player.rig.rotation.y+Math.PI/2)<1e-6);const rig=player.rig.position.clone();assert.equal(player.update(1,{
    getViewerPose:()=>null
  }),null);assert.ok(player.rig.position.equals(rig));player.dispose();
});
