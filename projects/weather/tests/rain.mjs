import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../../shared/vendor/three-r180/three.module.js';
import { RainSimulation, intersectsHead } from '../src/rain-simulation.js';
import { RainEffect, rainParameters } from '../src/rain-effect.js';
import { SnowEffect } from '../src/effects.js';
import { WeatherParameters } from '../src/parameters.js';
import { WeatherModes } from '../src/weather-modes.js';
const seeded = () => { let seed = 978; return () => ((seed = (1664525 * seed + 1013904223) >>> 0) / 4294967296); };
const defaults = () => Object.fromEntries(rainParameters.map(d => [d.id, d.default]));
const head = {x:0,y:1.7,z:0};
const near = (a,b,t=1e-5) => assert.ok(Math.abs(a-b)<t,`${a} != ${b}`);
test('rain defaults and initial pooled volume distribution',()=>{
 const p=defaults();assert.deepEqual(p,{count:2000,wind:0,turbulence:0,fallSpeed:1,trailDuration:15,groundEffects:1,splashes:1,ripples:1,splashProbability:15,rippleProbability:10});
 const s=new RainSimulation(50000,seeded());assert.equal(s.volume.radius,30);assert.equal(s.volume.height,12);let totalY=0,min=9,max=4;
 for(let n=0;n<50000;n++){const i=n*3;assert.ok(Math.hypot(s.positions[i],s.positions[i+2])<=30.00001);totalY+=s.positions[i+1];min=Math.min(min,s.speeds[n]);max=Math.max(max,s.speeds[n]);}
 assert.ok(totalY/50000>5.9&&totalY/50000<6.1);assert.ok(min>=4&&min<4.01&&max<=9&&max>8.99);
});
test('rain segment follows full velocity, grows with wind/fall multiplier, and uses terminal motion',()=>{
 const s=new RainSimulation(1,seeded()),p={...defaults(),count:1,wind:6};s.positions.set([2,6,3]);s.speeds[0]=8;s.update(.1,p,head);
 near(s.positions[0],2.6);near(s.positions[1],5.2);near(s.positions[2],3);
 near(s.segments[0]-s.segments[3],6*.015);near(s.segments[1]-s.segments[4],-8*.015);
 near(Math.hypot(s.segments[0]-s.segments[3],s.segments[1]-s.segments[4]),.15);
 p.fallSpeed=2;p.trailDuration=30;s.update(0,p,head);near(s.segments[1]-s.segments[4],-16*.03);
 p.wind=-6;s.update(0,p,head);assert.ok(s.segments[0]<s.segments[3]);
});
test('straight rain movement is frame independent and zero density preserves buffers',()=>{
 const a=new RainSimulation(1,seeded()),b=new RainSimulation(1,seeded()),p={...defaults(),count:1,wind:2};a.positions.set([2,10,3]);b.positions.set([2,10,3]);
 a.update(.5,p,head);for(let i=0;i<45;i++)b.update(1/90,p,head);
 a.positions.forEach((v,i)=>near(v,b.positions[i],.0001));const before=Array.from(a.positions);a.update(.5,{...p,count:0},head);assert.deepEqual(Array.from(a.positions),before);
});
test('turbulence is correlated for adjacent drops and varies smoothly over time',()=>{
 const s=new RainSimulation(2,seeded()),p={...defaults(),count:2,turbulence:100};s.positions.set([2,6,3,2.001,6,3.001]);s.speeds.fill(6);s.update(0,p,head);
 const vx0=(s.segments[0]-s.segments[3])/.015,vx1=(s.segments[6]-s.segments[9])/.015;
 near(vx0,vx1,.003);s.update(.001,p,head);near((s.segments[0]-s.segments[3])/.015,vx0,.004);
});
test('entire streak excluded from moving/height-changing headset sphere, including tail-only collisions',()=>{
 assert.ok(intersectsHead(0,1,0,0,2,0,{x:0,y:2,z:0}));assert.ok(!intersectsHead(2,1,0,2,2,0,head));
 const s=new RainSimulation(3,seeded()),p={...defaults(),count:3,trailDuration:50};s.positions.set([0,1.1,0,0,1.7,0,0,2.2,0]);s.speeds.fill(9);
 for(const h of [head,{x:3,y:3,z:4},{x:0,y:12,z:0}]){
  s.positions.set([h.x,h.y-.6,h.z,h.x,h.y,h.z,h.x,h.y+.4,h.z]);s.update(0,p,h);
  for(let n=0;n<3;n++){const i=n*6;assert.ok(!intersectsHead(...s.segments.slice(i,i+6),h));}
 }
});
test('wind inlets populate top and upwind side with projected-area flux and cover the cylinder',()=>{
 const s=new RainSimulation(1,seeded());let top=0,side=0,left=0,right=0;
 for(let n=0;n<10000;n++){s.spawn(0,6,-6,0);if(s.positions[1]===12)top++;else {side++;assert.ok(s.positions[0]<=.001);}if(s.positions[0]<0)left++;else right++;}
 assert.ok(top>7800&&side>1700);assert.ok(left>right);
 const p={...defaults(),count:5000,wind:6},field=new RainSimulation(5000,seeded());
 for(let n=0;n<360;n++)field.update(1/90,p,head);
 let upwind=0,downwind=0;for(let n=0;n<5000;n++){if(field.positions[n*3]<-5)upwind++;if(field.positions[n*3]>5)downwind++;}
 assert.ok(upwind>700&&downwind>700,`${upwind} / ${downwind}`);
});
test('50,000 rain drops stay finite and bounded with extreme controls, moving headset and teleport',()=>{
 const s=new RainSimulation(50000,seeded()),p={...defaults(),count:50000,wind:-6,turbulence:100,fallSpeed:3,trailDuration:50};const positions=s.positions,segments=s.segments;
 for(let f=0;f<90;f++)s.update(1/90,p,{x:f*.03,y:1.2+Math.sin(f*.1)*.5,z:f*.02});
 const h={x:300,y:2,z:-500};s.update(1/90,p,h);
 for(let n=0;n<50000;n++){const i=n*6;for(let j=0;j<6;j++)assert.ok(Number.isFinite(segments[i+j]));for(const off of [0,3]){assert.ok(Math.hypot(segments[i+off]-h.x,segments[i+off+2]-h.z)<=30.0001);assert.ok(segments[i+off+1]>=0&&segments[i+off+1]<=12.00001);}assert.ok(!intersectsHead(...segments.slice(i,i+6),h,.4999));}
 assert.equal(s.positions,positions);assert.equal(s.segments,segments);
});
test('rain is one opaque LineSegments batch, two vertices per drop, fixed buffers and cleanup',()=>{
 const scene=new THREE.Scene(),p=new WeatherParameters(),effect=new RainEffect();effect.initialize(scene,p);assert.ok(effect.object.isLineSegments);assert.equal(effect.object.material.transparent,false);assert.equal(effect.object.material.opacity,1);assert.equal(effect.object.material.blending,THREE.NoBlending);
 const attr=effect.object.geometry.attributes.position;p.set('count',50000);effect.update(1/90,head);assert.equal(effect.object.geometry.drawRange.count,100000);assert.equal(attr.array.length,300000);assert.equal(effect.object.geometry.attributes.position,attr);p.set('count',0);assert.equal(effect.object.geometry.drawRange.count,0);effect.dispose();assert.equal(scene.children.length,0);assert.equal(p.listeners.size,0);
});
test('weather registry retains each mode settings and pools, activates only one and accepts future effects',()=>{
 const scene=new THREE.Scene(),modes=new WeatherModes(scene,[{id:'snow',label:'Snow',create:()=>new SnowEffect()},{id:'rain',label:'Rain',create:()=>new RainEffect()},{id:'future',label:'Future',create:()=>new RainEffect()}]);
 const snow=modes.select('snow');snow.parameters.set('size',10);snow.parameters.set('count',12345);const pool=snow.effect.simulation.positions;
 const rain=modes.select('rain');assert.equal(snow.effect.object.visible,false);assert.equal(rain.effect.object.visible,true);rain.parameters.set('wind',-4);rain.parameters.set('trailDuration',30);
 assert.equal(modes.select('snow'),snow);assert.equal(snow.effect.simulation.positions,pool);assert.equal(snow.parameters.values.size,10);assert.equal(snow.parameters.values.count,12345);assert.equal(rain.effect.object.visible,false);
 assert.equal(modes.select('rain').parameters.values.wind,-4);assert.equal(rain.parameters.values.trailDuration,30);modes.select('future');assert.equal(rain.effect.object.visible,false);assert.throws(()=>modes.select('missing'));modes.dispose();assert.equal(scene.children.length,0);
});

