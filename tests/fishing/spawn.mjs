import {test} from 'node:test';
import assert from 'node:assert/strict';
import {coastalSpawn,waterLevel} from '../../src/fishing/water.mjs';
import {defaults,terrainHeight} from '../../src/fishing/height.mjs';
test('new seeds find reproducible dry coastal spawns with real water nearby',()=>{
 for(const seed of [0,1,2,42,12345,54321,65535]){
  const c={...defaults,seed},p=coastalSpawn(c);assert.ok(p,`seed ${seed} has a dry coast`);assert.deepEqual(p,coastalSpawn(c));
  assert.ok(terrainHeight(p.x,p.z,c)>=waterLevel(c)+1-1e-8);
  assert.ok(terrainHeight(p.shoreX,p.shoreZ,c)<=waterLevel(c));
  assert.ok(Math.hypot(p.x-p.shoreX,p.z-p.shoreZ)<=96);
 }
});
test('coastal placement respects edited terrain settings and rejects flat water-only terrain',()=>{
 for(const edits of [{amplitude:10},{amplitude:150},{frequency:.0001},{frequency:.02},{octaves:1},{seed:200,persistence:.8,lacunarity:3}]){
  const c={...defaults,...edits},p=coastalSpawn(c);assert.ok(p);assert.ok(terrainHeight(p.x,p.z,c)>waterLevel(c));assert.ok(terrainHeight(p.shoreX,p.shoreZ,c)<=waterLevel(c));
 }
 assert.equal(coastalSpawn({...defaults,amplitude:0}),null);
});
