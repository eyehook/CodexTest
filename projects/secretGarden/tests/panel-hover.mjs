import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../../shared/vendor/three-r180/three.module.js';
import {createSettingsPanel} from '../settings-panel.mjs';
import {createVRSettings} from '../vr-settings.mjs';
import {createSavePanel} from '../save-panel.mjs';
import {DEFAULT_SETTINGS} from '../preferences.mjs';
import {Locomotion} from '../../../shared/xr/locomotion.mjs';
test('rapid hover changes upload no canvas textures and panel rows use opaque cutout rendering',()=>{
 const old=globalThis.document;globalThis.document={createElement:()=>({getContext:()=>new Proxy({}, {get:()=>()=>{}})})};
 try{const scene=new THREE.Scene(),settings=createSettingsPanel(scene,{shadowMap:{enabled:true}}),vr=createVRSettings(scene,{...DEFAULT_SETTINGS},new Locomotion(new THREE.Group())),save=createSavePanel(scene,{slots:[null,null,null],errors:[]},{onSave(){},onLoad(){}});
 const controls=[settings.checkbox,settings.beesSlider,settings.resetButton,...vr.controls,...save.controls],versions=controls.map(c=>c.mesh.material.map.version);
 for(let i=0;i<100;i++)for(const panel of [settings,vr,save]){panel.setHover(controls[i%controls.length]);panel.setHover(null);}
 controls.forEach((control,i)=>{assert.equal(control.mesh.material.map.version,versions[i]);assert.equal(control.mesh.material.transparent,false);assert.ok(control.mesh.material.alphaTest>0);});
 const version=settings.beesSlider.texture.version;settings.model.set('bees',5);assert.ok(settings.beesSlider.texture.version>version,'value changes must still redraw');
 assert.equal(vr.group.children.length,vr.controls.length+2,'VR panel has only board, header and controls');
 for(const control of controls){control.setHover(true);const disabled=control.model?.disabled(control.model.definition(control.id));assert.equal(control.mesh.material.color.r,disabled?1:2.2);control.setHover(false);}
 settings.checkbox.setHover(true);assert.ok(settings.checkbox.mesh.material.color.r>=2);settings.checkbox.setHover(false);assert.equal(settings.checkbox.mesh.material.color.r,1);
 }finally{if(old===undefined)delete globalThis.document;else globalThis.document=old;}
});
