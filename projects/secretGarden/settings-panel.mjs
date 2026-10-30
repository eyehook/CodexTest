import * as THREE from '../../shared/vendor/three-r180/three.module.js';
import {ControlModel} from '../../shared/ui/controls.mjs';
import {VRCheckbox} from '../../shared/ui/checkbox.mjs';
import {ROOM_BACK} from './garden-layout.mjs?v=46';

export function createShadowSettings(scene,renderer,{onReset=()=>{}}={}){
 let refresh=true;
 const model=new ControlModel([{id:'shadows',kind:'toggle',label:'Shadows',get:()=>renderer.shadowMap.enabled,set:enabled=>{
  renderer.shadowMap.enabled=enabled;refresh=enabled;
  // Three compiles different shader variants when global shadow support changes.
  const materials=new Set();scene.traverse(object=>{for(const material of Array.isArray(object.material)?object.material:[object.material])if(material)materials.add(material);});
  for(const material of materials)material.needsUpdate=true;
 }},{id:'reset',kind:'action',label:'Reset Garden',run:onReset}]);
 return {model,beginFrame(changed){renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=renderer.shadowMap.enabled&&(refresh||changed);refresh=false;}};
}
export function createSettingsPanel(scene,renderer,options={}){
 const settings=createShadowSettings(scene,renderer,options),group=new THREE.Group();group.name='room-settings-panel';
 group.position.set(0,1.48,ROOM_BACK-.075);group.rotation.y=Math.PI;scene.add(group);
 const board=new THREE.Mesh(new THREE.BoxGeometry(1.5,1.05,.06),new THREE.MeshStandardMaterial({color:0x242e30,roughness:.85}));
 board.position.z=-.035;board.userData.surface='environment';group.add(board);
 const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=180;
 const ctx=canvas.getContext('2d');ctx.fillStyle='#eef1e7';ctx.font='bold 70px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('Garden Settings',512,90);
 const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
 const title=new THREE.Mesh(new THREE.PlaneGeometry(1.25,.22),new THREE.MeshBasicMaterial({map:texture,transparent:true,toneMapped:false}));title.position.set(0,.32,.002);group.add(title);
 const checkbox=new VRCheckbox(settings.model,'shadows');checkbox.mesh.position.set(0,.02,.003);checkbox.mesh.userData.control=checkbox;group.add(checkbox.mesh);
 const buttonCanvas=document.createElement('canvas');buttonCanvas.width=1024;buttonCanvas.height=212;
 const buttonTexture=new THREE.CanvasTexture(buttonCanvas);buttonTexture.colorSpace=THREE.SRGBColorSpace;
 const buttonMesh=new THREE.Mesh(new THREE.PlaneGeometry(1.16,.24),new THREE.MeshBasicMaterial({map:buttonTexture,toneMapped:false}));
 buttonMesh.name='reset-garden-button';buttonMesh.position.set(0,-.29,.003);group.add(buttonMesh);
 let hover=false;
 const drawButton=()=>{const c=buttonCanvas.getContext('2d');c.fillStyle=hover?'#a66139':'#654735';c.fillRect(0,0,1024,212);c.fillStyle='#ffffff';c.font='64px system-ui';c.textAlign='center';c.textBaseline='middle';c.fillText(settings.model.label(settings.model.definition('reset'),'vr'),512,106);buttonTexture.needsUpdate=true;};
 const resetButton={mesh:buttonMesh,activate({source='vr'}={}){for(let object=buttonMesh;object;object=object.parent)if(!object.visible)return false;return settings.model.activate('reset',{source});},setHover(value){value=!!value;if(value!==hover){hover=value;drawButton();}}};
 buttonMesh.userData.control=resetButton;drawButton();
 const controls=[checkbox,resetButton];
 return {...settings,group,checkbox,resetButton,setHover(control){for(const widget of controls)widget.setHover(widget===control);},targets:[checkbox.mesh,buttonMesh,board]};
}
