import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../../../shared/vendor/three-r180/three.module.js';
import {SettingsMenu,loadSettings,saveSettings} from '../settings-menu.mjs';
import {ControlModel} from '../../../shared/ui/controls.mjs';
import {placeAtEndpoint} from '../teleport.mjs';
import {applyHeightOffset} from '../height-offset.mjs';
import {FlightView} from '../flight-view.mjs';
import {FlightButtons} from '../flight-input.mjs';
test('settings validate and persist sound, shadows and seated height offset',()=>{
 const storage={value:null,getItem(){return this.value;},setItem(k,v){this.value=v;}};
 assert.deepEqual(loadSettings(storage),{shadows:false,heightOffset:0,sound:true});
 storage.value='{broken';assert.equal(loadSettings(storage).shadows,false);
 storage.value='{"shadows":"true"}';assert.equal(loadSettings(storage).shadows,false);
 saveSettings(storage,{shadows:true,heightOffset:1.25,sound:false});assert.deepEqual(loadSettings(storage),{shadows:true,heightOffset:1.25,sound:false});
 storage.value=JSON.stringify({shadows:true});assert.equal(loadSettings(storage).sound,true);storage.value=JSON.stringify({sound:"false"});assert.equal(loadSettings(storage).sound,true);
 storage.value=JSON.stringify({heightOffset:9});assert.equal(loadSettings(storage).heightOffset,1.5);storage.value=JSON.stringify({heightOffset:-1});assert.equal(loadSettings(storage).heightOffset,0);storage.value=JSON.stringify({heightOffset:'1'});assert.equal(loadSettings(storage).heightOffset,0);
});
test('Y and B open settings and absorbs held/reconnected buttons',()=>{
 const left={handedness:'left',targetRaySpace:{},gamepad:{mapping:'xr-standard',buttons:Array.from({length:6},()=>({pressed:false}))}};
 const right={...left,handedness:'right',gamepad:{mapping:'xr-standard',buttons:Array.from({length:6},()=>({pressed:false}))}};
 const buttons=new FlightButtons(),state={resumed:false,isTracked:()=>true};
 buttons.update([left,right],state);left.gamepad.buttons[5].pressed=true;
 assert.equal(buttons.update([left,right],state).settings,true);
 assert.equal(buttons.update([left,right],state).settings,false);
 right.gamepad.buttons[5].pressed=true;assert.equal(buttons.update([left,right],state).settings,true);
 buttons.reset();assert.equal(buttons.update([left,right],state).settings,false);
});
test('black settings scene preserves rig, restores world and saves only on exit',()=>{
 const oldDocument=globalThis.document,oldStorage=globalThis.localStorage;
 const ctx=new Proxy({}, {get:(o,k)=>o[k]??(()=>{}),set:(o,k,v)=>(o[k]=v,true)});
 globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>ctx})};
 globalThis.localStorage={value:null,getItem(){return this.value;},setItem(k,v){this.value=v;}};
 try{
  const scene=new T.Scene(),rig=new T.Group(),world=new T.Group(),hidden=new T.Group();hidden.visible=false;
  scene.add(rig,world,hidden);scene.background=new T.Color('skyblue');scene.fog=new T.Fog('skyblue',1,10);
  const background=scene.background,fog=scene.fog,controllers=[new T.Group(),new T.Group()];controllers.forEach(c=>rig.add(c));
  const teleports=[];
  const debugModel=new ControlModel(Array.from({length:18},(_,i)=>({id:`stat${i}`,kind:'readout',label:`Stat ${i}`,get:()=>i})));
  const menu=new SettingsMenu(scene,rig,{},controllers,{debugModel,onTeleport:id=>teleports.push(id)});
  menu.show(new T.Vector3(5,2,3),new T.Quaternion());
  assert.equal(scene.background.getHex(),0);assert.equal(scene.fog,null);assert.equal(world.visible,false);assert.equal(rig.visible,true);assert.equal(menu.panel.mesh.visible,true);
  menu.model.activate('shadows');assert.equal(globalThis.localStorage.value,null);
  menu.panel.activate(menu.panel.hitAt(970,303));assert.equal(menu.draft.sound,false);assert.equal(menu.saved.sound,true);assert.equal(globalThis.localStorage.value,null);
  menu.panel.activate(menu.panel.hitAt(970,216));assert.equal(menu.draft.heightOffset,1.5);menu.panel.activate(menu.panel.hitAt(625,216));assert.equal(menu.draft.heightOffset,.75);menu.panel.activate(menu.panel.hitAt(280,216));assert.equal(menu.draft.heightOffset,0);
  menu.model.set('heightOffset',1.25);
  // Exercise real ray-to-tab mapping with a controller at the viewer position.
  const controller=controllers[0],panel=menu.panel;
  controller.position.set(5,2,3);
  const source={gamepad:{buttons:[{pressed:true}]}};controller.userData.source=source;panel.controllerStates.get(controller).connected=true;
  const aim=(x,y)=>{const target=panel.mesh.localToWorld(new T.Vector3((x/1024-.5)*panel.width,(.5-y/820)*panel.mesh.geometry.parameters.height,0));controller.quaternion.setFromUnitVectors(new T.Vector3(0,0,-1),target.sub(controller.position).normalize());};
  aim(625,216);panel.update();assert.equal(menu.draft.heightOffset,1.25,'held trigger on entry is absorbed');
  source.gamepad.buttons[0].pressed=false;panel.update();source.gamepad.buttons[0].pressed=true;panel.update();assert.equal(menu.draft.heightOffset,.75);
  aim(970,216);panel.update();assert.equal(menu.draft.heightOffset,1.5,'held trigger drags slider');
  aim(120,290);panel.update();assert.equal(panel.tab,'General','drag cannot activate another control');
  source.gamepad.buttons[0].pressed=false;panel.update();menu.model.set('heightOffset',1.25);

  const target=panel.mesh.localToWorld(new T.Vector3((120/1024-.5)*panel.width,(.5-290/820)*panel.mesh.geometry.parameters.height,0));
  controller.quaternion.setFromUnitVectors(new T.Vector3(0,0,-1),target.sub(controller.position).normalize());
  panel.activate(panel.hit(controller));assert.equal(panel.tab,'Debug');
  assert.equal(panel.pageRows.length,7);panel.activate(panel.hitAt(900,640));assert.equal(panel.page,1);
  panel.activate(panel.hitAt(900,640));assert.equal(panel.pageRows.length,4);
  panel.activate(panel.hitAt(900,640));assert.equal(panel.page,2);
  panel.activate(panel.hitAt(300,640));assert.equal(panel.page,1);
  assert.equal(panel.hitAt(120,170),null);
  menu.selectTab('General');assert.equal(menu.draft.shadows,true);
  menu.saveAndExit();assert.equal(menu.open,false);assert.equal(scene.background,background);assert.equal(scene.fog,fog);assert.equal(world.visible,true);assert.equal(hidden.visible,false);
  assert.equal(loadSettings(globalThis.localStorage).sound,false);
  assert.equal(loadSettings(globalThis.localStorage).shadows,true);assert.equal(loadSettings(globalThis.localStorage).heightOffset,1.25);
  for(const destination of ['base','summit']){
   menu.show(new T.Vector3(),new T.Quaternion());assert.equal(menu.draft.shadows,true);
   menu.selectTab('Teleport');menu.panel.activate(menu.panel.hitAt(500,destination==='base'?130:202));
   assert.equal(menu.open,false);assert.equal(teleports.at(-1),destination);
  }
  menu.show(new T.Vector3(),new T.Quaternion());menu.model.activate('sound');assert.equal(menu.draft.sound,true);menu.close();
  menu.show(new T.Vector3(),new T.Quaternion());assert.equal(menu.draft.sound,false,'closing without saving discards sound draft');menu.selectTab('Debug');
  globalThis.localStorage.setItem=()=>{throw Error('quota');};
  assert.equal(menu.saveAndExit(),false);assert.equal(menu.open,true);assert.match(menu.panel.footer,/Could not save/);
  menu.close();menu.panel.dispose();
 }finally{globalThis.document=oldDocument;globalThis.localStorage=oldStorage;}
});

