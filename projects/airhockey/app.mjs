import * as T from '../../shared/vendor/three-r180/three.module.js';
import {VRButton} from '../../shared/vendor/three-r180/addons/VRButton.js';
import {XRFrameState} from '../../shared/xr/session.mjs';
import {ControlModel} from '../../shared/ui/controls.mjs';
import {DesktopControls} from '../../shared/ui/desktop.mjs';
import {VRSliderPanel} from '../../shared/ui/vr-slider-panel.mjs';
import {C} from './physics.mjs';
import {Game} from './game.mjs';
import {createView} from './view.mjs';
import {Sound} from './audio.mjs';
import {HandInput} from './input.mjs';
const scene=new T.Scene();scene.background=new T.Color('#c5d6d4');scene.fog=new T.Fog('#c5d6d4',6,18);
const renderer=new T.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setSize(innerWidth,innerHeight);renderer.xr.enabled=true;renderer.xr.setReferenceSpaceType('local-floor');document.body.prepend(renderer.domElement);
const camera=new T.PerspectiveCamera(48,innerWidth/innerHeight,.03,30),rig=new T.Group();scene.add(rig);rig.add(camera);
function desktopCamera(){rig.position.set(0,0,0);rig.quaternion.identity();camera.position.set(0,2.6,3.05);camera.lookAt(0,.65,-.05);}
desktopCamera();scene.add(new T.HemisphereLight(0xf3fbff,0x577477,2.5));const light=new T.DirectionalLight(0xfff3db,2.6);light.position.set(-3,6,2);scene.add(light);
const sound=new Sound();const game=new Game((kind,a,x)=>sound.play(kind,a,x)),view=createView(scene);
const controllers=[renderer.xr.getController(0),renderer.xr.getController(1)];
for(const c of controllers){rig.add(c);c.addEventListener('connected',e=>{c.userData.inputSource=e.data;});c.addEventListener('disconnected',()=>{c.userData.inputSource=null;});const marker=new T.Mesh(new T.SphereGeometry(.013,10,6),new T.MeshBasicMaterial({color:0x79969e}));c.add(marker);c.userData.marker=marker;}
const input=new HandInput(rig,controllers),frameState=new XRFrameState();let desktopOpen=false,accumulator=0,last=0,wasPaused=true,resetTracking=false;
const panelElement=document.querySelector('#panel'),status=document.querySelector('#status');
function setDesktopOpen(open){desktopOpen=open;panelElement.hidden=!open;sound.unlock();sound.play('menu');}
const model=new ControlModel([
 {id:'height',kind:'number',label:'Table height',min:60,max:110,step:1,get:()=>game.height*100,set:v=>{game.height=v/100;},format:v=>`${Math.round(v)} cm`},
 {id:'skill',kind:'number',label:'Opponent skill',min:0,max:100,step:1,get:()=>game.skill,set:v=>{game.skill=v;game.ai.clock=0;},format:v=>`${Math.round(v)} / 100`},
 {id:'new',kind:'action',label:'New game',run:()=>{game.newGame();accumulator=0;}}
]);
new DesktopControls(document.querySelector('#controls'),model,{numbers:false,showValues:true});
const head=new T.Vector3(),forward=new T.Vector3(),orientation=new T.Quaternion();
const panel=new VRSliderPanel(scene,controllers,model,{title:'TIMEOUT',subtitle:'B / Y to resume • Point + trigger to adjust',width:.8,footerAction:{label:'New game',run:()=>model.activate('new')},readout:'Trigger chooses hand • Blue is you',onOpen:mesh=>{
  const pose=frameState.pose;if(!pose)return;head.copy(pose.transform.position).applyMatrix4(rig.matrixWorld);orientation.copy(pose.transform.orientation).premultiply(rig.quaternion);forward.set(0,0,-1).applyQuaternion(orientation);forward.y=0;forward.normalize();mesh.position.copy(head).addScaledVector(forward,.85);mesh.position.y=head.y-.12;mesh.lookAt(head);mesh.updateMatrixWorld(true);
}});
document.querySelector('#settings').onclick=()=>setDesktopOpen(!desktopOpen);document.querySelector('#resume').onclick=()=>setDesktopOpen(false);
window.addEventListener('keydown',e=>{if(e.code==='Escape')setDesktopOpen(!desktopOpen);});
const ray=new T.Raycaster(),mouse=new T.Vector2(),plane=new T.Plane(new T.Vector3(0,1,0),-.8),hit=new T.Vector3(),desired={x:0,z:.88};
renderer.domElement.addEventListener('pointermove',e=>{if(renderer.xr.isPresenting||desktopOpen)return;mouse.set(e.clientX/innerWidth*2-1,1-e.clientY/innerHeight*2);ray.setFromCamera(mouse,camera);plane.constant=-game.height;if(ray.ray.intersectPlane(plane,hit)){desired.x=hit.x;desired.z=hit.z;}});
window.addEventListener('pointerdown',()=>sound.unlock());
const vrButton=VRButton.createButton(renderer,{optionalFeatures:['local-floor']});document.body.append(vrButton);
renderer.xr.addEventListener('sessionstart',()=>{input.reset();frameState.reset();accumulator=0;panel.beginSession();rig.position.set(0,0,1.65);rig.quaternion.identity();sound.unlock();document.querySelector('header').hidden=true;panelElement.hidden=true;status.hidden=true;});
renderer.xr.addEventListener('sessionend',()=>{input.reset();panel.update(null);desktopCamera();accumulator=0;document.querySelector('header').hidden=false;panelElement.hidden=!desktopOpen;status.hidden=false;});
const reset=()=>{resetTracking=true;};let observedReference=null;
function animate(ms,frame){
 const dt=Math.max(0,Math.min(.05,(ms-last)/1000||0));last=ms;const session=renderer.xr.getSession(),reference=renderer.xr.getReferenceSpace();frameState.update(session,frame,reference,document.hidden);
 if(reference!==observedReference){observedReference?.removeEventListener('reset',reset);observedReference=reference;reference?.addEventListener('reset',reset);}
 if(frameState.firstTracked){const pose=frameState.pose;orientation.copy(pose.transform.orientation);forward.set(0,0,-1).applyQuaternion(orientation);rig.rotation.y=Math.atan2(forward.x,-forward.z);head.copy(pose.transform.position).applyQuaternion(rig.quaternion);rig.position.set(-head.x,0,1.65-head.z);rig.updateMatrixWorld(true);}
 let tracked=true;
 if(session&&frameState.active){tracked=input.sample(session,frame,reference,frameState.resumed||resetTracking);resetTracking=false;panel.enabled=true;panel.update(session);if(tracked){desired.x=input.point.x;desired.z=input.point.z;}}
 else if(session){tracked=false;panel.enabled=false;panel.suspend();}
 for(const c of controllers)c.userData.marker.material.color.set(c.userData.inputSource===input.active?0x53caff:0x79969e);
 const paused=!frameState.active||(session?(panel.mesh.visible||!tracked):desktopOpen);
 if(paused){accumulator=0;game.setTarget(desired.x,desired.z,true);}
 else {
  const discontinuous=wasPaused||(session&&input.discontinuous);if(discontinuous)game.setTarget(desired.x,desired.z,true);
  accumulator+=dt;const steps=Math.min(12,Math.floor(accumulator/C.step)),startX=game.player.x,startZ=game.player.z;
  for(let i=1;i<=steps;i++){game.setTarget(startX+(desired.x-startX)*i/steps,startZ+(desired.z-startZ)*i/steps);game.step(C.step);accumulator-=C.step;}
 }
 wasPaused=paused;view.update(game,ms/1000,session?(panel.mesh.visible?'PAUSED • SETTINGS':!tracked?(input.active?'CONTROLLER TRACKING PAUSED':'SQUEEZE TRIGGER TO PLAY'):''):desktopOpen?'PAUSED • SETTINGS':'');
 const text=game.message||'Move your blue mallet • Settings pauses play';if(status.textContent!==text)status.textContent=text;
 renderer.render(scene,camera);
}
renderer.setAnimationLoop(animate);
window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
window.addEventListener('error',e=>{document.querySelector('#error').textContent=e.message;});
// Explicit diagnostic surface for integration tests; no production polling or captures.
window.airhockey={game,view,renderer,scene,camera,rig,input,panel,model,animate,frameState};
