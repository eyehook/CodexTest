import * as THREE from '../../shared/vendor/three-r180/three.module.js';
import {VRCheckbox} from '../../shared/ui/checkbox.mjs';
import {ControlModel} from '../../shared/ui/controls.mjs';
import {styleVRControl} from './vr-control-style.mjs?v=74';
import {SettingsSlider} from './bee-slider.mjs?v=73';
import {ROOM_SIZE,ROOM_FRONT,ROOM_BACK} from './garden-layout.mjs?v=46';
export function createVRSettings(scene,values,navigation){
 const definitions=[{id:'heightOffset',label:'Height offset',min:0,max:1,step:.05,unit:'m'}, {id:'moveSpeed',label:'Movement speed',min:.25,max:3,step:.25,unit:'m/s',disabled:()=>values.teleport}, {id:'turnSpeed',label:'Turn speed',min:15,max:120,step:15,unit:'°/s',disabled:()=>values.snapTurn}, {id:'snapAngle',label:'Snap',stops:[15,30,45],min:15,max:45,step:15,unit:'°',disabled:()=>!values.snapTurn}].map(d=>({...d,kind:'number',stepBase:d.min,get:()=>values[d.id],set:value=>{values[d.id]=value;apply();},format:value=>value.toFixed(['turnSpeed','snapAngle'].includes(d.id)?0:2)+' '+d.unit}));
 function apply(){navigation.settings.moveSpeed=values.moveSpeed;navigation.settings.turnSpeed=values.turnSpeed*Math.PI/180;}
 definitions.push({id:'teleport',kind:'toggle',label:'Teleport',get:()=>values.teleport,set:value=>{values.teleport=value;}});
 definitions.push({id:'snapTurn',kind:'toggle',label:'Snap turn',get:()=>values.snapTurn,set:value=>{values.snapTurn=value;}});
 apply();const model=new ControlModel(definitions),group=new THREE.Group();group.name='vr-settings-panel';group.position.set(-ROOM_SIZE/2+.075,1.4,(ROOM_FRONT+ROOM_BACK)/2);group.rotation.y=Math.PI/2;scene.add(group);
 const board=new THREE.Mesh(new THREE.BoxGeometry(1.9,2.1,.06),new THREE.MeshStandardMaterial({color:0x1d2e27,roughness:.85}));board.position.z=-.035;board.userData.surface='environment';group.add(board);
 const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=160;const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
 const title=new THREE.Mesh(new THREE.PlaneGeometry(1.65,1.65*160/1024),new THREE.MeshBasicMaterial({map:texture,toneMapped:false}));title.position.set(0,.82,.003);group.add(title);const c=canvas.getContext('2d');c.fillStyle='#1d2e27';c.fillRect(0,0,1024,160);c.fillStyle='#edf2e8';c.font='bold 48px system-ui';c.textAlign='left';c.textBaseline='middle';c.fillText('VR Settings',54,48);c.fillStyle='#a9beb1';c.font='26px system-ui';c.fillText('Comfort & movement',54,115);
 const controls=definitions.filter(d=>d.kind==='number').map((d,i)=>{const slider=new SettingsSlider(model,d.id);slider.mesh.name='slider-'+d.id;styleVRControl(slider);slider.mesh.position.set(0,i===0?.46:i===1?-.13:-.71,.003);group.add(slider.mesh);return slider;});
 // The panel skin supplies full-width, aspect-correct checkbox rows.
 const checkboxHeight=.18,checkboxWidth=checkboxHeight*1024/212;
 const snapCheckbox=new VRCheckbox(model,'snapTurn',{width:checkboxWidth,height:checkboxHeight});styleVRControl(snapCheckbox);snapCheckbox.mesh.position.set(0,-.42,.003);snapCheckbox.mesh.userData.control=snapCheckbox;group.add(snapCheckbox.mesh);controls.push(snapCheckbox);
 const teleportCheckbox=new VRCheckbox(model,'teleport',{width:checkboxWidth,height:checkboxHeight});styleVRControl(teleportCheckbox);teleportCheckbox.mesh.position.set(0,.16,.003);teleportCheckbox.mesh.userData.control=teleportCheckbox;group.add(teleportCheckbox.mesh);controls.push(teleportCheckbox);
 const syncTurn=()=>{controls[2].mesh.visible=!values.snapTurn;controls[3].mesh.visible=values.snapTurn;};model.subscribe(syncTurn);syncTurn();
 const footerCanvas=document.createElement('canvas');footerCanvas.width=1024;footerCanvas.height=80;const footerTexture=new THREE.CanvasTexture(footerCanvas);footerTexture.colorSpace=THREE.SRGBColorSpace;const footer=new THREE.Mesh(new THREE.PlaneGeometry(1.65,1.65*80/1024),new THREE.MeshBasicMaterial({map:footerTexture,toneMapped:false}));footer.position.set(0,-.96,.003);group.add(footer);
 const panel={model,group,controls,get targets(){return [board,...controls.filter(c=>c.mesh.visible).map(c=>c.mesh)];},setHover(control){for(const widget of controls)widget.setHover(widget===control);},setMessage(message){const c=footerCanvas.getContext('2d');c.fillStyle='#1d2e27';c.fillRect(0,0,1024,80);c.fillStyle='#a9beb1';c.font='24px system-ui';c.textAlign='left';c.textBaseline='middle';c.fillText(message,54,40,916);footerTexture.needsUpdate=true;}};panel.setMessage('Settings save automatically');return panel;
}
export function applyHeightOffset(rig,settings,inVR){rig.position.y=inVR?settings.heightOffset:0;}
