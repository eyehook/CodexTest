import test from 'node:test';
import assert from 'node:assert/strict';
import {ActiveController} from '../controller-actions.mjs';
import {ButtonEdges} from '../../../shared/xr/input.mjs';
test('right starts active; both hands map trigger/copy/delete only while active',()=>{
  const c=new ActiveController();
  assert.equal(c.hand,'right');
  assert.deepEqual(c.update([{hand:'left',first:true,second:true}]),[]);
  assert.deepEqual(c.update([{hand:'right',trigger:true,first:true,second:true}]),['plant','copy','delete']);
  assert.deepEqual(c.update([{hand:'left',trigger:true,first:true,second:true}]),[]);
  assert.equal(c.hand,'left');
  assert.deepEqual(c.update([{hand:'left',trigger:true,first:true,second:true}]),['plant','copy','delete']);
  assert.deepEqual(c.update([{hand:'right',first:true,second:true}]),[]);
  assert.deepEqual(c.update([]),[]);assert.equal(c.hand,'left');
});
test('handoff consumes simultaneous actions regardless of controller iteration order',()=>{
  for(const reverse of [false,true]){
    const c=new ActiveController(),inputs=[{hand:'right',trigger:true,first:true,second:true},{hand:'left',trigger:true,first:true,second:true}];
    assert.deepEqual(c.update(reverse?inputs.reverse():inputs),[]);assert.equal(c.hand,'left');
    assert.deepEqual(c.update([{hand:'right',trigger:true}]),[]);assert.equal(c.hand,'right');
  }
});
test('held triggers and inactive face buttons never plant or copy during handoff',()=>{
  const c=new ActiveController(),edges=new ButtonEdges();
  const left={handedness:'left',gamepad:{buttons:Array.from({length:6},()=>({pressed:false}))}};
  const read=()=>({hand:'left',trigger:edges.sample(left,0).pressed,first:edges.sample(left,4).pressed,second:edges.sample(left,5).pressed});
  left.gamepad.buttons[4].pressed=true;assert.deepEqual(c.update([read()]),[]);
  left.gamepad.buttons[0].pressed=true;assert.deepEqual(c.update([read()]),[]);assert.equal(c.hand,'left');
  assert.deepEqual(c.update([read()]),[]);
  left.gamepad.buttons[0].pressed=false;c.update([read()]);
  left.gamepad.buttons[0].pressed=true;assert.deepEqual(c.update([read()]),['plant']);
  left.gamepad.buttons[4].pressed=false;c.update([read()]);
  left.gamepad.buttons[4].pressed=true;assert.deepEqual(c.update([read()]),['copy']);
});

test('grip toggles active pointer off and suppresses planting and face actions',()=>{
  const c=new ActiveController();
  assert.deepEqual(c.update([{hand:'left',grip:true}]),[]);assert.equal(c.enabled,true);
  assert.deepEqual(c.update([{hand:'right',grip:true,first:true,second:true}]),[]);assert.equal(c.enabled,false);
  assert.deepEqual(c.update([{hand:'right',first:true,second:true}]),[]);assert.equal(c.enabled,false);
  assert.deepEqual(c.update([{hand:'right',grip:true}]),[]);assert.equal(c.enabled,true);
  assert.deepEqual(c.update([{hand:'right',trigger:true}]),['plant']);
});
test('trigger reactivates either hand without planting and requires a new trigger edge',()=>{
  for(const hand of ['left','right']){
    const c=new ActiveController();c.update([{hand:'right',grip:true}]);
    assert.deepEqual(c.update([{hand,trigger:true,first:true,second:true}]),[]);
    assert.equal(c.hand,hand);assert.equal(c.enabled,true);
    assert.deepEqual(c.update([{hand}]),[]);
    assert.deepEqual(c.update([{hand,trigger:true}]),['plant']);
  }
});
