import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {ForestAmbience,FOREST_CLIPS,equalPowerCurves,nextForestClip,bindForestAudio} from '../forest-audio.mjs';
class Param {
 constructor(){this.value=0;this.events=[];}
 setValueAtTime(value,time){this.events.push({type:'set',value,time});return this;}
 linearRampToValueAtTime(value,time){this.events.push({type:'ramp',value,time});return this;}
 setValueCurveAtTime(curve,time,duration){this.events.push({type:'curve',curve,time,duration});return this;}
 cancelAndHoldAtTime(time){this.events=this.events.filter(e=>e.time<time);return this;}
}
function fixture(options={}){
 let clock=0,nextTimer=1;const timers=new Map(),nodes=[],gains=[],loads=[],order=[];
 const context={state:'suspended',sampleRate:32000,get currentTime(){return clock/1000;},destination:{},
  createGain(){const n={gain:new Param(),connect(){},disconnect(){this.disconnected=true;}};gains.push(n);return n;},
  createBufferSource(){const n={connect(){},disconnect(){this.disconnected=true;},start(t){this.startTime=t;},stop(t=context.currentTime){this.endTime=t;}};nodes.push(n);return n;},
  resume(){order.push('resume');context.state='running';return Promise.resolve();},suspend(){context.state='suspended';return Promise.resolve();},close(){context.state='closed';return Promise.resolve();},
  decodeAudioData:async()=>({duration:20,numberOfChannels:2})};
 const audio=new ForestAmbience({createContext:()=>context,loadClip:async(i,format)=>{order.push('load');loads.push([i,format]);return new ArrayBuffer(8);},preferOgg:()=>true,random:()=>.4,
  setTimer:(fn,ms)=>{const id=nextTimer++;timers.set(id,{fn,time:clock+ms});return id;},clearTimer:id=>timers.delete(id),...options});
 function advance(seconds){const target=clock+seconds*1000;for(;;){const first=[...timers.entries()].filter(([,t])=>t.time<=target).sort((a,b)=>a[1].time-b[1].time)[0];if(!first)break;clock=first[1].time;ended();timers.delete(first[0]);first[1].fn();}clock=target;ended();}
 function ended(){for(const node of nodes)if(!node.ended&&node.endTime<=clock/1000){node.ended=true;node.onended?.();}}
 return {audio,context,nodes,gains,loads,order,timers,advance};
}
test('equal-power curves preserve overlap power, and random selection has no immediate repeats',()=>{
 const c=equalPowerCurves();for(let i=0;i<c.incoming.length;i++)assert.ok(Math.abs(c.incoming[i]**2+c.outgoing[i]**2-1)<1e-6);
 assert.equal(c.incoming[0],0);assert.equal(c.outgoing.at(-1),0);
 for(let previous=-1;previous<5;previous++)for(const random of [0,.1,.5,.99,1]){const next=nextForestClip(previous,5,()=>random);assert.ok(next>=0&&next<5);assert.notEqual(next,previous);}
});
test('gesture resumes immediately, decodes once, and activity edges defer all scheduling',async()=>{
 const f=fixture(),a=f.audio;a.setActive(true);assert.equal(f.nodes.length,0);await a.unlock();await Promise.resolve();
 assert.equal(f.order[0],'resume');assert.equal(f.loads.length,5);assert.equal(f.gains.length,3);assert.ok(a.playing);assert.equal(f.nodes.length,4);
 const scheduled=a.stats.scheduled;for(let i=0;i<1000;i++)a.setActive(true);assert.equal(a.stats.scheduled,scheduled);
 await a.unlock();assert.equal(f.loads.length,5);assert.equal(f.gains.length,3);a.dispose();assert.equal(f.context.state,'closed');assert.equal(f.timers.size,0);
});
test('two-hour scheduling alternates reusable lanes, overlaps exactly five seconds, and bounds live nodes',async()=>{
 const f=fixture(),a=f.audio;a.setActive(true);await a.unlock();await Promise.resolve();
 const timeline=[];let maxLive=0;
 for(let i=0;i<1440;i++){for(const r of a.sources)if(!timeline.includes(r))timeline.push(r);maxLive=Math.max(maxLive,a.sources.size);f.advance(5);}
 timeline.sort((a,b)=>a.start-b.start);
 assert.ok(timeline.length>450);assert.ok(maxLive<=6);assert.equal(f.gains.length,3);assert.equal(f.loads.length,5);assert.equal(a.stats.lateRecoveries,0);
 for(let i=1;i<timeline.length;i++){const prev=timeline[i-1],r=timeline[i];assert.notEqual(r.index,prev.index);assert.notEqual(r.lane,prev.lane);assert.ok(Math.abs(prev.end-r.start-5)<1e-8);}
 for(let t=10;t<7200;t+=.5)assert.ok(timeline.filter(r=>r.start<=t&&r.end>t).length<=2);
 a.dispose();assert.ok(f.nodes.every(n=>n.disconnected));
});
test('stop, rapid restart and disposal retire old sources without reloading buffers',async()=>{
 const f=fixture(),a=f.audio;a.setActive(true);await a.unlock();f.advance(8);a.stop();await Promise.resolve();assert.equal(a.playing,false);
 const end=f.context.currentTime+.16;assert.ok([...a.sources].every(r=>r.source.endTime===end));
 a.setActive(true);await Promise.resolve();assert.equal(a.playing,true);assert.ok([...a.sources].filter(r=>r.start>=f.context.currentTime).some(r=>r.start>=end));
 assert.ok(f.gains[0].gain.events.some(e=>e.type==='ramp'&&e.value===0&&e.time===end-.01),'rapid restart must preserve the retiring-source fade');
 f.advance(1);assert.equal(f.context.state,'running');assert.equal(f.loads.length,5);a.stop();await Promise.resolve();f.advance(.3);assert.equal(f.context.state,'suspended');
 a.dispose();a.dispose();a.setActive(true);assert.equal(await a.unlock(),false);assert.equal(f.timers.size,0);
});
test('Ogg fetch/decode failures fall back to MP3; errors are optional and retryable',async()=>{
 let fail=true;const calls=[];const f=fixture({loadClip:async(i,format)=>{calls.push(format);if(fail||format==='ogg')throw Error('unavailable');return new ArrayBuffer(8);}}),a=f.audio;
 a.setActive(true);assert.equal(await a.unlock(),false);assert.equal(a.playing,false);assert.match(a.error,/unavailable/);
 fail=false;await a.unlock();await Promise.resolve();assert.ok(a.playing);assert.deepEqual(a.formats,Array(5).fill('mp3'));assert.ok(calls.includes('ogg'));a.dispose();
});
test('disposing during load aborts and does not resurrect nodes',async()=>{
 let release;const f=fixture({loadClip:()=>new Promise(resolve=>{release=resolve;})}),a=f.audio;a.setActive(true);const opening=a.unlock();a.dispose();release(new ArrayBuffer(8));await opening;await Promise.resolve();assert.equal(f.nodes.length,0);assert.equal(a.buffers,null);assert.ok(a.abort.signal.aborted);
});
test('XR gesture bindings pause hidden sessions and clean listeners on end',()=>{
 const session=new EventTarget();session.visibilityState='visible';let unlocks=0,active=true;bindForestAudio(session,{unlock(){unlocks++;},setActive(v){active=v;}});
 session.dispatchEvent(new Event('selectstart'));session.dispatchEvent(new Event('squeezestart'));assert.equal(unlocks,2);
 session.visibilityState='hidden';session.dispatchEvent(new Event('visibilitychange'));assert.equal(active,false);session.dispatchEvent(new Event('end'));session.dispatchEvent(new Event('selectstart'));assert.equal(unlocks,2);
});
test('five packaged stereo clips have disjoint 15–30 second windows, modest gain and valid asset hashes',async()=>{
 const manifest=JSON.parse(await readFile(new URL('../../../assets/hike/audio/clips.json',import.meta.url),'utf8'));
 assert.equal(manifest.clips.length,5);assert.equal(manifest.preparation.channels,2);assert.equal(manifest.source.license,'CC0-1.0');
 let previousEnd=-1;
 for(let i=0;i<5;i++){
  const clip=manifest.clips[i];assert.ok(clip.sourceStartSeconds>=previousEnd);assert.ok(clip.durationSeconds>=15&&clip.durationSeconds<=30);assert.equal(clip.sourceEndSeconds-clip.sourceStartSeconds,clip.durationSeconds);assert.ok(Math.abs(clip.gainDb)<=3);previousEnd=clip.sourceEndSeconds;
  for(const format of ['ogg','mp3']){const bytes=await readFile(FOREST_CLIPS[i][format]);assert.equal(createHash('sha256').update(bytes).digest('hex'),clip.files[format].sha256);assert.equal(bytes.length,clip.files[format].bytes);assert.ok(clip.files[format].truePeakDbfs<-6);assert.ok(Math.abs(clip.files[format].integratedLufs+23)<1);if(format==='ogg')assert.equal(bytes.subarray(0,4).toString(),'OggS');}
 }
});
