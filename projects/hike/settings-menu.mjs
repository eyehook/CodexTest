import * as T from '../../shared/vendor/three-r180/three.module.js';
import {ButtonEdges} from '../../shared/xr/input.mjs';
import {sliderValue} from '../../shared/ui/slider.mjs';
import {ControlModel} from '../../shared/ui/controls.mjs';
import {VRControlPanel} from '../../shared/ui/vr-panel.mjs';
export const SETTINGS_KEY='hike.settings';
const defaults=()=>({shadows:false,heightOffset:0});
function normalizeSettings(value){return {shadows:value?.shadows===true,heightOffset:typeof value?.heightOffset==='number'&&Number.isFinite(value.heightOffset)?Math.max(0,Math.min(1.5,value.heightOffset)):0};}
export function loadSettings(storage){try{return normalizeSettings(JSON.parse(storage.getItem(SETTINGS_KEY)));}catch{return defaults();}}
export function saveSettings(storage,settings){storage.setItem(SETTINGS_KEY,JSON.stringify(normalizeSettings(settings)));}
const TABS=['General','Teleport','Debug'];
const PAGE_SIZE=7;
class SettingsPanel extends VRControlPanel {
 constructor(...args){super(...args);this.triggers=new ButtonEdges();this.drags=new Map();this.seen=new Set();this.seedTriggers=true;}
 cancelInteraction(){this.drags?.clear();this.seedTriggers=true;}
 hideRays(){super.hideRays();this.cancelInteraction();}
 update(){
  if(!this.enabled||!this.mesh.visible){this.hideRays();return;}
  const sources=this.controllers.map(c=>c.userData.source).filter(Boolean);this.triggers.retain(sources);
  for(const source of this.seen)if(!sources.includes(source))this.seen.delete(source);
  for(const controller of this.controllers){
   if(!this.enabled||!this.mesh.visible)break;
   const source=controller.userData.source,connected=this.controllerStates.get(controller).connected;
   if(!source||!connected){this.drags.delete(controller);if(source)this.seen.delete(source);continue;}
   const edge=this.triggers.sample(source,0,this.seedTriggers||!this.seen.has(source));this.seen.add(source);
   if(!edge.down){this.drags.delete(controller);continue;}
   const hit=this.hit(controller),definition=hit?.slider?this.pageRows[hit.row]:null;
   if(edge.pressed){if(definition)this.drags.set(controller,definition.id);else this.activate(hit);}
   if(definition&&this.drags.get(controller)===definition.id)this.model.set(definition.id,hit.value,{source:'vr'});
  }
  this.seedTriggers=false;super.update();
 }

