import * as THREE from '../../shared/vendor/three-r180/three.module.js';
import {ControlModel} from '../../shared/ui/controls.mjs';
import {ROOM_SIZE,ROOM_FRONT,ROOM_BACK} from './garden-layout.mjs?v=46';
export function createSavePanel(scene,saves,{onSave,onLoad}){
 const group=new THREE.Group();group.name='garden-save-panel';group.position.set(ROOM_SIZE/2-.075,1.48,(ROOM_FRONT+ROOM_BACK)/2);group.rotation.y=-Math.PI/2;scene.add(group);
 const board=new THREE.Mesh(new THREE.BoxGeometry(1.9,1.8,.06),new THREE.MeshStandardMaterial({color:0x1d2e27,roughness:.85}));board.position.z=-.035;board.userData.surface='environment';group.add(board);
 const definitions=[];for(let i=0;i<3;i++)definitions.push({id:'save'+i,kind:'action',run:()=>onSave(i)},{id:'load'+i,kind:'action',disabled:()=>!saves.slots[i],run:()=>onLoad(i)});
 const model=new ControlModel(definitions),controls=[],targets=[board];let message=saves.errors.length?'Some saves could not be read.':'3 slots · Saved on this device';
 function canvasMesh(width,height,w,h,x,y){const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;const mesh=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({map:texture,transparent:true,toneMapped:false}));mesh.position.set(x,y,.003);group.add(mesh);return {canvas,texture,mesh};}
 const header=canvasMesh(1024,160,1.65,1.65*160/1024,0,.67),footer=canvasMesh(1024,80,1.65,1.65*80/1024,0,-.75);
 const rows=Array.from({length:3},(_,i)=>{
  const row=canvasMesh(1024,210,1.65,1.65*210/1024,0,.23-i*.36);let hover=false;
  const control={mesh:row.mesh,activate({uv,source='vr'}={}){for(let o=row.mesh;o;o=o.parent)if(!o.visible)return false;if(!Number.isFinite(uv?.x)||uv.y<.12||uv.y>.88)return false;const x=uv.x*1024;if(x>=560&&x<=755)return model.activate('save'+i,{source});if(x>=790&&x<=985)return model.activate('load'+i,{source});return false;},setHover(value){if(hover!==!!value){hover=!!value;draw();}}};row.mesh.userData.control=control;row.hover=()=>hover;controls.push(control);targets.push(row.mesh);return row;
 });
 function draw(){
  const h=header.canvas.getContext('2d');h.fillStyle='#1d2e27';h.fillRect(0,0,1024,160);h.fillStyle='#edf2e8';h.font='bold 48px system-ui';h.textAlign='left';h.textBaseline='middle';h.fillText('Save / Load',54,48);h.fillStyle='#a9beb1';h.font='26px system-ui';h.fillText('Your gardens',54,115);header.texture.needsUpdate=true;
  rows.forEach((row,i)=>{const c=row.canvas.getContext('2d'),save=saves.slots[i];c.clearRect(0,0,1024,210);c.fillStyle=row.hover()?'#354d40':'#293e35';c.beginPath();c.roundRect(0,0,1024,210,18);c.fill();c.fillStyle='#edf2e8';c.font='38px system-ui';c.textAlign='left';c.textBaseline='middle';c.fillText('Slot '+(i+1),54,64);c.fillStyle='#a9beb1';c.font='26px system-ui';c.fillText(save?new Date(save.savedAt).toLocaleString():'Empty',54,125,470);
   for(const [label,x,enabled] of [['Save',560,true],['Load',790,!!save]]){c.globalAlpha=enabled?1:.35;c.fillStyle='#405548';c.beginPath();c.roundRect(x,45,195,120,12);c.fill();c.fillStyle=enabled?'#dfbd79':'#a9beb1';c.font='32px system-ui';c.textAlign='center';c.fillText(label,x+97.5,105);}c.globalAlpha=1;row.texture.needsUpdate=true;});
  const c=footer.canvas.getContext('2d');c.fillStyle='#1d2e27';c.fillRect(0,0,1024,80);c.fillStyle='#a9beb1';c.font='24px system-ui';c.textAlign='left';c.textBaseline='middle';c.fillText(message,54,40,916);footer.texture.needsUpdate=true;
 }
 draw();return {group,model,controls,targets,rows,refresh:draw,setMessage(text){message=text;draw();},setHover(control){for(const widget of controls)widget.setHover(widget===control);}};
}
