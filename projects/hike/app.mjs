import {Glider,LandingRunout} from './gliding.mjs?v=glide-17';
import {FlightButtons} from './flight-input.mjs?v=settings-tabs-1';
import {FlightView} from './flight-view.mjs?v=glide-17';
import {applyHeightOffset} from './height-offset.mjs?v=seated-1';
import {TriangleField} from './triangle-field.mjs?v=worker-3';
import {PineShadows} from './pine-shadows.mjs?v=pines-2';
import {Flora} from './flora.mjs?v=3d-fade-2';
import * as T from '../../shared/vendor/three-r180/three.module.js';
import {VRButton} from '../../shared/vendor/three-r180/addons/VRButton.js';
import {Locomotion} from '../../shared/xr/locomotion.mjs';
import {deadzone,readMovementAxes} from '../../shared/xr/input.mjs';
import {XRFrameState} from '../../shared/xr/session.mjs';
import {FrameRateCounter} from '../../shared/performance/frame-rate.mjs';
import {ControlModel} from '../../shared/ui/controls.mjs';
import {DesktopControls} from '../../shared/ui/desktop.mjs';
import {createWorldAsync} from './world-async.mjs?v=pines-dense-1';
import {placeAtEndpoint} from './teleport.mjs?v=settings-tabs-1';
import {SettingsMenu} from './settings-menu.mjs?v=seated-1';
import {APP_VERSION} from './version.mjs?v=0.18.1';
import {Terrain} from './terrain.mjs?v=summit-async-1';
import {SlopeSlide} from './movement.mjs?v=slide-1';

