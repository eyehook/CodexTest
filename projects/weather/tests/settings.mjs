import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../forest/vendor/three.module.js';
import { SettingsStore } from '../src/settings.js';
import { WeatherModes } from '../src/weather-modes.js';
import { weatherDefinitions } from '../src/weather-catalog.js';
import { VRControlPanel } from '../src/controls.js';
function memory(){const data=new Map();return {getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value)};}
test('explicit save restores selected weather and all per-mode controls, including toggles, on new session',()=>{
 const storage=memory(),store=new SettingsStore(()=>storage);assert.equal(store.load(),null);
 const a=new WeatherModes(new THREE.Scene(),weatherDefinitions);const snow=a.select('snow');snow.parameters.set('size',7);snow.parameters.set('count',12345);const rain=a.select('rain');rain.parameters.set('wind',-4);rain.parameters.set('splashes',0);rain.parameters.set('rippleProbability',55);rain.parameters.set('trailDuration',28);
 assert.equal(store.save(a.snapshot()),true);rain.parameters.set('wind',3); // Unsaved edits must not modify the stored snapshot.
 const b=new WeatherModes(new THREE.Scene(),weatherDefinitions),snapshot=store.load();const active=b.restore(snapshot);assert.equal(active,'rain');assert.equal(b.states.size,0);
 const restored=b.select(active);assert.equal(restored.parameters.values.wind,-4);assert.equal(restored.parameters.values.splashes,0);assert.equal(restored.parameters.values.rippleProbability,55);assert.equal(restored.parameters.values.trailDuration,28);
 const restoredSnow=b.select('snow');assert.equal(restoredSnow.parameters.values.size,7);assert.equal(restoredSnow.parameters.values.count,12345);a.dispose();b.dispose();
});
test('restoration clamps known values, ignores invalid/unknown values, and handles future defaults lazily',()=>{
 const modes=new WeatherModes(new THREE.Scene(),weatherDefinitions);assert.equal(modes.restore({activeMode:'removed',modes:{snow:{size:500,count:-5,wind:'bad',turbulence:null,unknown:123},rain:{wind:2}}}),'snow');
 const s=modes.select('snow');assert.equal(s.parameters.values.size,10);assert.equal(s.parameters.values.count,0);assert.equal(s.parameters.values.wind,0);assert.equal(s.parameters.values.turbulence,20);assert.equal(s.parameters.values.unknown,undefined);
 const snapshot=modes.snapshot();assert.equal(snapshot.modes.rain.wind,2);const r=modes.select('rain');assert.equal(r.parameters.values.count,2000);assert.equal(r.parameters.values.wind,2);assert.equal(r.parameters.values.groundEffects,1);modes.dispose();
});
test('corrupt, unsupported or inaccessible storage falls back without crashing; failed writes report failure',()=>{
 for(const text of ['bad','null','{}','{"version":2,"activeMode":"snow","modes":{}}','{"version":1,"activeMode":"snow","modes":[]}'])assert.equal(new SettingsStore(()=>({getItem:()=>text})).load(),null);
 const blocked=new SettingsStore(()=>{throw Error('blocked');});assert.equal(blocked.load(),null);assert.equal(blocked.save({}),false);
 assert.equal(new SettingsStore(()=>({setItem(){throw Error('quota');}})).save({}),false);
});
globalThis.document={createElement:()=>({getContext:()=>new Proxy({},{get:()=>()=>{}})})};
test('VR save button works once per trigger press and reports success/failure without moving panel',()=>{
 const scene=new THREE.Scene(),modes=new WeatherModes(scene,weatherDefinitions),snow=modes.select('snow');const controller=new THREE.Group(),view=new THREE.PerspectiveCamera();view.position.y=1.7;scene.add(controller,view);
 let saves=0,success=true;const panel=new VRControlPanel(scene,{controllers:[controller],getWorldPose(p,d){view.getWorldPosition(p);view.getWorldDirection(d);}},snow.parameters,{modes:weatherDefinitions,onSave:()=>{saves++;return success;}});panel.toggle();const position=panel.mesh.position.clone();
 const source={gamepad:{buttons:[{pressed:true}]}};controller.userData.inputSource=source;controller.position.copy(view.position);
 const target=new THREE.Vector3((750/1024-.5)*.9,(.5-(panel.canvas.height-90)/panel.canvas.height)*(.9*panel.canvas.height/1024),0).applyMatrix4(panel.mesh.matrixWorld);controller.lookAt(target);controller.rotateY(Math.PI);scene.updateMatrixWorld(true);
 panel.update({inputSources:[source]});assert.equal(saves,1);assert.equal(panel.saveMessage,'Settings saved');panel.update({inputSources:[source]});assert.equal(saves,1);assert.ok(panel.mesh.position.equals(position));
 source.gamepad.buttons[0].pressed=false;panel.update({inputSources:[source]});success=false;source.gamepad.buttons[0].pressed=true;panel.update({inputSources:[source]});assert.equal(saves,2);assert.equal(panel.saveMessage,'Save failed');panel.dispose();modes.dispose();
});

test('save status starts idle per weather mode, resets on real edits and is excluded from saved data',()=>{
 const modes=new WeatherModes(new THREE.Scene(),weatherDefinitions),snow=modes.select('snow');assert.equal(snow.saveStatus,'idle');snow.saveStatus='saved';const rain=modes.select('rain');assert.equal(rain.saveStatus,'idle');rain.saveStatus='saved';
 rain.parameters.set('wind',2);assert.equal(rain.saveStatus,'idle');assert.equal(modes.select('snow').saveStatus,'saved');snow.parameters.set('size',2);assert.equal(snow.saveStatus,'idle');snow.saveStatus='saved';snow.parameters.set('size',2);assert.equal(snow.saveStatus,'saved');
 const snapshot=modes.snapshot();assert.equal(snapshot.modes.snow.saveStatus,undefined);const next=new WeatherModes(new THREE.Scene(),weatherDefinitions);next.restore(snapshot);assert.equal(next.select('snow').saveStatus,'idle');assert.equal(next.select('rain').saveStatus,'idle');modes.dispose();next.dispose();
});
test('VR save confirmation clears after parameter edits and when rebinding another weather mode',()=>{
 const scene=new THREE.Scene(),modes=new WeatherModes(scene,weatherDefinitions),snow=modes.select('snow');const panel=new VRControlPanel(scene,{controllers:[],getWorldPose(){}},snow.parameters,{onSave:()=>true});
 panel.setSaveResult(true);assert.equal(panel.saveMessage,'Settings saved');snow.parameters.set('wind',1);assert.equal(panel.saveMessage,'Save settings');panel.setSaveResult(true);panel.setEffect(modes.select('rain').parameters,'rain');assert.equal(panel.saveMessage,'Save settings');panel.setSaveResult(null);assert.equal(panel.saveMessage,'Save settings');panel.dispose();modes.dispose();
});
