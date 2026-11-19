import * as T from '../../shared/vendor/three-r180/three.module.js';
import {VRButton} from '../../shared/vendor/three-r180/addons/VRButton.js';
import {requestFrameRate} from '../../shared/xr/frame-rate.mjs';
import {FrameRateCounter} from '../../shared/performance/frame-rate.mjs';
import {XRFrameState} from '../../shared/xr/session.mjs';
import {ControlModel} from '../../shared/ui/controls.mjs';
import {DesktopControls} from '../../shared/ui/desktop.mjs';
import {VRSliderPanel} from '../../shared/ui/vr-slider-panel.mjs';
import {C} from './physics.mjs';
import {Game} from './game.mjs?v=1.0.27';
import {createView} from './view.mjs?v=1.0.27';
import {Sound} from './audio.mjs';
import {TableGrab} from './table-grab.mjs?v=1.0.27';
import {ServeInput} from './serve-input.mjs?v=1.0.27';
import {ResultDialog} from './result-dialog.mjs?v=1.0.27';
import {HandInput} from './input.mjs?v=1.0.27';
const scene=new T.Scene();scene.background=new T.Color('#c5d6d4');scene.fog=new T.Fog('#c5d6d4',6,18);
const renderer=new T.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setSize(innerWidth,innerHeight);renderer.xr.enabled=true;renderer.xr.setReferenceSpaceType('local-floor');document.body.prepend(renderer.domElement);
const camera=new T.PerspectiveCamera(48,innerWidth/innerHeight,.03,30),rig=new T.Group();scene.add(rig);rig.add(camera);
function desktopCamera(){rig.position.set(0,0,0);rig.quaternion.identity();camera.position.set(0,2.6,3.05);camera.lookAt(0,.65,-.05);}
desktopCamera();scene.add(new T.HemisphereLight(0xf3fbff,0x577477,2.5));const light=new T.DirectionalLight(0xfff3db,2.6);light.position.set(-3,6,2);scene.add(light);
const sound=new Sound();const game=new Game((kind,a,x)=>sound.play(kind,a,x)),view=createView(scene);
const controllers=[renderer.xr.getController(0),renderer.xr.getController(1)];
for(const c of controllers){rig.add(c);c.addEventListener('connected',e=>{c.userData.inputSource=e.data;});c.addEventListener('disconnected',()=>{c.userData.inputSource=null;});}
const input=new HandInput(rig,controllers),frameState=new XRFrameState();let desktopOpen=false,accumulator=0,last=0,wasPaused=true,resetTracking=false;
const fps=new FrameRateCounter(),fpsText=()=>fps.value===null?'Measuring…':`${Math.round(fps.value)} FPS`;
const panelElement=document.querySelector('#panel'),status=document.querySelector('#status');
function setDesktopOpen(open){if(resultDialog.visible)return;desktopOpen=open;panelElement.hidden=!open;sound.unlock();sound.play('menu');}
const model=new ControlModel([
 {id:'skill',kind:'number',label:'Opponent skill',min:0,max:100,step:1,get:()=>game.skill,set:v=>{game.skill=v;game.ai.clock=0;},format:v=>`${Math.round(v)} / 100`},
 {id:'hand',kind:'toggle',label:'Main Hand',get:()=>input.mainHand==='right',set:v=>input.setHand(v?'right':'left'),format:v=>v?'Right':'Left'},
 {id:'fps',kind:'readout',label:'Debug FPS',get:()=>fps.value,format:fpsText,vr:false},
 {id:'new',kind:'action',label:'New game',run:()=>{resultDialog.hide();game.newGame();accumulator=0;setDesktopOpen(false);if(panel.mesh.visible)panel.toggle();}}
]);
const tableGrab=new TableGrab(rig,game),serveInput=new ServeInput(rig,game);
new DesktopControls(document.querySelector('#controls'),model,{numbers:false,showValues:true});
const resultDialog=new ResultDialog(scene,controllers,renderer.domElement,camera,()=>model.activate('new'));
const head=new T.Vector3(),forward=new T.Vector3(),orientation=new T.Quaternion();
const panel=new VRSliderPanel(scene,controllers,model,{title:'TIMEOUT',subtitle:'B / Y to resume • Point + trigger to adjust',width:.8,footerAction:{label:'New game',run:()=>model.activate('new')},readout:()=>`Debug FPS: ${fpsText()}`,onOpen:mesh=>{
  const pose=frameState.pose;if(!pose)return;head.copy(pose.transform.position).applyMatrix4(rig.matrixWorld);orientation.copy(pose.transform.orientation).premultiply(rig.quaternion);forward.set(0,0,-1).applyQuaternion(orientation);forward.y=0;forward.normalize();mesh.position.copy(head).addScaledVector(forward,.85);mesh.position.y=head.y-.12;mesh.lookAt(head);mesh.updateMatrixWorld(true);
}});
document.querySelector('#settings').onclick=()=>setDesktopOpen(!desktopOpen);document.querySelector('#resume').onclick=()=>setDesktopOpen(false);
window.addEventListener('keydown',e=>{if(e.code==='Escape')setDesktopOpen(!desktopOpen);});
const ray=new T.Raycaster(),mouse=new T.Vector2(),plane=new T.Plane(new T.Vector3(0,1,0),-.8),hit=new T.Vector3(),desired={x:0,z:.88};
renderer.domElement.addEventListener('pointermove',e=>{if(renderer.xr.isPresenting||desktopOpen||resultDialog.visible)return;mouse.set(e.clientX/innerWidth*2-1,1-e.clientY/innerHeight*2);ray.setFromCamera(mouse,camera);plane.constant=-game.height;if(ray.ray.intersectPlane(plane,hit)){desired.x=hit.x-game.tableX;desired.z=hit.z-game.tableZ;}});
window.addEventListener('pointerdown',()=>sound.unlock());
renderer.domElement.addEventListener('pointerdown',()=>{if(!renderer.xr.isPresenting&&!desktopOpen&&game.state==='placing'){game.previewServe(desired.x,desired.z);game.placeServe();wasPaused=true;}});
const vrButton=VRButton.createButton(renderer,{optionalFeatures:['local-floor']});document.body.append(vrButton);
renderer.xr.addEventListener('sessionstart',()=>{input.reset();tableGrab.reset();serveInput.reset();resultDialog.hide();frameState.reset();accumulator=0;panel.beginSession();rig.position.set(0,0,1.65);rig.quaternion.identity();sound.unlock();document.querySelector('header').hidden=true;panelElement.hidden=true;status.hidden=true;});
renderer.xr.addEventListener('sessionend',()=>{input.reset();tableGrab.reset();serveInput.reset();resultDialog.hide();panel.update(null);desktopCamera();accumulator=0;document.querySelector('header').hidden=false;panelElement.hidden=!desktopOpen;status.hidden=false;});
const reset=()=>{resetTracking=true;};let observedReference=null;
function animate(ms,frame){
 const elapsed=Math.max(0,(ms-last)/1000||0),dt=Math.min(.05,elapsed);last=ms;const session=renderer.xr.getSession(),reference=renderer.xr.getReferenceSpace();frameState.update(session,frame,reference,document.hidden);
 if(!frameState.active||frameState.changed||frameState.resumed){if(fps.value!==null){fps.reset();model.refresh();}else fps.reset();}
 else if(fps.sample(elapsed)!==null)model.refresh();
 if(reference!==observedReference){observedReference?.removeEventListener('reset',reset);observedReference=reference;reference?.addEventListener('reset',reset);}
 if(frameState.firstTracked){const pose=frameState.pose;orientation.copy(pose.transform.orientation);forward.set(0,0,-1).applyQuaternion(orientation);rig.rotation.y=Math.atan2(forward.x,-forward.z);head.copy(pose.transform.position).applyQuaternion(rig.quaternion);rig.position.set(-head.x,0,1.65-head.z);rig.updateMatrixWorld(true);
  // Calibrate once from the current floor-relative viewer pose, composed with the rig.
  head.copy(pose.transform.position).applyMatrix4(rig.matrixWorld);game.height=head.y*.5;
 }
 let tracked=true,grabbing=false,reseed=false;
 if(session&&frameState.active){const seed=frameState.resumed||resetTracking;reseed=seed;tracked=input.sample(session,frame,reference,seed);panel.enabled=!resultDialog.visible;if(panel.enabled)panel.update(session);else panel.suspend();grabbing=tableGrab.sample(session,frame,reference,{seed,enabled:!resultDialog.visible});resetTracking=false;if(tracked){desired.x=input.point.x-game.tableX;desired.z=input.point.z-game.tableZ;}}
 else if(session){serveInput.reset();tracked=false;tableGrab.cancel();panel.enabled=false;panel.suspend();}
 if(game.state==='placing'&&tracked)game.setTarget(desired.x,desired.z,true);
 if(session&&frameState.active)serveInput.update(session,frame,reference,input.mainHand,!panel.mesh.visible&&!grabbing&&tracked&&!reseed);
 else if(!session&&game.state==='placing'&&!desktopOpen)game.previewServe(desired.x,desired.z);
 const paused=resultDialog.visible||game.state==='placing'||!frameState.active||(session?(grabbing||panel.mesh.visible||!tracked):desktopOpen);
 if(paused){accumulator=0;game.setTarget(desired.x,desired.z,true);}
 else {
  const discontinuous=wasPaused||(session&&input.discontinuous);if(discontinuous)game.setTarget(desired.x,desired.z,true);
  accumulator+=dt;const steps=Math.min(12,Math.floor(accumulator/C.step)),startX=game.player.x,startZ=game.player.z;
  for(let i=1;i<=steps;i++){game.setTarget(startX+(desired.x-startX)*i/steps,startZ+(desired.z-startZ)*i/steps);game.step(C.step);accumulator-=C.step;}
 }
 wasPaused=paused;view.update(game,ms/1000,session?(grabbing?'MOVING TABLE':panel.mesh.visible?'PAUSED • SETTINGS':!tracked?(input.active?'CONTROLLER TRACKING PAUSED':'MAIN HAND NOT TRACKED'):''):desktopOpen?'PAUSED • SETTINGS':'');
 const text=!session&&game.state==='placing'?'YOUR SERVE • CLICK TO PLACE':game.message||'Move your blue mallet • Settings pauses play';if(status.textContent!==text)status.textContent=text;
 if(game.state!=='won')resultDialog.hide();
 else if(view.celebration.elapsed>=3.3&&!resultDialog.visible&&frameState.active){
  desktopOpen=false;panelElement.hidden=true;if(panel.mesh.visible)panel.toggle();
  if(session)resultDialog.showOnTable(game.scores[0]>=7,view.table);
  else {camera.getWorldPosition(head);camera.getWorldQuaternion(orientation);resultDialog.show(game.scores[0]>=7,head,orientation);}
 }
 resultDialog.update(session,frameState.active,frameState.resumed||reseed);
 renderer.render(scene,camera);
 if(session&&frameState.firstTracked)void requestFrameRate(session,120);
}
renderer.setAnimationLoop(animate);
window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
window.addEventListener('error',e=>{document.querySelector('#error').textContent=e.message;});
// Explicit diagnostic surface for integration tests; no production polling or captures.
window.airhockey={game,view,renderer,scene,camera,rig,input,panel,model,animate,frameState,tableGrab,serveInput,fps,resultDialog};
