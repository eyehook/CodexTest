import {test} from 'node:test';
import assert from 'node:assert/strict';
import {LeaderPhysics,LEADER_LENGTH,HOOK_LENGTH} from '../../src/fishing/rods/LeaderPhysics.mjs';
function run(fps,offset=0,water=null){
 const p=new LeaderPhysics(water);p.update(offset,2,0,0);
 for(let i=1;i<=fps*3;i++){
  const t=i/fps,x=offset+(t<1?.2*Math.sin(t*Math.PI*2):0);p.update(x,2,0,1/fps);
  assert.ok(p.position.every(Number.isFinite));
  for(let n=0;n<3;n++){
   const a=n*3,b=a+3,d=Math.hypot(p.position[b]-p.position[a],p.position[b+1]-p.position[a+1],p.position[b+2]-p.position[a+2]);
   assert.ok(d<=(n===2?HOOK_LENGTH:LEADER_LENGTH/2)+.012);
   if(n===2)assert.ok(Math.abs(d-HOOK_LENGTH)<1e-6);
  }
 }
 return p;
}
test('two leader links and rigid hook swing, stay bounded, and agree across frame rates',()=>{
 const results=[30,72,90,120].map(fps=>run(fps));
 for(const p of results)assert.ok(Math.abs(p.position[9]-results[0].position[9])<.015);
 const p=new LeaderPhysics();p.reset(0,2,0);
 for(let i=1;i<=60;i++)p.update(i/120,2,0,1/120);
 const x=p.position[9];p.update(.5,2,0,1/120);assert.notEqual(p.position[9],x);
 assert.ok(Math.abs(p.position[9]-.5)>.005);
});
test('leader physics supports underwater drag, large world positions and teleport reset',()=>{
 const air=run(120),wet=run(120,0,()=>10),large=run(120,1e9);
 assert.ok(Math.abs(wet.position[9])<Math.abs(air.position[9]));
 assert.ok(Math.abs((large.position[9]-1e9)-air.position[9])<.002);
 large.update(-1e9,3,0,1);assert.equal(large.position[0],-1e9);assert.equal(large.position[1],3);
});