test('switching weather immediately refills its existing volume around the current player without changing settings',()=>{
 const scene=new THREE.Scene(),modes=new WeatherModes(scene,[{id:'snow',label:'Snow',create:()=>new SnowEffect()},{id:'rain',label:'Rain',create:()=>new RainEffect()}]);
 const snow=modes.select('snow',{x:0,y:1.7,z:0});snow.parameters.set('size',4);snow.parameters.set('count',50000);const snowPositions=snow.effect.simulation.positions,sizes=snow.effect.simulation.sizes;
 modes.select('rain',{x:5,y:1.7,z:5});
 const destination={x:250,y:1.7,z:-150};assert.equal(modes.select('snow',destination),snow);snow.effect.update(0,destination);
 assert.equal(snow.effect.simulation.positions,snowPositions);assert.equal(snow.effect.simulation.sizes,sizes);assert.equal(snow.parameters.values.size,4);assert.equal(snow.parameters.values.count,50000);
 let ySum=0;for(let n=0;n<50000;n++){const i=n*3;assert.ok(Math.hypot(snowPositions[i]-destination.x,snowPositions[i+2]-destination.z)<=15.0001);ySum+=snowPositions[i+1];}assert.ok(ySum/50000>5.8&&ySum/50000<6.2);
 const rain=modes.select('rain',{x:400,y:1.7,z:200});rain.parameters.set('wind',4);const rainPositions=rain.effect.simulation.positions;
 modes.select('snow',destination);modes.select('rain',{x:-300,y:1.7,z:500});rain.effect.update(0,{x:-300,y:1.7,z:500});assert.equal(rain.effect.simulation.positions,rainPositions);assert.equal(rain.parameters.values.wind,4);
 for(let n=0;n<50000;n++){const i=n*3;assert.ok(Math.hypot(rainPositions[i]+300,rainPositions[i+2]-500)<=30.0001);}modes.dispose();
});
