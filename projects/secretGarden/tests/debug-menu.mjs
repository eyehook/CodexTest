import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../../shared/vendor/three-r180/three.module.js';
import {DebugMenu,leftPalmUp} from '../debug-menu.mjs';
import {DEBUG_PLANT_TYPES,selectPlantSeed} from '../debug-plant-types.mjs';
import {generatePlant} from '../generator.mjs';
import {PlantManager} from '../manager.mjs';
test('type selection enters distinct surface-correct debug mode; seed search matches every type',()=>{
 const manager=new PlantManager({},()=>123456789);for(const type of DEBUG_PLANT_TYPES){manager.chooseType(type.id);assert.equal(manager.clonedSeed,null);assert.equal(manager.debugType,type.id==='random'?null:type.id);if(type.id==='random')continue;const chosen=selectPlantSeed(type.id,()=>123456789);assert.ok(manager.canDebug(type.id==='vine'?'wall':'ground'));assert.equal(manager.canClone(),false);if(type.form){const p=generatePlant(chosen.seed).parameters;assert.equal(p.form,type.form);if(type.treeForm)assert.equal(p.treeForm,type.treeForm);}}
 assert.throws(()=>manager.chooseType('unknown'));manager.chooseType('random');assert.equal(manager.debugType,null);
});
test('left palm detection uses grip +X normal and hysteresis',()=>{
 assert.equal(leftPalmUp(new THREE.Quaternion()),false);assert.equal(leftPalmUp(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),Math.PI/2)),true);const tilted=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),.7);assert.equal(leftPalmUp(tilted,false),false);assert.equal(leftPalmUp(tilted,true),true);
});
test('menu follows palm, selects via ray UV only while visible and avoids hover texture uploads',()=>{
 const old=globalThis.document;globalThis.document={createElement:()=>({getContext:()=>new Proxy({}, {get:()=>()=>{}})})};
 try{const chosen=[],menu=new DebugMenu(new THREE.Scene(),id=>chosen.push(id)),rig=new THREE.Group(),head=new THREE.Vector3(0,1.6,0),pose={transform:{position:new THREE.Vector3(-.25,1,-.4),orientation:new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),Math.PI/2)}};
 menu.update(pose,rig,head);assert.equal(menu.visible,true);const uv={x:.5,y:1-(8+32)/menu.canvas.height};assert.equal(menu.activate({uv}),false);menu.update(pose,rig,head);assert.equal(menu.activate({uv}),true);assert.deepEqual(chosen,['flower']);const version=menu.texture.version;for(let i=0;i<50;i++)menu.setHover(uv);assert.equal(menu.texture.version,version);assert.equal(menu.highlight.visible,true);menu.update(null,rig,head);assert.equal(menu.visible,false);assert.equal(menu.activate({uv}),false);
 }finally{if(old===undefined)delete globalThis.document;else globalThis.document=old;}
});

test('debug mode creates a fresh matching seed for every placement and clone mode remains separate',()=>{
 const renderer={create:()=>({}),update(){},flush(){}},manager=new PlantManager(renderer,()=>99);manager.chooseType('bush');const a=manager.plant(new THREE.Vector3(0,0,0),0),b=manager.plant(new THREE.Vector3(1,0,0),0);assert.notEqual(a.seed,b.seed);assert.equal(a.structure.parameters.form,'bush');assert.equal(b.structure.parameters.form,'bush');assert.equal(manager.debugType,'bush');assert.equal(manager.clonedSeed,null);assert.equal(a.scale,1);
 manager.copy(a.id);assert.equal(manager.debugType,null);const clone=manager.plant(new THREE.Vector3(-1,0,0),0);assert.equal(clone.seed,a.seed);manager.chooseType('pine');assert.equal(manager.clonedSeed,null);manager.copy(null);assert.equal(manager.debugType,null);
});
test('debug mode rejects incompatible surfaces without clearing selection or acquiring a seed',()=>{
 let calls=0;const manager=new PlantManager({},()=>{calls++;return 1;});manager.chooseType('vine');assert.equal(calls,0);assert.equal(manager.plant(new THREE.Vector3(),0),null);assert.equal(manager.debugType,'vine');assert.equal(calls,0);manager.chooseType('random');assert.equal(manager.debugType,null);
});

test('debug menu includes only specific plant types and tree forms',()=>{assert.deepEqual(DEBUG_PLANT_TYPES.map(type=>type.id),['flower','bush','grass','vine','rounded','open','pine','columnar','umbrella']);});
