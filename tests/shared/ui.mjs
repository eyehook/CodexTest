import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ControlModel} from '../../shared/ui/controls.mjs';
import {createTheme} from '../../shared/ui/theme.mjs';
import {VRControlPanel} from '../../shared/ui/vr-panel.mjs';
import {Group, Scene, Vector3} from '../../shared/vendor/three-r180/three.module.js';
import {createSwarmControls} from '../../projects/swarm/src/controls.mjs';
import {config} from '../../projects/swarm/src/config.js';
import {createSurfaceControls} from '../../projects/surface/controls.mjs';
import {DEFAULTS} from '../../projects/surface/settings.mjs';

function fixture() {
  const state = {value: 0.65, enabled: false, blocked: false, calls: 0, status: 'Ready'}, changes = [];
  const model = new ControlModel([
    {id:'value',kind:'number',label:'Value',min:0.1,max:2,step:0.1,get:()=>state.value,set:v=>state.value=v},
    {id:'enabled',kind:'toggle',label:'Enabled',disabled:()=>state.blocked,get:()=>state.enabled,set:v=>state.enabled=v},
    {id:'run',kind:'action',label:()=>state.calls?'Again':'Run',disabled:()=>state.blocked,run:()=>state.calls++},
    {id:'status',kind:'readout',label:'Status',get:()=>state.status},
  ], {onChange:(id,meta)=>changes.push({id,...meta})});
  return {state,model,changes};
}
test('numbers use relative steps without snapping defaults; both interfaces share bounds and invalid handling',()=>{
  const {model,state,changes}=fixture();
  assert.equal(model.value('value'),0.65);
  model.set('value',0.75,{source:'desktop'});assert.equal(state.value,0.75);
  model.adjust('value',1);assert.equal(state.value,0.85);
  assert.equal(changes[1].source,'vr');
  model.set('value',999);assert.equal(state.value,2);
  model.set('value',-999);assert.equal(state.value,0.1);
  for(const invalid of ['',null,NaN,Infinity,{},true])assert.equal(model.set('value',invalid),false);
  assert.equal(state.value,0.1);
  assert.equal(model.adjust('value',0),false);
  model.set('value',0.655,{quantize:false});model.adjust('value',1);assert.equal(state.value,0.755);
});
test('toggle/action/readout and dynamic disabled state notify without exposing writes to readouts',()=>{
  const {model,state}=fixture();let events=0;
  const unsubscribe=model.subscribe(()=>events++);
  model.activate('enabled');assert.equal(state.enabled,true);
  model.activate('run');assert.equal(state.calls,1);assert.equal(model.label(model.definition('run')),'Again');
  state.blocked=true;model.refresh();
  assert.equal(model.activate('enabled'),false);assert.equal(model.activate('run'),false);
  assert.equal(model.set('status','Changed'),false);assert.equal(model.activate('status'),false);
  state.status='Finished';model.refresh();assert.equal(model.format(model.definition('status')),'Finished');
  assert.equal(events,4);unsubscribe();model.refresh();assert.equal(events,4);
});
test('deferred controls stay unchanged during input and commit exactly once',()=>{
  const c=structuredClone(config),changed=[],model=createSwarmControls(c,id=>changed.push(id));
  assert.equal(model.definition('beeCount').step,10);
  model.set('beeCount',300,{commit:false,source:'desktop'});assert.equal(c.beeCount,250);assert.equal(changed.length,0);
  model.set('beeCount',300,{source:'desktop'});model.set('beeCount',300,{source:'desktop'});
  assert.equal(c.beeCount,300);assert.deepEqual(changed,['beeCount']);
});
test('Swarm uses the former VR increments on all controls and preserves VR row order',()=>{
  const c=structuredClone(config),model=createSwarmControls(c,()=>{});
  const steps={beeCount:10,maxSpeed:0.25,maxForce:0.5,neighborRadius:0.2,separationRadius:0.1,cohesion:0.1,alignment:0.1,separation:0.1,attraction:0.1,boundary:0.1,waspSpeed:0.2,x:1,z:1,minY:0.5,maxY:0.5};
  for(const [id,step]of Object.entries(steps)){
    const d=model.definition(id),start=d.get();assert.equal(d.step,step,id);
    model.set(id,start+step,{source:'desktop'});const desktop=d.get();
    d.set(start);model.adjust(id,1);assert.equal(d.get(),desktop,id);
  }
  assert.equal(model.definition('waspSpeed').vrOrder,10);
  assert.equal(model.definition('overview').vr,false);
});
test('Surface actions refresh bound values after defaults and do not reset retained values on pause',()=>{
  const c={...DEFAULTS};let model;
  model=createSurfaceControls(c,id=>{
    if(id==='pause')c.paused=!c.paused;
    if(id==='defaults')Object.assign(c,DEFAULTS);
  });
  model.set('damping',0.2);model.activate('pause');assert.equal(c.paused,true);assert.equal(c.damping,0.2);
  model.activate('defaults');assert.equal(c.paused,false);assert.equal(c.damping,DEFAULTS.damping);
});
test('invalid definitions fail early',()=>{
  const valid={id:'v',kind:'number',label:'V',min:0,max:1,step:0.1,get:()=>0,set:()=>{}};
  assert.throws(()=>new ControlModel([valid,valid]),TypeError);
  assert.throws(()=>new ControlModel([{...valid,step:0}]),RangeError);
  assert.throws(()=>new ControlModel([{id:'action',kind:'action'}]),TypeError);
});

