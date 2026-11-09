import test from 'node:test';
import assert from 'node:assert/strict';
import {createStoneFacingGeometry,createStoneFacing,STONE_MAX_RELIEF} from '../stone-wall.mjs';
import {HALF_WIDTH,HALF_DEPTH,WALL_HEIGHT,DOOR_WIDTH,DOOR_HEIGHT} from '../garden-layout.mjs';
test('stone facing is deterministic, bounded and leaves the doorway clear',()=>{
 const g=createStoneFacingGeometry(),other=createStoneFacingGeometry();assert.deepEqual(g.attributes.position.array,other.attributes.position.array);
 const stones=g.userData.stones;assert.ok(stones.length>300&&stones.length<1200);
 assert.ok(new Set(stones.map(s=>(s.maxX-s.minX).toFixed(2))).size>30);assert.ok(new Set(stones.map(s=>(s.maxY-s.minY).toFixed(2))).size>10);
 for(const s of stones){assert.ok(s.minY>=0&&s.maxY<=WALL_HEIGHT);assert.ok(s.relief<=STONE_MAX_RELIEF);const half=s.wall%2===0?HALF_WIDTH:HALF_DEPTH;assert.ok(s.minX>=-half&&s.maxX<=half);if(s.wall===0&&s.minY<DOOR_HEIGHT)assert.ok(s.maxX<=-DOOR_WIDTH/2||s.minX>=DOOR_WIDTH/2);}
 const a=g.attributes.position,n=g.attributes.normal;assert.ok([...a.array,...n.array,...g.attributes.color.array].every(Number.isFinite));assert.equal(a.count,stones.length*24*3);
 for(let i=0;i<stones.length;i++)for(let j=0;j<72;j++){const k=i*72+j,s=stones[i],angle=s.wall*Math.PI/2,z=a.getX(k)*Math.sin(angle)+a.getZ(k)*Math.cos(angle),distance=s.wall%2===0?HALF_DEPTH:HALF_WIDTH;assert.ok(distance-z>=-.00001&&distance-z<=STONE_MAX_RELIEF+.00001);}
 g.dispose();other.dispose();
});
test('stone facing is one static non-instanced mesh without extra shadow passes',()=>{
 const mesh=createStoneFacing();assert.equal(mesh.isMesh,true);assert.ok(!mesh.isInstancedMesh);assert.equal(mesh.geometry.groups.length,0);assert.equal(mesh.material.vertexColors,true);assert.equal(mesh.matrixAutoUpdate,false);assert.equal(mesh.castShadow,false);mesh.geometry.dispose();mesh.material.dispose();
});
