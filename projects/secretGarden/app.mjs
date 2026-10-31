import * as THREE from '../../shared/vendor/three-r180/three.module.js';
import {createSettingsPanel} from './settings-panel.mjs?v=72';
import {VRButton} from '../../shared/vendor/three-r180/addons/VRButton.js';
import {Locomotion} from '../../shared/xr/locomotion.mjs';
import {ButtonEdges} from '../../shared/xr/input.mjs';
import {ControllerPointer,createPointerLine} from '../../shared/xr/pointer.mjs';
import {XRFrameState} from '../../shared/xr/session.mjs';
import {createEnvironment,constrainViewer,HALF_WIDTH,HALF_DEPTH} from './environment.mjs?v=63';
import {PlantRenderer} from './renderer.mjs?v=51';
import {DeleteHold} from './delete-hold.mjs?v=13';
import {ActiveController} from './controller-actions.mjs?v=19';
import {doorwayPlantingBlocked} from './garden-layout.mjs?v=46';
import {Bees} from './bees.mjs?v=57';
import {PlantManager} from './manager.mjs?v=58';
import {GardenSaves} from './garden-saves.mjs?v=60';
import {Teleport} from './teleport.mjs?v=70';
import {SnapTurn} from './snap-turn.mjs?v=71';
import {Preferences} from './preferences.mjs?v=69';
import {createVRSettings,applyHeightOffset} from './vr-settings.mjs?v=72';
import {createSavePanel} from './save-panel.mjs?v=72';
const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(65,innerWidth/innerHeight,.025,250);
const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setSize(innerWidth,innerHeight);renderer.xr.enabled=true;renderer.xr.setReferenceSpaceType('local-floor');renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;document.body.append(renderer.domElement);
const rig=new THREE.Group();scene.add(rig);rig.add(camera);rig.position.z=2.1;camera.position.set(0,1.6,0);camera.rotation.x=-.22;
const environment=createEnvironment(scene,renderer,{viewDistance:camera.far}),plants=new PlantManager(new PlantRenderer(scene));
const bees=new Bees(scene);
const settings=createSettingsPanel(scene,renderer,{bees,onReset:()=>{plants.reset();deleteHold.cancel();target=null;marker.visible=selection.visible=cloneIcon.visible=deleteFill.visible=false;}});
const navigation=new Locomotion(rig,{moveSpeed:1,turnSpeed:Math.PI/4}),edges=new ButtonEdges(),frameState=new XRFrameState();
const snapTurn=new SnapTurn(),teleport=new Teleport(scene);
const pointer=new ControllerPointer({far:25}),desktopRay=new THREE.Raycaster(),mouse=new THREE.Vector2(0,0),keys=new Set();
const controllers=[0,1].map(i=>{const c=renderer.xr.getController(i);rig.add(c);const line=createPointerLine({color:0xd5e9ac,length:8});line.material.transparent=true;line.material.depthWrite=false;c.add(line);c.addEventListener('connected',e=>{c.userData.source=e.data;c.userData.fresh=true;});c.addEventListener('disconnected',()=>{edges.reset(c.userData.source);delete c.userData.source;});return {controller:c,line};});
const marker=new THREE.Mesh(new THREE.RingGeometry(.055,.073,24),new THREE.MeshBasicMaterial({color:0xe0edb9,side:THREE.DoubleSide,depthTest:false}));marker.rotation.x=-Math.PI/2;marker.renderOrder=5;marker.visible=false;scene.add(marker);
const selection=new THREE.Mesh(new THREE.RingGeometry(.13,.15,32),new THREE.MeshBasicMaterial({color:0xffe3a3,side:THREE.DoubleSide,depthTest:false}));selection.rotation.x=-Math.PI/2;selection.renderOrder=5;selection.visible=false;scene.add(selection);
const deleteFill=new THREE.Mesh(new THREE.CircleGeometry(.13,64,0,-Math.PI*2),new THREE.MeshBasicMaterial({color:0xe43838,side:THREE.DoubleSide,depthTest:false}));deleteFill.rotation.x=-Math.PI/2;deleteFill.renderOrder=6;deleteFill.visible=false;scene.add(deleteFill);
// Two overlapping rectangle outlines, shared by ground and plant targets.
const cloneVertices=[];
for(const [x,y] of [[-.008,.008],[.008,-.008]]) {
  const corners=[[x-.021,y-.016,0],[x+.021,y-.016,0],[x+.021,y+.016,0],[x-.021,y+.016,0]];
  for(let i=0;i<4;i++)cloneVertices.push(...corners[i],...corners[(i+1)%4]);
}
const cloneIcon=new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(cloneVertices,3)),new THREE.LineBasicMaterial({color:0xe0edb9,depthTest:false,toneMapped:false}));
cloneIcon.name='clone-target-icon';cloneIcon.rotation.x=-Math.PI/2;cloneIcon.renderOrder=7;cloneIcon.visible=false;scene.add(cloneIcon);
let now=0,last=0,target=null,hudText='',shadowRevision=-1,drag=null,dragged=false,desktopSlider=null,vrSlider=null;
const activeController=new ActiveController(),deleteHold=new DeleteHold(),viewerWorld=new THREE.Vector3();
const status=document.querySelector('#status');
const storage={getItem:key=>localStorage.getItem(key),setItem:(key,value)=>localStorage.setItem(key,value),removeItem:key=>localStorage.removeItem(key)};
const preferences=new Preferences(storage),saves=new GardenSaves(storage);
const vrValues={...preferences.value},vrSettings=createVRSettings(scene,vrValues,navigation);
settings.model.set('shadows',preferences.value.shadows);settings.model.set('bees',preferences.value.bees);
let settingsTimer=null;
function persistSettings(){clearTimeout(settingsTimer);settingsTimer=null;try{preferences.save({...vrValues,shadows:renderer.shadowMap.enabled,bees:bees.density});vrSettings.setMessage('Settings saved');}catch{vrSettings.setMessage('Settings could not be saved');}}
function scheduleSettingsSave(){clearTimeout(settingsTimer);vrSettings.setMessage('Saving settings…');settingsTimer=setTimeout(persistSettings,250);}
settings.model.onChange=id=>{if(id==='shadows'||id==='bees')scheduleSettingsSave();};vrSettings.model.onChange=id=>{if(id==='teleport')teleport.reset();snapTurn.reset();scheduleSettingsSave();};
if(preferences.error)vrSettings.setMessage('Settings storage unavailable or invalid');
window.addEventListener('pagehide',()=>{if(settingsTimer!==null)persistSettings();});
function clearGardenInteraction(){deleteHold.cancel();target=null;desktopSlider=vrSlider=null;marker.visible=selection.visible=cloneIcon.visible=deleteFill.visible=false;}
function restoreGarden(save){
  plants.restore(save.plants,performance.now()/1000,environment.walls.map(w=>w.userData.wallSurface));
  clearGardenInteraction();const density=bees.density;bees.setDensity(0);bees.setDensity(density);bees.update(plants,performance.now()/1000);
}
const savePanel=createSavePanel(scene,saves,{
  onSave(index){try{saves.save(index,{plants:plants.snapshot(performance.now()/1000)});savePanel.setMessage('Saved to Slot '+(index+1));}catch{savePanel.setMessage('Save failed. Browser storage may be full or unavailable.');}},
  onLoad(index){try{if(!saves.slots[index])return;restoreGarden(saves.slots[index]);savePanel.setMessage('Loaded Slot '+(index+1));}catch{savePanel.setMessage('Could not load this save.');}}
});
const latestSave=saves.latest();if(latestSave){try{restoreGarden(latestSave.save);savePanel.setMessage('Loaded latest save: Slot '+(latestSave.index+1));}catch{savePanel.setMessage('Could not load the latest save.');}}
function resolve(hit){if(!hit)return null;if(hit.object.userData.control)return {point:hit.point,kind:'control',uv:hit.uv,control:hit.object.userData.control};return {point:hit.point,kind:hit.object.userData.plantId?'plant':hit.object.userData.surface,id:hit.object.userData.plantId,support:hit.object.userData.wallSurface&&hit.face?.normal.z<-.9&&!doorwayPlantingBlocked(hit.point)?hit.object.userData.wallSurface:null};}
function targetFrom(ray){return resolve(ray.intersectObjects([...settings.targets,...savePanel.targets,...vrSettings.targets,...environment.targets,...plants.targets],true)[0]);}
function perform(action,hit){
  if(hit?.kind==='control'){if(action==='plant')hit.control.activate({uv:hit.uv,source:renderer.xr.isPresenting?'vr':'desktop'});return;}
  if(action==='plant'&&hit?.kind==='ground'&&Math.abs(hit.point.x)<=HALF_WIDTH&&Math.abs(hit.point.z)<=HALF_DEPTH)plants.plant(hit.point,now);
  if(action==='plant'&&hit?.kind==='wall'&&hit.support)plants.plant(hit.point,now,hit.support);
  if(action==='copy')plants.copy(hit?.kind==='plant'?hit.id:null);
  if(action==='delete'&&hit?.kind==='plant')plants.remove(hit.id);
}
const indicatorAxis=new THREE.Vector3(0,0,1),groundNormal=new THREE.Vector3(0,1,0);
function placeIndicator(object,point,normal,lift){object.position.copy(point).addScaledVector(normal,lift);object.quaternion.setFromUnitVectors(indicatorAxis,normal);}
function showTarget(hit){
  marker.visible=hit?.kind==='ground'||hit?.kind==='wall'&&!!hit.support;selection.visible=hit?.kind==='plant';
  let type='ground',normal=groundNormal;
  if(marker.visible){type=hit.kind;normal=hit.support?.normal??groundNormal;placeIndicator(marker,hit.point,normal,hit.kind==='wall'?.055:.009);}
  if(selection.visible){const p=plants.instances.get(hit.id);if(p){type=p.surface??'ground';normal=p.support?.normal??groundNormal;placeIndicator(selection,p.position,normal,.012);}else selection.visible=false;}
  cloneIcon.visible=plants.canClone(type)&&marker.visible;
  if(cloneIcon.visible){const circle=selection.visible?selection:marker;cloneIcon.position.copy(circle.position).addScaledVector(normal,.003);cloneIcon.quaternion.copy(circle.quaternion);cloneIcon.scale.setScalar(selection.visible ? .13/.055 : 1);}
}
function updateHUD(){
  const text=`${plants.instances.size} plants · ${plants.growing.size} growing`;
  if(text!==hudText){hudText=text;document.querySelector('#stats').textContent=text;}
}
renderer.domElement.addEventListener('pointermove',e=>{mouse.set(e.clientX/innerWidth*2-1,-e.clientY/innerHeight*2+1);if(desktopSlider){scene.updateMatrixWorld(true);desktopRay.setFromCamera(mouse,camera);const hit=targetFrom(desktopRay);if(hit?.control===desktopSlider)desktopSlider.drag({uv:hit.uv,source:'desktop'});return;}if(drag){const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(Math.hypot(dx,dy)>2)dragged=true;rig.rotation.y-=dx*.004;camera.rotation.x=THREE.MathUtils.clamp(camera.rotation.x-dy*.003,-1.3,.9);drag={x:e.clientX,y:e.clientY};}});
renderer.domElement.addEventListener('pointerdown',e=>{if(e.button!==0)return;if(!renderer.xr.isPresenting){mouse.set(e.clientX/innerWidth*2-1,-e.clientY/innerHeight*2+1);scene.updateMatrixWorld(true);desktopRay.setFromCamera(mouse,camera);const hit=targetFrom(desktopRay);if(hit?.control?.drag){desktopSlider=hit.control;desktopSlider.activate({uv:hit.uv,source:'desktop'});renderer.domElement.setPointerCapture(e.pointerId);return;}}drag={x:e.clientX,y:e.clientY};dragged=false;renderer.domElement.setPointerCapture(e.pointerId);});
renderer.domElement.addEventListener('pointerup',e=>{if(desktopSlider){desktopSlider=null;return;}if(drag&&!dragged&&!renderer.xr.isPresenting){mouse.set(e.clientX/innerWidth*2-1,-e.clientY/innerHeight*2+1);scene.updateMatrixWorld(true);desktopRay.setFromCamera(mouse,camera);perform('plant',targetFrom(desktopRay));}drag=null;});
renderer.domElement.addEventListener('pointercancel',()=>{drag=null;desktopSlider=null;});
window.addEventListener('keydown',e=>{if(e.target.closest('button'))return;keys.add(e.code);if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.code))e.preventDefault();if(!e.repeat&&!renderer.xr.isPresenting){if(e.code==='KeyB')perform('copy',target);if(e.code==='KeyX')perform('delete',target);if(e.code==='Space'){e.preventDefault();perform('plant',target);};}});
window.addEventListener('keyup',e=>keys.delete(e.code));window.addEventListener('blur',()=>{keys.clear();drag=null;desktopSlider=null;});
window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
renderer.xr.addEventListener('sessionstart',()=>{document.body.classList.add('xr');edges.reset();teleport.reset();snapTurn.reset();desktopSlider=vrSlider=null;activeController.hand='right';activeController.enabled=true;deleteHold.cancel();keys.clear();marker.visible=selection.visible=cloneIcon.visible=false;});
renderer.xr.addEventListener('sessionend',()=>{document.body.classList.remove('xr');edges.reset();teleport.reset();snapTurn.reset();rig.position.y=0;vrSlider=null;deleteHold.cancel();deleteFill.visible=false;camera.position.set(0,1.6,0);camera.rotation.set(-.22,0,0);for(const c of controllers)c.line.visible=false;});
try{document.body.append(VRButton.createButton(renderer));}catch(error){status.textContent=`VR unavailable: ${error.message}`;}
renderer.setAnimationLoop((time,frame)=>{
  const dt=last?Math.min((time-last)/1000,.05):0;last=time;now=time/1000;
  const session=renderer.xr.getSession(),state=frameState.update(session,frame,renderer.xr.getReferenceSpace(),document.hidden);
  if(!state.active){teleport.reset();snapTurn.reset();vrSlider=null;desktopSlider=null;deleteHold.cancel();deleteFill.visible=false;for(const c of controllers)c.line.visible=false;marker.visible=selection.visible=cloneIcon.visible=false;return;}
  applyHeightOffset(rig,vrValues,!!session);
  if(session){
    const viewer=state.pose.transform;if(vrValues.teleport)teleport.sampleSources(session.inputSources,state.resumed,source=>state.isTracked(source.targetRaySpace));else teleport.reset();if(state.resumed)snapTurn.reset();snapTurn.update(navigation,dt,session.inputSources,viewer,vrValues,source=>state.isTracked(source.targetRaySpace));constrainViewer(rig,viewer.position,environment.room.passable);
  }else{
    navigation.move(dt,Number(keys.has('KeyD'))-Number(keys.has('KeyA')),Number(keys.has('KeyS'))-Number(keys.has('KeyW')),Number(keys.has('ArrowRight'))-Number(keys.has('ArrowLeft')),{position:camera.position,orientation:camera.quaternion});constrainViewer(rig,camera.position,environment.room.passable);
  }
  const viewerPosition=viewerWorld.copy(session?state.pose.transform.position:camera.position);
  rig.updateMatrixWorld(true);viewerPosition.applyMatrix4(rig.matrixWorld);
  const doorChanged=environment.room.update(dt,viewerPosition);
  environment.clouds.update(dt);
  settings.beginFrame(doorChanged||plants.hasGrowingShadows||shadowRevision!==plants.shadowRevision);shadowRevision=plants.shadowRevision;plants.update(now);bees.update(plants,now);scene.updateMatrixWorld(true);target=null;
  if(session){
    edges.retain(session.inputSources);
    if(state.resumed)deleteHold.cancel();
    const inputs=[];
    for(const {controller:c,line} of controllers) {
      line.visible=false;
      const source=c.userData.source;
      const hand=source?.handedness;
      const tracked=(hand==='left'||hand==='right')&&source?.gamepad?.mapping==='xr-standard'&&state.isTracked(source.targetRaySpace);
      if(!tracked){if(source)edges.reset(source);c.userData.fresh=true;continue;}
      const seed=state.resumed||c.userData.fresh;c.userData.fresh=false;
      const second=edges.sample(source,5,seed),trigger=edges.sample(source,0,seed);
      inputs.push({hand,controller:c,line,trigger:trigger.pressed,triggerDown:trigger.down,grip:edges.sample(source,1,seed).pressed,
        first:edges.sample(source,4,seed).pressed,second:second.pressed,deleteDown:second.down});
    }
    // Transfer takes priority for the whole frame and consumes the switching press.
    const teleportFrame=teleport.active;
    const actions=teleportFrame?[]:activeController.update(inputs);
    const active=activeController.enabled?inputs.find(input=>input.hand===activeController.hand):null;
    if(teleportFrame){
      vrSlider=null;deleteHold.cancel();const owner=inputs.find(input=>input.hand===teleport.source?.handedness);
      if(owner){const {controller:c,line}=owner;const hit=pointer.cast(c,[...settings.targets,...savePanel.targets,...vrSettings.targets,...environment.targets],true);teleport.aim(hit,environment.room.passable,environment.room);line.visible=true;line.scale.z=hit?hit.distance:8;line.material.color.set(teleport.valid?0x83d59a:0xe05b4b);const releasing=teleport.releasing,doorTarget=!!teleport.doorRoom;const moved=teleport.finish(rig,state.pose.transform.position);if(moved&&doorTarget)renderer.shadowMap.needsUpdate=renderer.shadowMap.enabled;if(releasing)line.visible=false;}
      else teleport.reset();
    }else if(active) {
      const {controller:c,line}=active;
      line.visible=true;
      target=resolve(pointer.cast(c,[...settings.targets,...savePanel.targets,...vrSettings.targets,...environment.targets,...plants.targets],true));
      line.scale.z=target?c.getWorldPosition(new THREE.Vector3()).distanceTo(target.point):8;
      line.material.color.set(target?.kind==='plant'?0xffdfa1:0xd5e9ac);
      for(const action of actions){if(action==='delete')plants.copy(null);else {perform(action,target);if(action==='plant'&&target?.control?.drag)vrSlider={control:target.control,hand:active.hand};}}
    }
    if(vrSlider){if(active?.triggerDown&&active.hand===vrSlider.hand&&target?.control===vrSlider.control)vrSlider.control.drag({uv:target.uv,source:'vr'});else vrSlider=null;}
    const removed=deleteHold.update({pressed:actions.includes('delete'),down:active?.deleteDown??false,
      id:target?.kind==='plant'?target.id:null,hand:activeController.hand},now);
    if(removed!==null){plants.remove(removed);target=null;}
    deleteFill.visible=deleteHold.progress>0&&target?.kind==='plant';
    if(deleteFill.visible){const selected=plants.instances.get(target.id);placeIndicator(deleteFill,selected.position,selected.support?.normal??groundNormal,.014);deleteFill.geometry.setDrawRange(0,Math.floor(deleteHold.progress*64)*3);}
  }else{deleteHold.cancel();deleteFill.visible=false;for(const c of controllers)c.line.visible=false;scene.updateMatrixWorld(true);desktopRay.setFromCamera(mouse,camera);target=targetFrom(desktopRay);}
  settings.setHover(target?.kind==='control'?target.control:null);savePanel.setHover(target?.kind==='control'?target.control:null);vrSettings.setHover(target?.kind==='control'?target.control:null);showTarget(target);updateHUD();renderer.render(scene,camera);
});
// Read-only diagnostic access for local acceptance checks.
window.secretGarden={scene,renderer,camera,rig,plants,environment,settings,bees,saves,savePanel,vrSettings,vrValues,preferences,teleport};
