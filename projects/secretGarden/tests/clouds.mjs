import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../../shared/vendor/three-r180/three.module.js';
import {CloudSky} from '../cloud-sky.mjs';
test('clouds are eight times larger and their arc stays overhead',()=>{
 const sky=new CloudSky(new THREE.Scene(),{halfWidth:4.572,halfDepth:6.858,viewDistance:250});
 assert.deepEqual(sky.clouds.map(c=>c.scale),[1.05,.85,1.2,.95,1.1].map(s=>s*8));
 const c=sky.clouds[2],m=new THREE.Matrix4();
 sky.update(0);sky.mesh.getMatrixAt(2,m);const top=m.elements[13];
 sky.elapsed=sky.wrapDistance*.8/c.speed;sky.update(0);sky.mesh.getMatrixAt(2,m);
 assert.ok(top>m.elements[13]);assert.ok(m.elements[13]>30);assert.ok(sky.arcBend>0);
 assert.equal(sky.mesh.material.transparent,false);assert.equal(sky.mesh.castShadow,false);sky.dispose();
});
test('recycling endpoints fully clear every garden corner and scale with garden size',()=>{
 const small=new CloudSky(new THREE.Scene(),{halfWidth:4,halfDepth:6,viewDistance:250});
 const large=new CloudSky(new THREE.Scene(),{halfWidth:20,halfDepth:30,viewDistance:250});
 assert.ok(large.wrapDistance>small.wrapDistance);
 for(const [sky,w,d] of [[small,4,6],[large,20,30]]){
  for(const sign of [-1,1])for(const x of [-w,w])for(const z of [-d,d]){
   const nearest=Math.hypot(sign*sky.wrapDistance-x,z)-sky.cloudReach;
   assert.ok(nearest>sky.visibilityRadius);
  }
  sky.update(1e7);
  const m=new THREE.Matrix4();for(let i=0;i<sky.mesh.count;i++){sky.mesh.getMatrixAt(i,m);assert.ok(Math.abs(m.elements[12])<=sky.wrapDistance);}
  sky.dispose();
 }
});
test('cloud arc motion is time based and independent of update frequency',()=>{
 const a=new CloudSky(new THREE.Scene(),{halfWidth:4,halfDepth:6}),b=new CloudSky(new THREE.Scene(),{halfWidth:4,halfDepth:6});
 a.update(60);for(let i=0;i<600;i++)b.update(.1);
 a.mesh.instanceMatrix.array.forEach((v,i)=>assert.ok(Math.abs(v-b.mesh.instanceMatrix.array[i])<1e-5));a.dispose();b.dispose();
});
