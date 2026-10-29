import * as THREE from '../../shared/vendor/three-r180/three.module.js';
import './style.css';
import {CONFIG} from './config.mjs';
import {createSimulation,stepSimulation} from './simulation.mjs';
import {createKeyboardInput,controllerSteering} from './input.mjs';
import {createCockpit} from './cockpit.mjs';
import {createWorld} from './world.mjs';
import {alignAnchors,createXR} from './xr.mjs';

if(import.meta.env.DEV)document.querySelector('.back').remove();
const button=document.querySelector('#enter'),status=document.querySelector('#status'),panel=document.querySelector('#intro');
try{
 const renderer=new THREE.WebGLRenderer({antialias:true});
 renderer.setPixelRatio(Math.min(devicePixelRatio,CONFIG.pixelRatioCap));renderer.setSize(innerWidth,innerHeight);renderer.outputColorSpace=THREE.SRGBColorSpace;document.body.prepend(renderer.domElement);
 const scene=new THREE.Scene();scene.background=new THREE.Color(0x9fc9ca);scene.fog=new THREE.Fog(0x9fc9ca,CONFIG.fogNear,CONFIG.fogFar);
 scene.add(new THREE.HemisphereLight(0xfff3dc,0x65716c,2.3));const sun=new THREE.DirectionalLight(0xffecd3,1.5);sun.position.set(-30,60,-30);scene.add(sun);
 const camera=new THREE.PerspectiveCamera(75,innerWidth/innerHeight,.05,CONFIG.farPlane);camera.position.y=CONFIG.seatedEyeHeight;
 const cockpit=createCockpit(),world=createWorld();scene.add(cockpit.group,world.anchor);
 function resize(){if(renderer.xr.isPresenting)return;camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);}
 const input=createKeyboardInput();let state=createSimulation(),aligned=true,last=null;
 const desktopPose=new THREE.Vector3(0,CONFIG.seatedEyeHeight,0),identity=new THREE.Quaternion();
 function desktop(){camera.position.copy(desktopPose);camera.quaternion.identity();alignAnchors(cockpit.group,world.anchor,desktopPose,identity,CONFIG.seatedEyeHeight);}
 desktop();
 const xr=createXR({renderer,button,status,onStart(){state=createSimulation();aligned=false;last=null;input.clear();cockpit.group.visible=false;world.anchor.visible=false;panel.hidden=true;},onEnd(){state=createSimulation();aligned=true;last=null;input.clear();desktop();cockpit.group.visible=true;world.anchor.visible=true;resize();panel.hidden=false;}});
 const initialPosition=new THREE.Vector3(),initialOrientation=new THREE.Quaternion();
 renderer.setAnimationLoop((time,frame)=>{
  const dt=last===null?0:Math.min(Math.max((time-last)/1000,0),.05);last=time;
  const session=xr.session;
  let steer=0,active=!document.hidden;
  if(renderer.xr.isPresenting){
   active=false;
   if(session&&frame&&session.visibilityState==='visible'){
    const reference=renderer.xr.getReferenceSpace(),pose=reference?frame.getViewerPose(reference):null;
    if(pose){
     if(!aligned){const p=pose.transform.position,q=pose.transform.orientation;initialPosition.set(p.x,p.y,p.z);initialOrientation.set(q.x,q.y,q.z,q.w);alignAnchors(cockpit.group,world.anchor,initialPosition,initialOrientation,CONFIG.seatedEyeHeight);cockpit.group.visible=true;world.anchor.visible=true;aligned=true;}
     active=aligned;steer=controllerSteering(session.inputSources);
    }
   }
  }else steer=input.read();
  if(active)stepSimulation(state,dt,steer);
  world.update(state);cockpit.update(active?steer:0,dt);renderer.render(scene,camera);
 });
 addEventListener('resize',resize);
}catch(error){button.disabled=true;status.textContent='Could not start 3D preview: '+error.message;console.error(error);}
