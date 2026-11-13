import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../../../shared/vendor/three-r180/three.module.js';
import {Atmosphere,atmosphereAmount} from '../atmosphere.mjs';
import {terrainVertexShader} from '../terrain.mjs';
import {pineFadeShader} from '../flora.mjs';
test('clear-air curve leaves foreground intact, grows smoothly and favors low viewing paths',()=>{
 for(const height of [-30,0,200,600]){
  assert.equal(atmosphereAmount(0,height,height),0);assert.equal(atmosphereAmount(90,height,height),0);
  let previous=0;
  for(let distance=0;distance<=1500;distance+=10){const value=atmosphereAmount(distance,height,height);assert.ok(value>=previous&&value<.6);previous=value;}
 }
 assert.ok(atmosphereAmount(500,20,20)>atmosphereAmount(500,220,220));
 assert.equal(atmosphereAmount(500,20,220),atmosphereAmount(500,220,20));
 assert.ok(atmosphereAmount(91,0,0)<.00001);
});
test('shader integration preserves terrain displacement, pine coverage and existing fog bounds/order',()=>{
 const scene=new T.Scene();scene.fog=new T.Fog(0x9fbac6,650,950);const atmosphere=new Atmosphere(scene);
 for(const variant of ['terrain','pine']){
  const material=new T.MeshLambertMaterial();material.onBeforeCompile=shader=>{
   if(variant==='terrain')terrainVertexShader(shader,{value:new T.Vector2()});
   else pineFadeShader(shader,{value:new T.Vector3()},{value:new T.Vector2(450,500)},{value:.25});
  };
  atmosphere.apply(material);const hook=material.onBeforeCompile;atmosphere.apply(material);assert.equal(material.onBeforeCompile,hook);
  const shader={uniforms:{},vertexShader:T.ShaderLib.lambert.vertexShader,fragmentShader:T.ShaderLib.lambert.fragmentShader};material.onBeforeCompile(shader);
  assert.ok(shader.vertexShader.includes(variant==='terrain'?'transformed.y=terrainHeight':'vPineDistance'));
  assert.ok(shader.fragmentShader.indexOf('gl_FragColor.rgb=mix')>shader.fragmentShader.indexOf('#include <tonemapping_fragment>'));
  assert.ok(shader.fragmentShader.indexOf('float fogFactor')>shader.fragmentShader.indexOf('#include <colorspace_fragment>'));
  assert.ok(shader.fragmentShader.includes('smoothstep( fogNear, fogFar, vFogDepth )'));
  material.dispose();
 }
 assert.equal(scene.fog.near,650);assert.equal(scene.fog.far,950);atmosphere.dispose();
});
test('world-height recovery works for translated, pitched and rolled eye views',()=>{
 for(const rotation of [[0,0,0],[.4,1.2,-.3],[-.7,-2,.5]]){
  const camera=new T.PerspectiveCamera();camera.position.set(123,82,-217);camera.rotation.set(...rotation);camera.updateMatrixWorld();
  const world=new T.Vector3(150,25,20),view=world.clone().applyMatrix4(camera.matrixWorldInverse),m=camera.matrixWorldInverse.elements;
  const recovered=camera.position.y+m[4]*view.x+m[5]*view.y+m[6]*view.z;
  assert.ok(Math.abs(recovered-world.y)<1e-10);
 }
});
test('sky uses current eye projection, ignores translation and releases resources',()=>{
 const scene=new T.Scene(),atmosphere=new Atmosphere(scene),eye=new T.PerspectiveCamera(70,1,.08,1200);
 const draw=()=>atmosphere.mesh.onBeforeRender(null,scene,eye);
 draw();const before=atmosphere.material.uniforms.inverseProjection.value.clone();eye.position.set(100,200,-300);eye.updateMatrixWorld();draw();assert.deepEqual(atmosphere.material.uniforms.inverseProjection.value,before);
 eye.projectionMatrix.elements[8]=.12;eye.projectionMatrixInverse.copy(eye.projectionMatrix).invert();draw();assert.notDeepEqual(atmosphere.material.uniforms.inverseProjection.value,before);assert.ok(atmosphere.material.uniformsNeedUpdate);
 assert.equal(atmosphere.mesh.frustumCulled,false);assert.equal(atmosphere.material.depthWrite,false);atmosphere.dispose();assert.equal(scene.children.length,0);
});
