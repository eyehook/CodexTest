import test from 'node:test';
import assert from 'node:assert/strict';
import { generateNoise,  noise } from '../src/noise.js';
import { Parameters } from '../src/parameters.js';
import { FrameRateCounter } from '../src/fps.js';
test('noise is deterministic and changes with octave count',()=>{
  const a=generateNoise(32,2);assert.deepEqual(a,generateNoise(32,2));assert.notDeepEqual(a,generateNoise(32,3));assert.equal(a.length,32**3);assert.ok(Math.max(...a)>160);assert.ok(Math.min(...a)<90);
});
test('noise coordinates remain consistent across resolutions',()=>{
  const a=generateNoise(32,2),b=generateNoise(64,2);assert.equal(a[0],b[0]);assert.equal(a.at(-1),b.at(-1));
});
test('value noise is bounded and continuous across lattice edges',()=>{
  for(let i=0;i<100;i++){
    const n=noise(i*.17,i*.29,-i*.11);assert.ok(n>=0&&n<=1);
  }
  assert.ok(Math.abs(noise(2-1e-6,3.2,5.1)-noise(2+1e-6,3.2,5.1))<1e-5);
});
test('parameter defaults, limits and quantization match the experiment',()=>{
  const p=new Parameters();assert.equal(p.values.steps,16);assert.equal(p.values.threshold,.4);assert.equal(p.values.resolution,1);assert.equal(p.values.termination,.02);p.set('steps',999);assert.equal(p.values.steps,128);p.set('steps',-1);assert.equal(p.values.steps,4);p.set('density',2.26);assert.ok(Math.abs(p.values.density-2.3)<1e-10);p.set('termination',0);assert.equal(p.values.termination,.001);p.set('scale',99);assert.equal(p.values.scale,4);
});
test('cloud resolution is live while unsupported foveation stays disabled',()=>{
  const p=new Parameters();assert.equal(p.values.cloudResolution,4);p.set('cloudResolution',0);p.set('foveation',1);assert.equal(p.values.cloudResolution,0);assert.equal(p.values.foveation,0);p.definitions.find(d=>d.id==='foveation').disabled=false;p.set('foveation',.75);assert.equal(p.values.foveation,.75);
});
test('parameter notifications represent actual valid changes',()=>{
  const p=new Parameters();let calls=0;const off=p.subscribe(()=>calls++);p.set('cloud',0);p.set('cloud',0);p.set('density',NaN);p.set('unknown',1);assert.equal(calls,1);off();p.set('cloud',1);assert.equal(calls,1);
});
test('cadence uses real intervals at 72,90,120 Hz and resets after gaps',()=>{
  for(const hz of [72,90,120]){
    const c=new FrameRateCounter();let result;for(let i=0;i<hz;i++){
      const n=c.sample(1/hz);if(n!==null)result=n;
    }
    assert.ok(Math.abs(result-hz)<1e-8);c.reset();assert.equal(c.sample(0),null);assert.equal(c.sample(NaN),null);assert.equal(c.sample(1/hz),null);
  }
});
