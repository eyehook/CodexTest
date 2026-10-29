import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Group,Scene,Vector3} from '../../shared/vendor/three-r180/three.module.js';
import {ControlModel} from '../../shared/ui/controls.mjs';
import {VRSliderPanel} from '../../shared/ui/vr-slider-panel.mjs';
import {ChoiceBar} from '../../shared/ui/choice-bar.mjs';
import {sliderValue} from '../../shared/ui/slider.mjs';

test('slider mapping clamps pointer endpoints and rejects invalid coordinates',()=>{
  const d={min:-6,max:6};assert.equal(sliderValue(d,80),-6);assert.equal(sliderValue(d,944),6);
  assert.equal(sliderValue(d,512),0);assert.equal(sliderValue(d,-10),-6);assert.equal(sliderValue(d,2000),6);
  assert.equal(sliderValue(d,NaN),undefined);assert.equal(sliderValue(d,80,80,0),undefined);
});
test('segmented choices support arbitrary contexts, ignore gaps/disabled options, and do not repeat selections',()=>{
  let selected='a',count=0;const bar=new ChoiceBar({options:[{id:'a',label:'A'},{id:'b',label:'B'},{id:'c',label:'C',disabled:true}],getValue:()=>selected,onSelect:id=>{selected=id;count++;}});
  assert.equal(bar.activateAt(100,170),true);assert.equal(count,0);
  assert.equal(bar.activateAt(500,170),true);assert.equal(selected,'b');assert.equal(count,1);
  assert.equal(bar.activateAt(800,170),false);assert.equal(bar.activateAt(59,170),false);
  assert.equal(bar.activateAt(360,170),false);assert.equal(bar.activateAt(500,500),false);
});
function modelFor(state){return new ControlModel([
 {id:'amount',kind:'number',label:'Amount',group:'Main',min:0,max:100,step:5,stepBase:0,disabled:()=>state.disabled,get:()=>state.amount,set:v=>state.amount=v},
 {id:'enabled',kind:'toggle',label:'Enabled',group:'Main',get:()=>state.enabled,set:v=>state.enabled=v},
 {id:'other',kind:'number',label:'Other',group:'Other',min:0,max:10,step:1,stepBase:0,get:()=>state.other,set:v=>state.other=v},
]);}
function fixture(run){
 const previous=globalThis.document;globalThis.document={createElement:()=>({getContext:()=>new Proxy({},{get:()=>()=>{}})})};
 const scene=new Scene(),controllers=[new Group(),new Group()];scene.add(...controllers);
 const sources=controllers.map(c=>c.userData.inputSource={gamepad:{buttons:Array.from({length:6},()=>({pressed:false}))}}),session={inputSources:sources};
 const state={amount:0,enabled:false,other:5,disabled:false,saves:0},model=modelFor(state);
 const panel=new VRSliderPanel(scene,controllers,model,{footerAction:{label:()=>`Run ${state.saves}`,run:()=>state.saves++},readout:()=> '90 FPS'});
 panel.mesh.position.z=-1;panel.mesh.updateMatrixWorld(true);panel.mesh.visible=true;
 function aim(x,y,index=0){const target=panel.mesh.localToWorld(new Vector3((x/1024-.5)*panel.width,(.5-y/panel.canvas.height)*panel.width*panel.canvas.height/1024,0));controllers[index].position.set(0,0,0);controllers[index].lookAt(target);controllers[index].rotateY(Math.PI);controllers[index].updateMatrixWorld(true);}
 function tick(down,x=512,y=223+panel.controlOffset,index=0){aim(x,y,index);sources[index].gamepad.buttons[0].pressed=down;panel.update(session);}
 try{run({panel,controllers,sources,session,state,model,aim,tick});}finally{panel.dispose();if(previous===undefined)delete globalThis.document;else globalThis.document=previous;}
}
test('held slider drags stay locked to the original control, clamp endpoints and release cleanly',()=>fixture(({panel,tick,state})=>{
 tick(true);assert.equal(state.amount,50);
 tick(true,944,223+panel.controlOffset+138);assert.equal(state.amount,100);assert.equal(state.enabled,false);
 tick(false);assert.equal(panel.dragRows.size,0);
 tick(true,80);assert.equal(state.amount,0);
}));
test('hidden/disabled/disconnected or suspended input cancels drags and cannot resume from a held trigger',()=>fixture(({panel,tick,state,controllers,session,sources})=>{
 tick(true);assert.equal(state.amount,50);
 state.disabled=true;tick(true,944);state.disabled=false;tick(true,944);assert.equal(state.amount,50);
 tick(false);tick(true,944);assert.equal(state.amount,100);
 panel.suspend();sources[0].gamepad.buttons[5].pressed=true;tick(true,80);assert.equal(panel.mesh.visible,true);assert.equal(state.amount,100);sources[0].gamepad.buttons[5].pressed=false;
 tick(false);tick(true,80);assert.equal(state.amount,0);
 controllers[0].visible=false;tick(true,944);controllers[0].visible=true;tick(true,944);assert.equal(state.amount,0);
 tick(false);tick(true);assert.equal(state.amount,50);
 panel.update({inputSources:[]});assert.equal(panel.dragRows.size,0);assert.equal(panel.previousTriggers.has(sources[0]),false);
 panel.toggle();panel.update(session);assert.equal(panel.rays[0].visible,false);
}));
test('section changes retain panel pose and consume held triggers before editing the new page',()=>fixture(({panel,tick,state})=>{
 const mesh=panel.mesh,position=mesh.position.clone();
 tick(true,750,panel.sectionBar.y+25);assert.equal(panel.section,'Other');assert.equal(panel.mesh,mesh);assert.ok(mesh.position.equals(position));
 tick(true,944,223+panel.controlOffset);assert.equal(state.other,5);
 tick(false);tick(true,944);assert.equal(state.other,10);
}));
test('rebinding a model mid-drag never applies a stale row to the replacement model',()=>fixture(({panel,tick,state})=>{
 tick(true);assert.equal(state.amount,50);
 const next={amount:10,enabled:false,other:3};panel.setModel(modelFor(next));tick(true,944);assert.equal(next.amount,10);
 tick(false);tick(true,944);assert.equal(next.amount,100);
}));
test('footer actions and toggles run once per trigger press',()=>fixture(({panel,tick,state})=>{
 tick(true,750,panel.canvas.height-90);tick(true,750,panel.canvas.height-90);assert.equal(state.saves,1);
 tick(false);tick(true,500,223+panel.controlOffset+138);tick(true,500,223+panel.controlOffset+138);assert.equal(state.enabled,true);
 tick(false);tick(true,500,223+panel.controlOffset+138);assert.equal(state.enabled,false);
}));
test('explicit step origins retain canonical parameter grids and canonicalizing setters do not emit false changes',()=>{
 let value=0.65,events=0;const model=new ControlModel([{id:'v',kind:'number',label:'V',min:0,max:2,step:0.1,stepBase:0,get:()=>value,set:v=>value=Math.round(v*10)/10}],{onChange:()=>events++});
 model.set('v',0.74);assert.equal(value,0.7);assert.equal(events,1);
 model.set('v',0.71,{quantize:false});assert.equal(value,0.7);assert.equal(events,1);
});

test('a page switch blocks another controller from editing the new page in the same frame',()=>fixture(({panel,sources,session,aim,tick,state})=>{
 panel.section='Other';panel.resizeControls();aim(944,223+panel.controlOffset,1);
 panel.section='Main';panel.resizeControls();panel.update(session);
 sources[1].gamepad.buttons[0].pressed=true;
 tick(true,750,panel.sectionBar.y+25,0);
 assert.equal(panel.section,'Other');assert.equal(state.other,5);
 panel.update(session);assert.equal(state.other,5);
}));
