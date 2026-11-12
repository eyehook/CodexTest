import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../../../shared/vendor/three-r180/three.module.js';
import {fieldHuePatch,fieldHueOffset,shiftGrassHue} from '../field-cells.mjs';
test('grass hue patches are seeded, bounded and continuous across positive and negative cell/lattice edges',()=>{
 let min=30,max=-30;
 for(let cx=-12;cx<12;cx++)for(let cz=-12;cz<12;cz++){
  const patch=fieldHuePatch(41729,cx,cz),right=fieldHuePatch(41729,cx+1,cz),above=fieldHuePatch(41729,cx,cz+1);
  assert.deepEqual(patch,fieldHuePatch(41729,cx,cz));
  for(const t of [0,.2,.5,.8,1]){
   const value=fieldHueOffset(patch,t,.5);assert.ok(value>=-30&&value<=30);min=Math.min(min,value);max=Math.max(max,value);
   assert.ok(Math.abs(fieldHueOffset(patch,1,t)-fieldHueOffset(right,0,t))<1e-10);
   assert.ok(Math.abs(fieldHueOffset(patch,t,1)-fieldHueOffset(above,t,0))<1e-10);
   assert.ok(Math.abs(fieldHueOffset(patch,t,.5)-fieldHueOffset(patch,t+.0001,.5))<.01);
  }
 }
 assert.ok(min<-20&&max>20);assert.notDeepEqual(fieldHuePatch(1,0,0),fieldHuePatch(2,0,0));
});
test('hue rotation wraps correctly and preserves saturation/lightness including gray and black',()=>{
 for(const rgb of [[.075,.16,.055],[.36,.285,.105],[.235,.155,.085],[.3,.3,.3],[0,0,0],[.8,.1,.2]]){
  const original=new T.Color().setRGB(...rgb),before=original.getHSL({});
  for(const degrees of [-45,-15,0,15,45]){
   const tint={r:rgb[0],g:rgb[1],b:rgb[2]};assert.equal(shiftGrassHue(tint,degrees),tint);
   const after=new T.Color().setRGB(tint.r,tint.g,tint.b).getHSL({});
   assert.ok(Math.abs(before.s-after.s)<1e-12);assert.ok(Math.abs(before.l-after.l)<1e-12);
   if(before.s>0){const delta=((after.h-before.h-degrees/360+.5)%1+1)%1-.5;assert.ok(Math.abs(delta)<1e-12);}
  }
 }
});
