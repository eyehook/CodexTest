import * as THREE from '../../../shared/vendor/three-r180/three.module.js';
import {DesktopControls as SharedDesktop} from '../../../shared/ui/desktop.mjs?v=shared-ui-slider-1';
import {VRSliderPanel} from '../../../shared/ui/vr-slider-panel.mjs?v=shared-ui-slider-1';
import {createWeatherControls} from './control-model.mjs?v=shared-ui-slider-1';

export class DesktopControls extends SharedDesktop {
  constructor(container, parameters, model = null) {
    super(container, model ?? createWeatherControls(parameters), {idPrefix:'weather',numbers:false,showValues:true,groupMode:'headings',theme:{accent:'#a8e8ff',checkboxSize:'24px'}});
    this.ownsModel = !model;
  }
  dispose() { if(this.disposed)return;super.dispose();if(this.ownsModel)this.model.dispose(); }
}

export class VRControlPanel extends VRSliderPanel {
  constructor(scene, player, parameters, options = {}) {
    const state={mode:options.mode??'snow',fps:null,saveMessage:'Save settings'};
    const modes=options.modes??[],head=new THREE.Vector3(),direction=new THREE.Vector3(),target=new THREE.Vector3(),up=new THREE.Vector3(0,1,0);
    super(scene,player.controllers,options.model??createWeatherControls(parameters),{
      title:()=>`${modes.find(d=>d.id===state.mode)?.label??'Snow'} / WEATHER LAB`,
      subtitle:'Point + hold trigger to adjust · B / Y to close', defaultSection:'Weather',
      theme:{titleFont:'bold 40px sans-serif',subtitleFont:'24px sans-serif',labelFont:'30px sans-serif',buttonFont:'27px sans-serif',footerFont:'26px sans-serif'},
      selection:modes.length?{options:modes,getValue:()=>state.mode,onSelect:options.onSelect??(()=>{})}:null,
      footerAction:options.onSave?{label:()=>state.saveMessage,run:()=>{this.setSaveResult(options.onSave()!==false);}}:null,
      readout:()=>state.fps===null?'FPS  —':`FPS  ${state.fps}`,
      onOpen:mesh=>{
        player.getWorldPose(head,direction);direction.y=0;direction.normalize().applyAxisAngle(up,-Math.PI/4);
        mesh.position.copy(head).addScaledVector(direction,1.2);mesh.position.y-=0.15;
        target.copy(head);target.y=mesh.position.y;mesh.lookAt(target);mesh.updateMatrixWorld(true);
      },
    });
    this.state=state;this.parameters=parameters;this.player=player;this.ownsModel=!options.model;
  }
  get mode(){return this.state.mode;}
  get fps(){return this.state.fps;}
  get saveMessage(){return this.state.saveMessage;}
  onModelChange(){if(this.state)this.state.saveMessage='Save settings';this.draw();}
  setEffect(parameters,mode,model=null){
    const previous=this.model,owned=this.ownsModel;
    this.parameters=parameters;this.state.mode=mode;this.state.saveMessage='Save settings';this.ownsModel=!model;
    this.setModel(model??createWeatherControls(parameters));if(owned)previous.dispose();
  }
  setSaveResult(success){this.state.saveMessage=success===null?'Save settings':success?'Settings saved':'Save failed';if(this.mesh.visible)this.draw();}
  setFPS(fps){const next=Number.isFinite(fps)?Math.round(fps):null;if(next===this.state.fps)return;this.state.fps=next;if(this.mesh.visible)this.draw();}
  dispose(){if(this.disposed)return;super.dispose();if(this.ownsModel)this.model.dispose();}
}
