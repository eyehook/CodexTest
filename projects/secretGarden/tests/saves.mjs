import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../../shared/vendor/three-r180/three.module.js';
import {GardenSaves,SAVE_PREFIX,validateSave} from '../garden-saves.mjs';
import {createSavePanel} from '../save-panel.mjs';
import {PlantManager} from '../manager.mjs';
import {PlantRenderer} from '../renderer.mjs';
import {createEnvironment} from '../environment.mjs';
import {ROOM_SIZE,ROOM_FRONT,ROOM_BACK} from '../garden-layout.mjs';
const data=()=>({plants:[]});
function storage(){const map=new Map();return {map,getItem:key=>map.get(key)??null,setItem:(key,value)=>map.set(key,value),removeItem:key=>map.delete(key)};}
test('three persistent slots, latest save ordering and overwrite failures preserve saved data',()=>{
 const disk=storage(),s=new GardenSaves(disk);assert.deepEqual(s.slots,[null,null,null]);assert.equal(s.latest(),null);
 s.save(2,data());s.save(0,data());assert.equal(s.latest().index,0);assert.equal(new GardenSaves(disk).latest().save.version,2);
 s.save(2,data());assert.equal(new GardenSaves(disk).latest().index,2);
 const before=s.slots[2];disk.setItem=()=>{throw Error('Quota exceeded');};assert.throws(()=>s.save(2,data()));assert.equal(s.slots[2],before);
});
test('corrupt or inaccessible slots fail safely without losing other saves',()=>{
 const disk=storage(),s=new GardenSaves(disk);s.save(1,data());disk.map.set(SAVE_PREFIX+0,'{');disk.map.set(SAVE_PREFIX+2,JSON.stringify({...data(),version:2,savedAt:1,plants:[{seed:1}]}));
 const loaded=new GardenSaves(disk);assert.deepEqual(loaded.errors,[0,2]);assert.equal(loaded.latest().index,1);
 assert.deepEqual(new GardenSaves({getItem(){throw Error('blocked');}}).errors,[0,1,2]);
 assert.throws(()=>validateSave({...data(),version:3,savedAt:1}));
});
test('snapshot restores seeds, clone transforms, corner vines, mature batching and partial growth',()=>{
 const scene=new THREE.Scene(),r=new PlantRenderer(scene),env=createEnvironment(scene,{shadowMap:{}}),manager=new PlantManager(r,()=>29,()=>.8,()=>1.2);
 const first=manager.plant(new THREE.Vector3(1,0,-2),0);manager.copy(first.id);manager.plant(new THREE.Vector3(-1,0,-1),7);
 const wall=env.walls[1].userData.wallSurface;manager.plant(new THREE.Vector3(-4.572,1,1),0,wall);manager.update(10);
 const records=JSON.parse(JSON.stringify(manager.snapshot(10))),structures=[...manager.instances.values()].map(p=>p.structure);validateSave({...data(),version:2,savedAt:1,plants:records});
 manager.restore(records,100,env.walls.map(w=>w.userData.wallSurface));assert.equal(manager.instances.size,3);assert.equal(manager.growing.size,1);assert.equal(manager.clonedSeed,null);
 const restored=[...manager.instances.values()];restored.forEach((p,i)=>{assert.deepEqual(p.structure,structures[i]);assert.deepEqual(p.position.toArray(),records[i].position);assert.equal(p.scale,records[i].scale);assert.equal(p.rotationY,records[i].rotationY);});
 assert.equal(restored[0].state,'mature');assert.ok(restored[0].visual.matureSlots);assert.equal(restored[1].born,97);assert.equal(restored[2].support.id,wall.id);
 const before=manager.instances;assert.throws(()=>manager.restore(records,110,[]));assert.equal(manager.instances,before);assert.equal(manager.instances.size,3);manager.reset();r.dispose();
});
test('save panel is on the left when facing settings; Empty loads reject activation and save/load route slots',()=>{
 const old=globalThis.document;globalThis.document={createElement:()=>({getContext:()=>new Proxy({}, {get:()=>()=>{}})})};
 try{const s=new GardenSaves(storage()),calls=[],panel=createSavePanel(new THREE.Scene(),s,{onSave:i=>{calls.push('save'+i);s.save(i,data());},onLoad:i=>calls.push('load'+i)});
 assert.equal(panel.group.position.x,ROOM_SIZE/2-.075);assert.equal(panel.group.position.z,(ROOM_FRONT+ROOM_BACK)/2);assert.equal(panel.group.rotation.y,-Math.PI/2);
 assert.equal(panel.controls[1].activate({uv:{x:.86,y:.5}}),false);panel.controls[1].activate({uv:{x:.64,y:.5}});panel.controls[1].activate({uv:{x:.86,y:.5}});assert.deepEqual(calls,['save1','load1']);
 panel.group.visible=false;assert.equal(panel.controls[1].activate({uv:{x:.64,y:.5}}),false);
 }finally{if(old===undefined)delete globalThis.document;else globalThis.document=old;}
});

test('mismatched garden versions are deleted and become Empty; current slots remain',()=>{
 const d=storage();for(const [i,version] of [[0,1],[1,999]])d.setItem(SAVE_PREFIX+i,JSON.stringify({version,savedAt:1,plants:[]}));
 const current=new GardenSaves(d);current.save(2,data());const loaded=new GardenSaves(d);assert.deepEqual(loaded.errors,[]);assert.equal(loaded.slots[0],null);assert.equal(loaded.slots[1],null);assert.equal(d.getItem(SAVE_PREFIX+0),null);assert.equal(d.getItem(SAVE_PREFIX+1),null);assert.equal(loaded.latest().index,2);
});
