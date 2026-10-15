import test from 'node:test';
import assert from 'node:assert/strict';
import {config} from '../src/config.js';
import {Wasp} from '../src/Wasp.js';
import {Swarm} from '../src/Swarm.js';
function random(){let seed=12345;return ()=>((seed=(1664525*seed+1013904223)>>>0)/4294967296);}
test('two minutes of pursuit remain finite, airborne, bounded in speed and near leader',()=>{
 const c=structuredClone(config),r=random(),w=new Wasp(c,r),s=new Swarm(c,w.position,r);
 let minY=Infinity,maxGap=0;
 for(let frame=0;frame<7200;frame++){
  const old=w.position.clone();w.update(1/60);
  assert.ok(old.distanceTo(w.position)<.055,'continuous approximately constant-speed path');
  assert.ok(w.position.y>2 && w.position.y<15);
  s.update(1/60,w.position);
  for(const b of s.boids){assert.ok(Number.isFinite(b.position.lengthSq()));assert.ok(b.velocity.length()<=c.maxSpeed*b.variation+1e-8);minY=Math.min(minY,b.position.y);maxGap=Math.max(maxGap,b.position.distanceTo(w.position));}
 }
 assert.ok(minY>1,'soft ground avoidance');assert.ok(maxGap<30,'pursuit does not disperse indefinitely');
 console.log({minY,maxGap});
});
test('live speed and population configuration are respected',()=>{
 const c=structuredClone(config),r=random(),w=new Wasp(c,r);c.beeCount=17;const s=new Swarm(c,w.position,r);assert.equal(s.boids.length,17);c.maxSpeed=.5;s.update(1/60,w.position);assert.ok(s.boids.every(b=>b.velocity.length()<=.5*b.variation+1e-8));
});
