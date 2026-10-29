import test from 'node:test';
import assert from 'node:assert/strict';
import {PerspectiveCamera,Vector3,Scene,Group,Object3D} from '../../../shared/vendor/three-r180/three.module.js';
import {fitDesktop,overviewDistance} from '../src/viewer.js';
import {VRPanel} from '../src/VRPanel.js';
import {config} from '../src/config.js';
test('all eight flight-box corners fit portrait, landscape, and expanded bounds',()=>{
 for(const aspect of [.45,1,1.78,2.4])for(const b of [config.bounds,{x:20,z:20,minY:3,maxY:14}]){
  const camera=new PerspectiveCamera(65,aspect,.05,400);fitDesktop(camera,b);camera.updateMatrixWorld(true);
  for(const x of [-b.x,b.x])for(const y of [b.minY,b.maxY])for(const z of [-b.z,b.z]){
   const projected=new Vector3(x,y,z).project(camera);
   assert.ok(Math.abs(projected.x)<1 && Math.abs(projected.y)<1 && projected.z<1);
  }
 }
});
test('panel is 45 degrees right; ray-targeted trigger changes shared config',()=>{
 const context=new Proxy({}, {get:()=>()=>{},set:()=>true});
 globalThis.document={createElement:()=>({getContext:()=>context})};
 try{
  const c=structuredClone(config),scene=new Scene(),rig=new Group();scene.add(rig);
  const controllers=[new Object3D(),new Object3D()],changes=[];
  const panel=new VRPanel(scene,rig,{xr:{getController:i=>controllers[i]}},c,k=>changes.push(k));
  const distance=overviewDistance({x:20,z:20,minY:3,maxY:14});panel.place(distance);scene.updateMatrixWorld(true);
  const offset=panel.mesh.position.clone().sub(new Vector3(0,1.6,distance));
  assert.ok(Math.abs(offset.length()-3)<1e-8);assert.ok(Math.abs(offset.x+offset.z)<1e-8);assert.ok(offset.x>0);
  const target=new Vector3(((920/1024)-.5)*1.45,(.5-180/1280)*1.8125,0).applyMatrix4(panel.mesh.matrixWorld);
  const controller=controllers[0];controller.position.set(0,1.3,distance);controller.lookAt(target);controller.rotateY(Math.PI);controller.updateMatrixWorld(true);
  controller.dispatchEvent({type:'connected'});
  const hit=panel.hit(controller);assert.ok(hit);assert.equal(hit.row,0);assert.equal(hit.sign,1);
  controller.dispatchEvent({type:'selectstart'});assert.equal(c.beeCount,260);assert.deepEqual(changes,['beeCount']);
  for(let i=0;i<100;i++)panel.activate(hit);assert.equal(c.beeCount,1000);
  panel.toggle();assert.equal(panel.mesh.visible,false);
  c.beeCount=250;controller.dispatchEvent({type:'selectstart'});assert.equal(c.beeCount,250);
  const moved=new Vector3(10,1.7,20),heading=new (rig.quaternion.constructor)().setFromAxisAngle(new Vector3(0,1,0),Math.PI/2);
  panel.follow(moved,heading);assert.equal(panel.mesh.visible,false);
  const relative=panel.mesh.position.clone().sub(moved).applyQuaternion(heading.clone().invert());
  assert.ok(Math.abs(relative.x-3/Math.sqrt(2))<1e-8);assert.ok(Math.abs(relative.z+3/Math.sqrt(2))<1e-8);
  panel.toggle();assert.equal(panel.mesh.visible,true);
  c.beeCount=1000;
  controller.dispatchEvent({type:'disconnected'});controller.dispatchEvent({type:'selectstart'});assert.equal(c.beeCount,1000);
 }finally{delete globalThis.document;}
});
