import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../../../shared/vendor/three-r180/three.module.js';
import {TableGrab} from '../table-grab.mjs';
function setup(){
 const rig=new T.Group();rig.position.set(2,.25,-3);rig.rotation.y=Math.PI/2;rig.updateMatrixWorld(true);
 const game={tableX:.3,tableZ:-.2,height:.8};
 const source={gripSpace:{},gamepad:{buttons:[{}, {pressed:false}]}},other={gripSpace:{},gamepad:{buttons:[{}, {pressed:false}]}};
 const world=new T.Vector3(4,.6,2);
 const session={inputSources:[source,other]};let lost=false;
 const frame={getPose:space=>lost?null:{transform:{position:world.clone().applyMatrix4(rig.matrixWorld.clone().invert())}}};
 const grab=new TableGrab(rig,game),sample=options=>grab.sample(session,frame,{},options);
 return {game,source,other,world,session,grab,sample,lose:()=>lost=true};
}
test('grab translates table from current world grip with rig offset/yaw and preserves grab offset',()=>{
 const a=setup();a.sample({seed:true});a.source.gamepad.buttons[1].pressed=true;assert.ok(a.sample());assert.equal(a.grab.owner,a.source);
 a.world.add(new T.Vector3(.12,.15,-.1));a.sample();assert.ok(Math.abs(a.game.tableX-.42)<1e-9);assert.ok(Math.abs(a.game.tableZ+.3)<1e-9);assert.ok(Math.abs(a.game.height-.95)<1e-9);
 a.source.gamepad.buttons[1].pressed=false;assert.equal(a.sample(),false);assert.ok(Math.abs(a.game.height-.95)<1e-9);
});
test('grip starts anywhere without snapping and height follows above and below former limits',()=>{
 const a=setup();a.source.gamepad.buttons[1].pressed=true;assert.ok(a.sample());assert.equal(a.game.tableX,.3);assert.equal(a.game.height,.8);
 for(let i=0;i<5;i++){a.world.y+=.2;a.sample();}assert.ok(Math.abs(a.game.height-1.8)<1e-9);
 for(let i=0;i<10;i++){a.world.y-=.2;a.sample();}assert.ok(Math.abs(a.game.height+.2)<1e-9);
});
test('tracking loss, jump, recenter seed, disabled UI and disconnect cancel without held reacquisition',()=>{
 for(const reason of ['loss','jump','seed','disabled','disconnect']){
  const a=setup();a.source.gamepad.buttons[1].pressed=true;assert.ok(a.sample());
  if(reason==='loss')a.lose();if(reason==='jump')a.world.x+=1;if(reason==='disconnect')a.session.inputSources=[];
  assert.equal(a.sample({seed:reason==='seed',enabled:reason!=='disabled'}),false,reason);
  assert.equal(a.sample(),false,reason);assert.equal(a.game.tableX,.3);
 }
});
test('either controller can own the grab, while another held grip cannot steal it',()=>{
 const a=setup();a.other.gamepad.buttons[1].pressed=true;assert.ok(a.sample());assert.equal(a.grab.owner,a.other);
 a.source.gamepad.buttons[1].pressed=true;a.world.y+=.0037;a.sample();assert.equal(a.grab.owner,a.other);assert.ok(Math.abs(a.game.height-.8037)<1e-9);
 a.other.gamepad.buttons[1].pressed=false;assert.equal(a.sample(),false);assert.equal(a.sample(),false);
 a.source.gamepad.buttons[1].pressed=false;a.sample();a.source.gamepad.buttons[1].pressed=true;assert.ok(a.sample());assert.equal(a.grab.owner,a.source);
});