test('base and summit placement use current physical offset once in rotated/translated rigs',()=>{
 const world={start:{x:-100,y:20,z:70},summit:{x:800,y:230,z:-400},route:Array.from({length:25},(_,i)=>({x:i*10,z:-i*5}))};
 const rig=new T.Group(),viewer={position:new T.Vector3(.7,1.8,-.4)};
 for(const destination of ['base','summit']){
  rig.position.set(345,60,-678);rig.rotation.y=2.3;
  placeAtEndpoint(rig,viewer,world,destination,true);
  const point=destination==='base'?world.start:world.summit,head=viewer.position.clone().applyMatrix4(rig.matrixWorld);
  assert.ok(Math.abs(head.x-point.x)<1e-9);assert.ok(Math.abs(head.z-point.z)<1e-9);assert.equal(rig.position.y,point.y);
  assert.ok(Math.abs(head.y-point.y-1.8)<1e-9);
  placeAtEndpoint(rig,viewer,world,destination,false);assert.deepEqual(rig.position.toArray(),[point.x,point.y,point.z]);
 }
});

test('seated offset raises rendered head and controllers once while preserving the ground and bank pivot',()=>{
 const rig=new T.Group(),bank=new T.Group(),heightRig=new T.Group(),camera=new T.Object3D(),controller=new T.Object3D();rig.add(bank);bank.add(heightRig);heightRig.add(camera,controller);
 rig.position.set(120,30,-70);rig.rotation.y=.8;camera.position.set(.4,.9,-.3);controller.position.set(.1,.6,-.5);
 const raw=camera.position.clone(),viewer={position:raw.clone(),orientation:new T.Quaternion()},view=new FlightView(bank),floor=rig.position.clone();
 for(const offset of [0,.75,1.5]){
  viewer.position.copy(raw);applyHeightOffset(heightRig,viewer,offset);view.sample(rig,viewer);view.bank(viewer,.06);rig.updateMatrixWorld(true);
  const rendered=camera.getWorldPosition(new T.Vector3());assert.ok(rendered.distanceTo(view.head)<1e-9);assert.deepEqual(rig.position.toArray(),floor.toArray());assert.ok(Math.abs(rendered.y-(30+.9+offset))<1e-9);assert.deepEqual(camera.position.toArray(),raw.toArray());
  view.reset();rig.updateMatrixWorld(true);assert.ok(Math.abs(controller.getWorldPosition(new T.Vector3()).y-(30+.6+offset))<1e-9);
 }
});
