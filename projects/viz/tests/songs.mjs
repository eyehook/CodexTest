import {test} from 'node:test';
import assert from 'node:assert/strict';
import {sequence,songAt,phrase,events} from '../score.mjs';
import {Loom} from '../audio.mjs';
import {songSkipInput} from '../song-input.mjs';

const collect=(seed,p,step)=>{const result=[];events(seed,p,step,(...e)=>result.push(e));return result;};
test('songs last approximately five minutes and themes return before a tonic ending',()=>{
  for(let seed=0;seed<100;seed++) {
    const {periods}=sequence(seed),song=songAt(seed,0);
    assert.ok(song.seconds>285 && song.seconds<315);
    const sections=Array.from({length:periods},(_,i)=>phrase(seed,i).section);
    assert.deepEqual([...new Set(sections)],['intro','themeA','themeB','variation','bridge','climax','outro']);
    assert.deepEqual(phrase(seed,1).lead,phrase(seed,8).lead);
    assert.deepEqual(phrase(seed,1).lead.map(n=>n?.note),phrase(seed,5).lead.map(n=>n?.note));
    assert.notDeepEqual(phrase(seed,1).lead,phrase(seed,3).lead);
    const final=phrase(seed,periods-1);
    assert.equal(final.lead[112].note%12,final.key.tonic%12);
    for(let step=120;step<128;step++)assert.deepEqual(collect(seed,final,step),[]);
    assert.equal(phrase(seed,periods).song,1);
    assert.equal(phrase(seed,periods).section,'intro');
    assert.notEqual(songAt(seed,1).seed,song.seed);
    assert.deepEqual(songAt(seed,25),songAt(seed,25));
  }
});

test('introduction and bridge are sparse, climax adds the secondary voice',()=>{
  const kinds=i=>new Set(Array.from({length:128},(_,s)=>collect(123,phrase(123,i),s)).flat().map(e=>e[0]));
  assert.ok(!kinds(0).has('kick') && !kinds(0).has('hat'));
  assert.ok(!kinds(7).has('kick'));
  assert.ok(kinds(8).has('reed') && kinds(8).has('kick'));
});

test('scheduler rolls into the next song and skip cancels old voices',()=>{
  const seed=123,unit=15/sequence(seed).bpm,boundary=sequence(seed).periods*128;
  const played=[];
  const loom={seed,unit,start:10-(boundary-1)*unit,next:boundary-1,ctx:{currentTime:10},
    cues:Array.from({length:16},()=>({time:-Infinity})),cueIndex:0,
    voice:(...args)=>played.push(args),active:new Set(),schedule:Loom.prototype.schedule,beat:Loom.prototype.beat};
  loom.schedule();assert.equal(loom.song,0);
  loom.ctx.currentTime+=unit;loom.schedule();assert.equal(loom.song,1);
  let stops=0;
  loom.active.add({env:{gain:{cancelScheduledValues(){},setTargetAtTime(){}}},source:{stop(){stops++;}},nodes:[]});
  Loom.prototype.nextSong.call(loom);
  assert.equal(stops,1);assert.equal(loom.song,2);
  assert.equal(loom.plan.section,'intro');assert.ok(played.length>0);
  // Consecutive skips while the audio clock is frozen still advance the sequence.
  Loom.prototype.nextSong.call(loom);assert.equal(loom.song,3);
});

test('either thumbstick skips once, absorbs entry holds, and requires neutral',()=>{
  const sample=songSkipInput(),left={gamepad:{axes:[0,0,0,0]}},right={gamepad:{axes:[0,0,0,0]}};
  assert.equal(sample([left,right]),false);
  left.gamepad.axes[2]=1;assert.equal(sample([left,right]),true);
  assert.equal(sample([left,right]),false);
  left.gamepad.axes[2]=.5;assert.equal(sample([left,right]),false);
  left.gamepad.axes[2]=1;assert.equal(sample([left,right]),false);
  left.gamepad.axes[2]=0;sample([left,right]);
  right.gamepad.axes[2]=1;assert.equal(sample([left,right]),true);
  assert.equal(sample([left,right],true),false);
  assert.equal(sample([left,right]),false);
  sample([]);assert.equal(sample([right]),false);
});
