import {test} from 'node:test';
import assert from 'node:assert/strict';
import {selectTrailhead} from '../trailhead.mjs';
test('selects a low broad bench instead of a flat-bottomed enclosed pit',()=>{
 const summit={x:0,y:220,z:0};
 const height=(x,z)=>{
  const pit=Math.hypot(x-675,z);
  if(pit<12)return 0;
  if(pit<100)return 50;
  return 20;
 };
 const landscape={height,summit,extent:1920},start=selectTrailhead(landscape);
 assert.equal(start.y,20);
 assert.ok(Math.hypot(start.x-675,start.z)>100);
 assert.ok(Math.hypot(start.x,start.z)>=500&&Math.hypot(start.x,start.z)<=900);
 assert.deepEqual(selectTrailhead(landscape),start);
});
