import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../../../shared/vendor/three-r180/three.module.js';
import {Conductor} from '../conductor.mjs';
import {phrase,leadChoices,chord} from '../score.mjs';
import {Loom} from '../audio.mjs';

test('five ascending choices fit the active triad across the song sequence',()=>{
  for(let seed=0;seed<48;seed++)for(let period=0;period<16;period++){
    const p=phrase(seed,period);
    for(let step=0;step<128;step+=8){
      const notes=leadChoices(p,step),root=chord(p,step);
      assert.equal(new Set(notes).size,5);assert.deepEqual(notes,[...notes].sort((a,b)=>a-b));
      const allowed=[0,2,4].map(i=>{
        const degree=(root+i)%7;
        return (p.key.tonic+p.key.scale[degree]+(p.key.minor&&root===4&&degree===6?1:0))%12;
      });
      assert.ok(notes.every(n=>allowed.includes(n%12)));
    }
  }
});

test('A/X toggles ownership; pointing highlights and enlarges; missing clears',()=>{
  const scene=new T.Scene(),rays=[new T.Group(),new T.Group()],grips=[new T.Group(),new T.Group()];
  const conductor=new Conductor(scene,{xr:{getController:i=>rays[i],getControllerGrip:i=>grips[i]}});
  const source={handedness:'right',targetRaySpace:{},gripSpace:{},gamepad:{buttons:Array.from({length:6},()=>({pressed:false}))}};
  rays[0].dispatchEvent({type:'connected',data:source});
  const session={inputSources:[source]},state={active:true,resumed:true,isTracked:()=>true,
    pose:{transform:{position:{x:0,y:0,z:0},orientation:{x:0,y:0,z:0,w:1}}}};
  conductor.update(session,state);state.resumed=false;source.gamepad.buttons[4].pressed=true;
  conductor.update(session,state);assert.equal(conductor.owner,source);assert.equal(conductor.stream.parent,scene);
  rays[0].position.set(.42,-.12,0);
  assert.equal(conductor.update(session,state),2);
  assert.equal(conductor.targets[2].scale.x,1.25);
  assert.ok(conductor.targets[2].material.color.r>conductor.targets[1].material.color.r);
  const peak=conductor.targets[1].scale.x;
  conductor.update(session,state,.5,.3);
  assert.equal(conductor.targets[1].scale.x,peak);
  assert.ok(conductor.targets.every(c=>c.material.opacity===.5));
  assert.equal(conductor.targets[0].geometry.parameters.radius,.065*1.10);
  assert.equal(conductor.targets[1].material.color.getHex(),conductor.stream.material.uniforms.tint.value.getHex());
  const lastPosition=conductor.stream.position.clone(),lastRotation=conductor.stream.quaternion.clone();
  rays[0].position.set(9,9,9);rays[0].rotation.y=.8;rays[0].visible=false;
  state.isTracked=()=>false;
  assert.equal(conductor.update(session,state),2);
  assert.equal(conductor.panel.visible,true);assert.equal(conductor.stream.visible,true);
  assert.deepEqual(conductor.stream.position,lastPosition);
  assert.ok(conductor.stream.quaternion.equals(lastRotation));
  rays[0].dispatchEvent({type:'disconnected',data:source});session.inputSources=[];
  assert.equal(conductor.update(session,state),2);assert.equal(conductor.panel.visible,true);
  assert.deepEqual(conductor.stream.position,lastPosition);
  state.active=false;conductor.update(session,state);
  assert.equal(conductor.stream.visible,true);assert.deepEqual(conductor.stream.position,lastPosition);
  state.active=true;rays[0].visible=true;rays[0].position.set(.42,-.12,0);rays[0].rotation.y=0;
  const replacement={...source,targetRaySpace:{},gripSpace:{}};
  rays[0].dispatchEvent({type:'connected',data:replacement});session.inputSources=[replacement];
  assert.equal(conductor.owner,replacement);
  state.isTracked=()=>true;
  conductor.update(session,state);
  assert.equal(conductor.stream.visible,true);
  assert.ok(Math.abs(conductor.stream.material.uniforms.reach.value-1.2)<.01);
  rays[0].position.x=2;assert.equal(conductor.update(session,state),null);
  assert.equal(conductor.targets[2].scale.x,1);
  source.gamepad.buttons[4].pressed=false;conductor.update(session,state);
  source.gamepad.buttons[4].pressed=true;conductor.update(session,state);
  assert.equal(conductor.owner,null);assert.equal(conductor.stream.parent,null);
  assert.equal(conductor.panel.visible,false);
});

test('selection replaces future lead only, preserving onset and sounding voices',()=>{
  const scheduled=[],active=new Set();let stops=0;
  const voice=(kind,note,level,length,time)=>{
    const result={note,source:{stop(){stops++;},disconnect(){}},nodes:[]};
    active.add(result);scheduled.push({kind,note,level,length,time});return result;
  };
  const future={time:11,original:64,choices:[60,64,67,72,76],level:.3,length:4,palette:{},cue:{time:11,note:64},active:voice('bell',64,.3,4,11)};
  future.cue.lead=future;
  const sounding={...future,time:9,active:voice('bell',64,.3,4,9)};
  const loom={ctx:{currentTime:10},leads:new Set([sounding,future]),active,palette:{},voice};
  Loom.prototype.setLeadChoice.call(loom,4);
  assert.equal(stops,1);assert.equal(future.active.note,76);assert.equal(future.cue.note,76);
  assert.equal(scheduled.at(-1).time,11);assert.ok(active.has(sounding.active));
  Loom.prototype.setLeadChoice.call(loom,null,true);
  assert.equal(future.active,null);assert.equal(stops,2);
  assert.equal(future.cue.time,-Infinity);
  assert.ok(active.has(sounding.active));
  Loom.prototype.setLeadChoice.call(loom,0,true);
  assert.equal(future.active.note,60);assert.equal(future.cue.time,11);
  Loom.prototype.setLeadChoice.call(loom,null,false);
  assert.equal(future.active.note,64);assert.equal(stops,3);
  loom.ctx.currentTime=11;Loom.prototype.setLeadChoice.call(loom,0);
  assert.equal(stops,3);assert.equal(loom.leads.size,0);
});
