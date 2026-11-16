import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../../../shared/vendor/three-r180/three.module.js';
import {generateTerrainSunlight,sampleSunlight} from '../terrain-sunlight.mjs';
import {sunlightShader,TerrainSunlight} from '../terrain-sunlight-material.mjs';
import {pineShadowReceiver} from '../pine-shadows.mjs';
import {atmosphereShader,Atmosphere} from '../atmosphere.mjs';
test('sweep shadows a valley behind a ridge, for either dominant axis and direction',()=>{
 for(const xMajor of [true,false])for(const sign of [-1,1]){
  const world={extent:16,height:(x,z)=>Math.abs((xMajor?x:z)-sign*4)<.1?12:0};
  const direction={x:xMajor?sign:0,y:1,z:xMajor?0:sign};
  const map=generateTerrainSunlight(world,{size:33,direction});
  const at=a=>sampleSunlight(map,xMajor?a:0,xMajor?0:a);
  assert.equal(at(sign*8),1);assert.equal(at(0),0);assert.equal(at(-sign*12),1);
  assert.equal(at(sign*4),1);assert.equal(sampleSunlight(map,17,0),1);
  assert.deepEqual(map.visibility,generateTerrainSunlight(world,{size:33,direction}).visibility);
 }
});
test('flat and sun-facing slopes remain lit; oblique sweep and interpolation stay bounded',()=>{
 for(const height of [()=>0,(x,z)=>x*.2+z*.1]){
  const map=generateTerrainSunlight({extent:20,height},{size:65});
  assert.ok(map.visibility.every(v=>v===255));
 }
 const map=generateTerrainSunlight({extent:20,height:(x,z)=>Math.hypot(x,z)<3?20:0},{size:65});
 assert.ok(map.visibility.some(v=>v===0));
 for(let x=-20;x<=20;x+=.3){const light=sampleSunlight(map,x,x);assert.ok(light>=0&&light<=1);}
});
test('Lambert hook composes with pine shadows and atmosphere without attenuating ambient',()=>{
 const map=generateTerrainSunlight({extent:4,height:()=>0},{size:8}),receiver=new TerrainSunlight(map);
 const scene=new T.Scene(),atmosphere=new Atmosphere(scene);
 for(const instanced of [false,true]){
  const shader={uniforms:{},vertexShader:T.ShaderLib.lambert.vertexShader,fragmentShader:T.ShaderLib.lambert.fragmentShader};
  pineShadowReceiver(shader,{value:new T.Vector3()});sunlightShader(shader,instanced?null:receiver.uniforms);atmosphereShader(shader,atmosphere.uniforms);
  assert.match(shader.fragmentShader,/reflectedLight.directDiffuse \*=/);
  assert.doesNotMatch(shader.fragmentShader,/indirectDiffuse \*=/);
  assert.match(shader.fragmentShader,/hikeShadowFade/);assert.match(shader.fragmentShader,/atmosphereAlpha/);
  assert.match(shader.vertexShader,instanced?/vTerrainSunlight=terrainSunlight/:/vTerrainSunXZ=\(modelMatrix/);
 }
 assert.equal(receiver.texture.image.data.byteLength,64);receiver.dispose();atmosphere.dispose();
});
