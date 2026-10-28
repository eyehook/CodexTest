import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../forest/vendor/three.module.js';
import { ImpactPool, GroundEffects } from '../src/ground-effects.js';
import { RainSimulation } from '../src/rain-simulation.js';
import { RainEffect, rainParameters } from '../src/rain-effect.js';
import { WeatherParameters } from '../src/parameters.js';
const params=()=>Object.fromEntries(rainParameters.map(d=>[d.id,d.default]));
const near=(a,b,t=1e-5)=>assert.ok(Math.abs(a-b)<t,`${a} != ${b}`);
test('interpolated rain crossing records actual wind-driven impact before recycling',()=>{
 const s=new RainSimulation(1,()=>.5),p={...params(),count:1,wind:6};s.positions.set([2,.2,3]);s.speeds[0]=4;
 let impacts=0;s.onImpact=(x,y,z,wind,age)=>{impacts++;near(x,2.3);near(y,0);near(z,3);near(wind,6);near(age,.05);};
 s.update(.1,p,{x:0,y:1.7,z:0});assert.equal(impacts,1);assert.ok(s.positions[1]>0);
 s.positions.set([30,.2,0]);s.update(.1,p,{x:0,y:1.7,z:0});assert.equal(impacts,1); // Impact beyond cylinder is excluded.
});
test('rain and ground batches use provided ground elevation and exact offsets',()=>{
 const scene=new THREE.Scene(),ground=new THREE.Mesh();ground.position.y=3;const p=new WeatherParameters(),e=new RainEffect();e.initialize(scene,p,{ground});
 assert.equal(e.simulation.groundY,3);e.simulation.positions.set([2,3.2,3]);e.simulation.speeds[0]=4;p.set('count',1);p.set('splashProbability',100);p.set('rippleProbability',100);e.update(.1,{x:0,y:4.7,z:0});
 assert.equal(e.groundEffects.splashes.freeCount,299);assert.equal(e.groundEffects.ripples.freeCount,199);near(e.groundEffects.ripples.vertices[1],3.01);
 assert.ok(e.groundEffects.splashes.vertices[1]>3.005);e.dispose();assert.equal(scene.children.length,0);
});
test('fixed pool exhaustion skips, lifetime returns slots, repeated expiry cannot duplicate free slots',()=>{
 const pool=new ImpactPool(2,'splash',()=>.5),vertices=pool.vertices,free=pool.free;
 assert.equal(pool.spawn(1,0,2),0);assert.equal(pool.spawn(3,0,4),1);assert.equal(pool.spawn(5,0,6),-1);assert.equal(pool.freeCount,0);
 pool.update(.2);assert.equal(pool.freeCount,2);assert.ok(vertices.every(v=>v===0));pool.update(1);assert.equal(pool.freeCount,2);
 assert.ok(pool.spawn(5,0,6)>=0);assert.equal(pool.vertices,vertices);assert.equal(pool.free,free);pool.clear();assert.equal(pool.freeCount,2);
});
test('splash segments follow upward/outward ballistic arcs with a short lifetime and fixed world origin',()=>{
 const pool=new ImpactPool(1,'splash',()=>.5);pool.spawn(10,2,20);near(pool.vertices[1],2.005);
 pool.update(.1);near(pool.vertices[1],2.125);const midpoint=pool.vertices[0];assert.ok(Math.abs(midpoint-10)>0.02);
 assert.equal(pool.x[0],10);assert.equal(pool.z[0],20);pool.update(.05);assert.ok(pool.vertices[1]<2.125&&pool.vertices[1]>2.005);assert.ok(Math.abs(pool.vertices[0]-10)>Math.abs(midpoint-10));pool.update(.05);assert.equal(pool.active[0],0);
});
test('ripples are 12-sided constant-height symmetric outlines with linear radius independent of wind',()=>{
 const a=new ImpactPool(1,'ripple'),b=new ImpactPool(1,'ripple');a.spawn(4,2,6,-6);b.spawn(4,2,6,6);near(a.vertices[0]-4,.02);
 a.update(.225);b.update(.225);near(a.vertices[0]-4,.135);assert.deepEqual(a.vertices,b.vertices);
 for(let n=0;n<12;n++){const i=n*6;near(a.vertices[i+1],2.01);near(a.vertices[i+4],2.01);near(Math.hypot(a.vertices[i]-4,a.vertices[i+2]-6),.135);near(a.vertices[i+3],a.vertices[((n+1)%12)*6]);near(a.vertices[i+5],a.vertices[((n+1)%12)*6+2]);}
 a.update(.225);assert.ok(a.vertices.every(v=>v===0));assert.equal(a.freeCount,1);
});
test('splash and ripple choices are independent including saturation and zero probabilities',()=>{
 const g=new GroundEffects(new THREE.Scene(),null,()=>0);const p=params();g.configure({...p,splashProbability:100,rippleProbability:100});g.impact(1,0,2,0);
 assert.equal(g.splashes.freeCount,299);assert.equal(g.ripples.freeCount,199);
 g.splashes.clear();g.ripples.clear();g.configure({...p,splashProbability:0,rippleProbability:100});g.impact(1,0,2,0);assert.equal(g.splashes.freeCount,300);assert.equal(g.ripples.freeCount,199);
 g.splashes.clear();g.ripples.clear();for(let n=0;n<300;n++)g.splashes.spawn(1,0,2);g.configure({...p,splashProbability:100,rippleProbability:100});g.impact(1,0,2,0);assert.equal(g.splashes.freeCount,0);assert.equal(g.ripples.freeCount,199);g.dispose();
});
test('toggles immediately hide/clear instances, stop spawns and resume without resizing',()=>{
 const g=new GroundEffects(new THREE.Scene(),null,()=>0),p={...params(),splashProbability:100,rippleProbability:100};const v=g.splashes.vertices;g.configure(p);g.impact(1,0,2,0);
 g.configure({...p,splashes:0});assert.equal(g.splashObject.visible,false);assert.equal(g.splashes.freeCount,300);assert.equal(g.ripples.freeCount,199);g.impact(1,0,2,0);assert.equal(g.splashes.freeCount,300);
 g.configure({...p,groundEffects:0});assert.equal(g.rippleObject.visible,false);assert.equal(g.ripples.freeCount,200);g.impact(1,0,2,0);assert.equal(g.ripples.freeCount,200);
 g.configure(p);g.impact(1,0,2,0);assert.equal(g.splashes.freeCount,299);assert.equal(g.splashes.vertices,v);g.dispose();
});
test('ground animation is frame independent and rain deactivation hides/clears both fixed batches',()=>{
 const a=new ImpactPool(1,'splash',()=>.5),b=new ImpactPool(1,'splash',()=>.5);a.spawn(1,0,2);b.spawn(1,0,2);a.update(.1);for(let n=0;n<9;n++)b.update(1/90);a.vertices.forEach((v,i)=>near(v,b.vertices[i]));
 const e=new RainEffect(),p=new WeatherParameters();e.initialize(new THREE.Scene(),p);e.groundEffects.splashes.spawn(5,0,6);e.deactivate();assert.equal(e.object.visible,false);assert.equal(e.groundEffects.group.visible,false);assert.equal(e.groundEffects.splashes.freeCount,300);e.activate();assert.equal(e.groundEffects.group.visible,true);
 for(const obj of e.groundEffects.group.children){const ripple=obj===e.groundEffects.rippleObject;assert.ok(obj.isLineSegments);assert.equal(obj.material.transparent,ripple);assert.equal(obj.material.blending,ripple?THREE.NormalBlending:THREE.NoBlending);assert.equal(obj.material.depthWrite,!ripple);assert.equal(obj.material.map,null);}e.dispose();
});

