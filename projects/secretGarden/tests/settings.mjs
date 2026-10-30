import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Scene,Mesh,BoxGeometry,MeshStandardMaterial} from '../../../shared/vendor/three-r180/three.module.js';
import {createShadowSettings,createSettingsPanel} from '../settings-panel.mjs';
import {ROOM_BACK} from '../garden-layout.mjs';
test('global shadows stay off through scene changes; enabling refreshes a static map once',()=>{
 const scene=new Scene(),material=new MeshStandardMaterial();scene.add(new Mesh(new BoxGeometry(),material));
 const renderer={shadowMap:{enabled:true}},settings=createShadowSettings(scene,renderer);
 settings.beginFrame(false);assert.equal(renderer.shadowMap.needsUpdate,true);
 settings.beginFrame(false);assert.equal(renderer.shadowMap.needsUpdate,false);
 const version=material.version;settings.model.activate('shadows');assert.equal(renderer.shadowMap.enabled,false);assert.ok(material.version>version);
 settings.beginFrame(true);assert.equal(renderer.shadowMap.needsUpdate,false);
 settings.model.activate('shadows');assert.equal(renderer.shadowMap.enabled,true);
 settings.beginFrame(false);assert.equal(renderer.shadowMap.needsUpdate,true);
 settings.beginFrame(false);assert.equal(renderer.shadowMap.needsUpdate,false);
 settings.beginFrame(true);assert.equal(renderer.shadowMap.needsUpdate,true);
});
test('panel faces into the room from the wall opposite the door and shares its model',()=>{
 const old=globalThis.document;globalThis.document={createElement:()=>({getContext:()=>new Proxy({}, {get:()=>()=>{}})})};
 try{
  let resets=0;const scene=new Scene(),renderer={shadowMap:{enabled:true}},panel=createSettingsPanel(scene,renderer,{onReset:()=>resets++});
  assert.equal(panel.group.position.z,ROOM_BACK-.075);assert.equal(panel.group.rotation.y,Math.PI);
  assert.ok(panel.targets.includes(panel.checkbox.mesh));panel.checkbox.activate();assert.equal(renderer.shadowMap.enabled,false);
  assert.ok(panel.targets.includes(panel.resetButton.mesh));panel.resetButton.activate();assert.equal(resets,1);assert.equal(renderer.shadowMap.enabled,false);
  panel.group.visible=false;assert.equal(panel.resetButton.activate(),false);assert.equal(resets,1);
  panel.checkbox.dispose();panel.model.dispose();
 }finally{if(old===undefined)delete globalThis.document;else globalThis.document=old;}
});
