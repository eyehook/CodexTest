import {ROOM_PANEL_COLORS,ROOM_PANEL_DISABLED_OPACITY} from './room-panel-theme.mjs?v=163';
import {layoutRoomPanel} from './room-panel-layout.mjs?v=164';
import {ROOM_HOVER_BRIGHTNESS} from './vr-control-style.mjs?v=163';
import * as THREE from '../../shared/vendor/three-r180/three.module.js';
import {ControlModel} from '../../shared/ui/controls.mjs';
import {ROOM_SIZE,ROOM_FRONT,ROOM_BACK,ROOM_HEIGHT} from './garden-layout.mjs?v=46';
export function createSavePanel(scene,saves,{onSave,onLoad,onMessage=()=>{}}){
 const group=new THREE.Group();group.name='garden-save-panel';group.position.set(ROOM_SIZE/2-.075,ROOM_HEIGHT/2,(ROOM_FRONT+ROOM_BACK)/2);group.rotation.y=-Math.PI/2;scene.add(group);
 const board=new THREE.Mesh(new THREE.BoxGeometry(1.9,1.8,.06),new THREE.MeshStandardMaterial({color:ROOM_PANEL_COLORS.background,roughness:.85}));board.position.z=-.035;board.userData.surface='environment';group.add(board);
 const definitions=[];for(let i=0;i<3;i++)definitions.push({id:'save'+i,kind:'action',run:()=>onSave(i)},{id:'load'+i,kind:'action',disabled:()=>!saves.slots[i],run:()=>onLoad(i)});
 const model=new ControlModel(definitions),controls=[],targets=[board];if(saves.errors.length)onMessage('Some saves could not be read.');
 function canvasMesh(width,height,w,h,x,y){const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;const mesh=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({map:texture,alphaTest:.05,toneMapped:false}));mesh.position.set(x,y,.003);group.add(mesh);return {canvas,texture,mesh};}
 const header=canvasMesh(1024,160,1.65,1.65*160/1024,0,.67);
 const rows=Array.from({length:3},(_,i)=>{
  const row=canvasMesh(1024,210,1.65,1.65*210/1024,0,.23-i*.36);let hover=false;
  const control={mesh:row.mesh,activate({uv,source='vr'}={}){for(let o=row.mesh;o;o=o.parent)if(!o.visible)return false;if(!Number.isFinite(uv?.x)||uv.y<.12||uv.y>.88)return false;const x=uv.x*1024;if(x>=560&&x<=755)return model.activate('save'+i,{source});if(x>=790&&x<=985)return model.activate('load'+i,{source});return false;},setHover(value){if(hover!==!!value){hover=!!value;const brightness=hover?ROOM_HOVER_BRIGHTNESS:1;row.mesh.material.color.setRGB(brightness,brightness,brightness);}}};row.mesh.userData.control=control;row.hover=()=>hover;controls.push(control);targets.push(row.mesh);return row;
 });
 function draw(){
  const h=header.canvas.getContext('2d');h.fillStyle=ROOM_PANEL_COLORS.background;h.fillRect(0,0,1024,160);h.fillStyle=ROOM_PANEL_COLORS.text;h.font='bold 48px system-ui';h.textAlign='left';h.textBaseline='middle';h.fillText('Save / Load',54,80);header.texture.needsUpdate=true;
  rows.forEach((row,i)=>{const c=row.canvas.getContext('2d'),save=saves.slots[i];c.clearRect(0,0,1024,210);c.fillStyle=ROOM_PANEL_COLORS.control;c.beginPath();c.roundRect(0,0,1024,210,18);c.fill();c.fillStyle=ROOM_PANEL_COLORS.text;c.font='38px system-ui';c.textAlign='left';c.textBaseline='middle';c.fillText('Slot '+(i+1),54,64);c.fillStyle=ROOM_PANEL_COLORS.muted;c.font='26px system-ui';c.fillText(save?new Date(save.savedAt).toLocaleString():'Empty',54,125,470);
   for(const [label,x,enabled] of [['Save',560,true],['Load',790,!!save]]){c.globalAlpha=enabled?1:ROOM_PANEL_DISABLED_OPACITY;c.fillStyle=ROOM_PANEL_COLORS.control;c.beginPath();c.roundRect(x,45,195,120,12);c.fill();c.strokeStyle=ROOM_PANEL_COLORS.track;c.lineWidth=3;c.stroke();c.fillStyle=enabled?ROOM_PANEL_COLORS.accent:ROOM_PANEL_COLORS.muted;c.font='32px system-ui';c.textAlign='center';c.fillText(label,x+97.5,105);}c.globalAlpha=1;row.texture.needsUpdate=true;});
 }
 layoutRoomPanel(board,[header.mesh,...rows.map(row=>row.mesh)]);
 draw();return {group,model,controls,targets,rows,refresh:draw,setMessage(text){onMessage(text);draw();},setHover(control){for(const widget of controls)widget.setHover(widget===control);}};
}