test('ripple alpha holds through first half then smoothly fades independently and resets on reuse',()=>{
 const pool=new ImpactPool(2,'ripple'),colors=pool.colors;const a=pool.spawn(1,0,2);assert.equal(colors[3],1);
 pool.update(.225);assert.equal(colors[3],1);const b=pool.spawn(3,0,4);pool.update(.1125);near(colors[3],.5);assert.equal(colors[12*8+3],1);
 for(let i=3;i<12*8;i+=4)near(colors[i],.5);
 pool.update(.1125);assert.equal(pool.active[a],0);assert.equal(colors[3],0);assert.equal(pool.active[b],1);assert.equal(colors[12*8+3],1);
 assert.equal(pool.spawn(5,0,6),a);assert.equal(colors[3],1);assert.equal(pool.colors,colors);pool.clear();for(let i=3;i<colors.length;i+=4)assert.equal(colors[i],0);
});

test('splash launch and line orientation follow reflected incoming velocity including Z turbulence',()=>{
 const straight=new ImpactPool(1,'splash',()=>.5),angled=new ImpactPool(1,'splash',()=>.5);
 straight.spawn(1,0,2,0,0,-6,0);angled.spawn(1,0,2,6,0,-6,-3);
 near(angled.launchX[0],2.4);near(angled.launchZ[0],-1.2);
 // Radial fan is identical; its average launch-axis slopes match the incident angle.
 for(let n=0;n<4;n++){const j=n*6;assert.ok(angled.vertices[j+3]>angled.vertices[j]);assert.ok(angled.vertices[j+5]<angled.vertices[j+2]);const dx=angled.vertices[j+3]-angled.vertices[j],dy=angled.vertices[j+4]-angled.vertices[j+1],dz=angled.vertices[j+5]-angled.vertices[j+2];near(Math.hypot(dx,dy,dz),angled.lengths[n]);}
 straight.update(.1);angled.update(.1);for(let n=0;n<4;n++){const j=n*6;near(angled.vertices[j]-straight.vertices[j],.24);near(angled.vertices[j+2]-straight.vertices[j+2],-.12);near(angled.vertices[j+1],straight.vertices[j+1]);}
 const faster=new ImpactPool(1,'splash',()=>.5);faster.spawn(0,0,0,6,0,-12,-3);near(faster.launchX[0],1.2);near(faster.launchZ[0],-.6);
});
test('rain impact callback supplies actual turbulent velocity, not only global X wind',()=>{
 const s=new RainSimulation(1,()=>.5),p={...params(),count:1,wind:2,turbulence:100};s.positions.set([2,.01,3]);s.speeds[0]=8;let called=false;
 s.onImpact=(x,y,z,vx,age,vy,vz)=>{called=true;assert.notEqual(vx,p.wind);near(vy,-8);assert.ok(Math.abs(vz)>0);near((x-2)/(.01/8),vx,.001);near((z-3)/(.01/8),vz,.001);};s.update(.01,p,{x:0,y:1.7,z:0});assert.ok(called);
});