const $=s=>document.querySelector(s);
$('#version').textContent=`v${APP_VERSION}`;
document.title=`The Hike v${APP_VERSION} · CodexTest`;
let loadingProgress=0;
function showProgress(value,label){
 loadingProgress=Math.max(loadingProgress,Math.min(1,value));
 $('#loading-progress').value=loadingProgress;
 $('#loading-stage').textContent=`${Math.round(loadingProgress*100)}% · ${label}`;
}
const generationAbort=new AbortController();
addEventListener('pagehide',()=>generationAbort.abort(),{once:true});
const rawSeed=new URLSearchParams(location.search).get('seed');
const seed=rawSeed!==null&&rawSeed.trim()!==''&&Number.isFinite(Number(rawSeed))?Number(rawSeed):crypto.getRandomValues(new Uint32Array(1))[0];
let panelOpen=false;
function setPanel(open){panelOpen=open;$('#diagnostics').hidden=!open;if(open&&document.pointerLockElement)document.exitPointerLock();}
$('#panel-toggle').onclick=()=>setPanel(!panelOpen);$('#close').onclick=()=>setPanel(false);
function regenerate(nextSeed){const url=new URL(location);url.searchParams.set('seed',String(nextSeed));location.href=url;}
$('#seed').value=seed;$('#seed-form').onsubmit=e=>{e.preventDefault();regenerate(Number($('#seed').value));};
$('#random-seed').onclick=()=>{
  const value=new Uint32Array(1);crypto.getRandomValues(value);
  // Always change the effective 32-bit generation seed, even on a repeated draw.
  const next=value[0]===(seed>>>0)?(value[0]+1)>>>0:value[0];
  regenerate(next);
};
addEventListener('keydown',e=>{
  if(e.code==='KeyP'&&!e.repeat&&!/INPUT|TEXTAREA/.test(e.target.tagName)){e.preventDefault();setPanel(!panelOpen);}
});
$('#route-info').textContent=`Seed ${seed}`;
try {
showProgress(0,'Starting mountain generation');
const world=await createWorldAsync({seed},{onProgress:showProgress,signal:generationAbort.signal});
showProgress(.93,'Preparing the landscape view');
// Start at the canonical trailhead, facing up the trail.
const spawn=world.start;
const settings={speed:14,slideSlope:35};
const scene=new T.Scene();scene.background=new T.Color(0x9fbac6);scene.fog=new T.Fog(0x9fbac6,650,950);
const camera=new T.PerspectiveCamera(70,innerWidth/innerHeight,.08,1200);camera.position.y=1.7;camera.rotation.order='YXZ';camera.rotation.x=.18;
const rig=new T.Group(),bankRig=new T.Group(),heightRig=new T.Group();scene.add(rig);rig.add(bankRig);bankRig.add(heightRig);heightRig.add(camera);
const renderer=new T.WebGLRenderer({canvas:$('#world'),antialias:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setSize(innerWidth,innerHeight);renderer.xr.enabled=true;renderer.xr.setReferenceSpaceType('local-floor');
renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1;renderer.outputColorSpace=T.SRGBColorSpace;renderer.setClearColor(scene.background);
scene.add(new T.HemisphereLight(0xe2edf0,0x665644,1.2));const sun=new T.DirectionalLight(0xffe5b5,2.2);sun.position.set(-450,650,-150);scene.add(sun);
const terrain=new Terrain(scene,world,{initialPosition:spawn,onProgress:value=>showProgress(.93+value*.06,'Sampling detailed and distant terrain')});
terrain.onError=error=>{renderer.setAnimationLoop(null);document.body.classList.remove('loading');$('#error').hidden=false;$('#error').textContent=error.message+' · Choose another seed to reload.';setPanel(true);};
await terrain.ready;
showProgress(.99,'Preparing pine visibility');
const flora=new Flora(scene,world.flora,renderer);
await flora.initialize(spawn);
let lastTerrainSnap=terrain.snapCount;
const marker=new T.Group();marker.position.set(world.summit.x,world.summit.y,world.summit.z);scene.add(marker);
const mast=new T.Mesh(new T.CylinderGeometry(.2,.25,9,6),new T.MeshLambertMaterial({color:0x302b24}));mast.position.y=4.5;marker.add(mast);
const pennant=new T.Mesh(new T.BoxGeometry(3.4,1.6,.08),new T.MeshLambertMaterial({color:0xeab04c}));pennant.position.set(1.6,8,0);marker.add(pennant);
const locomotion=new Locomotion(rig,{moveSpeed:settings.speed,turnSpeed:Math.PI/2});
const sliding=new SlopeSlide(world),glider=new Glider(world),runout=new LandingRunout(world),flightView=new FlightView(bankRig),walkVelocity=new T.Vector3();
const state=new XRFrameState(),buttons=new FlightButtons(),fps=new FrameRateCounter();
const viewer={position:new T.Vector3(),orientation:new T.Quaternion()},head=new T.Vector3(),heading=new T.Quaternion(),euler=new T.Euler(0,0,0,'YXZ');
const stats={triangles:0,fps:0,elevation:0,remaining:world.totalLength,along:0};const projected={};
let pendingTeleport=null;
let walk=false,last=0,uiElapsed=0,frameCount=0,launchQueued=false;
const keys=new Set();
function reset(destination='base') {
  sliding.reset();glider.reset();runout.reset();flightView.reset();walkVelocity.set(0,0,0);launchQueued=false;
  placeAtEndpoint(rig,viewer,world,destination,renderer.xr.isPresenting&&!!state.pose);
  camera.rotation.set(.18,0,0);rig.updateMatrixWorld(true);
}
const pineShadows=new PineShadows(scene,renderer,sun,terrain,flora,world);
showProgress(.995,'Preparing the triangle surface field');
const triangleField=new TriangleField(scene,world,flora);
await triangleField.initialize(spawn);
const defs=[
  {id:'speed',kind:'number',label:'Walk speed (m/s)',min:.7,max:30,step:.1,get:()=>settings.speed,set:v=>settings.speed=v},
  {id:'slope',kind:'number',label:'Slide above (degrees)',min:20,max:50,step:1,get:()=>settings.slideSlope,set:v=>settings.slideSlope=v},
  {id:'glideBank',kind:'number',label:'Glide bank (degrees, 0 = off)',min:0,max:5,step:.5,get:()=>glider.settings.bankMax*180/Math.PI,set:v=>glider.settings.bankMax=v*Math.PI/180},
  {id:'glideSpeed',kind:'number',label:'Maximum glide speed (m/s)',min:8,max:90,step:1,get:()=>glider.settings.maxSpeed,set:v=>glider.settings.maxSpeed=v},
  {id:'glideRatio',kind:'number',label:'Level glide ratio',min:4,max:16,step:.5,get:()=>glider.settings.glideRatio,set:v=>glider.settings.glideRatio=v},
  ...[['movement','Movement',()=>glider.active?'Gliding':runout.active?'Landing runout':'Walking'],['airspeed','Glide speed (m/s)',()=>glider.speed.toFixed(1)],['fps','FPS',()=>stats.fps.toFixed(0)],['triangles','Rendered triangles (~)',()=>stats.triangles.toLocaleString()],['update','Snap apply CPU (ms)',()=>terrain.updateMs.toFixed(1)],['sample','Snap worker (ms)',()=>terrain.sampleMs.toFixed(1)],['latency','Snap latency (ms)',()=>terrain.latencyMs.toFixed(1)],['generation','Generation (ms)',()=>(terrain.generationMs+world.generationMs+world.flora.generationMs).toFixed(0)],['vertices','Terrain vertices',()=>terrain.vertexCount.toLocaleString()],['snaps','Terrain snaps',()=>terrain.snapCount],['elevation','Elevation (m)',()=>stats.elevation.toFixed(1)],['remaining','Trail remaining (m)',()=>stats.remaining.toFixed(0)],['trees','Generated pines',()=>flora.total.toLocaleString()],['trees3d','3D pine instances',()=>flora.instanceCount],['floraCalls','Vegetation batches',()=>flora.drawCalls],['pineSamples','Tree fade MSAA samples',()=>flora.coverageSamples],['floraMs','Vegetation slice (ms)',()=>flora.updateMs.toFixed(2)],['floraPeak','Vegetation peak (ms)',()=>flora.peakUpdateMs.toFixed(2)],['shadowTrees','Shadow pine instances',()=>pineShadows.enabled?pineShadows.instanceCount:0],['shadowCpu','Shadow setup CPU (ms)',()=>pineShadows.updateMs.toFixed(2)],['fieldBlades','Field triangles (visible candidates)',()=>triangleField.instanceCount],['fieldCpu','Field apply CPU (ms)',()=>triangleField.updateMs.toFixed(2)],['fieldWorker','Field worker (ms)',()=>triangleField.workerMs.toFixed(2)],['fieldState','Field status',()=>triangleField.error?triangleField.error.message:triangleField.inFlight?'Generating':'Ready']].map(([id,label,get])=>({id,label,kind:'readout',get})),
  {id:'reset',kind:'action',label:'Reset to trailhead',run:()=>{if(settingsMenu.open){if(settingsMenu.saveAndExit())pendingTeleport='base';}else reset();}}
];
const model=new ControlModel(defs);
const desktop=new DesktopControls($('#controls'),model);
const controllers=[renderer.xr.getController(0),renderer.xr.getController(1)];
for(const c of controllers){heightRig.add(c);c.addEventListener('connected',e=>c.userData.source=e.data);c.addEventListener('disconnected',()=>delete c.userData.source);}
const settingsMenu=new SettingsMenu(scene,rig,renderer,controllers,{debugModel:model,onTeleport:destination=>{pendingTeleport=destination;}});
$('#route-info').textContent=`Seed ${seed} · ${(world.totalLength/1000).toFixed(2)} km · ${Math.round(world.totalLength/settings.speed/60)} minutes · summit ${Math.round(world.summit.y)} m`;
$('#explore').onclick=()=>{$('#explore').blur();walk=true;document.body.classList.add('walking');$('#world').requestPointerLock?.();};
$('#world').onclick=()=>{if(walk&&!panelOpen&&!renderer.xr.isPresenting)$('#world').requestPointerLock?.();};
addEventListener('keydown',e=>{
  if(/INPUT|TEXTAREA|BUTTON/.test(e.target.tagName))return;
  if(['KeyW','KeyA','KeyS','KeyD','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','KeyR','Space'].includes(e.code)){e.preventDefault();keys.add(e.code);}
  if(!e.repeat&&e.code==='KeyR')reset();
  if(!e.repeat&&e.code==='Space'&&walk&&!panelOpen&&!runout.active)launchQueued=true;
});
addEventListener('keyup',e=>keys.delete(e.code));addEventListener('blur',()=>{keys.clear();launchQueued=false;});document.addEventListener('visibilitychange',()=>{keys.clear();launchQueued=false;last=0;fps.reset();});
addEventListener('mousemove',e=>{if(document.pointerLockElement===$('#world')&&!renderer.xr.isPresenting){camera.rotation.y-=e.movementX*.002;camera.rotation.x=T.MathUtils.clamp(camera.rotation.x-e.movementY*.002,-1.35,1.35);}});
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
const vrButton=VRButton.createButton(renderer);document.body.append(vrButton);
renderer.xr.addEventListener('sessionstart',()=>{glider.reset();runout.reset();flightView.reset();walkVelocity.set(0,0,0);launchQueued=false;keys.clear();walk=true;document.body.classList.add('walking');camera.rotation.set(0,0,0);fps.reset();buttons.reset();last=0;});
renderer.xr.addEventListener('sessionend',()=>{pendingTeleport=null;settingsMenu.close();flora.setCoverageSamples(flora.desktopSamples);state.reset();buttons.reset();fps.reset();last=0;camera.position.set(0,1.7,0);reset();});
reset();
function stepFrame(time,frame){
  const elapsed=last?Math.max(0,(time-last)/1000):0;last=time;let dt=Math.min(.05,elapsed);
  const session=renderer.xr.getSession();state.update(session,frame,renderer.xr.getReferenceSpace(),document.hidden);
  if(!state.active){settingsMenu.panel.enabled=false;settingsMenu.panel.hideRays();fps.reset();return;}
  if(session){viewer.position.copy(state.pose.transform.position);viewer.orientation.copy(state.pose.transform.orientation);if(state.firstTracked){reset();const gl=renderer.getContext();flora.setCoverageSamples(gl.getParameter(gl.SAMPLES));}}
  else {viewer.position.copy(camera.position);viewer.orientation.copy(camera.quaternion);}
  applyHeightOffset(heightRig,viewer,settingsMenu.saved.heightOffset);
  const teleported=!!pendingTeleport;
  if(teleported){reset(pendingTeleport);pendingTeleport=null;dt=0;}
  let launchPressed=launchQueued;launchQueued=false;
  if(session){const input=buttons.update(session.inputSources,state);launchPressed=!teleported&&input.launch;}
  if(session&&buttons.result.settings&&settingsMenu.open){
    settingsMenu.saveAndExit();renderer.render(scene,camera);return;
  }
  if(session&&buttons.result.settings&&!settingsMenu.open){
    euler.setFromQuaternion(viewer.orientation,'YXZ');heading.setFromAxisAngle(T.Object3D.DEFAULT_UP,euler.y+rig.rotation.y);
    rig.updateMatrixWorld(true);head.copy(viewer.position).applyMatrix4(rig.matrixWorld);
    settingsMenu.show(head,heading);
  }
  if(settingsMenu.open){
    const panel=settingsMenu.panel;panel.enabled=true;
    for(const c of controllers)panel.controllerStates.get(c).connected=!!buttons.tracked.get(c.userData.source);
    const reading=fps.sample(elapsed);if(reading!==null)stats.fps=reading;
    uiElapsed+=elapsed;if(uiElapsed>.5){uiElapsed=0;panel.model.refresh();}
    panel.update();renderer.render(scene,camera);return;
  }
  if(runout.active){
    let x=0,z=0;
    if(session){const axes=readMovementAxes(session.inputSources,locomotion.axes);x=axes.x;z=axes.z;}
    else if(walk&&!panelOpen){x=Number(keys.has('KeyD'))-Number(keys.has('KeyA'));z=Number(keys.has('KeyS')||keys.has('ArrowDown'))-Number(keys.has('KeyW')||keys.has('ArrowUp'));}
    const c=locomotion.settings;
    const requestedSpeed=settings.speed*Math.min(1,Math.hypot(deadzone(x,c.deadzone,c.rescaleDeadzone),deadzone(z,c.deadzone,c.rescaleDeadzone)));
    // Once input can keep up, use the normal walking branch this very frame.
    runout.takeOver(requestedSpeed);
  }
  const inputLocked=runout.active;
  flightView.sample(rig,viewer);head.copy(flightView.head);let ground;
  if(glider.active){
    // The collision floor is beneath the current physical head X/Z. Its world
    // height is rig.y, preserving the live standing/headset height above it.
    const turn=session?readMovementAxes(session.inputSources,locomotion.axes).turn:walk&&!panelOpen?Number(keys.has('ArrowRight'))-Number(keys.has('ArrowLeft')):0;
    flightView.advance(glider,rig,viewer,dt,turn);
    if(glider.landed){sliding.reset();runout.start(glider.landingVelocity.x,glider.landingVelocity.z);walkVelocity.set(0,0,0);}
  }else if(inputLocked){
    const point=runout.update(dt,head.x,head.z);
    rig.position.x+=point.x-head.x;rig.position.z+=point.z-head.z;rig.position.y=point.y;
    ground=point.y;glider.settle(dt);walkVelocity.set(0,0,0);
  }else{
    const beforeX=head.x,beforeZ=head.z,beforeFloor=rig.position.y;
    locomotion.settings.moveSpeed=settings.speed;
    if(session)locomotion.update(dt,session.inputSources,viewer);
    else if(walk&&!panelOpen)locomotion.move(dt,Number(keys.has('KeyD'))-Number(keys.has('KeyA')),Number(keys.has('KeyS')||keys.has('ArrowDown'))-Number(keys.has('KeyW')||keys.has('ArrowUp')),Number(keys.has('ArrowRight'))-Number(keys.has('ArrowLeft')),viewer);
    flightView.sample(rig,viewer);head.copy(flightView.head);
    if(session||walk){
      const slide=sliding.update(head.x,head.z,dt,settings.slideSlope,settings.speed);
      rig.position.x+=slide.x-head.x;rig.position.z+=slide.z-head.z;head.x=slide.x;head.z=slide.z;
    }
    ground=world.height(head.x,head.z);rig.position.y+=(ground-rig.position.y)*(1-Math.exp(-dt*18));
    if(dt>0)walkVelocity.set((head.x-beforeX)/dt,(rig.position.y-beforeFloor)/dt,(head.z-beforeZ)/dt);
    flightView.sample(rig,viewer);head.copy(flightView.head);
    if(launchPressed&&(session||walk)){
      glider.launch(head.x,rig.position.y,head.z,flightView.heading,walkVelocity.x,walkVelocity.z,walkVelocity.y);rig.position.y=glider.position.y;sliding.reset();
    }else glider.settle(dt);
  }
  flightView.sample(rig,viewer);head.copy(flightView.head);flightView.bank(viewer,glider.bank);rig.updateMatrixWorld(true);
  if(ground===undefined)ground=world.height(head.x,head.z);
  terrain.update(head.x,head.z);
  const terrainApplied=terrain.snapCount!==lastTerrainSnap;lastTerrainSnap=terrain.snapCount;
  flora.update(head,false,!terrainApplied);
  pineShadows.setEnabled(settingsMenu.saved.shadows);pineShadows.update(head);
  triangleField.update(head,!terrainApplied);
  const reading=fps.sample(elapsed);if(reading!==null)stats.fps=reading;
  uiElapsed+=elapsed;
  if(uiElapsed>.5){uiElapsed=0;world.trail(head.x,head.z,projected,true);stats.along=projected.along;stats.remaining=world.totalLength-projected.along;stats.elevation=glider.active?rig.position.y:ground;if(panelOpen)model.refresh();$('#status').textContent=`${Math.round(stats.elevation)} m elevation · ${(stats.remaining/1000).toFixed(2)} km to summit${projected.distance>20?' · off trail':''}${stats.remaining<8&&projected.distance<10?' · Summit reached':''}${glider.active?' · Gliding · '+Math.max(0,Math.round(rig.position.y-ground))+' m above ground':''}`;}
  renderer.render(scene,camera);if(frameCount===0){showProgress(1,'Ready');document.body.classList.remove('loading');}stats.triangles=renderer.info.render.triangles;frameCount++;
}
renderer.setAnimationLoop(stepFrame);
// Desktop inspection surface for desktop acceptance checks.
window.hike={heightRig,triangleField,pineShadows,settingsMenu,version:APP_VERSION,world,terrain,flora,glider,runout,flightView,bankRig,stepFrame,settings,rig,camera,renderer,scene,model,stats,reset,get frameCount(){return frameCount;}};
} catch(error) {
  document.body.classList.remove('loading');
  $('#intro').hidden=true;$('#status').textContent='Mountain generation failed · choose another seed';
  $('#error').hidden=false;$('#error').textContent=`Seed ${seed} could not load: ${error.message}. Choose Random seed or enter another seed below.`;
  setPanel(true);console.error(error);
}
