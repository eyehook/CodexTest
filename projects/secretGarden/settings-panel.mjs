import {RAIN_LEVELS} from './rain-cycle.mjs?v=133';
import * as THREE from '../../shared/vendor/three-r180/three.module.js';
import {ControlModel} from '../../shared/ui/controls.mjs';
import {VRCheckbox} from '../../shared/ui/checkbox.mjs';
import {SettingsSlider} from './bee-slider.mjs?v=73';
import {styleVRControl,ROOM_HOVER_BRIGHTNESS} from './vr-control-style.mjs?v=84';
import {ROOM_BACK} from './garden-layout.mjs?v=46';

export function createShadowSettings(scene,renderer,{onReset=()=>{},sound={enabled:true,setEnabled(value){this.enabled=value;}},rain={level:2,setLevel(value){this.level=value;}},bees={count:3,setCount(value){this.count=value;}}}={}){
 let refresh=true;
 const model=new ControlModel([{id:'shadows',kind:'toggle',label:'Shadows',get:()=>renderer.shadowMap.enabled,set:enabled=>{
  renderer.shadowMap.enabled=enabled;refresh=enabled;
  // Three compiles different shader variants when global shadow support changes.
  const materials=new Set();scene.traverse(object=>{for(const material of Array.isArray(object.material)?object.material:[object.material])if(material)materials.add(material);});
  for(const material of materials)material.needsUpdate=true;
 }},{id:'sound',kind:'toggle',label:'Sound',get:()=>sound.enabled,set:value=>sound.setEnabled(value)},{id:'bees',kind:'number',label:'Bees',stops:[0,5,10],stopFormat:value=>String(value),min:0,max:10,step:1,stepBase:0,get:()=>bees.count,set:count=>bees.setCount(count),format:count=>String(count)},{id:'rain',kind:'number',label:'Rain',min:0,max:4,step:1,stepBase:0,stops:[0,1,2,3,4],stopFormat:value=>RAIN_LEVELS[value],get:()=>rain.level,set:value=>rain.setLevel(value),format:value=>RAIN_LEVELS[value]},{id:'reset',kind:'action',label:'Reset Garden',run:onReset}]);
 return {model,beginFrame(changed){renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=renderer.shadowMap.enabled&&(refresh||changed);refresh=false;}};
}
export function createSettingsPanel(scene,renderer,options={}){
 const settings=createShadowSettings(scene,renderer,options),group=new THREE.Group();group.name='room-settings-panel';
 group.position.set(0,1.48,ROOM_BACK-.075);group.rotation.y=Math.PI;scene.add(group);
 const board=new THREE.Mesh(new THREE.BoxGeometry(1.9,2.2,.06),new THREE.MeshStandardMaterial({color:0x1d2e27,roughness:.85}));
 board.position.z=-.035;board.userData.surface='environment';group.add(board);
 const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=160;
 const ctx=canvas.getContext('2d');ctx.fillStyle='#1d2e27';ctx.fillRect(0,0,1024,160);ctx.fillStyle='#edf2e8';ctx.font='bold 48px system-ui';ctx.textAlign='left';ctx.textBaseline='middle';ctx.fillText('Settings',54,48);ctx.fillStyle='#a9beb1';ctx.font='26px system-ui';ctx.fillText('Garden settings',54,115);
 const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
 const title=new THREE.Mesh(new THREE.PlaneGeometry(1.65,1.65*160/1024),new THREE.MeshBasicMaterial({map:texture,toneMapped:false}));title.position.set(0,.86,.002);group.add(title);
 const checkbox=new VRCheckbox(settings.model,'shadows');styleVRControl(checkbox);checkbox.mesh.position.set(0,.60,.003);checkbox.mesh.userData.control=checkbox;group.add(checkbox.mesh);
 const soundCheckbox=new VRCheckbox(settings.model,'sound');styleVRControl(soundCheckbox);soundCheckbox.mesh.position.set(0,.34,.003);soundCheckbox.mesh.userData.control=soundCheckbox;group.add(soundCheckbox.mesh);
 const beesSlider=new SettingsSlider(settings.model,'bees');styleVRControl(beesSlider);beesSlider.mesh.position.set(0,-.02,.003);group.add(beesSlider.mesh);
 const rainSlider=new SettingsSlider(settings.model,'rain');styleVRControl(rainSlider);rainSlider.mesh.position.set(0,-.45,.003);group.add(rainSlider.mesh);
 const buttonCanvas=document.createElement('canvas');buttonCanvas.width=1024;buttonCanvas.height=120;
 const buttonTexture=new THREE.CanvasTexture(buttonCanvas);buttonTexture.colorSpace=THREE.SRGBColorSpace;
 const buttonMesh=new THREE.Mesh(new THREE.PlaneGeometry(1.65,1.65*120/1024),new THREE.MeshBasicMaterial({map:buttonTexture,alphaTest:.05,toneMapped:false}));
 buttonMesh.name='reset-garden-button';buttonMesh.position.set(0,-.86,.003);group.add(buttonMesh);
 let hover=false;
 const drawButton=()=>{const c=buttonCanvas.getContext('2d');c.clearRect(0,0,1024,120);c.fillStyle='#293e35';c.beginPath();c.roundRect(0,0,1024,120,18);c.fill();c.fillStyle='#dfbd79';c.font='38px system-ui';c.textAlign='left';c.textBaseline='middle';c.fillText(settings.model.label(settings.model.definition('reset'),'vr'),54,60);buttonTexture.needsUpdate=true;};
 const resetButton={mesh:buttonMesh,activate({source='vr'}={}){for(let object=buttonMesh;object;object=object.parent)if(!object.visible)return false;return settings.model.activate('reset',{source});},setHover(value){value=!!value;if(value!==hover){hover=value;const brightness=hover?ROOM_HOVER_BRIGHTNESS:1;buttonMesh.material.color.setRGB(brightness,brightness,brightness);}}};
 buttonMesh.userData.control=resetButton;drawButton();
 const controls=[checkbox,soundCheckbox,beesSlider,rainSlider,resetButton];
 return {...settings,group,checkbox,soundCheckbox,beesSlider,rainSlider,resetButton,setHover(control){for(const widget of controls)widget.setHover(widget===control);},targets:[checkbox.mesh,soundCheckbox.mesh,beesSlider.mesh,rainSlider.mesh,buttonMesh,board]};
}
