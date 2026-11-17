import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Group,Color} from '../../../shared/vendor/three-r180/three.module.js';
import {NoteSwirl} from '../note-swirl.mjs';

test('particles trail independently, preserve momentum on retarget, and fade on misses',()=>{
  const swirl=new NoteSwirl(new Group()),color=new Color(0x55aaff);
  swirl.update(0,color,0);
  for(let i=1;i<=120;i++)swirl.update(0,color,i/120);
  const before=swirl.positions.slice(),velocities=swirl.velocities.slice();
  swirl.update(4,color,1);
  assert.deepEqual(swirl.positions,before);assert.deepEqual(swirl.velocities,velocities);
  for(let i=1;i<=24;i++)swirl.update(4,color,1+i/120);
  const travel=Array.from({length:72},(_,i)=>swirl.positions[i*3+1]-before[i*3+1]);
  assert.ok(Math.max(...travel)-Math.min(...travel)>.15);
  assert.ok(travel.every(v=>v>0));
  const mid=swirl.positions.slice();swirl.update(1,color,1.2);
  assert.deepEqual(swirl.positions,mid);
  for(let i=1;i<=480;i++)swirl.update(i%70<35?1:4,color,1.2+i/120);
  assert.ok([...swirl.positions,...swirl.velocities].every(Number.isFinite));
  assert.ok(swirl.positions.every(v=>Math.abs(v)<1));
  const alpha=swirl.uniforms.alpha.value;
  swirl.update(null,color,5.3);assert.ok(swirl.uniforms.alpha.value>0 && swirl.uniforms.alpha.value<alpha);
  assert.equal(swirl.points.visible,true);
  swirl.update(null,color,12);assert.equal(swirl.points.visible,false);
  assert.equal(swirl.points.geometry.attributes.position.count,72);
  assert.equal(swirl.points.position.y,0); // No shared translating ring.
  swirl.reset();assert.equal(swirl.uniforms.alpha.value,0);assert.equal(swirl.points.visible,false);
});
