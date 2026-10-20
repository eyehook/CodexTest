import {test} from 'node:test';
import assert from 'node:assert/strict';
import {LinePhysics,LINE_SEGMENTS,LINE_STEP} from '../../src/fishing/rods/LinePhysics.mjs';
const end=LINE_SEGMENTS*3;
function distance(p,x,y,z){return Math.hypot(p.position[end]-x,p.position[end+1]-y,p.position[end+2]-z);}
test('gravity and finite line length hold a resting bobber without drift or explosions',()=>{
 const p=new LinePhysics(.8);p.reset(0,2,0);
 for(let i=0;i<1200;i++)p.update(0,2,0,LINE_STEP);
 assert.ok(distance(p,0,2,0)<.81);assert.ok(p.position[end+1]<1.21&&p.position[end+1]>1.18);
 assert.ok(Array.from(p.position).every(Number.isFinite));
});
test('moving the rod transfers momentum, and bobber continues swinging after the rod stops',()=>{
 const p=new LinePhysics(.8);p.reset(0,2,0);
 for(let i=1;i<=36;i++)p.update(i/120*1.5,2,0,LINE_STEP);
 const first=p.position[end],v=new Float64Array(3);p.bobberVelocity(v);assert.ok(Math.abs(v[0])>.05);
 let min=Infinity,max=-Infinity;
 for(let i=0;i<240;i++){p.update(.45,2,0,LINE_STEP);min=Math.min(min,p.position[end]);max=Math.max(max,p.position[end]);assert.ok(distance(p,.45,2,0)<.83);}
 assert.ok(max-min>.1);assert.ok(max>.45);assert.ok(first!==p.position[end]);
});
test('fixed-step swinging is consistent across display rates',()=>{
 const results=[];
 for(const fps of [30,72,90,120]){
  const p=new LinePhysics(.8);p.reset(0,2,0);for(let i=1;i<=fps*4;i++)p.update(Math.min(i/fps,.3)*1.5,2,0,1/fps);results.push(p.position.slice(end));
 }
 for(const r of results)assert.ok(Math.hypot(r[0]-results[0][0],r[1]-results[0][1],r[2]-results[0][2])<.01);
});
test('large world coordinates, line payout, teleports and delayed frames remain bounded',()=>{
 const p=new LinePhysics(.8);p.reset(1e9,100,-1e9);for(let i=0;i<100;i++)p.update(1e9,100,-1e9,1/72);
 assert.ok(distance(p,1e9,100,-1e9)<.82);p.length=2;for(let i=0;i<240;i++)p.update(1e9,100,-1e9,1/120);assert.ok(distance(p,1e9,100,-1e9)>1.8&&distance(p,1e9,100,-1e9)<2.05);
 p.update(-1e9,20,1e9,1/72);assert.ok(distance(p,-1e9,20,1e9)<=2.001);
 p.update(-1e9,20,1e9,10);assert.ok(Array.from(p.position).every(Number.isFinite));
});
