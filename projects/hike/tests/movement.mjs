import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../../../shared/vendor/three-r180/three.module.js';
import {Locomotion} from '../../../shared/xr/locomotion.mjs';
import {SlopeSlide} from '../movement.mjs';
function plane(degrees){const angle=degrees*Math.PI/180;return {height:(x,z)=>Math.tan(angle)*x,normal:(x,z,out={})=>Object.assign(out,{x:-Math.sin(angle),y:Math.cos(angle),z:0,slope:degrees})};}
test('35 degrees holds position; steeper surfaces drift downhill and lower elevation',()=>{
 for(const degrees of [0,20,35]){const slide=new SlopeSlide(plane(degrees)),p=slide.update(10,2,.05);assert.equal(p.x,10);assert.equal(p.z,2);assert.equal(p.active,false);}
 const world=plane(35.01),p=new SlopeSlide(world).update(10,2,.05);assert.ok(p.x<10);assert.ok(world.height(p.x,p.z)<world.height(10,2));assert.equal(p.active,true);
});
test('walking input is accepted, then drift wins uphill while lateral steering stays available',()=>{
 for(const speed of [1.4,14,30]){
  const slide=new SlopeSlide(plane(45)),dt=1/72;
  let x=100,z=0;
  for(let i=0;i<72;i++){const p=slide.update(x+speed*dt,z+speed*dt,dt,35,speed);x=p.x;z=p.z;}
  assert.ok(x<100,`uphill input overcame slide at ${speed}`);assert.ok(z>speed*.99,'lateral input was blocked');
 }
});
test('slide settles on the first gentle surface without residual momentum',()=>{
 const world={height:(x,z)=>Math.max(0,x),normal:(x,z,out={})=>Object.assign(out,x>0?{x:-Math.SQRT1_2,y:Math.SQRT1_2,z:0,slope:45}:{x:0,y:1,z:0,slope:0})};
 const slide=new SlopeSlide(world);let p=slide.update(.01,3,.05,35,14);
 assert.ok(p.x<=0&&p.x>-.001);assert.equal(p.z,3);assert.equal(p.active,false);assert.equal(p.speed,0);
 const x=p.x;p=slide.update(x,3,.05,35,14);assert.equal(p.x,x);assert.equal(p.speed,0);
});
test('downhill direction follows both horizontal normal components and curved slopes',()=>{
 const world={normal:(x,z,out={})=>Object.assign(out,{x:-Math.SQRT1_2,y:0.5,z:-Math.SQRT1_2,slope:60})};
 const p=new SlopeSlide(world).update(10,10,.05);assert.ok(p.x<10&&p.z<10);assert.ok(Math.abs(p.x-p.z)<1e-9);
});
test('zero delta pauses motion, frame time is bounded, reset clears slide speed',()=>{
 const slide=new SlopeSlide(plane(45));assert.equal(slide.update(10,0,0).x,10);
 const a=slide.update(10,0,5).x;slide.reset();const b=slide.update(10,0,.05).x;assert.equal(a,b);
 slide.reset();assert.equal(slide.speed,0);
});
test('sliding preserves turning and physical headset offset in a translated rig',()=>{
 const rig=new T.Group();rig.position.set(100,0,40);rig.rotation.y=.7;
 const viewer={position:new T.Vector3(1.2,1.7,.4),orientation:new T.Quaternion()};
 const locomotion=new Locomotion(rig,{moveSpeed:14});locomotion.move(1/72,.4,-.3,.8,viewer);
 rig.updateMatrixWorld(true);const head=viewer.position.clone().applyMatrix4(rig.matrixWorld),yaw=rig.rotation.y;
 const p=new SlopeSlide(plane(45)).update(head.x,head.z,1/72,35,14);
 rig.position.x+=p.x-head.x;rig.position.z+=p.z-head.z;rig.updateMatrixWorld(true);
 const after=viewer.position.clone().applyMatrix4(rig.matrixWorld);
 assert.ok(Math.abs(after.x-p.x)<1e-9);assert.ok(Math.abs(after.z-p.z)<1e-9);assert.equal(rig.rotation.y,yaw);assert.ok(yaw!==.7);assert.equal(after.y,head.y);
});
