import {test} from 'node:test';
import assert from 'node:assert/strict';
import {voicePalette} from '../voices.mjs';
import {Loom} from '../audio.mjs';

test('seeded palettes repeat, vary, and remain in musical ranges',()=>{
  const sounds=new Set();
  for(let seed=0;seed<256;seed++) {
    const p=voicePalette(seed);
    assert.deepEqual(p,voicePalette(seed));
    sounds.add(JSON.stringify(p));
    for(const kind of ['bass','bell','pad','reed']) {
      assert.ok(p[kind].cutoff>=280 && p[kind].cutoff<=3900);
      assert.ok(p[kind].attack>0 && p[kind].release>0);
      assert.ok(['sawtooth','square','triangle','sine'].includes(p[kind].wave));
    }
    assert.ok(p.echo>=.19 && p.echo<=.29);
  }
  assert.equal(sounds.size,256);
});

test('all patches schedule valid envelopes and disconnect every note node',()=>{
  // Audio graph contract check; audible quality still requires Web Audio listening.
  let checks=0;
  for(const seed of [0,1,7,42,123,4294967295]) for(const kind of ['bass','bell','pad','reed','kick','hat','brush'])
    for(const length of [1,3,8,64]) {
      const nodes=[];
      const param=()=>({value:0,last:-Infinity,
        setValueAtTime(v,t){assert.ok(Number.isFinite(v) && Number.isFinite(t));assert.ok(t>=this.last);this.last=t;},
        exponentialRampToValueAtTime(v,t){assert.ok(v>0 && Number.isFinite(v));assert.ok(t>=this.last);this.last=t;}});
      function node() {
        const n={gain:param(),frequency:param(),detune:param(),Q:param(),pan:param(),
          connect(target){return target;},disconnect(){this.disconnected=true;},
          start(t){this.started=t;},stop(t){assert.ok(t>this.started);this.stopped=t;}};
        nodes.push(n);return n;
      }
      const loom={unit:.18,palette:voicePalette(seed),bus:{},echo:{},noise:{},ctx:{
        sampleRate:48000,createGain:node,createOscillator:node,
        createStereoPanner:node,createBiquadFilter:node,createBufferSource:node}};
      Loom.prototype.voice.call(loom,kind,kind==='bass'?36:72,.25,length,10);
      const sources=nodes.filter(n=>n.started!==undefined);
      assert.ok(sources.length>=1 && sources.length<=2);
      assert.equal(sources.filter(n=>n.onended).length,1);
      sources.find(n=>n.onended).onended();
      assert.ok(nodes.every(n=>n.disconnected));
      checks++;
    }
  console.log({voiceGraphChecks:checks});
});
