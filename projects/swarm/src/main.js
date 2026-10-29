import * as T from '../../../shared/vendor/three-r180/three.module.js';
import {VRButton} from '../../../shared/vendor/three-r180/addons/VRButton.js';
import {config} from './config.js';
import {Wasp} from './Wasp.js';
import {Swarm} from './Swarm.js';
import {createScene} from './scene.js';
import {createDesktopTuning} from './tuning.js?v=native-controls-1';
import {VRPanel} from './VRPanel.js';
import {overviewDistance,fitDesktop} from './viewer.js';
import {Locomotion} from './locomotion.js';
const {scene,camera,renderer,rig}=createScene();
const wasp=new Wasp(config);wasp.update(0);
// Capture once: entering VR later still uses the wasp's original spawn.
const waspStart=wasp.position.clone();
camera.position.x=(camera.position.x+waspStart.x)/2;
camera.position.z=(camera.position.z+waspStart.z)/2;
camera.lookAt(waspStart);
const geometry=new T.BoxGeometry(1,1,1), material=new T.MeshLambertMaterial({color:0xff7800});
const leader=new T.Mesh(geometry,new T.MeshLambertMaterial({color:0xffffff}));leader.scale.setScalar(.2);scene.add(leader);
let swarm,bees;
function resetSwarm(){if(bees){scene.remove(bees);bees.dispose();}swarm=new Swarm(config,wasp.position);bees=new T.InstancedMesh(geometry,material,config.beeCount);bees.instanceMatrix.setUsage(T.DynamicDrawUsage);bees.frustumCulled=false;scene.add(bees);}
resetSwarm();const intro=document.querySelector('#intro');
const tuning=createDesktopTuning(document.querySelector('#tuning'),config,key=>{
 if(key==='beeCount')resetSwarm();
 panel.draw();
},()=>fitDesktop(camera,config.bounds));
document.body.append(VRButton.createButton(renderer));
const panel=new VRPanel(scene,rig,renderer,config,key=>{
 if(key==='beeCount')resetSwarm();
 tuning.sync();
});
const pose=new T.Vector3(),rotation=new T.Quaternion();
const headRotation=new T.Quaternion(),headAngles=new T.Euler(0,0,0,'YXZ'),headPosition=new T.Vector3();
const locomotion=new Locomotion(rig,config.locomotion);
const playerPosition=new T.Vector3();
let anchorPending=false;
// Move the previous ground-level overview spawn halfway toward the wasp start.
const vrStart=new T.Vector3(waspStart.x/2,0,(overviewDistance({x:20,z:20,minY:3,maxY:14},65,1)+waspStart.z)/2);
renderer.xr.addEventListener('sessionstart',()=>{pose.copy(camera.position);rotation.copy(camera.quaternion);camera.position.set(0,0,0);camera.quaternion.identity();anchorPending=true;locomotion.reset();tuning.setVisible(false);intro.hidden=true;});
renderer.xr.addEventListener('sessionend',()=>{rig.position.set(0,0,0);rig.quaternion.identity();camera.position.copy(pose);camera.quaternion.copy(rotation);panel.mesh.visible=false;locomotion.reset();anchorPending=false;tuning.sync();tuning.setVisible(true);intro.hidden=false;});
const angles=new T.Euler(0,0,0,'YXZ');let dragging=false;const canvas=renderer.domElement;
canvas.addEventListener('pointerdown',e=>{if(renderer.xr.isPresenting)return;dragging=true;canvas.setPointerCapture(e.pointerId);});
for(const event of ['pointerup','pointercancel'])canvas.addEventListener(event,()=>dragging=false);
canvas.addEventListener('pointermove',e=>{if(!dragging||renderer.xr.isPresenting)return;angles.setFromQuaternion(camera.quaternion);angles.y-=e.movementX*.004;angles.x=T.MathUtils.clamp(angles.x-e.movementY*.004,-1.45,1.45);camera.quaternion.setFromEuler(angles);});
canvas.addEventListener('wheel',e=>{e.preventDefault();if(!renderer.xr.isPresenting)camera.position.z=T.MathUtils.clamp(camera.position.z+e.deltaY*.02,6,65);},{passive:false});
const transform=new T.Object3D(),direction=new T.Vector3(),forward=new T.Vector3(0,0,1);let previous;
renderer.setAnimationLoop((time,frame)=>{
 const dt=previous===undefined?0:Math.min(Math.max((time-previous)/1000,0),.05);previous=time;
 const session=renderer.xr.getSession();
 const viewer=frame && session?.visibilityState==='visible'
   ? frame.getViewerPose(renderer.xr.getReferenceSpace()) : null;
 if(anchorPending && frame){
  if(!viewer)return;
  headRotation.copy(viewer.transform.orientation);headAngles.setFromQuaternion(headRotation);
  rig.rotation.y=-headAngles.y;
  headPosition.copy(viewer.transform.position).applyQuaternion(rig.quaternion);
  rig.position.set(vrStart.x-headPosition.x,0,vrStart.z-headPosition.z);
  rig.updateMatrixWorld(true);panel.mesh.visible=true;anchorPending=false;
 }
 if(viewer && !anchorPending){
  locomotion.update(dt,session.inputSources,viewer.transform,()=>panel.toggle());
  playerPosition.copy(viewer.transform.position).applyMatrix4(rig.matrixWorld);
  panel.follow(playerPosition,rig.quaternion);
 }else locomotion.reset();
 panel.update();
 const steps=Math.max(1,Math.ceil(dt/(1/90))),step=dt/steps;
 for(let i=0;i<steps;i++){wasp.update(step);swarm.update(step,wasp.position);}leader.position.copy(wasp.position);
 for(let i=0;i<swarm.boids.length;i++){const b=swarm.boids[i];transform.position.copy(b.position);transform.scale.setScalar(.1);if(b.velocity.lengthSq()>1e-8)transform.quaternion.setFromUnitVectors(forward,direction.copy(b.velocity).normalize());transform.updateMatrix();bees.setMatrixAt(i,transform.matrix);}
 bees.instanceMatrix.needsUpdate=true;renderer.render(scene,camera);
});
canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();document.querySelector('#status').textContent='Graphics context lost. Reload to restart.';});
