import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Group} from '../../shared/vendor/three-r180/three.module.js';
import {ControlModel} from '../../shared/ui/controls.mjs';
import {VRCheckbox} from '../../shared/ui/checkbox.mjs';
test('checkbox follows model, respects disabled and hidden parents, and releases resources',()=>{
 const old=globalThis.document;globalThis.document={createElement:()=>({getContext:()=>new Proxy({}, {get:()=>()=>{}})})};
 let value=true,disabled=false;const model=new ControlModel([{id:'s',kind:'toggle',get:()=>value,set:v=>value=v,disabled:()=>disabled}]);
 const checkbox=new VRCheckbox(model,'s'),parent=new Group();parent.add(checkbox.mesh);
 try{
  assert.equal(checkbox.activate(),true);assert.equal(value,false);
  model.set('s',true);assert.equal(value,true);
  disabled=true;assert.equal(checkbox.activate(),false);disabled=false;
  parent.visible=false;assert.equal(checkbox.activate(),false);parent.visible=true;
  checkbox.setHover(true);assert.equal(checkbox.hover,true);
  let released=0;checkbox.texture.addEventListener('dispose',()=>released++);
  checkbox.dispose();checkbox.dispose();assert.equal(released,1);assert.equal(model.listeners.size,0);assert.equal(checkbox.mesh.parent,null);assert.equal(checkbox.activate(),false);
  assert.throws(()=>new VRCheckbox(new ControlModel([{id:'a',kind:'action',run(){}}]),'a'),TypeError);
 }finally{checkbox.dispose();if(old===undefined)delete globalThis.document;else globalThis.document=old;}
});
