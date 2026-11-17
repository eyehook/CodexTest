import {test} from 'node:test';
import assert from 'node:assert/strict';
import {particleMotion} from '../particle-motion.mjs';

test('note changes preserve position and velocity; pause freezes attraction',()=>{
  const move=particleMotion();move(0,.1,1);const a={...move(.2,.1,1)};
  assert.ok(a.pitch<.5 && a.pitch>.1);
  const b={...move(.2,.9,0)};
  assert.deepEqual(b,a);
  const c={...move(.21,.9,1)};
  assert.ok(Math.abs(c.pitch-b.pitch)<.02);
  assert.ok(c.velocity<0); // Keeps drifting before reversing toward the high note.
  const end=move(10,.9,1);
  assert.ok(Math.abs(end.pitch-.9)<1e-8);
});

test('constant-note attraction is independent of update rate and handles rewinds',()=>{
  const fast=particleMotion(),slow=particleMotion();fast(0,1,1);slow(0,1,1);
  let a,b;
  for(let i=1;i<=120;i++)a=fast(i/60,1,1);
  for(let i=1;i<=10;i++)b=slow(i/5,1,1);
  for(const field of ['pitch','velocity','pull'])assert.ok(Math.abs(a[field]-b[field])<1e-12);
  assert.deepEqual(slow(0,1,1),{pitch:.5,velocity:0,pull:0});
});
