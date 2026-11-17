import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Loom} from '../audio.mjs';
import {musicStickInput} from '../song-input.mjs';
import {tempoControl} from '../tempo.mjs';
import {leadChoices,phrase,sequence} from '../score.mjs';

const controller=()=>({gamepad:{axes:[0,0,0,0]}});
test('either stick changes tempo once per push and dominant axes prevent diagonal skips',()=>{
  const read=musicStickInput(),left=controller(),right=controller(),sources=[left,right];
  read(sources);
  left.gamepad.axes[3]=-1;assert.equal(read(sources).tempo,1);
  assert.equal(read(sources).tempo,0);
  left.gamepad.axes[3]=-.4;read(sources);
  left.gamepad.axes[3]=-1;assert.equal(read(sources).tempo,0);
  left.gamepad.axes[3]=0;read(sources);
  right.gamepad.axes[3]=1;assert.equal(read(sources).tempo,-1);
  right.gamepad.axes[3]=0;read(sources);
  left.gamepad.axes[2]=.8;left.gamepad.axes[3]=-1;
  const diagonal=read(sources);assert.equal(diagonal.skip,false);assert.equal(diagonal.tempo,1);
  left.gamepad.axes[3]=0;assert.equal(read(sources).skip,false);
  left.gamepad.axes[2]=0;read(sources);
  left.gamepad.axes[2]=1;left.gamepad.axes[3]=-.7;
  assert.equal(read(sources).skip,true);
  assert.equal(read(sources).tempo,0);
  assert.equal(tempoControl.step,5);
});

test('entry/recovery absorbs held sticks and simultaneous changes coalesce',()=>{
  const read=musicStickInput(),left=controller(),right=controller(),sources=[left,right];
  left.gamepad.axes[3]=-1;assert.equal(read(sources).tempo,0);
  left.gamepad.axes[3]=0;read(sources);
  left.gamepad.axes[3]=-1;right.gamepad.axes[3]=-1;
  assert.equal(read(sources).tempo,1);
  assert.equal(read(sources,true).tempo,0);
  assert.equal(read(sources).tempo,0);
  read([]);assert.equal(read(sources).tempo,0);
  left.gamepad.axes[3]=right.gamepad.axes[3]=0;read(sources);
  left.gamepad.axes[3]=-1;right.gamepad.axes[3]=1;
  assert.equal(read(sources).tempo,0);
  assert.equal(read([{gamepad:{axes:[NaN,Infinity]}}]).tempo,0);
});

function fakeLoom(position=159.5) {
  const loom=Object.create(Loom.prototype),scheduled=[],stopped=[];
  Object.assign(loom,{seed:123,bpm:90,unit:15/90,ctx:{currentTime:10,state:'running'},
    start:10-position*(15/90),next:Math.ceil(position+1),active:new Set(),leads:new Set(),
    cues:Array.from({length:16},()=>({time:-Infinity})),cueIndex:0});
  loom.voice=(kind,note,level,length,time)=>{
    const voice={kind,note,time,nodes:[],source:{stop(){stopped.push(voice);},disconnect(){}},
      env:{gain:{cancelScheduledValues(){},setTargetAtTime(){}}}};
    loom.active.add(voice);scheduled.push(voice);return voice;
  };
  return {loom,scheduled,stopped};
}

test('tempo changes keep beat position, retime queued onsets and preserve sounding notes',()=>{
  const {loom,scheduled,stopped}=fakeLoom();
  const sounding=loom.voice('bass',36,.4,4,9.8);
  const future=loom.voice('bell',64,.3,4,10+.5*loom.unit);
  loom.leads.add({time:future.time,active:future});
  loom.cues[0]={time:future.time};loom.cues[1]={time:9.8};loom.cueIndex=2;
  scheduled.length=0;
  const beat=loom.beat();loom.leadChoice=4;loom.conducting=true;
  assert.equal(loom.setTempo(95),95);
  assert.ok(Math.abs(loom.beat()-beat)<1e-12);
  assert.deepEqual(stopped,[future]);assert.ok(loom.active.has(sounding));
  const onset=10+.5*(15/95);
  assert.ok(scheduled.length>0 && scheduled.every(v=>Math.abs(v.time-onset)<1e-12));
  assert.equal(scheduled.find(v=>v.kind==='bell').note,leadChoices(phrase(123,1),160)[4]);
  assert.equal(loom.cues[0].time,-Infinity);assert.equal(loom.cues[1].time,9.8);
  const count=scheduled.length;loom.setTempo(95);assert.equal(scheduled.length,count);
  loom.nextSong();assert.equal(loom.song,1);assert.equal(loom.bpm,95);
});

test('paused tempo changes, bounds, stalls and song rollover preserve the musical clock',()=>{
  const {loom}=fakeLoom();loom.ctx.state='suspended';
  const beat=loom.beat();loom.setTempo(85);loom.setTempo(80);
  assert.ok(Math.abs(loom.beat()-beat)<1e-12);assert.equal(loom.ctx.state,'suspended');
  assert.equal(loom.setTempo(0),tempoControl.min);
  assert.equal(loom.setTempo(999),tempoControl.max);
  assert.equal(loom.setTempo(NaN),tempoControl.max);
  const before=loom.beat();loom.ctx.currentTime+=20;loom.schedule();
  assert.ok(Math.abs(loom.beat()-(before+20*180/60))<1e-10);
  const boundary=sequence(123).periods*128;
  const next=fakeLoom(boundary-.5).loom;
  next.setTempo(100);next.ctx.currentTime+=15/100;next.schedule();
  assert.equal(next.song,1);
});
