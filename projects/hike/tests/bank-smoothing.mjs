import {test} from 'node:test';
import assert from 'node:assert/strict';
import {smoothBankPeaks} from '../trail-surface.mjs';

// A single bank vertex enclosed by the two sides of a tight turn. The ring
// belongs to walking triangles; the middle four triangles are exposed bank.
function fixture(){
 const vertices=[{x:0,z:0,y:8},...[[1,0],[0,1],[-1,0],[0,-1]].map(([x,z])=>({x,z,y:2})),...[[2,0],[0,2],[-2,0],[0,-2]].map(([x,z])=>({x,z,y:2}))];
 const banks=[[0,1,2],[0,2,3],[0,3,4],[0,4,1]],walking=[[1,5,2],[2,6,3],[3,7,4],[4,8,1]];
 return {vertices,banks,walking};
}
test('isolated inner-bank spike is flattened without changing tread or topology',()=>{
 const {vertices,banks,walking}=fixture(),before=structuredClone({vertices,banks,walking});
 assert.equal(smoothBankPeaks(vertices,walking,banks),1);
 assert.equal(vertices[0].y,2);
 assert.deepEqual(vertices.slice(1),before.vertices.slice(1));
 assert.deepEqual({banks,walking},{banks:before.banks,walking:before.walking});
 assert.equal(smoothBankPeaks(vertices,walking,banks),0);
});
test('ordinary sloping banks, endpoints and open patch boundaries are preserved',()=>{
 for(const mode of ['slope','endpoint','boundary']){
  const {vertices,banks,walking}=fixture();
  if(mode==='slope')for(const p of vertices)p.y=2+p.x*.4+p.z*.2;
  if(mode==='endpoint')vertices[0].fixed=true;
  if(mode==='boundary')banks.pop();
  const before=structuredClone(vertices);
  assert.equal(smoothBankPeaks(vertices,walking,banks),0,mode);
  assert.deepEqual(vertices,before,mode);
 }
});
test('smoothing is independent of triangle traversal order',()=>{
 const a=fixture(),b=fixture();
 smoothBankPeaks(a.vertices,a.walking,a.banks);
 smoothBankPeaks(b.vertices,b.walking.slice().reverse(),b.banks.slice().reverse());
 assert.deepEqual(a.vertices,b.vertices);
});

import {createBankHeight} from '../bank-height.mjs';
import {createRouteQuery} from '../route-query.mjs';
function bankFixture(profile,raw=()=>30){
 return createBankHeight(profile,2.5,raw,createRouteQuery(profile,2.5));
}
test('deep earthworks widen shoulders and join the tread continuously',()=>{
 const height=bankFixture([{x:-100,z:0,y:0,distance:0},{x:100,z:0,y:0,distance:200}]);
 assert.equal(height(0,0),0);
 assert.ok(Math.abs(height(0,2.50001))<1e-6);
 assert.ok(height(0,11.5)<1,'old 9 m shoulder must no longer return to 30 m');
 let maxSlope=0;
 for(let z=2.6;z<153;z+=.1)maxSlope=Math.max(maxSlope,Math.abs(height(0,z+.01)-height(0,z))/.01);
 assert.ok(maxSlope<.6,`bank gradient ${maxSlope}`);
 assert.equal(height(0,153),30);
});
test('overlapping switchback shoulders have no nearest-leg height jump',()=>{
 const profile=[{x:-100,z:0,y:0,distance:0},{x:100,z:0,y:0,distance:200},{x:100,z:20,y:10,distance:222},{x:-100,z:20,y:10,distance:422}];
 const height=bankFixture(profile);
 assert.ok(Math.abs(height(0,10.0001)-height(0,9.9999))<.001);
 for(const z of [2.5,17.5])assert.ok(Math.abs(height(0,z+.00001)-height(0,z-.00001))<.001);
 for(let z=3;z<17;z+=.1)assert.ok(Number.isFinite(height(0,z)));
});
