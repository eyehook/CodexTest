import assert from 'node:assert/strict';
import test from 'node:test';
import {SkiProfiler, CPU, FRAME, SHADOW} from '../profiling.mjs';

function warmUp(profiler) {
  profiler.finishFrame(0);
  profiler.finishFrame(5000);
}

test('warm-up skips startup spikes and counts only active gameplay', () => {
  const profiler = new SkiProfiler();
  profiler.finishFrame(0);
  profiler.finishFrame(4000);
  profiler.pause();
  profiler.beginFrame();
  profiler.values[CPU] = 80;
  profiler.finishFrame(20000);
  profiler.finishFrame(20999);
  assert.equal(profiler.ready, false);
  profiler.finishFrame(21000);
  assert.equal(profiler.ready, true);
  assert.equal(profiler.format(CPU), '— / — ms');
  profiler.beginFrame();
  profiler.values[CPU] = 3;
  profiler.finishFrame(21010);
  assert.equal(profiler.format(CPU), '3.00 / 3.00 ms');
  assert.equal(profiler.formatFps(), '100.0 / —');
  profiler.reset();
  assert.equal(profiler.ready, false);
});

test('rolling measurements age out while lifetime worsts and sparse sample peaks persist', () => {
  const profiler = new SkiProfiler();
  warmUp(profiler);
  for (let i = 0; i <= 40; i++) {
    profiler.beginFrame();
    profiler.values[CPU] = 5;
    if (i === 5) profiler.values[SHADOW] = 12;
    profiler.finishFrame(5000 + i * 50);
  }
  assert.equal(profiler.formatFps(), '20.0 / 20.0');
  assert.equal(profiler.format(SHADOW), '12.00 / 12.00 ms');
  for (let i = 1; i <= 80; i++) {
    profiler.beginFrame();
    profiler.values[CPU] = 2;
    profiler.finishFrame(7000 + i * 25);
  }
  assert.equal(profiler.formatFps(), '40.0 / 20.0');
  assert.equal(profiler.format(CPU), '2.00 / 5.00 ms');
  assert.equal(profiler.format(SHADOW), '— / 12.00 ms');
});

test('pauses exclude elapsed wall time and retain the first resumed CPU sample', () => {
  const profiler = new SkiProfiler();
  warmUp(profiler);
  profiler.beginFrame();
  profiler.finishFrame(5010);
  profiler.pause();
  profiler.beginFrame();
  profiler.values[CPU] = 7;
  profiler.finishFrame(60000);
  profiler.beginFrame();
  profiler.finishFrame(60010);
  assert.equal(profiler.format(FRAME), '10.00 / 10.00 ms');
  assert.equal(profiler.format(CPU), '7.00 / 7.00 ms');
  profiler.reset();
  assert.equal(profiler.formatFps(), '— / —');
  assert.equal(profiler.format(CPU), '— / — ms');
});
