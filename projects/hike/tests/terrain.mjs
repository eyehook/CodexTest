import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../../../shared/vendor/three-r180/three.module.js';
import {createWorld} from '../world.mjs';
import {Terrain} from '../terrain.mjs';
const world=createWorld(),scene=new T.Scene(),settings={radius:160,quality:1,transition:160};
const terrain=new Terrain(scene,world,settings);
test('persistent tile objects and buffers survive movement and settings changes',()=>{
 const before=terrain.tiles.map(t=>[t.mesh,t.mesh.geometry,t.mesh.geometry.attributes.position.array,t.mesh.geometry.index.array]);
 assert.equal(terrain.update(world.start.x+1,world.start.z+1),false);
 terrain.update(300,100);settings.quality=2;terrain.update(0,260,true);
 terrain.tiles.forEach((t,i)=>{assert.equal(t.mesh,before[i][0]);assert.equal(t.mesh.geometry,before[i][1]);assert.equal(t.mesh.geometry.attributes.position.array,before[i][2]);assert.equal(t.mesh.geometry.index.array,before[i][3]);if(t.pinned)assert.equal(t.step,1);});
 assert.ok(terrain.triangles<500000);assert.equal(terrain.tiles.length,100);
});
test('all neighboring LODs use identical fine perimeter vertices',()=>{
 for(const [x,z] of [[0,-470],[300,0],[-350,150],[0,260]]){
  terrain.update(x,z,true);
  for(const t of terrain.tiles)for(const [dx,dz] of [[1,0],[0,1]]){
   if(t.ix+dx>=10||t.iz+dz>=10)continue;
   const u=terrain.at(t.ix+dx,t.iz+dz);
   for(let q=0;q<=64;q++){
    const ai=((dz?64:q)*65+(dx?64:q))*3,bi=((dz?0:q)*65+(dx?0:q))*3;
    for(let j=0;j<3;j++)assert.equal(t.mesh.geometry.attributes.position.array[ai+j],u.mesh.geometry.attributes.position.array[bi+j]);
   }
   // Every fine perimeter segment must be present in the live index buffer.
   for(const tile of [t,u]){
    const indices=tile.mesh.geometry.index.array,used=new Set(indices.subarray(0,tile.mesh.geometry.drawRange.count));
    for(let q=0;q<=64;q++){const i=tile===t?(dz?64:q)*65+(dx?64:q):(dz?0:q)*65+(dx?0:q);assert.ok(used.has(i));}
   }
  }
 }
});
test('summit vertices and trail tile resolutions are independent of player position',()=>{
 const pinned=terrain.tiles.filter(t=>t.pinned),before=pinned.map(t=>t.mesh.geometry.attributes.position.array.slice());terrain.update(500,-500,true);
 pinned.forEach((t,i)=>{assert.equal(t.step,1);assert.deepEqual(t.mesh.geometry.attributes.position.array,before[i]);});
});

test('surrounding ground meets the flat border without overlapping any terrain tile',()=>{
 const g=terrain.ground.geometry,positions=g.attributes.position,indices=g.index;
 assert.equal(terrain.ground.position.y,0);
 for(let i=0;i<indices.count;i+=3){
  const vertices=[0,1,2].map(j=>indices.getX(i+j));
  assert.ok(vertices.every(v=>positions.getX(v)<=-640)||vertices.every(v=>positions.getX(v)>=640)||vertices.every(v=>positions.getZ(v)<=-640)||vertices.every(v=>positions.getZ(v)>=640),'ground triangle overlaps terrain footprint');
  for(const v of vertices)assert.equal(positions.getY(v),0);
 }
 const groundVertices=new Set();
 for(let i=0;i<positions.count;i++)groundVertices.add(`${positions.getX(i)},${positions.getZ(i)}`);
 for(let q=-640;q<=640;q+=2){
  for(const [x,z] of [[q,-640],[q,640],[-640,q],[640,q]])assert.ok(groundVertices.has(`${x},${z}`),'coarse plain edge would leave a T-junction');
  for(const [x,z] of [[q,-640],[q,640],[-640,q],[640,q]])assert.equal(world.height(x,z),0);
 }
 const ray=new T.Raycaster(new T.Vector3(0,10,-550),new T.Vector3(0,-1,0));
 scene.updateMatrixWorld(true);
 assert.equal(ray.intersectObject(terrain.ground).length,0,'plain must not be rendered underneath the foothills');
 assert.ok(ray.intersectObjects(terrain.tiles.map(t=>t.mesh)).length>0);
});
