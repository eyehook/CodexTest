import * as T from '../../shared/vendor/three-r180/three.module.js';
import {VRButton} from '../../shared/vendor/three-r180/addons/VRButton.js';
import {Locomotion} from '../../shared/xr/locomotion.mjs';
import {XRFrameState} from '../../shared/xr/session.mjs';
import {ButtonEdges} from '../../shared/xr/input.mjs';
import {FrameRateCounter} from '../../shared/performance/frame-rate.mjs';
import {ControlModel} from '../../shared/ui/controls.mjs';
import {DesktopControls} from '../../shared/ui/desktop.mjs';
import {VRControlPanel} from '../../shared/ui/vr-panel.mjs';
import {createWorld} from './world.mjs?v=snapped-1';
import {Terrain} from './terrain.mjs?v=snapped-1';
import {SlopeSlide} from './movement.mjs?v=slide-1';

const $=s=>document.querySelector(s);
const rawSeed=new URLSearchParams(location.search).get('seed');
const seed=rawSeed!==null&&Number.isFinite(Number(rawSeed))?Number(rawSeed):41729;
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
// Give the loading card a paint before synchronous world generation begins.
await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
const world=createWorld({seed});
const settings={speed:14,slideSlope:35};
const scene=new T.Scene();scene.background=new T.Color(0x9fbac6);scene.fog=new T.Fog(0x9fbac6,650,950);
const camera=new T.PerspectiveCamera(70,innerWidth/innerHeight,.08,1200);camera.position.y=1.7;camera.rotation.order='YXZ';camera.rotation.x=.18;
const rig=new T.Group();scene.add(rig);rig.add(camera);
const renderer=new T.WebGLRenderer({canvas:$('#world'),antialias:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setSize(innerWidth,innerHeight);renderer.xr.enabled=true;renderer.xr.setReferenceSpaceType('local-floor');
renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1;renderer.outputColorSpace=T.SRGBColorSpace;renderer.setClearColor(scene.background);
scene.add(new T.HemisphereLight(0xe2edf0,0x665644,1.2));const sun=new T.DirectionalLight(0xffe5b5,2.2);sun.position.set(-450,650,-150);scene.add(sun);
const terrain=new Terrain(scene,world);
terrain.onError=error=>{renderer.setAnimationLoop(null);document.body.classList.remove('loading');$('#error').hidden=false;$('#error').textContent=error.message+' · Choose another seed to reload.';setPanel(true);};
await terrain.ready;
const marker=new T.Group();marker.position.set(world.summit.x,world.summit.y,world.summit.z);scene.add(marker);
const mast=new T.Mesh(new T.CylinderGeometry(.2,.25,9,6),new T.MeshLambertMaterial({color:0x302b24}));mast.position.y=4.5;marker.add(mast);
const pennant=new T.Mesh(new T.BoxGeometry(3.4,1.6,.08),new T.MeshLambertMaterial({color:0xeab04c}));pennant.position.set(1.6,8,0);marker.add(pennant);
const locomotion=new Locomotion(rig,{moveSpeed:settings.speed,turnSpeed:Math.PI/3});
const sliding=new SlopeSlide(world);
const state=new XRFrameState(),edges=new ButtonEdges(),fps=new FrameRateCounter();
const viewer={position:new T.Vector3(),orientation:new T.Quaternion()},head=new T.Vector3(),heading=new T.Quaternion(),euler=new T.Euler(0,0,0,'YXZ');
const stats={triangles:0,fps:0,elevation:0,remaining:world.totalLength,along:0};const projected={};
let walk=false,last=0,uiElapsed=0,frameCount=0;
const keys=new Set();
function reset() {
  // Place the physical headset's horizontal offset over the trailhead exactly once.
  const ahead=world.route[12];
  sliding.reset();rig.rotation.set(0,Math.atan2(world.start.x-ahead.x,world.start.z-ahead.z),0);rig.position.set(world.start.x,world.start.y,world.start.z);
  if(renderer.xr.isPresenting&&state.pose){head.copy(viewer.position).applyQuaternion(rig.quaternion);rig.position.x-=head.x;rig.position.z-=head.z;}
  camera.rotation.set(.18,0,0);rig.updateMatrixWorld(true);
}
const defs=[
  {id:'speed',kind:'number',label:'Walk speed (m/s)',min:.7,max:30,step:.1,get:()=>settings.speed,set:v=>settings.speed=v},
  {id:'slope',kind:'number',label:'Slide above (degrees)',min:20,max:50,step:1,get:()=>settings.slideSlope,set:v=>settings.slideSlope=v},
  ...[['fps','FPS',()=>stats.fps.toFixed(0)],['triangles','Rendered triangles (~)',()=>stats.triangles.toLocaleString()],['update','Snap apply CPU (ms)',()=>terrain.updateMs.toFixed(1)],['sample','Snap worker (ms)',()=>terrain.sampleMs.toFixed(1)],['latency','Snap latency (ms)',()=>terrain.latencyMs.toFixed(1)],['generation','Generation (ms)',()=>(terrain.generationMs+world.generationMs).toFixed(0)],['vertices','Terrain vertices',()=>terrain.vertexCount.toLocaleString()],['snaps','Terrain snaps',()=>terrain.snapCount],['elevation','Elevation (m)',()=>stats.elevation.toFixed(1)],['remaining','Trail remaining (m)',()=>stats.remaining.toFixed(0)]].map(([id,label,get])=>({id,label,kind:'readout',get})),
  {id:'reset',kind:'action',label:'Reset to trailhead',run:reset}
];
const model=new ControlModel(defs);
const desktop=new DesktopControls($('#controls'),model);
const controllers=[renderer.xr.getController(0),renderer.xr.getController(1)];
for(const c of controllers){rig.add(c);c.addEventListener('connected',e=>c.userData.source=e.data);c.addEventListener('disconnected',()=>delete c.userData.source);}
const vr=new VRControlPanel(scene,rig,renderer,model,{title:'THE HIKE · FIELD NOTES',distance:2.1,width:1.1,controllers});
function placePanel(){euler.setFromQuaternion(viewer.orientation,'YXZ');heading.setFromAxisAngle(T.Object3D.DEFAULT_UP,euler.y+rig.rotation.y);rig.updateMatrixWorld(true);head.copy(viewer.position).applyMatrix4(rig.matrixWorld);vr.follow(head,heading);}
$('#route-info').textContent=`Seed ${seed} · ${(world.totalLength/1000).toFixed(2)} km · ${Math.round(world.totalLength/settings.speed/60)} minutes · summit ${Math.round(world.summit.y)} m`;
$('#explore').onclick=()=>{walk=true;document.body.classList.add('walking');$('#world').requestPointerLock?.();};
$('#world').onclick=()=>{if(walk&&!panelOpen&&!renderer.xr.isPresenting)$('#world').requestPointerLock?.();};
addEventListener('keydown',e=>{
  if(/INPUT|TEXTAREA|BUTTON/.test(e.target.tagName))return;
  if(['KeyW','KeyA','KeyS','KeyD','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','KeyR'].includes(e.code)){e.preventDefault();keys.add(e.code);}
  if(!e.repeat&&e.code==='KeyR')reset();
});
addEventListener('keyup',e=>keys.delete(e.code));addEventListener('blur',()=>keys.clear());document.addEventListener('visibilitychange',()=>{keys.clear();last=0;fps.reset();});
addEventListener('mousemove',e=>{if(document.pointerLockElement===$('#world')&&!renderer.xr.isPresenting){camera.rotation.y-=e.movementX*.002;camera.rotation.x=T.MathUtils.clamp(camera.rotation.x-e.movementY*.002,-1.35,1.35);}});
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
const vrButton=VRButton.createButton(renderer);document.body.append(vrButton);
renderer.xr.addEventListener('sessionstart',()=>{keys.clear();walk=true;document.body.classList.add('walking');camera.rotation.set(0,0,0);fps.reset();edges.reset();last=0;vr.mesh.visible=false;});
renderer.xr.addEventListener('sessionend',()=>{vr.enabled=false;vr.mesh.visible=false;state.reset();edges.reset();fps.reset();last=0;camera.position.set(0,1.7,0);reset();});
reset();
renderer.setAnimationLoop((time,frame)=>{
  const elapsed=last?Math.max(0,(time-last)/1000):0;last=time;const dt=Math.min(.05,elapsed);
  const session=renderer.xr.getSession();state.update(session,frame,renderer.xr.getReferenceSpace(),document.hidden);
  if(!state.active){vr.enabled=false;vr.hideRays();fps.reset();return;}
  if(session){viewer.position.copy(state.pose.transform.position);viewer.orientation.copy(state.pose.transform.orientation);if(state.firstTracked)reset();}
  else {viewer.position.copy(camera.position);viewer.orientation.copy(camera.quaternion);}
  locomotion.settings.moveSpeed=settings.speed;
  if(session)locomotion.update(dt,session.inputSources,viewer);
  else if(walk&&!panelOpen)locomotion.move(dt,Number(keys.has('KeyD'))-Number(keys.has('KeyA')),Number(keys.has('KeyS')||keys.has('ArrowDown'))-Number(keys.has('KeyW')||keys.has('ArrowUp')),Number(keys.has('ArrowRight'))-Number(keys.has('ArrowLeft')),viewer);
  rig.updateMatrixWorld(true);head.copy(viewer.position).applyMatrix4(rig.matrixWorld);
  if(session||walk){
    const slide=sliding.update(head.x,head.z,dt,settings.slideSlope,settings.speed);
    rig.position.x+=slide.x-head.x;rig.position.z+=slide.z-head.z;
    head.x=slide.x;head.z=slide.z;
  }
  const ground=world.height(head.x,head.z);rig.position.y+=(ground-rig.position.y)*(1-Math.exp(-dt*18));rig.updateMatrixWorld(true);
  terrain.update(head.x,head.z);
  if(session){
    let toggle=false;edges.retain(session.inputSources);
    for(const source of session.inputSources)if(source.gamepad?.mapping==='xr-standard')toggle=edges.sample(source,5,state.resumed).pressed||toggle;
    if(toggle){vr.toggle();if(vr.mesh.visible)placePanel();}
    vr.enabled=state.active;
    for(const c of controllers){const source=c.userData.source;const tracked=source&&state.isTracked(source.targetRaySpace);vr.controllerStates.get(c).connected=!!tracked;}
    vr.update();
  }else {vr.enabled=false;vr.hideRays();}
  const reading=fps.sample(elapsed);if(reading!==null)stats.fps=reading;
  uiElapsed+=elapsed;
  if(uiElapsed>.5){uiElapsed=0;world.trail(head.x,head.z,projected,true);stats.along=projected.along;stats.remaining=world.totalLength-projected.along;stats.elevation=ground;model.refresh();$('#status').textContent=`${Math.round(ground)} m elevation · ${(stats.remaining/1000).toFixed(2)} km to summit${projected.distance>20?' · off trail':''}${stats.remaining<8&&projected.distance<10?' · Summit reached':''}`;}
  renderer.render(scene,camera);if(frameCount===0)document.body.classList.remove('loading');stats.triangles=renderer.info.render.triangles;frameCount++;
});
// Desktop inspection surface for desktop acceptance checks.
window.hike={world,terrain,settings,rig,camera,renderer,scene,model,stats,reset,get frameCount(){return frameCount;}};
} catch(error) {
  document.body.classList.remove('loading');
  $('#intro').hidden=true;$('#status').textContent='Mountain generation failed · choose another seed';
  $('#error').hidden=false;$('#error').textContent=`Seed ${seed} could not load: ${error.message}. Choose Random seed or enter another seed below.`;
  setPanel(true);console.error(error);
}
