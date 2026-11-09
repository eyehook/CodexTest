import test from 'node:test';
import assert from 'node:assert/strict';
import {RainAudio,bindXRAudio} from '../rain-audio.mjs';
test('one rain loop follows intensity, mute and inactive state without restarting',async()=>{
 let loads=0,starts=0,stops=0,target=0;
 const context={currentTime:1,destination:{},resume:async()=>{},close(){},decodeAudioData:async data=>data,
 createGain:()=>({gain:{value:0,setTargetAtTime(value){target=value;}},connect(){}}),
 createBufferSource:()=>({connect(){},start(){starts++;},stop(){stops++;}})};
 const audio=new RainAudio({createContext:()=>context,load:async()=>{loads++;return new ArrayBuffer(1);}});
 audio.update(.4);await audio.unlock();await audio.loading;
 assert.equal(audio.source.loop,true);assert.equal(target,.4);
 audio.update(1);assert.equal(target,1);audio.setEnabled(false);assert.equal(target,0);
 audio.update(.7);assert.equal(target,0);audio.setEnabled(true);assert.equal(target,.7);
 audio.update(.7,false);assert.equal(target,0);audio.update(0);assert.equal(target,0);
 await audio.unlock();assert.equal(loads,1);assert.equal(starts,1);audio.dispose();assert.equal(stops,1);
});
test('failed rain loads can retry on a later gesture',async()=>{
 let attempts=0;
 const context={currentTime:0,destination:{},resume:async()=>{},decodeAudioData:async d=>d,createGain:()=>({gain:{value:0,setTargetAtTime(){}},connect(){}}),createBufferSource:()=>({connect(){},start(){}})};
 const audio=new RainAudio({createContext:()=>context,load:async()=>{if(++attempts===1)throw Error('offline');return new ArrayBuffer(1);}});
 await audio.unlock();await audio.loading;await audio.unlock();await audio.loading;assert.equal(attempts,2);assert.ok(audio.source);
});

test('Quest controller gestures and returning XR visibility retry shared audio and clean up on exit',()=>{
 const session=new EventTarget();let calls=0;bindXRAudio(session,{unlock(){calls++;}});
 session.dispatchEvent(new Event('selectstart'));session.dispatchEvent(new Event('squeezestart'));assert.equal(calls,2);
 session.visibilityState='hidden';session.dispatchEvent(new Event('visibilitychange'));assert.equal(calls,2);
 session.visibilityState='visible';session.dispatchEvent(new Event('visibilitychange'));assert.equal(calls,3);
 session.dispatchEvent(new Event('end'));session.dispatchEvent(new Event('selectstart'));assert.equal(calls,3);
});
test('active audio recovers suspended or interrupted contexts with throttled automatic retries',async()=>{
 let calls=0;const audio=new RainAudio();audio.context={state:'suspended',resume:async()=>{calls++;}};
 audio.update(.5);audio.update(.5);assert.equal(calls,1);await audio.resume(true);assert.equal(calls,2);
 audio.context.state='running';audio.update(.5);assert.equal(calls,2);
 audio.context.state='interrupted';audio.nextResume=0;audio.update(.5);assert.equal(calls,3);
 audio.nextResume=0;audio.setEnabled(false);audio.update(.5);assert.equal(calls,3);
 audio.setEnabled(true);audio.update(.5,false);assert.equal(calls,3);
});
