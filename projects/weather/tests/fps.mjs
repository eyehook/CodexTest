import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../../shared/vendor/three-r180/three.module.js';
import { FrameRateCounter } from '../src/fps.js';
import { SnowEffect } from '../src/effects.js';
import { WeatherParameters } from '../src/parameters.js';
test('FPS averages real intervals at 90/120 Hz and low cadence without simulation clamping',()=>{
 for(const rate of [10,90,120]){
  const counter=new FrameRateCounter();let measured=null;
  for(let n=0;n<rate;n++){const next=counter.sample(1/rate);if(next!==null)measured=next;}
  assert.ok(Math.abs(measured-rate)<1e-8);
 }
 const counter=new FrameRateCounter();counter.sample(.25);counter.reset();assert.equal(counter.sample(1/90),null);
 assert.equal(counter.sample(NaN),null);assert.equal(counter.frames,1);
});
test('50,000 particles render from fixed buffers and can return to zero',()=>{
 const effect=new SnowEffect(),parameters=new WeatherParameters();effect.initialize(new THREE.Scene(),parameters);
 const positions=effect.simulation.positions;assert.equal(positions.length,150000);
 parameters.set('count',50000);effect.update(1/90,new THREE.Vector3());assert.equal(effect.object.geometry.drawRange.count,50000);
 assert.equal(effect.object.geometry.attributes.position.count,50000);assert.ok(positions.every(Number.isFinite));
 parameters.set('count',0);effect.update(1/90,new THREE.Vector3());assert.equal(effect.object.geometry.drawRange.count,0);assert.equal(effect.simulation.positions,positions);effect.dispose();
});

test('snow size changes immediately through a uniform while preserving individual sizes and physics',()=>{
 const effect=new SnowEffect(),parameters=new WeatherParameters();effect.initialize(new THREE.Scene(),parameters);
 const sizes=effect.simulation.sizes, speeds=effect.simulation.speeds;
 const firstSize=sizes[0],firstSpeed=speeds[0];assert.equal(effect.object.material.uniforms.sizeScale.value,1);
 parameters.set('size',10);assert.equal(effect.object.material.uniforms.sizeScale.value,10);
 parameters.set('size',20);assert.equal(parameters.values.size,10);
 parameters.set('size',0);assert.equal(parameters.values.size,.1);
 assert.equal(effect.simulation.sizes,sizes);assert.equal(sizes[0],firstSize);assert.equal(effect.simulation.speeds,speeds);assert.equal(speeds[0],firstSpeed);
 effect.dispose();
});
