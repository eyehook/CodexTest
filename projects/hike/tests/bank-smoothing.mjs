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
