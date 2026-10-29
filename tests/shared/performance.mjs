import {test} from 'node:test';
import assert from 'node:assert/strict';
import {FrameRateCounter} from '../../shared/performance/frame-rate.mjs';
import {requestFrameRate} from '../../shared/xr/frame-rate.mjs';
test('cadence measures raw slow frames, retains last reading, and resets on inactivity', () => {
  const fps=new FrameRateCounter();
  for(let i=0;i<4;i++)assert.equal(fps.sample(0.1),null);
  assert.equal(fps.sample(0.1),10);assert.equal(fps.value,10);
  assert.equal(fps.sample(1/120),null);assert.equal(fps.value,10);
  fps.reset();assert.equal(fps.value,null);
  for(const dt of [0,-1,NaN,Infinity])assert.equal(fps.sample(dt),null);
  assert.equal(fps.frames,0);assert.throws(()=>new FrameRateCounter(0),RangeError);
});
test('optional refresh requests tolerate unsupported, rejected and indefinitely pending runtimes', async () => {
  assert.equal(await requestFrameRate(null,120),false);
  assert.equal(await requestFrameRate({},120),false);
  assert.equal(await requestFrameRate({supportedFrameRates:[90],updateTargetFrameRate(){throw Error();}},120),false);
  assert.equal(await requestFrameRate({supportedFrameRates:[120],updateTargetFrameRate(){throw Error();}},120),false);
  let requested=false;
  void requestFrameRate({supportedFrameRates:new Float32Array([90,120]),updateTargetFrameRate(){requested=true;return new Promise(()=>{});}},120);
  assert.equal(requested,true);
});
