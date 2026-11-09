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
  assert.ok(panel.targets.includes(panel.soundCheckbox.mesh));assert.ok(panel.soundCheckbox.mesh.position.y<panel.checkbox.mesh.position.y);panel.soundCheckbox.activate();assert.equal(panel.model.value('sound'),false);
  assert.ok(panel.targets.includes(panel.checkbox.mesh));panel.checkbox.activate();assert.equal(renderer.shadowMap.enabled,false);
  assert.ok(panel.targets.includes(panel.beesSlider.mesh));assert.equal(panel.model.value('bees'),3);panel.beesSlider.activate({uv:{x:0}});assert.equal(panel.model.value('bees'),0);panel.beesSlider.drag({uv:{x:1}});assert.equal(panel.model.value('bees'),10);panel.beesSlider.drag({uv:{x:(100+824*.5)/1024}});assert.equal(panel.model.value('bees'),5);
  assert.ok(panel.targets.includes(panel.resetButton.mesh));panel.resetButton.activate();assert.equal(resets,1);assert.equal(renderer.shadowMap.enabled,false);
  panel.group.visible=false;assert.equal(panel.resetButton.activate(),false);assert.equal(resets,1);
  panel.checkbox.dispose();panel.beesSlider.dispose();panel.model.dispose();
 }finally{if(old===undefined)delete globalThis.document;else globalThis.document=old;}
});

test('reset stays disabled after activation until garden contents change',()=>{
 let revision=5,resets=0;const settings=createShadowSettings(new Scene(),{shadowMap:{enabled:true}},{getGardenRevision:()=>revision,onReset:()=>{resets++;revision++;}}),d=settings.model.definition('reset');
 assert.equal(settings.model.label(d),'Reset Garden');assert.equal(settings.model.activate('reset'),true);
 assert.equal(settings.model.label(d),'Garden Reset');assert.equal(settings.model.disabled(d),true);assert.equal(settings.model.activate('reset'),false);assert.equal(resets,1);
 settings.model.activate('shadows');settings.beginFrame(true);assert.equal(settings.model.disabled(d),true);
 revision++;settings.beginFrame(false);assert.equal(settings.model.disabled(d),false);assert.equal(settings.model.label(d),'Reset Garden');assert.equal(settings.model.activate('reset'),true);assert.equal(resets,2);
});
