import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../../../shared/vendor/three-r180/three.module.js';
import {Flora} from '../flora.mjs';
import {generatePines} from '../flora-placement.mjs';
import {PineShadows,pineShadowReceiver,shadowStrength} from '../pine-shadows.mjs';
function fixture(){
 const world={extent:1000,config:{seed:42,trailWidth:5,elevation:100},boundaryHeight:0,maxEarthwork:0,landscape:{heights:new Float32Array([0,100])},height:(x,z)=>50+x*.04+z*.02,normal(x,z,out){return Object.assign(out,{x:0,y:1,z:0,slope:2.56});},trail(x,z,out){out.distance=Math.abs(z);return out;}};
 const scene=new T.Scene(),renderer={shadowMap:{}},sun=new T.DirectionalLight();sun.position.set(-450,650,-150);scene.add(sun);
 const flora=new Flora(scene,generatePines(world,{densityMultiplier:1}),null),terrain={material:new T.MeshLambertMaterial(),mesh:new T.Mesh()};
 const shadows=new PineShadows(scene,renderer,sun,terrain,flora,world);return {shadows,scene,renderer,sun,flora,terrain,world};
}
test('receiver shader fades only shadow occlusion radially from 180 to 200m',()=>{
 assert.equal(shadowStrength(0),1);assert.equal(shadowStrength(180),1);assert.equal(shadowStrength(190),.5);assert.equal(shadowStrength(200),0);assert.equal(shadowStrength(210),0);
 const shader={uniforms:{},vertexShader:T.ShaderLib.lambert.vertexShader,fragmentShader:T.ShaderLib.lambert.fragmentShader},viewer={value:new T.Vector3()};pineShadowReceiver(shader,viewer);
 assert.equal(shader.uniforms.hikeShadowViewer,viewer);assert.match(shader.vertexShader,/instanceMatrix\*hikeShadowPosition/);
 assert.match(shader.fragmentShader,/mix\(1.0,getShadow\( directionalShadowMap/);assert.match(shader.fragmentShader,/smoothstep\(180.0,200.0/);
 assert.match(shader.fragmentShader,/getHemisphereLightIrradiance/);
});
test('shadow pass is off by default; nearby casters stay separate from visible forest',()=>{
 const {shadows:s,flora,renderer,sun}=fixture();s.update(new T.Vector3());assert.equal(s.rebuilds,0);assert.equal(s.group.visible,false);
 s.setEnabled(true);s.update(new T.Vector3(0,52,0));assert.equal(renderer.shadowMap.enabled,true);assert.equal(sun.castShadow,true);assert.deepEqual(sun.shadow.mapSize.toArray(),[2048,2048]);
 assert.ok(s.instanceCount>0&&s.instanceCount<flora.total);assert.ok(s.candidates<flora.total);
 assert.ok(flora.batches.every(m=>!m.castShadow&&m.receiveShadow));
 for(const mesh of s.batches){assert.equal(mesh.geometry.drawRange.count,0);mesh.onBeforeShadow();assert.equal(mesh.geometry.drawRange.count,Infinity);mesh.onAfterShadow();assert.equal(mesh.geometry.drawRange.count,0);}
 const rebuilds=s.rebuilds,matrices=s.batches.map(m=>m.instanceMatrix);renderer.shadowMap.needsUpdate=false;s.update(new T.Vector3(0,100,0));assert.equal(s.rebuilds,rebuilds);assert.equal(renderer.shadowMap.needsUpdate,false);
 s.update(new T.Vector3(10,52,5));assert.equal(s.rebuilds,rebuilds+1);s.batches.forEach((m,i)=>assert.equal(m.instanceMatrix,matrices[i]));
 s.setEnabled(false);assert.equal(renderer.shadowMap.enabled,false);assert.equal(sun.castShadow,false);assert.equal(renderer.shadowMap.needsUpdate,false);s.update(new T.Vector3(500,0,500));assert.equal(s.rebuilds,rebuilds+1);
 s.setEnabled(true);s.update(new T.Vector3(500,0,500));assert.equal(s.rebuilds,rebuilds+2);s.dispose();s.dispose();flora.dispose();
});
test('camera covers 200m receiver cylinder at all elevations with stable light-space texels',()=>{
 const {shadows:s,flora,sun}=fixture();s.setEnabled(true);const viewer=new T.Vector3(-143,80,67);s.update(viewer);sun.shadow.updateMatrices(sun);
 const camera=sun.shadow.camera,projection=new T.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);
 for(const y of [s.minY,s.maxY])for(let i=0;i<32;i++){const a=i*Math.PI/16,p=new T.Vector3(viewer.x+200*Math.cos(a),y,viewer.z+200*Math.sin(a)).applyMatrix4(projection);assert.ok(Math.abs(p.x)<1&&Math.abs(p.y)<1&&Math.abs(p.z)<1);}
 for(const [axis,size] of [[s.right,2*s.halfWidth/2048],[s.up,2*s.halfHeight/2048]]){const texels=s.center.dot(axis)/size;assert.ok(Math.abs(texels-Math.round(texels))<1e-8);}
 assert.ok(s.selectionRadius>200);s.dispose();flora.dispose();
});
