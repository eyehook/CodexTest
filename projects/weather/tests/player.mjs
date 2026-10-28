import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../forest/vendor/three.module.js';
import { PlayerController } from '../src/player.js';
import { VRControlPanel } from '../src/controls.js';
import { WeatherParameters, snowParameters } from '../src/parameters.js';
globalThis.innerWidth=1000;globalThis.innerHeight=800;
globalThis.window={addEventListener(){}};
globalThis.document={createElement:()=>({getContext:()=>new Proxy({},{get:()=>()=>{}})})};
function setup(){
 const left={handedness:'left',gamepad:{mapping:'xr-standard',axes:[0,0,0,0]}},right={handedness:'right',gamepad:{mapping:'xr-standard',axes:[0,0,0,0]}};
 const session={inputSources:[right,left]}, xr={isPresenting:true,getSession:()=>session,getReferenceSpace:()=>({}),getController:()=>new THREE.Group(),addEventListener(){},removeEventListener(){},getCamera(){throw Error('Do not read internal XR camera');}};
 const scene=new THREE.Scene(),player=new PlayerController(scene,{xr,domElement:{addEventListener(){}}});
 const pose={transform:{position:new THREE.Vector3(1,1.7,2),orientation:new THREE.Quaternion()}};
 const frame={getViewerPose:()=>pose};return {scene,player,left,right,pose,frame};
}
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
test('XR locomotion combines live headset heading with translated and rotated rig',()=>{
 const {player,left,pose,frame}=setup();player.rig.position.set(20,0,30);player.rig.rotation.y=Math.PI/2;
 pose.transform.orientation.setFromAxisAngle(new THREE.Vector3(0,1,0),Math.PI/2);
 left.gamepad.axes[3]=-1;const before=player.update(0,frame).clone();const after=player.update(.5,frame);
 near(after.x,before.x);near(after.z,before.z+1);near(after.y,1.7);
});
test('right stick turns right about current room-scale head and next forward follows turn',()=>{
 const {player,left,right,frame}=setup();player.rig.position.set(20,0,30);
 const before=player.update(0,frame).clone();right.gamepad.axes[2]=1;const after=player.update(1,frame);
 near(player.rig.rotation.y,-Math.PI/2);near(after.x,before.x);near(after.z,before.z);
 right.gamepad.axes[2]=0;left.gamepad.axes[3]=-1;player.update(.5,frame);near(player.position.x,before.x+1);near(player.position.z,before.z);
});
test('strafing, deadzone, diagonal cap, frame independence and tracking loss',()=>{
 const a=setup(),b=setup();a.left.gamepad.axes[2]=1;b.left.gamepad.axes[2]=1;
 const before=a.player.update(0,a.frame).clone();a.player.update(.5,a.frame);for(let i=0;i<45;i++)b.player.update(1/90,b.frame);
 near(a.player.position.x,before.x+1);near(a.player.position.x,b.player.position.x);
 a.left.gamepad.axes[2]=.1;a.player.update(1,a.frame);near(a.player.position.x,before.x+1);
 a.left.gamepad.axes[2]=1;a.left.gamepad.axes[3]=-1;const start=a.player.position.clone();a.player.update(1,a.frame);near(a.player.position.distanceTo(start),2);
 const rig=a.player.rig.position.clone();assert.equal(a.player.update(1,{getViewerPose:()=>null}),null);assert.ok(a.player.rig.position.equals(rig));
});
test('panel reopening uses current rig translation, turn and newest tracked head pose',()=>{
 const {scene,player,left,right,pose,frame}=setup();const parameters=new WeatherParameters();parameters.register(snowParameters);
 const panel=new VRControlPanel(scene,player,parameters);player.update(0,frame);panel.toggle();const first=panel.mesh.position.clone();panel.toggle();
 left.gamepad.axes[3]=-1;for(let i=0;i<180;i++)player.update(1/90,frame);left.gamepad.axes[3]=0;right.gamepad.axes[2]=1;player.update(1,frame);right.gamepad.axes[2]=0;
 pose.transform.position.x+=.5;player.update(0,frame);panel.toggle();
 const head=new THREE.Vector3(),forward=new THREE.Vector3();player.getWorldPose(head,forward);forward.applyAxisAngle(new THREE.Vector3(0,1,0),-Math.PI/4);
 near(panel.mesh.position.x,head.x+forward.x*1.2);near(panel.mesh.position.z,head.z+forward.z*1.2);assert.ok(!panel.mesh.position.equals(first));
 const fixed=panel.mesh.position.clone();left.gamepad.axes[3]=-1;player.update(1,frame);assert.ok(panel.mesh.position.equals(fixed));panel.dispose();
});
