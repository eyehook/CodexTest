import {ForestAmbience,bindForestAudio} from './forest-audio.mjs?v=1';
import {GraphicsWarmup} from './graphics-warmup.mjs?v=1';
import {createLoadingView} from './loading-view.mjs?v=2';
import {Glider,LandingRunout} from './gliding.mjs?v=glide-17';
import {FlightButtons} from './flight-input.mjs?v=settings-tabs-1';
import {FlightView} from './flight-view.mjs?v=glide-17';
import {applyHeightOffset} from './height-offset.mjs?v=seated-1';
import {HikeProfiler} from './profiler.mjs?v=capture-1';
import {CaptureNotice} from './capture-notice.mjs?v=capture-1';
import {TriangleField} from './triangle-field.mjs?v=hue-2';
import {PineShadows} from './pine-shadows.mjs?v=incremental-1';
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
import {SettingsMenu} from './settings-menu.mjs?v=sound-1';
import {APP_VERSION} from './version.mjs?v=0.24.1';
import {Terrain} from './terrain.mjs?v=overlap-4';
import {SlopeSlide} from './movement.mjs?v=slide-1';

const $=s=>document.querySelector(s);
$('#version').textContent=$('#loading-version').textContent=`v${APP_VERSION}`;
document.title=`The Hike v${APP_VERSION} · CodexTest`;
const startupTimings={started:performance.now()};
let loadingProgress=0;
function showProgress(value,label){
 const bar=$('#loading-progress');
 if(value===null){bar.removeAttribute('value');$('#loading-stage').textContent=label;return;}
 loadingProgress=Math.max(loadingProgress,Math.min(1,value));bar.value=loadingProgress;
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
startupTimings.generationMs=performance.now()-startupTimings.started;
showProgress(.93,'Preparing landscape');
const preparationStarted=performance.now();
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
const terrain=new Terrain(scene,world,{initialPosition:spawn,onProgress:value=>showProgress(.93+value*.06,'Preparing landscape')});
terrain.onError=error=>{renderer.setAnimationLoop(null);document.body.classList.remove('loading');$('#error').hidden=false;$('#error').textContent=error.message+' · Choose another seed to reload.';setPanel(true);};
await terrain.ready;
showProgress(.99,'Preparing vegetation');
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
showProgress(.995,'Preparing vegetation');
const triangleField=new TriangleField(scene,world,flora);
await triangleField.initialize(spawn);
const captureNotice=new CaptureNotice(scene);
const ambience=new ForestAmbience();let audioRequested=false;
const profiler=new HikeProfiler({gl:renderer.getContext(),onNotice:message=>captureNotice.show(message)});
function visitCaptureBuffers(visit){
  visit(terrain.geometry.attributes.terrainHeight);visit(terrain.geometry.attributes.normal);visit(terrain.geometry.attributes.color);
  for(const mesh of flora.batches){visit(mesh.instanceMatrix);visit(mesh.instanceColor);}
  for(const mesh of pineShadows.batches)visit(mesh.instanceMatrix);
  for(const name in triangleField.attributes)visit(triangleField.attributes[name]);
}
const seedCaptureBuffer=attribute=>profiler.seedUpload(attribute),countCaptureBuffer=attribute=>profiler.noteUpload(attribute);
function captureMetadata(){
 const session=renderer.xr.getSession(),size=renderer.getDrawingBufferSize(new T.Vector2()),layer=renderer.xr.getBaseLayer();
 return {appVersion:APP_VERSION,seed,mode:session?'immersive-vr':'desktop',xrFrameRate:Number.isFinite(session?.frameRate)?session.frameRate:null,userAgent:navigator.userAgent,
  settings:{...settings,...settingsMenu.saved,gliding:{...glider.settings}},graphics:{drawingBuffer:size.toArray(),pixelRatio:renderer.getPixelRatio(),xrFramebuffer:layer?[layer.framebufferWidth??layer.textureWidth,layer.framebufferHeight??layer.textureHeight]:null,msaaSamples:flora.coverageSamples},
  startup:{...startupTimings,graphics:warmup.history},
  world:{trailLength:world.totalLength,trees:flora.total,terrainTriangles:terrain.triangles,grassCapacity:triangleField.maxTriangles}};
}
function startCapture(){
 if(profiler.running){profiler.cancel();return;}
 if(settingsMenu.open&&!settingsMenu.saveAndExit())return;
 setPanel(false);captureNotice.hide();
 if(profiler.start(captureMetadata()))visitCaptureBuffers(seedCaptureBuffer);
}
const pair=key=>{const value=profiler.last?.summary?.timing?.[key];return value?.p95===null||!value?'—':`${value.p95.toFixed(1)} / ${value.max.toFixed(1)} ms`;};
let warmup;
const defs=[
 {id:'graphicsWarmup',kind:'readout',label:'Graphics preparation',get:()=>{const r=warmup?.history.at(-1);return r?`${r.totalMs.toFixed(0)} ms · ${r.status}`:'Pending';}},
 {id:'capture',kind:'action',label:()=>profiler.running?'Cancel capture':'Start capture (30 seconds)',disabled:()=>profiler.busy,run:startCapture},
 {id:'captureStatus',kind:'readout',label:'Capture status',get:()=>profiler.status},
 {id:'captureCpu',kind:'readout',label:'CPU p95 / max',get:()=>pair('cpuMs')},
 {id:'captureFrames',kind:'readout',label:'Frame p95 / max',get:()=>pair('intervalMs')},
 {id:'captureGpu',kind:'readout',label:'GPU p95',get:()=>{const value=profiler.last?.summary?.timing?.gpuMs?.p95;return Number.isFinite(value)?`${value.toFixed(1)} ms`:'Unavailable';}},
 {id:'captureSend',kind:'action',label:'Send capture to computer',disabled:()=>!profiler.last||profiler.running||profiler.busy,run:()=>profiler.upload()},
 {id:'captureExport',kind:'action',label:'Export JSON',disabled:()=>!profiler.last||profiler.running||profiler.busy,run:()=>profiler.exportJSON()}
];
const model=new ControlModel(defs);
const desktop=new DesktopControls($('#controls'),model);
const controllers=[renderer.xr.getController(0),renderer.xr.getController(1)];
for(const c of controllers){heightRig.add(c);c.addEventListener('connected',e=>c.userData.source=e.data);c.addEventListener('disconnected',()=>delete c.userData.source);}
const settingsMenu=new SettingsMenu(scene,rig,renderer,controllers,{debugModel:model,onTeleport:destination=>{pendingTeleport=destination;}});
profiler.onChange=()=>{settingsMenu.panel.footer=profiler.lastError??'';model.refresh();};
terrain.onApply=()=>profiler.noteTerrain(terrain);
profiler.restore();
addEventListener('pagehide',()=>{profiler.dispose();captureNotice.dispose();},{once:true});
$('#route-info').textContent=`Seed ${seed} · ${(world.totalLength/1000).toFixed(2)} km · ${Math.round(world.totalLength/settings.speed/60)} minutes · summit ${Math.round(world.summit.y)} m`;
$('#explore').onclick=()=>{$('#explore').blur();walk=true;audioRequested=true;void ambience.unlock();document.body.classList.add('walking');$('#world').requestPointerLock?.();};
$('#world').onclick=()=>{if(walk){audioRequested=true;void ambience.unlock();}if(walk&&!panelOpen&&!renderer.xr.isPresenting)$('#world').requestPointerLock?.();};
addEventListener('keydown',e=>{
  if(/INPUT|TEXTAREA|BUTTON/.test(e.target.tagName))return;
  if(walk&&!e.repeat){audioRequested=true;void ambience.unlock();}
  if(['KeyW','KeyA','KeyS','KeyD','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','KeyR','Space'].includes(e.code)){e.preventDefault();keys.add(e.code);}
  if(!e.repeat&&e.code==='KeyR'&&!warmup.active)reset();
  if(!e.repeat&&e.code==='Space'&&walk&&!panelOpen&&!runout.active)launchQueued=true;
});
addEventListener('keyup',e=>keys.delete(e.code));addEventListener('blur',()=>{keys.clear();launchQueued=false;});document.addEventListener('visibilitychange',()=>{if(document.hidden)ambience.setActive(false);profiler.pause();keys.clear();launchQueued=false;last=0;fps.reset();});
addEventListener('mousemove',e=>{if(document.pointerLockElement===$('#world')&&!renderer.xr.isPresenting){camera.rotation.y-=e.movementX*.002;camera.rotation.x=T.MathUtils.clamp(camera.rotation.x-e.movementY*.002,-1.35,1.35);}});
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
const loadingView=createLoadingView(scene);
let startupReady=false;
warmup=new GraphicsWarmup(renderer,scene,camera,{onFinish:()=>{
 loadingView.mesh.visible=false;keys.clear();launchQueued=false;buttons.reset();last=0;fps.reset();
 if(!startupReady){startupReady=true;showProgress(1,'Ready');document.body.classList.remove('loading');$('#explore').disabled=false;vrButton.disabled=false;vrButton.style.pointerEvents='';}
 model.refresh();
}});
const warmupKey=mode=>`${mode}:shadows=${settingsMenu.saved.shadows}:samples=${flora.coverageSamples}`;
const vrButton=VRButton.createButton(renderer);vrButton.disabled=true;vrButton.style.pointerEvents='none';document.body.append(vrButton);
vrButton.addEventListener('click',()=>void ambience.unlock());
$('#explore').disabled=true;
$('#world').addEventListener('webglcontextrestored',()=>warmup.invalidate());
addEventListener('pagehide',()=>{ambience.dispose();warmup.cancel();loadingView.dispose();},{once:true});
renderer.xr.addEventListener('sessionstart',()=>{const session=renderer.xr.getSession();session.addEventListener('visibilitychange',()=>{if(session.visibilityState!=='visible')profiler.pause();});audioRequested=true;void ambience.unlock();bindForestAudio(session,ambience);glider.reset();runout.reset();flightView.reset();walkVelocity.set(0,0,0);launchQueued=false;keys.clear();walk=true;document.body.classList.add('walking');camera.rotation.set(0,0,0);fps.reset();buttons.reset();last=0;});
renderer.xr.addEventListener('sessionend',()=>{audioRequested=false;ambience.stop();warmup.cancel();loadingView.mesh.visible=false;profiler.pause();pendingTeleport=null;settingsMenu.close();flora.setCoverageSamples(flora.desktopSamples);state.reset();buttons.reset();fps.reset();last=0;camera.position.set(0,1.7,0);reset();});
reset();
startupTimings.preparationMs=performance.now()-preparationStarted;
pineShadows.setEnabled(settingsMenu.saved.shadows);pineShadows.update(spawn);
showProgress(null,'Preparing graphics');loadingView.mesh.visible=true;warmup.begin(warmupKey('desktop'));
function stepFrame(time,frame){
  const captureBegan=profiler.running?performance.now():0;
  const elapsed=last?Math.max(0,(time-last)/1000):0;last=time;let dt=Math.min(.05,elapsed);
  const session=renderer.xr.getSession();state.update(session,frame,renderer.xr.getReferenceSpace(),document.hidden);
  if(!state.active){ambience.setActive(false);profiler.pause();settingsMenu.panel.enabled=false;settingsMenu.panel.hideRays();fps.reset();return;}
  if(session){viewer.position.copy(state.pose.transform.position);viewer.orientation.copy(state.pose.transform.orientation);if(state.firstTracked){reset();const gl=renderer.getContext();flora.setCoverageSamples(gl.getParameter(gl.SAMPLES));}}
  else {viewer.position.copy(camera.position);viewer.orientation.copy(camera.quaternion);}
  applyHeightOffset(heightRig,viewer,settingsMenu.saved.heightOffset);
  const graphicsKey=warmupKey(session?'immersive-vr':'desktop');
  if(!warmup.active&&!settingsMenu.open&&!warmup.ready.has(graphicsKey)){
   pineShadows.setEnabled(settingsMenu.saved.shadows);flightView.sample(rig,viewer);pineShadows.update(flightView.head);
   loadingView.mesh.visible=true;warmup.begin(graphicsKey);
  }
  if(warmup.active){
   ambience.setActive(false);profiler.pause();settingsMenu.panel.enabled=false;settingsMenu.panel.hideRays();keys.clear();launchQueued=false;buttons.reset();
   loadingView.mesh.visible=true;
   if(warmup.update()){
    // Do not force an unfinished program into use while compileAsync polls it.
    if(warmup.phase==='compile'){if(session)renderer.render(loadingView.scene,camera);else renderer.clear();}
    else renderer.render(scene,camera);
    warmup.afterRender();last=0;return;
   }
   loadingView.mesh.visible=false;dt=0;
  }
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
    ambience.setActive(false);profiler.pause();
    const panel=settingsMenu.panel;panel.enabled=true;
    for(const c of controllers)panel.controllerStates.get(c).connected=!!buttons.tracked.get(c.userData.source);
    const reading=fps.sample(elapsed);if(reading!==null)stats.fps=reading;
    uiElapsed+=elapsed;if(uiElapsed>.5){uiElapsed=0;panel.model.refresh();}
    panel.update();renderer.render(scene,camera);return;
  }
  ambience.setActive(audioRequested&&settingsMenu.saved.sound&&!panelOpen);
  const tracing=profiler.beginFrame(captureBegan,session?'immersive-vr':'desktop');
  let capturePhase=tracing?performance.now():0;
  const grassJobsBefore=triangleField.appliedJobs,shadowRebuildsBefore=pineShadows.rebuilds;
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
  if(tracing){profiler.set('navigationMs',performance.now()-capturePhase);capturePhase=performance.now();}
  terrain.update(head.x,head.z);
  if(tracing){profiler.set('terrainCheckMs',performance.now()-capturePhase);capturePhase=performance.now();}
  const terrainApplied=terrain.snapCount!==lastTerrainSnap;lastTerrainSnap=terrain.snapCount;
  flora.update(head,false,!terrainApplied);
  if(tracing){profiler.set('pineMs',performance.now()-capturePhase);capturePhase=performance.now();}
  pineShadows.setEnabled(settingsMenu.saved.shadows);pineShadows.update(head);
  if(tracing){profiler.set('shadowMs',performance.now()-capturePhase);capturePhase=performance.now();}
  triangleField.setTime(time*.001);triangleField.update(head,!terrainApplied);
  if(tracing)profiler.set('grassMs',performance.now()-capturePhase);
  const reading=fps.sample(elapsed);if(reading!==null)stats.fps=reading;
  uiElapsed+=elapsed;
  if(uiElapsed>.5){uiElapsed=0;world.trail(head.x,head.z,projected,true);stats.along=projected.along;stats.remaining=world.totalLength-projected.along;stats.elevation=glider.active?rig.position.y:ground;if(panelOpen)model.refresh();$('#status').textContent=`${Math.round(stats.elevation)} m elevation · ${(stats.remaining/1000).toFixed(2)} km to summit${projected.distance>20?' · off trail':''}${stats.remaining<8&&projected.distance<10?' · Summit reached':''}${glider.active?' · Gliding · '+Math.max(0,Math.round(rig.position.y-ground))+' m above ground':''}`;}
  captureNotice.update(head,flightView.orientation,profiler.running);
  if(tracing){visitCaptureBuffers(countCaptureBuffer);profiler.beginRender();capturePhase=performance.now();}
  try{renderer.render(scene,camera);}finally{if(tracing)profiler.endRender();}
  if(tracing){
   profiler.set('renderSubmitMs',performance.now()-capturePhase);
   profiler.set('grassJobs',triangleField.appliedJobs-grassJobsBefore);profiler.set('grassWorkerMs',triangleField.appliedJobs!==grassJobsBefore?triangleField.workerMs:0);
   profiler.set('shadowRebuilds',pineShadows.rebuilds-shadowRebuildsBefore);profiler.set('pines',flora.instanceCount);profiler.set('grassBlades',triangleField.instanceCount);profiler.set('shadowCasters',pineShadows.enabled?pineShadows.instanceCount:0);
   profiler.set('colorTriangles',renderer.info.render.triangles);profiler.set('colorDrawCalls',renderer.info.render.calls);
   profiler.set('x',head.x);profiler.set('y',head.y);profiler.set('z',head.z);profiler.set('movement',glider.active?1:runout.active?2:0);profiler.set('airspeed',glider.speed);profiler.set('shadows',Number(pineShadows.enabled));profiler.set('heightOffset',settingsMenu.saved.heightOffset);
   profiler.endFrame(performance.now());
  }
  stats.triangles=renderer.info.render.triangles;frameCount++;
}
renderer.setAnimationLoop(stepFrame);
// Desktop inspection surface for desktop acceptance checks.
window.hike={ambience,warmup,startupTimings,loadingView,profiler,captureNotice,heightRig,triangleField,pineShadows,settingsMenu,version:APP_VERSION,world,terrain,flora,glider,runout,flightView,bankRig,stepFrame,settings,rig,camera,renderer,scene,model,stats,reset,get frameCount(){return frameCount;}};
} catch(error) {
  document.body.classList.remove('loading');
  $('#intro').hidden=true;$('#status').textContent='Mountain generation failed · choose another seed';
  $('#error').hidden=false;$('#error').textContent=`Seed ${seed} could not load: ${error.message}. Choose Random seed or enter another seed below.`;
  setPanel(true);console.error(error);
}
