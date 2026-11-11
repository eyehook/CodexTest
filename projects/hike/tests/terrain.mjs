import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../../../shared/vendor/three-r180/three.module.js';
import {cachedWorld} from './helpers/world-fixture.mjs';
import {Terrain} from '../terrain.mjs';
import {createTerrainGrid,cellSubdivisions,vertexKey} from '../terrain-grid.mjs';
const grid=createTerrainGrid();
test('one fixed grid has a 3×3 full-detail core, expanded near/mid radial bands and 2 km coverage',()=>{
 const expected=new Map([[0,64],[2,32],[3,32],[4,16],[7,16],[8,8],[12,8],[13,4],[16,4],[17,2],[20,2],[21,1]]);
 for(const [x,n] of expected)assert.equal(cellSubdivisions(x,0),n);
 assert.equal(grid.cells.filter(c=>c.subdivisions===64).length,9);
 for(const c of grid.cells){assert.ok(Math.hypot(c.x*16,c.z*16)<=1000);const radius=Math.hypot(c.x,c.z)*16;assert.equal(c.subdivisions,Math.abs(c.x)<=1&&Math.abs(c.z)<=1?64:radius<64?32:radius<120?16:radius<200?8:radius<272?4:radius<336?2:1);}
 assert.equal(grid.cells.length,12281);assert.equal(grid.baseTriangles,293440);assert.equal(grid.indices.length/3,299612);assert.equal(grid.vertexCount,150057);
 assert.ok(grid.indices.length/3<=300000,'including transition stitching');
 const points=new Set();for(let i=0;i<grid.vertexCount;i++){const key=vertexKey(grid.coordinates[i*2],grid.coordinates[i*2+1]);assert.ok(!points.has(key));points.add(key);}
});
test('all four transition sides and corners form an upward-wound, crack-free partition',()=>{
 const edges=new Map(),cells=new Set(grid.cells.map(c=>c.x+','+c.z));let area=0;
 for(let i=0;i<grid.indices.length;i+=3){const ids=[grid.indices[i],grid.indices[i+1],grid.indices[i+2]],a=ids[0]*2,b=ids[1]*2,c=ids[2]*2,q=grid.coordinates;
  const twice=(q[c]-q[a])*(q[b+1]-q[a+1])-(q[b]-q[a])*(q[c+1]-q[a+1]);assert.ok(twice>0,'degenerate or downward triangle');area+=twice/32;
  for(let j=0;j<3;j++){const a=ids[j],b=ids[(j+1)%3],key=a<b?a*grid.vertexCount+b:b*grid.vertexCount+a;edges.set(key,(edges.get(key)??0)+1);}
 }
 assert.equal(area,grid.cells.length*256);
 for(const [key,count] of edges){assert.ok(count===1||count===2);if(count===2)continue;
  const a=Math.floor(key/grid.vertexCount)*2,b=(key%grid.vertexCount)*2,q=grid.coordinates,x=(q[a]+q[b])/2,z=(q[a+1]+q[b+1])/2;
  if(q[a]===q[b]&&x%64===0){const cx=x/64,cz=Math.floor(z/64);assert.notEqual(cells.has((cx-1)+','+cz),cells.has(cx+','+cz),'interior vertical open edge');}
  else if(q[a+1]===q[b+1]&&z%64===0){const cx=Math.floor(x/64),cz=z/64;assert.notEqual(cells.has(cx+','+(cz-1)),cells.has(cx+','+cz),'interior horizontal open edge');}
  else assert.fail('non-perimeter open edge / T junction');
 }
});
function syntheticWorld(){let queries=0;return {start:{x:0,z:0},config:{seed:1,trailWidth:5},landscape:{summit:{y:200}},height(x,z){queries++;return 30+.02*x+.01*z;},normal(x,z,out){Object.assign(out,{x:-.019995,y:.99975,z:-.0099975,slope:1.28});return out;},trail(x,z,out){out.distance=100;return out;},get queries(){return queries;}};}
test('stationary buffers, 16 m negative/diagonal/multi-cell snaps, stable shared samples',()=>{
 const world=syntheticWorld(),scene=new T.Scene(),terrain=new Terrain(scene,world),g=terrain.geometry;
 assert.equal(scene.children.length,1);assert.equal(scene.children[0],terrain.mesh);assert.equal(g.groups.length,0);
 const index=g.index.array,attrs=Object.values(g.attributes).map(a=>[a,a.array,a.version]),before=g.attributes.position.array.slice(),queries=world.queries,beforeAttributes=Object.values(g.attributes).map(a=>a.array.slice());
 for(let i=0;i<100;i++)assert.equal(terrain.update(15.99*i/100,10),false);
 assert.equal(world.queries,queries);assert.deepEqual(g.attributes.position.array,before);attrs.forEach(([a,array,version])=>{assert.equal(a.array,array);assert.equal(a.version,version);});
 for(const [x,z,ox,oz] of [[16,0,16,0],[-.01,-.01,-16,-16],[-16,-16,-16,-16],[1025,-1025,1024,-1040],[0,0,0,0]]){
  terrain.update(x,z);assert.equal(terrain.originX,ox);assert.equal(terrain.originZ,oz);assert.equal(g.index.array,index);assert.equal(g.index.version,0);
  assert.ok(x>=ox-16&&x<=ox+32&&z>=oz-16&&z<=oz+32);
  for(let i=0;i<terrain.vertexCount;i+=97){const p=g.attributes.position,x=ox+p.getX(i),z=oz+p.getZ(i);assert.ok(Math.abs(p.getY(i)-world.height(x,z))<1e-4,'averaging preserves a plane');assert.ok(g.boundingBox.containsPoint(new T.Vector3(p.getX(i),p.getY(i),p.getZ(i))));assert.ok(g.boundingSphere.containsPoint(new T.Vector3(p.getX(i),p.getY(i),p.getZ(i))));}
 }
 assert.deepEqual(g.attributes.position.array,before);attrs.forEach(([a,array],i)=>{assert.equal(a.array,array);assert.deepEqual(a.array,beforeAttributes[i]);});terrain.dispose();assert.equal(scene.children.length,0);
});
class FakeWorker {
 messages=[];postMessage(message){this.messages.push(message);}terminate(){this.terminated=true;}
 finish(){const m=this.messages.filter(m=>m.type==='sample').at(-1);this.onmessage({data:{...m,min:0,max:0,sampled:0,sampleMs:1}});}
}
test('completed worker results stay visible and apply before catching up to the latest cell',async()=>{
 const progress=[],worker=new FakeWorker(),terrain=new Terrain(new T.Scene(),syntheticWorld(),{workerFactory:()=>worker,onProgress:value=>progress.push(value)});
 worker.onmessage({data:{type:'progress',value:.5}});assert.deepEqual(progress,[.5]);assert.equal(terrain.inFlight,true);assert.equal(terrain.snapCount,0);
 terrain.update(20,1);terrain.update(200,-100);assert.equal(terrain.snapCount,0);assert.equal(terrain.mesh.visible,false);assert.equal(worker.messages.length,2);
 worker.finish();await terrain.ready;
 assert.equal(terrain.snapCount,1);assert.equal(terrain.originX,0);assert.equal(terrain.mesh.visible,true);assert.equal(worker.messages.length,3);
 assert.equal(worker.messages.at(-1).originX,192);assert.equal(worker.messages.at(-1).originZ,-112);
 terrain.update(400,-200);assert.equal(terrain.mesh.visible,true,'old grid remains visible outside its fine core');
 worker.finish();assert.equal(terrain.snapCount,2);assert.equal(terrain.originX,192);assert.equal(terrain.originZ,-112);assert.equal(terrain.mesh.visible,true);
 assert.equal(worker.messages.at(-1).originX,400);assert.equal(worker.messages.at(-1).originZ,-208);
 // No more input is needed for the latest pending result to appear.
 worker.finish();assert.equal(terrain.snapCount,3);assert.equal(terrain.originX,400);assert.equal(terrain.inFlight,false);
 // Returning to the displayed cell still applies the completed excursion and
 // requests the return cell, with neither response discarded or hidden.
 terrain.update(416,-200);terrain.update(400,-200);worker.finish();
 assert.equal(terrain.snapCount,4);assert.equal(terrain.originX,416);assert.equal(terrain.mesh.visible,true);assert.equal(terrain.inFlight,true);
 worker.finish();assert.equal(terrain.snapCount,5);assert.equal(terrain.originX,400);assert.equal(terrain.inFlight,false);
 terrain.update(800,0);terrain.dispose();const snaps=terrain.snapCount;worker.finish();assert.equal(worker.terminated,true);assert.equal(terrain.snapCount,snaps);
});
test('worker failure rejects startup and reports the error',async()=>{
 const worker=new FakeWorker(),terrain=new Terrain(new T.Scene(),syntheticWorld(),{workerFactory:()=>worker});
 const rejected=assert.rejects(terrain.ready,/sampling failed/);worker.onmessage({data:{error:'sampling failed'}});await rejected;assert.equal(terrain.mesh.visible,false);assert.equal(worker.terminated,true);terrain.dispose();
});
const world=await cachedWorld();
test('near-player rendering follows the unchanged trail and level destination',()=>{
 const terrain=new Terrain(new T.Scene(),world),q=terrain.grid.coordinates,lookup=new Map();for(let i=0;i<q.length;i+=2)lookup.set(vertexKey(q[i],q[i+1]),i/2);
 let worst=0;
 for(const routeIndex of [0,50,150,300,450,600,750,790,800]){
  const at=world.route[routeIndex];terrain.update(at.x,at.z);const p=terrain.geometry.attributes.position;
  for(const dx of [-.5,0,.5])for(const dz of [-.5,0,.5]){
   const x=at.x+dx,z=at.z+dz,lx=(x-terrain.originX)*4,lz=(z-terrain.originZ)*4,ix=Math.floor(lx),iz=Math.floor(lz),u=lx-ix,v=lz-iz;
   const y=(a,b)=>p.getY(lookup.get(vertexKey(a,b)));
   const rendered=u+v<=1?y(ix,iz)*(1-u-v)+y(ix+1,iz)*u+y(ix,iz+1)*v:y(ix+1,iz)*(1-v)+y(ix,iz+1)*(1-u)+y(ix+1,iz+1)*(u+v-1);
   worst=Math.max(worst,Math.abs(rendered-world.height(x,z)));
  }
 }
 assert.ok(worst<.08,`near-tread interpolation error ${worst} m`);
 for(let i=0;i<terrain.vertexCount;i++){const x=terrain.originX+pX(i),z=terrain.originZ+pZ(i);if(Math.hypot(x-world.summit.x,z-world.summit.z)<=1.5)assert.ok(Math.abs(terrain.geometry.attributes.position.getY(i)-world.summit.y)<.0001);}
 function pX(i){return terrain.geometry.attributes.position.getX(i);}function pZ(i){return terrain.geometry.attributes.position.getZ(i);}
 terrain.dispose();
});
