import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../../../shared/vendor/three-r180/three.module.js';
import {createWorld} from '../world.mjs';
import {Terrain} from '../terrain.mjs';
const world=createWorld(),scene=new T.Scene(),settings={radius:160,quality:1,transition:160};
const terrain=new Terrain(scene,world,settings);
function edge(t,side){const p=t.mesh.geometry.attributes.position,result=new Map(),used=new Set(t.mesh.geometry.index.array.subarray(0,t.mesh.geometry.drawRange.count));for(let i=0;i<p.count;i++){if(!used.has(i))continue;const x=p.getX(i),z=p.getZ(i);if(side===0&&x===t.x||side===1&&x===t.x+128||side===2&&z===t.z||side===3&&z===t.z+128)result.set(side<2?z:x,[x,p.getY(i),z,i]);}return result;}
test('route-based allocation preserves static meshes/buffers across travel and LOD changes',()=>{
 const before=terrain.tiles.map(t=>[t.mesh,t.mesh.geometry,t.mesh.geometry.attributes.position.array,t.mesh.geometry.index.array]);
 assert.equal(terrain.update(world.start.x+1,world.start.z+1),false);
 for(const [x,z] of [[300,100],[-1200,-900],[world.summit.x,world.summit.z]])terrain.update(x,z,true);
 terrain.tiles.forEach((t,i)=>{assert.equal(t.mesh,before[i][0]);assert.equal(t.mesh.geometry,before[i][1]);assert.equal(t.mesh.geometry.attributes.position.array,before[i][2]);assert.equal(t.mesh.geometry.index.array,before[i][3]);assert.ok(t.step>=t.nativeStep);if(t.pinned)assert.equal(t.step,2);});
 assert.equal(terrain.tiles.length,900);assert.ok(terrain.vertexCount<422500,'larger map must not allocate full-resolution grids everywhere');
 assert.ok(terrain.tiles.some(t=>t.nativeStep===2));assert.ok(terrain.tiles.some(t=>t.nativeStep===8));assert.ok(terrain.tiles.some(t=>t.nativeStep===32));
 for(const t of terrain.tiles)if(t.distance>384&&!t.pinned)assert.equal(t.nativeStep,32);
});
test('different native densities and LODs share identical edge vertices and live segments',()=>{
 for(const [x,z] of [[world.start.x,world.start.z],[world.summit.x,world.summit.z],[-1200,800]]){
  terrain.update(x,z,true);
  for(const t of terrain.tiles)for(const [dx,dz,side,opposite] of [[1,0,1,0],[0,1,3,2]]){
   const u=terrain.at(t.ix+dx,t.iz+dz);if(!u)continue;
   const a=edge(t,side),b=edge(u,opposite);assert.equal(a.size,b.size);
   const usedA=new Set(t.mesh.geometry.index.array.subarray(0,t.mesh.geometry.drawRange.count)),usedB=new Set(u.mesh.geometry.index.array.subarray(0,u.mesh.geometry.drawRange.count));
   for(const [key,p] of a){const q=b.get(key);assert.ok(q);assert.deepEqual(p.slice(0,3),q.slice(0,3));assert.ok(usedA.has(p[3]));assert.ok(usedB.has(q[3]));for(const name of ['normal','color','uv']){const aa=t.mesh.geometry.attributes[name],bb=u.mesh.geometry.attributes[name];for(let c=0;c<aa.itemSize;c++)assert.equal(aa.array[p[3]*aa.itemSize+c],bb.array[q[3]*bb.itemSize+c]);}}
  }
 }
});
test('mesh heights in near and distant regions sample the same carved terrain definition',()=>{
 for(const t of terrain.tiles){const p=t.mesh.geometry.attributes.position;for(let i=0;i<p.count;i+=Math.max(1,Math.floor(p.count/5))){assert.ok(Math.abs(p.getY(i)-world.height(p.getX(i),p.getZ(i)))<.0001);}}
});
test('fixed summit/trail vertices remain unchanged and 1 km culling tracks the viewer',()=>{
 const fixed=terrain.tiles.filter(t=>t.pinned),before=fixed.map(t=>t.mesh.geometry.attributes.position.array.slice());terrain.update(-1400,-1400,true);
 fixed.forEach((t,i)=>{assert.equal(t.step,2);assert.deepEqual(t.mesh.geometry.attributes.position.array,before[i]);});
 for(const t of terrain.tiles){const d=Math.hypot(Math.max(t.x+1400,0,-1400-t.x-128),Math.max(t.z+1400,0,-1400-t.z-128));assert.equal(t.mesh.visible,d<1000);}
 assert.ok(terrain.activeTiles<terrain.tiles.length/2);
});
test('flat continuation never overlaps the unified map and matches its exact border',()=>{
 const g=terrain.ground.geometry,p=g.attributes.position,index=g.index,e=world.extent,keys=new Set();
 for(let i=0;i<p.count;i++){keys.add(`${p.getX(i)},${p.getZ(i)}`);assert.equal(p.getY(i),world.boundaryHeight);}
 for(let i=0;i<index.count;i+=3){const v=[0,1,2].map(j=>index.getX(i+j));assert.ok(v.every(j=>p.getX(j)<=-e)||v.every(j=>p.getX(j)>=e)||v.every(j=>p.getZ(j)<=-e)||v.every(j=>p.getZ(j)>=e));}
 for(let q=-e;q<=e;q+=2)for(const [x,z] of [[q,-e],[q,e],[-e,q],[e,q]]){assert.ok(keys.has(`${x},${z}`));assert.equal(world.height(x,z),world.boundaryHeight);}
});