function withPanel(run, options = {}) {
  const old=globalThis.document,ctx=new Proxy({}, {get:()=>()=>{}});
  globalThis.document={createElement:()=>({getContext:()=>ctx})};
  const scene=new Scene(),rig=new Group();scene.add(rig);
  const controllers=[new Group(),new Group()],f=fixture();
  const panel=new VRControlPanel(scene,rig,{xr:{getController:i=>controllers[i]}},f.model,options);
  try {run({...f,panel,controllers,scene,rig});} finally {panel.dispose();if(old===undefined)delete globalThis.document;else globalThis.document=old;}
}
function aim(panel,controller,row,x=920){
  panel.mesh.updateMatrixWorld(true);
  const target=panel.mesh.localToWorld(new Vector3((x/1024-0.5)*1.45,(0.5-(panel.theme.rowTop+30+row*panel.theme.rowHeight)/panel.canvas.height)*1.45*panel.canvas.height/1024,0));
  controller.position.copy(target).add(new Vector3(0,0,1).applyQuaternion(panel.mesh.quaternion));
  controller.quaternion.copy(panel.mesh.quaternion);controller.updateMatrixWorld(true);
}
test('real VR rays change numeric/toggle/action controls and skip readouts or disabled rows',()=>withPanel(({panel,controllers,state,model})=>{
  panel.place(3);const controller=controllers[0];controller.dispatchEvent({type:'connected'});
  aim(panel,controller,0);controller.dispatchEvent({type:'selectstart'});assert.equal(state.value,0.75);
  aim(panel,controller,1,500);controller.dispatchEvent({type:'selectstart'});assert.equal(state.enabled,true);
  aim(panel,controller,2,500);assert.equal(panel.hit(controller),null);
  aim(panel,controller,3,500);controller.dispatchEvent({type:'selectstart'});assert.equal(state.calls,1);
  state.blocked=true;model.refresh();assert.equal(panel.hit(controller),null);
  aim(panel,controller,1,500);assert.equal(panel.hit(controller),null);
}));
test('hidden/disabled/disconnected panels reject triggers; disposal releases listeners, rays and textures',()=>withPanel(({panel,controllers,state,model})=>{
  panel.place(3);const controller=controllers[0];controller.dispatchEvent({type:'connected'});aim(panel,controller,0);
  panel.toggle();controller.dispatchEvent({type:'selectstart'});assert.equal(state.value,0.65);
  panel.toggle();panel.enabled=false;controller.dispatchEvent({type:'selectstart'});assert.equal(state.value,0.65);
  panel.enabled=true;controller.dispatchEvent({type:'disconnected'});controller.dispatchEvent({type:'selectstart'});assert.equal(state.value,0.65);
  assert.equal(model.listeners.size,1);
  let disposed=0;panel.texture.addEventListener('dispose',()=>disposed++);
  panel.dispose();assert.equal(disposed,1);assert.equal(model.listeners.size,0);assert.equal(controller.children.length,0);assert.equal(panel.mesh.parent,null);
  controller.dispatchEvent({type:'connected'});controller.dispatchEvent({type:'selectstart'});assert.equal(state.value,0.65);
  panel.dispose();assert.equal(disposed,1);
}));

test('themes configure spacing/fonts while retaining validated defaults',()=>{
  const theme=createTheme({accent:'#00ffff',rowTop:160,rowHeight:84,labelFont:'30px sans-serif'});
  assert.equal(theme.rowTop,160);assert.equal(theme.rowHeight,84);assert.equal(theme.labelFont,'30px sans-serif');
  assert.equal(createTheme().rowHeight,70);
  assert.throws(()=>createTheme({rowHeight:0}),RangeError);
  withPanel(({panel,controllers})=>{
    panel.place(3);aim(panel,controllers[0],1,500);assert.equal(panel.hit(controllers[0]).row,1);
  },{theme});
});

test('button-panel model replacement retains the mesh and expands layout without stale subscriptions',()=>withPanel(({panel,model})=>{
 const mesh=panel.mesh,next=new ControlModel(Array.from({length:20},(_,i)=>({id:`status${i}`,kind:'readout',label:`Status ${i}`,get:()=> 'Ready'})));
 panel.setModel(next);assert.equal(panel.mesh,mesh);assert.equal(panel.rows.length,20);assert.ok(panel.canvas.height>1280);
 assert.equal(model.listeners.size,0);assert.equal(next.listeners.size,1);
}));
