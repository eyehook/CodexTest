import * as THREE from '../../projects/forest/vendor/three.module.js';
// This changes the environment/cockpit anchors once at entry, never the headset camera.
export function alignAnchors(cockpit,world,position,orientation,eyeHeight){
 const forward=new THREE.Vector3(0,0,-1).applyQuaternion(orientation);
 const yaw=Math.atan2(-forward.x,-forward.z);
 cockpit.position.copy(position);cockpit.rotation.set(0,yaw,0);
 world.position.set(position.x,position.y-eyeHeight,position.z);world.rotation.set(0,yaw,0);
}
export function createXR({renderer,button,status,onStart,onEnd}){
 let session=null,starting=false;
 renderer.xr.enabled=true;renderer.xr.setReferenceSpaceType('local');
 async function check(){
  try{const supported=!!navigator.xr&&await navigator.xr.isSessionSupported('immersive-vr');button.disabled=!supported;button.textContent=supported?'Enter VR':'VR unavailable';status.textContent=supported?'Sit comfortably, face forward, then enter VR.':window.isSecureContext?'Desktop preview · Open in Meta Quest Browser for VR.':'VR needs HTTPS or localhost. Desktop preview is available.';}
  catch(error){button.disabled=true;status.textContent='VR check failed: '+error.message;}
 }
 button.addEventListener('click',async()=>{
  if(starting||session)return;starting=true;button.disabled=true;
  let requested=null;
  try{
   requested=await navigator.xr.requestSession('immersive-vr');
   requested.addEventListener('end',()=>{session=null;onEnd();button.disabled=false;button.textContent='Enter VR';status.textContent='Session ended. Sit comfortably to enter again.';});
   await renderer.xr.setSession(requested);session=requested;onStart();
  }catch(error){if(requested)await requested.end().catch(()=>{});session=null;button.disabled=false;status.textContent='Could not enter VR: '+error.message;}
  finally{starting=false;}
 });
 check();return {get session(){return session;}};
}
