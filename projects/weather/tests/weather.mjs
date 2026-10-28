import test from 'node:test';
import assert from 'node:assert/strict';
import { WeatherParameters, snowParameters } from '../src/parameters.js';
import { SnowSimulation, SimulationVolume } from '../src/simulation.js';
const seeded = () => { let seed = 123; return () => ((seed = (1664525 * seed + 1013904223) >>> 0) / 4294967296); };
test('parameter ranges, quantization and shared notifications', () => {
 const p = new WeatherParameters(); p.register(snowParameters); let notices = 0;
 const stop = p.subscribe(() => notices++); assert.equal(p.values.count, 5000);
 p.set('count', 60000); assert.equal(p.values.count, 50000);
 p.set('wind', -2.34); assert.ok(Math.abs(p.values.wind + 2.3) < 1e-8);
 p.set('turbulence', -5); assert.equal(p.values.turbulence, 0);
 p.set('count', NaN); assert.equal(notices, 3); stop(); p.set('count', 0); assert.equal(notices, 3);
});
test('initial full-volume distribution, physical sizes and inverse size/speed trend', () => {
 const s = new SnowSimulation(50000, seeded()); let small = 0, large = 0, ns = 0, nl = 0, y = 0;
 for(let n=0;n<50000;n++) {
  assert.ok(Math.hypot(s.positions[n*3], s.positions[n*3+2]) <= 15.00001);
  assert.ok(s.sizes[n]>=.001299 && s.sizes[n]<=.007601);
  y += s.positions[n*3+1];
  if(s.sizes[n]<.002){small+=s.speeds[n];ns++;} if(s.sizes[n]>.006){large+=s.speeds[n];nl++;}
 }
 assert.ok(y/50000>5.8 && y/50000<6.2); assert.ok(small/ns>large/nl);
});
test('world positions stay stable when player shifts; outside particles wrap opposite', () => {
 const v = new SimulationVolume(), p = new Float32Array([2,6,3,16,5,0]); v.follow(1,0); v.wrap(p,0);
 assert.deepEqual(Array.from(p.slice(0,3)), [2,6,3]); v.follow(0,0); v.wrap(p,3); assert.equal(p[3],-14);
 v.follow(100,100); v.wrap(p,0); assert.ok(Math.hypot(p[0]-100,p[2]-100)<=15.00001);
});
test('zero turbulence gives straight wind and terminal fall; recycling stays in cylinder', () => {
 const s = new SnowSimulation(1, seeded()); s.positions.set([0,6,0]); const speed = s.speeds[0];
 s.update(.5,1,2,0,0,0); assert.equal(s.positions[0],1); assert.equal(s.positions[2],0); assert.ok(Math.abs(s.positions[1]-(6-speed*.5))<1e-6);
 s.positions[1]=.001; s.update(.1,1,0,0,0,0); assert.ok(s.positions[1]>11); assert.ok(Math.hypot(s.positions[0],s.positions[2])<=15);
});
test('straight trajectories are frame independent and count zero preserves buffers', () => {
 const a=new SnowSimulation(1,seeded()),b=new SnowSimulation(1,seeded()); a.positions.set([0,6,0]);b.positions.set([0,6,0]);
 a.update(.5,1,1,0,0,0); for(let n=0;n<50;n++)b.update(.01,1,1,0,0,0);
 for(let n=0;n<3;n++)assert.ok(Math.abs(a.positions[n]-b.positions[n])<.0001);
 const before=Array.from(a.positions);a.update(1,0,6,100,100,100);assert.deepEqual(Array.from(a.positions),before);
});
test('all supported particles remain finite and bounded under sustained maximum wind and moving center', () => {
 const s=new SnowSimulation(50000,seeded()); const positions=s.positions;
 for(let frame=0;frame<200;frame++)s.update(1/90,50000,6,100,frame*.02,frame*.01);
 assert.equal(s.positions,positions);
 for(let n=0;n<50000;n++){const i=n*3; assert.ok(Number.isFinite(positions[i]));assert.ok(positions[i+1]>0&&positions[i+1]<=12);assert.ok(Math.hypot(positions[i]-3.98,positions[i+2]-1.99)<=15.0001);}
});
