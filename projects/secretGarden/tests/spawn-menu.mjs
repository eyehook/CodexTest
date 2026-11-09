import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../../shared/vendor/three-r180/three.module.js';
import {SpawnMenu,leftPalmUp} from '../spawn-menu.mjs';
import {SPAWN_PLANT_TYPES,selectPlantSeed} from '../spawn-plant-types.mjs';
import {generatePlant} from '../generator.mjs';
import {PlantManager} from '../manager.mjs';
test('type selection enters distinct surface-correct spawn mode; seed search matches every type',()=>{
 const manager=new PlantManager({},()=>123456789);for(const type of SPAWN_PLANT_TYPES){manager.chooseType(type.id);assert.equal(manager.clonedSeed,null);assert.equal(manager.spawnType,type.id==='random'?null:type.id);if(type.id==='random')continue;const chosen=selectPlantSeed(type.id,()=>123456789);assert.ok(manager.canSpawn(type.id==='vine'?'wall':'ground'));assert.equal(manager.canClone(),false);if(type.form){const p=generatePlant(chosen.seed).parameters;assert.equal(p.form,type.form);if(type.treeForm)assert.equal(p.treeForm,type.treeForm);}}
 assert.throws(()=>manager.chooseType('unknown'));manager.chooseType('random');assert.equal(manager.spawnType,null);
});
test('left palm detection uses grip +X normal and hysteresis',()=>{
 assert.equal(leftPalmUp(new THREE.Quaternion()),false);assert.equal(leftPalmUp(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),Math.PI/2)),true);const tilted=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),.7);assert.equal(leftPalmUp(tilted,false),false);assert.equal(leftPalmUp(tilted,true),true);
});
test('menu follows palm, selects via ray UV only while visible and avoids hover texture uploads',()=>{
 const old=globalThis.document;globalThis.document={createElement:()=>({getContext:()=>new Proxy({}, {get:()=>()=>{}})})};
 try{const chosen=[],menu=new SpawnMenu(new THREE.Scene(),id=>chosen.push(id)),rig=new THREE.Group(),head=new THREE.Vector3(0,1.6,0),pose={transform:{position:new THREE.Vector3(-.25,1,-.4),orientation:new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),Math.PI/2)}};
 menu.update(pose,rig,head);assert.equal(menu.visible,true);const uv={x:.5,y:1-(8+32)/menu.canvas.height};assert.equal(menu.activate({uv}),false);menu.update(pose,rig,head);assert.equal(menu.activate({uv}),true);assert.deepEqual(chosen,['flower']);const version=menu.texture.version;for(let i=0;i<50;i++)menu.setHover(uv);assert.equal(menu.texture.version,version);assert.equal(menu.highlight.visible,true);menu.update(null,rig,head);assert.equal(menu.visible,false);assert.equal(menu.activate({uv}),false);
 }finally{if(old===undefined)delete globalThis.document;else globalThis.document=old;}
});

test('spawn mode creates a fresh matching seed for every placement and clone mode remains separate',()=>{
 const renderer={create:()=>({}),update(){},flush(){}},manager=new PlantManager(renderer,()=>99);manager.chooseType('bush');const a=manager.plant(new THREE.Vector3(0,0,0),0),b=manager.plant(new THREE.Vector3(1,0,0),0);assert.notEqual(a.seed,b.seed);assert.equal(a.structure.parameters.form,'bush');assert.equal(b.structure.parameters.form,'bush');assert.equal(manager.spawnType,'bush');assert.equal(manager.clonedSeed,null);assert.equal(a.scale,1);
 manager.copy(a.id);assert.equal(manager.spawnType,null);const clone=manager.plant(new THREE.Vector3(-1,0,0),0);assert.equal(clone.seed,a.seed);manager.chooseType('pine');assert.equal(manager.clonedSeed,null);manager.copy(null);assert.equal(manager.spawnType,null);
});
test('spawn mode rejects incompatible surfaces without clearing selection or acquiring a seed',()=>{
 let calls=0;const manager=new PlantManager({},()=>{calls++;return 1;});manager.chooseType('vine');assert.equal(calls,0);assert.equal(manager.plant(new THREE.Vector3(),0),null);assert.equal(manager.spawnType,'vine');assert.equal(calls,0);manager.chooseType('random');assert.equal(manager.spawnType,null);
});

test('spawn menu includes only specific plant types and tree forms',()=>{assert.deepEqual(SPAWN_PLANT_TYPES.map(type=>type.id),['flower','bush','grass','seed-grass','fern','rosette','vine','bolete','fly-agaric','chanterelle','rounded','pine','columnar','umbrella']);});

test('Trees submenu resizes with a fixed lower edge and returns without spawning',()=>{
 const old=globalThis.document;globalThis.document={createElement:()=>({getContext:()=>new Proxy({}, {get:()=>()=>{}})})};
 try{
  const chosen=[],menu=new SpawnMenu(new THREE.Scene(),id=>chosen.push(id));menu.group.visible=true;
  const click=i=>menu.activate({uv:{x:.5,y:1-(8+i*64+32)/menu.canvas.height}});
  const lower=()=>menu.group.position.clone().add(new THREE.Vector3(0,-menu.height/2,0).applyQuaternion(menu.group.quaternion));
  const before=lower();assert.equal(menu.rows.at(-1).label,'Trees');assert.ok(click(menu.rows.length-1));
  assert.deepEqual(menu.rows.map(r=>r.label),['Rounded','Pine','Cypress','Umbrella','< Back']);assert.ok(lower().distanceTo(before)<1e-9);assert.deepEqual(chosen,[]);
  assert.ok(click(1));assert.deepEqual(chosen,['pine']);assert.equal(menu.selected,'pine');
  assert.ok(click(menu.rows.length-1));assert.equal(menu.rows.at(-1).label,'Trees');assert.equal(menu.path.length,0);assert.ok(lower().distanceTo(before)<1e-9);assert.deepEqual(chosen,['pine']);
 }finally{if(old===undefined)delete globalThis.document;else globalThis.document=old;}
});
test('generic submenus support multiple levels and navigate back one level at a time',()=>{
 const old=globalThis.document;globalThis.document={createElement:()=>({getContext:()=>new Proxy({}, {get:()=>()=>{}})})};
 try{
  const chosen=[],menu=new SpawnMenu(new THREE.Scene(),id=>chosen.push(id),[{label:'Group',children:[{label:'Nested',children:[{id:'fern',label:'Ferns'}]}]}]);menu.group.visible=true;
  const click=i=>menu.activate({uv:{x:.5,y:1-(8+i*64+32)/menu.canvas.height}});
  click(0);click(0);assert.equal(menu.path.length,2);assert.equal(menu.rows.at(-1).label,'< Back');click(0);assert.deepEqual(chosen,['fern']);
  click(menu.rows.length-1);assert.equal(menu.path.length,1);assert.equal(menu.rows[0].label,'Nested');assert.equal(menu.rows.at(-1).label,'< Back');click(menu.rows.length-1);assert.equal(menu.path.length,0);assert.equal(menu.rows[0].label,'Group');
 }finally{if(old===undefined)delete globalThis.document;else globalThis.document=old;}
});
