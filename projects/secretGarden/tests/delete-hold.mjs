import test from 'node:test';
import assert from 'node:assert/strict';
import {DeleteHold} from '../delete-hold.mjs';
test('deletion fills for one second and requires a new press after completion',()=>{
  const hold=new DeleteHold(),input={pressed:true,down:true,id:7,hand:'right'};
  assert.equal(hold.update(input,10),null);
  input.pressed=false;assert.equal(hold.update(input,10.5),null);assert.equal(hold.progress,.5);
  assert.equal(hold.update(input,11),7);assert.equal(hold.progress,0);
  input.id=8;assert.equal(hold.update(input,12),null);assert.equal(hold.update(input,14),null);
  input.down=false;hold.update(input,15);input.down=true;input.pressed=true;hold.update(input,16);
  input.pressed=false;assert.equal(hold.update(input,17.1),8);
});
test('early release, target change, miss and handoff cancel without retargeting',()=>{
  for(const change of [{down:false},{id:8},{id:null},{hand:'left'}]){
    const hold=new DeleteHold(),input={pressed:true,down:true,id:7,hand:'right'};
    hold.update(input,0);input.pressed=false;Object.assign(input,change);
    assert.equal(hold.update(input,.5),null);assert.equal(hold.progress,0);
    Object.assign(input,{down:true,id:7,hand:'right'});assert.equal(hold.update(input,3),null);
  }
});
test('a press without a plant cannot start deleting when a plant is targeted later',()=>{
  const hold=new DeleteHold();hold.update({pressed:true,down:true,id:null,hand:'right'},0);
  assert.equal(hold.update({down:true,id:7,hand:'right'},2),null);assert.equal(hold.progress,0);
  hold.update({pressed:true,down:true,id:7,hand:'right'},3);hold.cancel();
  assert.equal(hold.update({down:true,id:7,hand:'right'},5),null);
});
