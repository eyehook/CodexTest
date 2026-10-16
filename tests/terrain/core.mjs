import {test} from 'node:test';import assert from 'node:assert/strict';
import {defaults,terrainHeight,octaveData} from '../../src/terrain/height.mjs';import {meshData} from '../../src/terrain/mesh.mjs';import {advance,deadzone,xrAxes} from '../../src/terrain/player.mjs';
test('mesh faces up, has no degenerate faces, closed ring seams, and manifold interior',()=>{for(const [r,n,s]of [[2000,128,256],[100,16,32],[5000,256,512],[100,256,512]]){const m=meshData(r,n,s),edges=new Map();for(let i=0;i<m.indices.length;i+=3){const ids=Array.from(m.indices.slice(i,i+3)),[a,b,c]=ids.map(k=>[m.positions[k*3],m.positions[k*3+2]]);assert.ok((b[1]-a[1])*(c[0]-a[0])-(b[0]-a[0])*(c[1]-a[1])>1e-9);for(let j=0;j<3;j++){const k=[ids[j],ids[(j+1)%3]].sort((a,b)=>a-b).join(',');edges.set(k,(edges.get(k)||0)+1);}}for(const [edge,count]of edges){assert.ok(count===1||count===2);if(count===1)for(const id of edge.split(',').map(Number))assert.ok(Math.abs(Math.hypot(m.positions[id*3],m.positions[id*3+2])-r)<0.001);}assert.ok(m.indices.length/3<2*n*s);}});
test('height reproducible, continuous at signed lattice boundaries, and seed sensitive',()=>{for(const x of [-1e9,-500,-0.001,0,500,1e9]){const h=terrainHeight(x,x*0.3);assert.equal(h,terrainHeight(x,x*0.3));assert.ok(Number.isFinite(h));assert.ok(Math.abs(h-terrainHeight(x+0.001,x*0.3))<0.01);}assert.notEqual(terrainHeight(123,456),terrainHeight(123,456,{...defaults,seed:99}));});
test('large travel keeps submeter octave fractions and unsigned lattice values',()=>{for(const x of [-1e9,1e9]){const a=octaveData(x,0,defaults),b=octaveData(x+0.25,0,defaults);assert.ok(Math.abs(b.fraction[0][0]-a.fraction[0][0]-0.25*defaults.frequency)<1e-8);assert.ok(a.base.every(v=>v.every(n=>n>=0&&n<=0xffffffff)));}});
test('head-relative movement, frame independence, analog deadzone and left controller selection',()=>{const a={x:0,z:0},b={x:0,z:0};advance(a,0,-1,Math.PI/2,3,1);for(let i=0;i<72;i++)advance(b,0,-1,Math.PI/2,3,1/72);assert.ok(Math.abs(a.x+3)<1e-10);assert.ok(Math.abs(a.x-b.x)<1e-10);assert.deepEqual(deadzone(0.1,0),[0,0]);assert.ok(Math.abs(Math.hypot(...deadzone(1,1))-1)<1e-10);assert.deepEqual(xrAxes({inputSources:[{handedness:'right',gamepad:{axes:[0,0,1,1]}}]}),[0,0]);});

test('smooth turn has signed analog control, horizontal deadzone, and pivots about the tracked head',async()=>{
 const {xrTurn,turnAtHead}=await import('../../src/terrain/player.mjs');
 const session=x=>({inputSources:[{handedness:'left',gamepad:{axes:[0,0,1,0]}},{handedness:'right',gamepad:{axes:[0,0,x,1]}}]});
 assert.equal(xrTurn(session(0.1)),0);assert.equal(xrTurn(session(1)),1);assert.equal(xrTurn(session(-1)),-1);assert.ok(Math.abs(xrTurn(session(0.575))-0.5)<1e-12);assert.equal(xrTurn(null),0);
 const head={x:1.2,z:-0.7},point=rig=>({x:rig.x+Math.cos(rig.yaw)*head.x+Math.sin(rig.yaw)*head.z,z:rig.z-Math.sin(rig.yaw)*head.x+Math.cos(rig.yaw)*head.z});
 const a={x:4,z:-3,yaw:0.3},b={...a},before=point(a),delta=-defaults.turnSpeed*Math.PI/180;
 turnAtHead(a,head.x,head.z,delta);for(let i=0;i<72;i++)turnAtHead(b,head.x,head.z,delta/72);
 for(const rig of [a,b]){const after=point(rig);assert.ok(Math.abs(after.x-before.x)<1e-10);assert.ok(Math.abs(after.z-before.z)<1e-10);}
 assert.ok(Math.abs(a.yaw-b.yaw)<1e-10);
 const world={x:0,z:0};advance(world,0,-1,-Math.PI/2,defaults.speed,1);assert.ok(Math.abs(world.x-6)<1e-10);
});

test('water world level is fixed across movement and dry spawn is reproducible',async()=>{
 const {waterLevel,localWaterHeight,drySpawn}=await import('../../src/terrain/water.mjs');
 assert.equal(waterLevel(defaults),6.5);
 for(const ground of [-50,0,20,100])assert.ok(Math.abs(localWaterHeight(defaults,ground)+ground-6.5)<1e-10);
 assert.equal(waterLevel({...defaults,amplitude:100}),10);
 const spawn=drySpawn(defaults);assert.deepEqual(spawn,drySpawn(defaults));assert.ok(terrainHeight(spawn.x,spawn.z,defaults)>waterLevel(defaults)+2);
 assert.deepEqual(drySpawn({...defaults,amplitude:0}),{x:0,z:0});
});
