import {VRControlPanel} from './vr-panel.mjs?v=shared-ui-slider-1';
import {ChoiceBar} from './choice-bar.mjs?v=shared-ui-slider-1';
import {sliderValue} from './slider.mjs?v=shared-ui-slider-1';
const text=value=>String(typeof value==='function'?value():value??'');

// Weather's drag interaction and paged layout, generalized around a ControlModel.
export class VRSliderPanel extends VRControlPanel {
  constructor(scene,controllers,model,{title='TUNING',subtitle='Point + hold trigger to adjust',selection=null,footerAction=null,readout='',defaultSection='Controls',onOpen=()=>{},getSource=controller=>controller.userData.inputSource,toggleButton=5,triggerButton=0,width=0.9,theme={}}={}) {
    super(scene,null,null,model,{controllers,controllerEvents:false,width,pointer:{length:1.5,depthTest:false,renderOrder:10},theme:{background:'#131d28',text:'#f1f6fa',accent:'#a8e8ff',subtitle:'#b1c7d7',...theme}});
    Object.assign(this,{title,subtitle,selection,footerAction,readout,defaultSection,onOpen,getSource,toggleButton,triggerButton});
    this.previousButtons=new Map();this.previousTriggers=new Map();this.dragRows=new Map();this.generation=0;
    this.rays=this.controllers.map(controller=>this.controllerStates.get(controller).line);
    this.ready=true;this.resizeControls();this.seedTriggers=false;
  }
  setModel(model) { this.section=null;super.setModel(model); }
  resizeLayout() { if(this.ready)this.resizeControls(); }
  resizeControls() {
    this.sections=[...new Set(this.model.definitions.filter(d=>['number','toggle'].includes(d.kind)).map(d=>d.group??this.defaultSection))];
    if(!this.sections.includes(this.section))this.section=this.sections[0];
    this.visibleDefinitions=this.model.definitions.filter(d=>['number','toggle'].includes(d.kind)&&(d.group??this.defaultSection)===this.section);
    this.controlOffset=(this.selection?.options.length?100:0)+(this.sections.length>1?80:0);
    this.saveHeight=this.footerAction?80:0;
    this.resizeCanvas(276+this.saveHeight+this.controlOffset+this.visibleDefinitions.length*138);
    this.selectionBar=this.selection?new ChoiceBar({...this.selection}):null;
    this.sectionBar=this.sections.length>1?new ChoiceBar({options:this.sections.map(id=>({id,label:id})),getValue:()=>this.section,onSelect:id=>{this.section=id;this.resizeControls();},y:this.selection?.options.length?220:140,height:50,font:'27px sans-serif'}):null;
    this.generation++;this.dragRows.clear();this.seedTriggers=true;this.draw();
  }
  draw() {
    if(!this.ready)return;
    const ctx=this.ctx,c=this.theme;
    ctx.fillStyle=c.background;ctx.fillRect(0,0,1024,this.canvas.height);
    ctx.fillStyle=c.text;ctx.font=c.titleFont;ctx.fillText(text(this.title),55,70);
    ctx.font=c.subtitleFont;ctx.fillStyle=c.subtitle;ctx.fillText(text(this.subtitle),55,116);
    const choices={selected:c.selection,button:c.selectionButton,text:c.text,muted:c.muted};
    this.selectionBar?.draw(ctx,choices);this.sectionBar?.draw(ctx,choices);
    this.visibleDefinitions.forEach((d,index)=>{
      const y=180+this.controlOffset+index*138,value=d.get(),disabled=this.model.disabled(d);
      ctx.font=c.labelFont;ctx.fillStyle=disabled?c.muted:c.text;ctx.textAlign='left';ctx.fillText(this.model.label(d,'vr'),60,y);
      ctx.textAlign='right';ctx.fillText(this.model.format(d),964,y);ctx.textAlign='left';
      if(d.kind==='toggle'){ctx.fillStyle=value?c.accent:c.sliderTrack;ctx.fillRect(80,y+25,864,40);return;}
      ctx.fillStyle=c.sliderTrack;ctx.fillRect(80,y+37,864,12);
      const x=80+(value-d.min)/(d.max-d.min)*864;
      ctx.fillStyle=disabled?c.muted:c.accent;ctx.fillRect(80,y+37,x-80,12);
      ctx.beginPath();ctx.arc(x,y+43,17,0,Math.PI*2);ctx.fill();
    });
    if(this.footerAction){const disabled=typeof this.footerAction.disabled==='function'?this.footerAction.disabled():this.footerAction.disabled;ctx.fillStyle=disabled?c.button:c.selection;ctx.fillRect(544,this.canvas.height-116,420,54);ctx.fillStyle=disabled?c.muted:c.text;ctx.font=c.buttonFont;ctx.fillText(text(this.footerAction.label),562,this.canvas.height-80);}
    ctx.font=c.footerFont;ctx.fillStyle=c.accent;ctx.fillText(text(this.readout),60,this.canvas.height-30);
    this.texture.needsUpdate=true;
  }
  beginSession() {this.openPending=true;this.mesh.visible=false;this.previousButtons.clear();this.previousTriggers.clear();this.dragRows.clear();this.hideRays();}
  toggle() {super.toggle();this.dragRows.clear();if(this.mesh.visible)this.onOpen(this.mesh);}
  suspend() {this.dragRows.clear();this.seedTriggers=true;this.seedButtons=true;this.hideRays();}
  update(session) {
    if(!session){this.openPending=false;this.mesh.visible=false;this.previousButtons.clear();this.previousTriggers.clear();this.dragRows.clear();this.hideRays();return;}
    if(!this.enabled){this.suspend();return;}
    const sources=session.inputSources;
    if(this.openPending){
      this.openPending=false;
      for(const source of sources)this.previousButtons.set(source,!!source.gamepad?.buttons[this.toggleButton]?.pressed);
      this.seedTriggers=true;if(!this.mesh.visible)this.toggle();
    }
    if(this.seedButtons){for(const source of sources)this.previousButtons.set(source,!!source.gamepad?.buttons[this.toggleButton]?.pressed);this.seedButtons=false;}
    if(this.seedTriggers){for(const source of sources)this.previousTriggers.set(source,!!source.gamepad?.buttons[this.triggerButton]?.pressed);this.seedTriggers=false;}
    let toggle=false;
    for(const source of sources){const pressed=!!source.gamepad?.buttons[this.toggleButton]?.pressed;if(pressed&&!this.previousButtons.get(source))toggle=true;this.previousButtons.set(source,pressed);}
    if(toggle)this.toggle();
    for(const source of this.previousButtons.keys())if(!Array.prototype.includes.call(sources,source)){this.previousButtons.delete(source);this.previousTriggers.delete(source);this.dragRows.delete(source);}
    const generation=this.generation;
    for(let index=0;index<this.controllers.length;index++){
      if(this.generation!==generation)break;
      const controller=this.controllers[index],source=this.getSource(controller),ray=this.rays[index];
      ray.visible=this.mesh.visible&&!!source?.gamepad&&controller.visible&&Array.prototype.includes.call(sources,source);
      if(!source||!Array.prototype.includes.call(sources,source)){if(source){this.dragRows.delete(source);this.previousTriggers.delete(source);}continue;}
      const down=!!source.gamepad?.buttons[this.triggerButton]?.pressed,wasDown=this.previousTriggers.get(source);this.previousTriggers.set(source,down);
      if(!ray.visible){this.dragRows.delete(source);continue;}
      const hit=this.pointer.cast(controller,this.mesh);ray.scale.z=hit?hit.distance:1.5;
      if(!down){this.dragRows.delete(source);continue;}if(!hit)continue;
      const x=hit.uv.x*1024,y=(1-hit.uv.y)*this.canvas.height;
      if(!wasDown){
        if(this.footerAction&&x>=544&&x<=964&&y>=this.canvas.height-116&&y<=this.canvas.height-62){if(!(typeof this.footerAction.disabled==='function'?this.footerAction.disabled():this.footerAction.disabled))this.footerAction.run();continue;}
        if(this.selectionBar?.activateAt(x,y))continue;
        if(this.sectionBar?.activateAt(x,y))continue;
        const row=Math.round((y-223-this.controlOffset)/138),d=this.visibleDefinitions[row];
        if(d&&Math.abs(y-(223+this.controlOffset+row*138))<36&&!this.model.disabled(d)){
          if(d.kind==='toggle'){this.model.activate(d.id,{source:'vr'});continue;}
          this.dragRows.set(source,d.id);
        }
      }
      const id=this.dragRows.get(source),d=this.model.byId.get(id);
      if(d&&!this.model.disabled(d))this.model.set(id,sliderValue(d,x),{source:'vr'});else if(id)this.dragRows.delete(source);
    }
  }
  dispose(){if(this.disposed)return;this.previousButtons.clear();this.previousTriggers.clear();this.dragRows.clear();super.dispose();}
}