test('moving the endpoints moves the dense allocation while retaining the same geology',()=>{
 const start={x:-900,z:-600},end={x:-600,z:-300},custom=createWorld({start,end,targetLength:1000});
 const other=new Terrain(new T.Scene(),custom,settings),ix=Math.floor((start.x+terrain.extent)/128),iz=Math.floor((start.z+terrain.extent)/128);
 assert.equal(other.at(ix,iz).nativeStep,2);assert.equal(other.at(ix,iz).pinned,true);
 assert.ok(terrain.at(ix,iz).nativeStep>2);
 assert.deepEqual(world.landscape.heights,custom.landscape.heights);
});

test('rendered walking triangles are fine, grounded and below 30 degrees',()=>{
 let count=0,maximum=0;
 for(const tile of terrain.tiles){const p=tile.mesh.geometry.attributes.position,ids=tile.walkingIndices;
  for(let i=0;i<ids.length;i+=3){const a=ids[i],b=ids[i+1],c=ids[i+2],dx=p.getX(b)-p.getX(a),dz=p.getZ(b)-p.getZ(a),ex=p.getX(c)-p.getX(a),ez=p.getZ(c)-p.getZ(a),det=dx*ez-dz*ex;if(Math.abs(det)<1e-12)continue;
   const gx=((p.getY(b)-p.getY(a))*ez-(p.getY(c)-p.getY(a))*dz)/det,gz=(dx*(p.getY(c)-p.getY(a))-ex*(p.getY(b)-p.getY(a)))/det,slope=Math.atan(Math.hypot(gx,gz))*180/Math.PI;
   maximum=Math.max(maximum,slope);assert.ok(slope<30,`rendered slope ${slope}`);
   assert.ok(Math.max(Math.hypot(dx,dz),Math.hypot(ex,ez),Math.hypot(dx-ex,dz-ez))<1.2);
   const x=(p.getX(a)+p.getX(b)+p.getX(c))/3,z=(p.getZ(a)+p.getZ(b)+p.getZ(c))/3,y=(p.getY(a)+p.getY(b)+p.getY(c))/3;
   assert.ok(Math.abs(world.height(x,z)-y)<.002,'grounding and displayed walking triangle disagree');count++;
  }
 }
 assert.equal(count,world.surface.walking.length);assert.ok(count>20000&&count<100000);assert.ok(maximum>15);
});
test('trail replacement is a conforming partition with no overlapping terrain layer',()=>{
 const edges=new Map();let area=0;
 for(const tile of terrain.tiles){const p=tile.mesh.geometry.attributes.position,index=tile.mesh.geometry.index.array;for(let i=0;i<tile.mesh.geometry.drawRange.count;i+=3){const a=index[i],b=index[i+1],c=index[i+2];area+=Math.abs((p.getX(b)-p.getX(a))*(p.getZ(c)-p.getZ(a))-(p.getZ(b)-p.getZ(a))*(p.getX(c)-p.getX(a)))/2;}}
 assert.ok(Math.abs(area-world.extent**2*4)<.01,'terrain should cover the map exactly once');
 for(const tile of world.surface.tiles.values())for(const triangle of tile.triangles){const ids=triangle.ids;for(let e=0;e<3;e++){const a=ids[e],b=ids[(e+1)%3],key=a<b?a+','+b:b+','+a;edges.set(key,(edges.get(key)??0)+1);}}
 for(const [key,count] of edges){assert.ok(count===1||count===2,'overlapping surface triangles');if(count===2)continue;const [a,b]=key.split(',').map(i=>world.surface.vertices[Number(i)]),x=(a.x+b.x)/2,z=(a.z+b.z)/2;
  const cell=(x,z)=>world.surface.refined.has((Math.floor(x/2)*2)+','+(Math.floor(z/2)*2));
  if(Math.abs(a.x-b.x)<1e-8&&Math.abs(x/2-Math.round(x/2))<1e-8)assert.notEqual(cell(x-.01,z),cell(x+.01,z),'open interior vertical edge');
  else if(Math.abs(a.z-b.z)<1e-8&&Math.abs(z/2-Math.round(z/2))<1e-8)assert.notEqual(cell(x,z-.01),cell(x,z+.01),'open interior horizontal edge');
  else assert.fail('open interior trail edge');
 }
});
test('extra vertices are confined to the trail and narrow transition cells',()=>{
 for(const t of terrain.tiles){const p=t.mesh.geometry.attributes.position;for(let i=0;i<p.count;i++){
  const x=p.getX(i),z=p.getZ(i);if(Math.abs(x/2-Math.round(x/2))<1e-8&&Math.abs(z/2-Math.round(z/2))<1e-8)continue;
  assert.ok(world.trail(x,z,{}).distance<world.config.trailWidth/2+4,'detail leaked out of the trail corridor');
 }}
});
