import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../../shared/vendor/three-r180/three.module.js';
import {Preferences,SETTINGS_KEY,DEFAULT_SETTINGS} from '../preferences.mjs';
import {GardenSaves,SAVE_PREFIX} from '../garden-saves.mjs';
import {createVRSettings,applyHeightOffset} from '../vr-settings.mjs';
import {Locomotion} from '../../../shared/xr/locomotion.mjs';
import {ROOM_SIZE} from '../garden-layout.mjs';
const disk=()=>{const map=new Map();return {map,getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};};
test('preferences persist independently and old garden settings are discarded',()=>{
 const d=disk();d.setItem(SAVE_PREFIX+1,JSON.stringify({version:1,savedAt:2,plants:[],shadows:false,bees:1}));
 const gardens=new GardenSaves(d),prefs=new Preferences(d);assert.equal(gardens.slots[1],null);assert.equal(d.getItem(SAVE_PREFIX+1),null);assert.equal(prefs.value.bees,2);
 prefs.save({...prefs.value,...{shadows:false,bees:1,heightOffset:.5,moveSpeed:2,turnSpeed:90}});
 gardens.save(0,{plants:[],shadows:true,bees:3});assert.deepEqual(Object.keys(JSON.parse(d.getItem(SAVE_PREFIX+0))).sort(),['plants','savedAt','version']);assert.equal(new Preferences(d).value.heightOffset,.5);assert.equal(new Preferences(d).value.bees,1);
 const before=d.getItem(SETTINGS_KEY);d.setItem=()=>{throw Error('quota');};assert.throws(()=>prefs.save({...prefs.value,bees:3}));assert.equal(d.getItem(SETTINGS_KEY),before);
});
test('invalid and blocked settings storage use defaults without breaking startup',()=>{
 const d=disk();d.setItem(SETTINGS_KEY,'{');const prefs=new Preferences(d);assert.equal(prefs.error,true);assert.deepEqual(prefs.value,DEFAULT_SETTINGS);
 assert.deepEqual(new Preferences({getItem(){throw Error('blocked');}}).value,DEFAULT_SETTINGS);
 assert.throws(()=>prefs.save({...prefs.value,heightOffset:Infinity}));
});
test('right-wall sliders quantize, apply shared locomotion speeds, and offset only the tracked VR rig',()=>{
 const old=globalThis.document;globalThis.document={createElement:()=>({getContext:()=>new Proxy({}, {get:()=>()=>{}})})};
 try{const rig=new THREE.Group(),tracked=new THREE.PerspectiveCamera();rig.add(tracked);tracked.position.y=1;const values={...DEFAULT_SETTINGS,teleport:false,snapTurn:false},nav=new Locomotion(rig),panel=createVRSettings(new THREE.Scene(),values,nav);
 assert.equal(panel.group.position.x,-ROOM_SIZE/2+.075);assert.equal(panel.group.rotation.y,Math.PI/2);
 panel.controls[0].activate({uv:{x:.5}});assert.equal(values.heightOffset,.5);panel.model.set('moveSpeed',2);panel.model.set('turnSpeed',90);assert.equal(nav.settings.moveSpeed,2);assert.equal(nav.settings.turnSpeed,Math.PI/2);
 applyHeightOffset(rig,values,true);rig.updateMatrixWorld(true);assert.equal(tracked.getWorldPosition(new THREE.Vector3()).y,1.5);assert.equal(tracked.position.y,1);
 applyHeightOffset(rig,values,false);assert.equal(rig.position.y,0);
 panel.group.visible=false;assert.equal(panel.controls[0].activate({uv:{x:1}}),false);
 }finally{if(old===undefined)delete globalThis.document;else globalThis.document=old;}
});

test('mismatched settings versions are deleted and use defaults',()=>{
 for(const version of [0,1,2,4]){const d=disk();d.setItem(SETTINGS_KEY,JSON.stringify({version,...DEFAULT_SETTINGS,bees:1}));const prefs=new Preferences(d);assert.deepEqual(prefs.value,DEFAULT_SETTINGS);assert.equal(prefs.exists,false);assert.equal(prefs.error,false);assert.equal(d.getItem(SETTINGS_KEY),null);}
});

test('snap checkbox swaps the turn slider and defaults to 30 degrees',()=>{
 const old=globalThis.document;globalThis.document={createElement:()=>({getContext:()=>new Proxy({}, {get:()=>()=>{}})})};
 try{const values={...DEFAULT_SETTINGS,teleport:false,snapTurn:false},panel=createVRSettings(new THREE.Scene(),values,new Locomotion(new THREE.Group()));
 assert.equal(values.snapAngle,30);assert.equal(values.snapTurn,false);assert.ok(panel.targets.includes(panel.controls[2].mesh));panel.controls[4].activate();assert.equal(values.snapTurn,true);assert.equal(panel.controls[2].mesh.visible,false);assert.equal(panel.controls[3].mesh.visible,true);assert.ok(!panel.targets.includes(panel.controls[2].mesh));
 for(const [x,angle] of [[0,15],[.5,30],[1,45]]){panel.controls[3].activate({uv:{x}});assert.equal(values.snapAngle,angle);}
 assert.equal(panel.model.set('turnSpeed',90),false);panel.controls[4].activate();assert.equal(panel.model.value('turnSpeed'),45);
 }finally{if(old===undefined)delete globalThis.document;else globalThis.document=old;}
});

test('Teleport checkbox disables movement speed without changing its saved value',()=>{
 const old=globalThis.document;globalThis.document={createElement:()=>({getContext:()=>new Proxy({}, {get:()=>()=>{}})})};
 try{const values={...DEFAULT_SETTINGS,teleport:false,snapTurn:false},panel=createVRSettings(new THREE.Scene(),values,new Locomotion(new THREE.Group()));
 const checkbox=panel.controls.find(c=>c.id==='teleport');assert.ok(checkbox.mesh.position.y>panel.controls[1].mesh.position.y);assert.equal(values.teleport,false);panel.model.set('moveSpeed',2);checkbox.activate();assert.equal(values.teleport,true);assert.equal(panel.model.disabled(panel.model.definition('moveSpeed')),true);assert.equal(panel.controls[1].activate({uv:{x:1}}),false);assert.equal(values.moveSpeed,2);checkbox.activate();assert.equal(panel.model.disabled(panel.model.definition('moveSpeed')),false);assert.equal(values.moveSpeed,2);
 }finally{if(old===undefined)delete globalThis.document;else globalThis.document=old;}
});

test('fresh VR defaults enable teleport and 30-degree snap turning while saved choices remain authoritative',()=>{
 const d=disk(),prefs=new Preferences(d);assert.equal(prefs.value.teleport,true);assert.equal(prefs.value.snapTurn,true);assert.equal(prefs.value.snapAngle,30);prefs.save({...prefs.value,teleport:false,snapTurn:false});const saved=new Preferences(d);assert.equal(saved.value.teleport,false);assert.equal(saved.value.snapTurn,false);
});