 get pageRows(){return this.rows.concat(this.actions).slice((this.page??0)*PAGE_SIZE,((this.page??0)+1)*PAGE_SIZE);}
 draw(){
  const ctx=this.ctx,c=this.theme,tab=this.tab??'General',page=this.page??0;
  ctx.fillStyle=c.background;ctx.fillRect(0,0,1024,this.canvas.height);
  ctx.fillStyle=c.text;ctx.font='bold 36px system-ui';ctx.fillText('SETTINGS',30,55);
  ctx.font='20px system-ui';ctx.fillStyle=c.subtitle;ctx.fillText('Point and trigger to select · B / Y saves and closes',260,55);
  TABS.forEach((name,i)=>{ctx.fillStyle=name===tab?c.hover:c.button;ctx.fillRect(20,100+i*80,210,64);ctx.fillStyle=c.text;ctx.font='28px system-ui';ctx.fillText(name,38,142+i*80);});
  this.pageRows.forEach((d,i)=>{
   const y=100+i*72,disabled=this.model.disabled(d);
   ctx.fillStyle=this.hover===i*2+1?c.hover:c.row;ctx.fillRect(250,y,754,60);
   ctx.fillStyle=disabled?c.muted:c.text;ctx.font='22px system-ui';ctx.fillText(this.model.label(d,'vr'),268,y+37);
   if(d.kind==='toggle'){
    ctx.strokeStyle=c.accent;ctx.lineWidth=3;ctx.strokeRect(940,y+15,28,28);
    if(d.get()){ctx.beginPath();ctx.moveTo(945,y+28);ctx.lineTo(953,y+36);ctx.lineTo(964,y+20);ctx.stroke();}
   }else if(d.slider){
    ctx.fillStyle=c.row;ctx.fillRect(250,y,754,60);ctx.fillStyle=c.text;ctx.font='22px system-ui';ctx.fillText(this.model.label(d,'vr'),268,y+23);ctx.fillText(this.model.format(d),900,y+23);
    ctx.fillStyle=c.button;ctx.fillRect(280,y+40,690,8);const x=280+690*(d.get()-d.min)/(d.max-d.min);
    ctx.fillStyle=c.accent;ctx.fillRect(280,y+40,x-280,8);ctx.beginPath();ctx.arc(x,y+44,9,0,Math.PI*2);ctx.fill();
   }else if(d.kind==='number'){
    ctx.fillText(this.model.format(d),730,y+37);
    for(let j=0;j<2;j++){ctx.fillStyle=c.button;ctx.fillRect(850+j*76,y+5,64,50);ctx.fillStyle=c.text;ctx.fillText(j?'+':'−',871+j*76,y+37);}
   }else if(d.kind==='readout'){ctx.fillStyle=c.accent;ctx.fillText(this.model.format(d),770,y+37);}
  });
  if(this.rows.length+this.actions.length>PAGE_SIZE){ctx.fillStyle=c.button;ctx.fillRect(250,620,180,50);ctx.fillRect(824,620,180,50);ctx.fillStyle=c.text;ctx.font='22px system-ui';ctx.fillText('Previous',280,653);ctx.fillText('Next',878,653);ctx.fillText(`${page+1} / ${Math.ceil((this.rows.length+this.actions.length)/PAGE_SIZE)}`,585,653);}
  ctx.fillStyle=c.button;ctx.fillRect(250,700,754,60);ctx.fillStyle=c.text;ctx.font='28px system-ui';ctx.fillText('Save and Close',510,740);
  ctx.font='20px system-ui';ctx.fillStyle=c.muted;ctx.fillText(this.footer||'',250,795);this.texture.needsUpdate=true;
 }
 hit(controller){
  const hit=this.pointer.cast(controller,this.mesh);if(!hit)return null;
  return this.hitAt(hit.uv.x*1024,(1-hit.uv.y)*this.canvas.height,hit.distance);
 }
 hitAt(x,y,distance=2){
  if(x>=20&&x<=230&&y>=100&&y<340){const i=Math.floor((y-100)/80);return y<100+i*80+64?{tab:TABS[i],row:-i-2,sign:1,distance}:null;}
  if(x<250||x>1004)return null;
  if(y>=700&&y<=760)return {save:true,row:20,sign:1,distance};
  if(y>=620&&y<=670&&this.rows.length+this.actions.length>PAGE_SIZE){if(x<=430)return {page:-1,row:21,sign:1,distance};if(x>=824)return {page:1,row:22,sign:1,distance};}
  const row=Math.floor((y-100)/72),d=this.pageRows[row];if(!d||y<100||y>=100+row*72+60||d.kind==='readout'||this.model.disabled(d))return null;
  if(d.slider)return x>=280&&x<=970&&y>=100+row*72+30?{row,slider:true,value:sliderValue(d,x,280,690),sign:1,distance}:null;
  const sign=d.kind==='number'?(x>=850&&x<=914?-1:x>=926&&x<=990?1:0):1;
  return sign?{row,sign,distance}:null;
 }
 activate(hit){
  if(!hit)return;
  if(hit.tab){this.onTab(hit.tab);return;}
  if(hit.save){this.onSave();return;}
  if(hit.page){this.page=Math.max(0,Math.min(Math.ceil((this.rows.length+this.actions.length)/PAGE_SIZE)-1,(this.page??0)+hit.page));this.hover=-1;this.draw();return;}
  const d=this.pageRows[hit.row];if(!d)return;
  if(hit.slider){this.model.set(d.id,hit.value,{source:'vr'});return;}
  if(d.kind==='number')this.model.adjust(d.id,hit.sign);else this.model.activate(d.id,{source:'vr'});
 }
 resizeLayout(){this.resizeCanvas(820);}
}
export class SettingsMenu {
 constructor(scene,rig,renderer,controllers,{debugModel=null,onTeleport=()=>{}}={}){
  this.scene=scene;this.rig=rig;this.open=false;this.saved=defaults();try{this.saved=loadSettings(globalThis.localStorage);}catch{}this.draft={...this.saved};
  this.model=new ControlModel([
   {id:'shadows',kind:'toggle',label:'Shadows',get:()=>this.draft.shadows,set:v=>this.draft.shadows=v},
   {id:'heightOffset',kind:'number',slider:true,label:'Height offset',min:0,max:1.5,step:.05,stepBase:0,get:()=>this.draft.heightOffset,set:v=>this.draft.heightOffset=v,format:v=>`${v.toFixed(2)} m`},
  ]);
  this.panel=new SettingsPanel(scene,rig,renderer,this.model,{title:'SETTINGS',subtitle:'Point either controller · Trigger to select',distance:2,angle:0,width:1.7,controllers,controllerEvents:false,enabled:false});
  this.models={General:this.model,Teleport:new ControlModel(['base','summit'].map(id=>({id,kind:'action',label:id==='base'?'Base':'Summit',run:()=>{if(this.saveAndExit())onTeleport(id);}}))),Debug:debugModel??new ControlModel([])};
  this.panel.onTab=tab=>this.selectTab(tab);this.panel.onSave=()=>this.saveAndExit();
  this.panel.resizeCanvas(820);this.selectTab('General');
 }
 selectTab(tab){
  if(!this.models[tab])return;
  this.panel.cancelInteraction();this.panel.tab=tab;this.panel.page=0;this.panel.hover=-1;this.panel.setModel(this.models[tab]);
 }
 show(position,heading){
  if(this.open)return;
  this.draft={...this.saved};this.selectTab('General');this.model.refresh();this.previous={background:this.scene.background,fog:this.scene.fog,visible:new Map()};
  for(const child of this.scene.children){if(child===this.panel.mesh||child===this.rig)continue;this.previous.visible.set(child,child.visible);child.visible=false;}
  this.scene.background=new T.Color(0);this.scene.fog=null;this.open=true;
  this.panel.mesh.visible=true;this.panel.enabled=true;this.panel.follow(position,heading);
 }
 saveAndExit(){
  try{saveSettings(globalThis.localStorage,this.draft);this.saved={...this.draft};this.close();return true;}
  catch{this.panel.footer='Could not save settings. Please try again.';this.panel.draw();return false;}
 }
 close(){
  if(!this.open)return;
  this.scene.background=this.previous.background;this.scene.fog=this.previous.fog;
  for(const [child,visible] of this.previous.visible)child.visible=visible;
  this.open=false;this.panel.enabled=false;this.panel.mesh.visible=false;this.panel.hideRays();this.panel.footer='';
 }
}
