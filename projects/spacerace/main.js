import * as THREE from '../forest/vendor/three.module.js';
import {CONFIG as c, FT} from './config.mjs?v=17';
import {Simulation,densityAt,triggerInput} from './simulation.mjs?v=3';
import {createRings} from './rings.js?v=7';
import {createParticles} from './particles.js';
import {FrameRate} from './frame-rate.mjs?v=1';
import {RingAudio} from './ring-audio.mjs?v=2';
import {requestFrameRate} from './xr-frame-rate.mjs?v=1';
const status=document.querySelector('#status'), button=document.querySelector('#vr');
try { start(); } catch(error) { status.textContent='Could not start WebGL: '+error.message; console.error(error); }
function start(){
const renderer=new THREE.WebGLRenderer({antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setSize(innerWidth,innerHeight);
renderer.setClearColor(0x000000); renderer.xr.enabled=true;renderer.xr.setReferenceSpaceType('local');
document.body.append(renderer.domElement);
const scene=new THREE.Scene(), camera=new THREE.PerspectiveCamera(70,innerWidth/innerHeight,0.03,Math.max(500,c.ringCount*c.ringSpacing+c.rearBoundary+10));
const world=new THREE.Group();scene.add(world);
const sim=new Simulation(c), particles=createParticles(sim); world.add(particles.mesh);
const sound=new RingAudio(c,sim.rings.length), soundButton=document.querySelector('#sound');
soundButton.disabled=!sound.available;
soundButton.textContent=sound.available?'Sound: On':'Sound unavailable';
soundButton.addEventListener('click',()=>{soundButton.textContent=sound.toggle()?'Sound: On':'Sound: Off';});
const audioPosition=new THREE.Vector3(),audioForward=new THREE.Vector3(),audioUp=new THREE.Vector3(),audioOrientation=new THREE.Quaternion(),worldInverse=new THREE.Quaternion();
window.addEventListener('pagehide',()=>sound.dispose(),{once:true});
const rings=createRings(c,sim.rings.length);world.add(rings.group);
const hudCanvas=document.createElement('canvas');hudCanvas.width=768;hudCanvas.height=160;
const ctx=hudCanvas.getContext('2d'), texture=new THREE.CanvasTexture(hudCanvas);texture.colorSpace=THREE.SRGBColorSpace;
const hud=new THREE.Mesh(new THREE.PlaneGeometry(0.74,0.154),new THREE.MeshBasicMaterial({map:texture,transparent:true,depthTest:false,depthWrite:false}));
hud.renderOrder=10;hud.visible=false;scene.add(hud);
const targetPosition=new THREE.Vector3(), targetOrientation=new THREE.Quaternion(), offset=new THREE.Vector3(), eyePosition=new THREE.Vector3(), eyeOrientation=new THREE.Quaternion();
const forward=new THREE.Vector3();let session=null, refreshPending=false, anchorPending=false, previousTime=null, hudTime=1, density=densityAt(0), hudReady=false;
const frameRate=new FrameRate();
const keys=new Set(); let dragging=false,lastX=0,lastY=0,yaw=0,pitch=0;
window.addEventListener('keydown',event=>{if(['ArrowUp','ArrowDown'].includes(event.code)){event.preventDefault();sound.unlock();keys.add(event.code);}});
window.addEventListener('keyup',event=>keys.delete(event.code));
window.addEventListener('blur',()=>{keys.clear();dragging=false;previousTime=null;sound.silence();});
document.addEventListener('visibilitychange',()=>{keys.clear();previousTime=null;sound.silence();});
renderer.domElement.addEventListener('pointerdown',event=>{if(session)return;sound.unlock();dragging=true;lastX=event.clientX;lastY=event.clientY;renderer.domElement.setPointerCapture(event.pointerId);});
renderer.domElement.addEventListener('pointermove',event=>{if(!dragging||session)return;yaw-=(event.clientX-lastX)*0.003;pitch=Math.max(-1.45,Math.min(1.45,pitch-(event.clientY-lastY)*0.003));lastX=event.clientX;lastY=event.clientY;camera.quaternion.setFromEuler(new THREE.Euler(pitch,yaw,0,'YXZ'));});
renderer.domElement.addEventListener('pointerup',()=>dragging=false);
renderer.domElement.addEventListener('lostpointercapture',()=>dragging=false);
window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
async function checkVR(){try{const available=!!navigator.xr&&await navigator.xr.isSessionSupported('immersive-vr');button.disabled=!available;button.textContent=available?'Enter VR':'VR unavailable';status.textContent=available?'Face along your intended flight path before entering VR.':isSecureContext?'Desktop preview · Use Meta Quest Browser for VR.':'WebXR requires HTTPS or localhost.';}catch(error){button.disabled=true;status.textContent='VR check failed: '+error.message;}}
button.addEventListener('click',async()=>{
 sound.unlock();
 button.disabled=true;let requested;
 try{
  requested=await navigator.xr.requestSession('immersive-vr');
  requested.addEventListener('end',()=>{sound.silence();session=null;refreshPending=false;anchorPending=false;hud.visible=false;hudReady=false;previousTime=null;sim.reset();density=densityAt(0);world.position.set(0,0,0);world.quaternion.identity();camera.position.set(0,0,0);camera.quaternion.setFromEuler(new THREE.Euler(pitch,yaw,0,'YXZ'));document.body.classList.remove('xr');button.disabled=false;button.textContent='Enter VR';});
  await renderer.xr.setSession(requested);session=requested;sound.silence();refreshPending=c.targetFrameRate!==null;sim.reset();density=densityAt(0);anchorPending=true;previousTime=null;keys.clear();dragging=false;document.body.classList.add('xr');
 }catch(error){if(requested)await requested.end().catch(()=>{});button.disabled=false;status.textContent='Could not enter VR: '+error.message;}
});
checkVR();
renderer.setAnimationLoop((time,frame)=>{
 let pose=null;
 if(session&&frame)pose=frame.getViewerPose(renderer.xr.getReferenceSpace());
 const active=session?session.visibilityState==='visible'&&!!pose:!document.hidden;
 const elapsed=active&&previousTime!==null?(time-previousTime)/1000:0;
 if(elapsed>0)frameRate.sample(elapsed);else frameRate.reset();
 const dt=Math.min(elapsed,0.05);
 previousTime=active?time:null;
 if(pose){
  const p=pose.transform.position,q=pose.transform.orientation;
  eyePosition.set(p.x,p.y,p.z);eyeOrientation.set(q.x,q.y,q.z,q.w);
  if(anchorPending){world.position.copy(eyePosition);forward.set(0,0,-1).applyQuaternion(eyeOrientation);world.rotation.set(0,Math.atan2(-forward.x,-forward.z),0);anchorPending=false;hudReady=false;}
 }
 let input={accelerate:Number(keys.has('ArrowUp')),decelerate:Number(keys.has('ArrowDown'))};
 if(session)input=active?triggerInput(session.inputSources):{accelerate:0,decelerate:0};
 if(active){sim.step(dt,input.accelerate,input.decelerate);density+=(densityAt(sim.speed)-density)*(1-Math.exp(-dt/0.18));}
 // Express the listener in the fixed flight frame used by the rings.
 world.updateMatrixWorld();
 audioPosition.copy(session?eyePosition:camera.position);world.worldToLocal(audioPosition);
 worldInverse.copy(world.quaternion).invert();audioOrientation.copy(worldInverse).multiply(session?eyeOrientation:camera.quaternion);
 audioForward.set(0,0,-1).applyQuaternion(audioOrientation);audioUp.set(0,1,0).applyQuaternion(audioOrientation);
 sound.update(sim.rings,sim.speed,active&&!anchorPending,audioPosition,audioForward,audioUp);
 particles.update(density);
 rings.update(sim.rings,sim.speed);
 hud.visible=!!session&&active&&!anchorPending;
 if(hud.visible){
  targetOrientation.copy(eyeOrientation);offset.set(0,-0.38,-1.7).applyQuaternion(targetOrientation);targetPosition.copy(eyePosition).add(offset);
  if(!hudReady){hud.position.copy(targetPosition);hud.quaternion.copy(targetOrientation);hudReady=true;}
  else{const follow=1-Math.exp(-dt/0.10);hud.position.lerp(targetPosition,follow);hud.quaternion.slerp(targetOrientation,follow);}
 }
 hudTime+=dt;
 if(hudTime>=0.1){hudTime=0;const feetPerSecond=sim.speed/FT,mph=feetPerSecond*3600/5280,count=Math.round(density);
  const fpsLabel=frameRate.value===null?'— FPS':`${frameRate.value.toFixed(0)} FPS`;
  document.querySelector('#stats').textContent=`${feetPerSecond.toFixed(0)} ft/s · ${mph.toFixed(1)} mph · ${count} particles · ${fpsLabel}`;
  ctx.clearRect(0,0,768,160);ctx.fillStyle='rgba(4,12,20,0.8)';ctx.fillRect(0,0,768,160);ctx.textAlign='center';ctx.fillStyle='#d9eafa';ctx.font='36px system-ui';ctx.fillText(`${feetPerSecond.toFixed(0)} ft/s     ${mph.toFixed(1)} mph`,384,65);ctx.fillStyle='#9eb8ca';ctx.font='26px system-ui';ctx.fillText(`${count} particles · ${fpsLabel}`,384,119);texture.needsUpdate=true;
 }
 renderer.render(scene,camera);
 // Start rendering before requesting a different display rate. Never await it:
 // some runtimes may leave this optional request pending indefinitely.
 if(session&&frame&&active&&refreshPending){
  refreshPending=false;
  void requestFrameRate(session,c.targetFrameRate);
 }
});
}
