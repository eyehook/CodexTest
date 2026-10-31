import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../../shared/vendor/three-r180/three.module.js';
import {randomFor} from '../generator.mjs';
import {CloudSky} from '../cloud-sky.mjs';
const options={halfWidth:4.572,halfDepth:6.858,wallHeight:3.048};
test('ten varied clouds move west to east on shallow arcs in thirty minutes',()=>{
 const sky=new CloudSky(new THREE.Scene(),{...options,random:randomFor(8)}),matrix=new THREE.Matrix4();assert.equal(sky.mesh.count,10);assert.equal(sky.cycleSeconds,1800);assert.equal(sky.mesh.castShadow,false);assert.equal(sky.mesh.material.transparent,false);
 for(let i=0;i<10;i++){const c=sky.clouds[i];assert.equal(c.speed*sky.cycleSeconds,sky.wrapDistance*2);sky.elapsed=(.3-c.phase+1)*sky.cycleSeconds;sky.update(0);sky.mesh.getMatrixAt(i,matrix);const west=new THREE.Vector3().setFromMatrixPosition(matrix);sky.elapsed=(.7-c.phase+1)*sky.cycleSeconds;sky.update(0);sky.mesh.getMatrixAt(i,matrix);const east=new THREE.Vector3().setFromMatrixPosition(matrix);assert.ok(east.x>west.x);assert.ok(Math.abs(west.z-east.z)<1e-6);assert.ok(Math.abs(west.y-east.y)<1e-5);}
 const scales=sky.clouds.map(c=>c.scale),heights=sky.clouds.map(c=>c.y);assert.ok(Math.max(...scales)/Math.min(...scales)>=2);assert.ok(Math.max(...heights)-Math.min(...heights)>=16);assert.ok(new Set(sky.clouds.map(c=>c.z)).size>5);sky.dispose();
});
test('recycling occurs only when the entire cloud is beyond the garden and hidden below the wall top',()=>{
 const sky=new CloudSky(new THREE.Scene(),{...options,random:randomFor(41)}),matrix=new THREE.Matrix4(),point=new THREE.Vector3(),positions=sky.mesh.geometry.attributes.position;
 for(let i=0;i<10;i++)for(const phase of [.001,.049,.951,.999]){sky.elapsed=(phase-sky.clouds[i].phase+1)*sky.cycleSeconds;sky.update(0);sky.mesh.getMatrixAt(i,matrix);for(let j=0;j<positions.count;j++){point.fromBufferAttribute(positions,j).applyMatrix4(matrix);assert.ok(point.y<options.wallHeight-.19);assert.ok(phase<.5?point.x<-options.halfWidth:point.x>options.halfWidth);}}
 sky.dispose();
});
test('west-east journeys are time-based and repeat after the 30-minute cycle',()=>{
 const a=new CloudSky(new THREE.Scene(),{...options,random:()=>.5}),b=new CloudSky(new THREE.Scene(),{...options,random:()=>.5});a.update(21);for(let i=0;i<210;i++)b.update(.1);a.mesh.instanceMatrix.array.forEach((v,i)=>assert.ok(Math.abs(v-b.mesh.instanceMatrix.array[i])<1e-5));const before=a.mesh.instanceMatrix.array.slice();a.update(a.cycleSeconds);before.forEach((v,i)=>assert.ok(Math.abs(v-a.mesh.instanceMatrix.array[i])<1e-5));a.dispose();b.dispose();
});
test('staggered journeys leave visible cloud geometry above the garden walls throughout recycling',()=>{
 for(const random of [()=>0,()=>1,randomFor(3),randomFor(8),randomFor(41)]){
  const sky=new CloudSky(new THREE.Scene(),{...options,random}),matrix=new THREE.Matrix4(),point=new THREE.Vector3(),positions=sky.mesh.geometry.attributes.position;
  for(let frame=0;frame<120;frame++){sky.elapsed=frame/120*sky.cycleSeconds;sky.update(0);
   for(const x of [-options.halfWidth+.18,options.halfWidth-.18])for(const z of [-options.halfDepth+.18,options.halfDepth-.18]){let visible=false;
    for(let i=0;i<10&&!visible;i++){sky.mesh.getMatrixAt(i,matrix);for(let j=0;j<positions.count&&!visible;j++){point.fromBufferAttribute(positions,j).applyMatrix4(matrix);const dx=point.x-x,dz=point.z-z,t=Math.min(dx>0?(options.halfWidth-x)/dx:dx<0?(-options.halfWidth-x)/dx:Infinity,dz>0?(options.halfDepth-z)/dz:dz<0?(-options.halfDepth-z)/dz:Infinity);const wallY=1.6+(point.y-1.6)*t;visible=point.distanceTo(new THREE.Vector3(x,1.6,z))<250&&point.y>options.wallHeight&&(t>=1||wallY>options.wallHeight);}}
    assert.ok(visible,'some cloud geometry must remain visible above the walls');
   }
  }sky.dispose();
 }
});
