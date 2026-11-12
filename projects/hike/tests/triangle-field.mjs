import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../../../shared/vendor/three-r180/three.module.js';
import {surfaceAltitude,SNOW_LINE} from '../surface.mjs';
import {fieldClumps} from '../field-cells.mjs';
import {TriangleField,fieldCell,TRIANGLE_CAP} from '../triangle-field.mjs';
function world(){return {config:{seed:41729,trailWidth:5},extent:1920,flora:{range:{min:0,max:100}},landscape:{summit:{y:100}},summit:{x:1000,z:1000},height:(x,z)=>30+.01*x+.02*z,normal:(x,z,out)=>Object.assign(out,{slope:2}),trail:(x,z,out)=>Object.assign(out,{distance:Math.abs(z)})};}
function drain(field,viewer){for(let i=0;i<500;i++){field.update(viewer);if(field.next===field.queue.length)return;}throw Error('Field did not settle');}
test('field cells produce seeded ground-matched clumps with rooted individual triangles',()=>{
 const w=world();let data,cx;for(cx=0;cx<20;cx++){data=fieldCell(w,cx,2);if(data.count)break;}
 assert.ok(data.count>0&&data.count<=1056);assert.deepEqual(data,fieldCell(w,cx,2));
 let minX=Infinity,maxX=-Infinity,minZ=Infinity,maxZ=-Infinity;
 for(let i=0;i<data.count;i++){
  const k=i*3,x=data.root[k],z=data.root[k+2];assert.ok(Math.abs(data.root[k+1]-(w.height(x,z)-.012))<.00001);
  assert.ok(w.trail(x,z,{}).distance>=2.68);assert.ok(data.shape[i*4]>=.016&&data.shape[i*4]<=.035);assert.ok(data.shape[i*4+1]>=.24*.45&&data.shape[i*4+1]<=1.28);
  minX=Math.min(minX,x);maxX=Math.max(maxX,x);minZ=Math.min(minZ,z);maxZ=Math.max(maxZ,z);
 }assert.ok(maxX-minX<11&&maxZ-minZ<11);w.config.seed++;assert.notDeepEqual(data,fieldCell(w,cx,2));
});
test('field excludes paths, summit landing, cliffs and high rocky ground',()=>{
 const w=world();w.trail=(x,z,out)=>Object.assign(out,{distance:0});for(let i=0;i<5;i++)assert.equal(fieldCell(w,i,2).count,0);
 w.trail=(x,z,out)=>Object.assign(out,{distance:100});w.normal=(x,z,out)=>Object.assign(out,{slope:40});assert.equal(fieldCell(w,1,2).count,0);
 w.normal=(x,z,out)=>Object.assign(out,{slope:0});w.height=()=>95;assert.equal(fieldCell(w,1,2).count,0);assert.equal(fieldCell(w,300,300).count,0);
});
test('triangle field has a hard 240k budget, compact fixed buffers, no shadows and static cells',()=>{
 const scene=new T.Scene(),flora={coverageSamples:4,coverageStep:{value:.25}},field=new TriangleField(scene,world(),flora),viewer=new T.Vector3(0,32,30);drain(field,viewer);
 assert.equal(field.geometry.attributes.position.count,3);assert.equal(field.geometry.index,null);assert.ok(field.geometry.instanceCount<=TRIANGLE_CAP);assert.equal(field.geometry.instanceCount,field.instanceCount);assert.equal(field.maxTriangles,237600);assert.equal(field.material.lights,false);assert.equal(field.mesh.castShadow,false);assert.equal(field.mesh.receiveShadow,false);
 assert.match(field.material.fragmentShader,/smoothstep\(40.0,50.0/);assert.doesNotMatch(field.material.fragmentShader,/shadowmap|sampler2D|time/);
 const root=field.attributes.fieldRoot,array=root.array.slice(),oldVersion=root.version;root.clearUpdateRanges();field.update(viewer);assert.deepEqual(root.array,array);assert.equal(root.version,oldVersion);assert.equal(root.updateRanges.length,0);
 field.update(new T.Vector3(100,30,100),false);assert.equal(field.attributes.fieldRoot,root);assert.equal(field.cellX,0);assert.deepEqual(field.viewer.value.toArray(),[100,30,100]);
 for(const position of [new T.Vector3(8,32,30),new T.Vector3(16,32,38),new T.Vector3(-8,32,22),new T.Vector3(-300,40,-200),new T.Vector3(600,30,200),new T.Vector3(0,32,30)]){drain(field,position);assert.equal(field.attributes.fieldRoot,root);assert.equal(field.cells.size,225);assert.ok(field.geometry.instanceCount<=240000);assert.equal(field.instanceCount,[...field.cells.values()].reduce((sum,r)=>sum+r.count,0));assert.equal(field.geometry.instanceCount,field.instanceCount);
 for(const record of field.cells.values()){
  const expected=fieldCell(field.world,record.cx,record.cz);
  for(let i=0;i<record.count;i++){const slot=record.bladeSlots[i];assert.equal(field.owners[slot],record);assert.equal(field.ownerLocal[slot],i);assert.deepEqual(root.array.slice(slot*3,slot*3+3),expected.root.slice(i*3,i*3+3));}
 }}
 root.clearUpdateRanges();field.attributes.fieldShape.clearUpdateRanges();field.attributes.fieldColor.clearUpdateRanges();
 field.markDirty(0,1);field.markDirty(field.instanceCount-1,1);field.update(new T.Vector3(0,32,30));
 assert.equal(root.updateRanges.length,2);assert.ok(root.updateRanges.reduce((sum,r)=>sum+r.count,0)<=256*3,'distant edits must not upload the unchanged gap');
 flora.coverageSamples=0;field.update(viewer);assert.equal(field.material.alphaToCoverage,false);field.dispose();field.dispose();assert.equal(scene.children.length,0);
});

test('grass stops at the terrain snow line including its seeded patch variation',()=>{
 const w=world();w.trail=(x,z,out)=>Object.assign(out,{distance:100});w.normal=(x,z,out)=>Object.assign(out,{slope:0});
 // Exactly 90% escaped the previous strict greater-than cutoff, despite snow.
 w.height=()=>90;for(let cx=0;cx<8;cx++)assert.equal(fieldCell(w,cx,2).count,0);
 w.height=()=>74;assert.ok(Array.from({length:8},(_,cx)=>fieldCell(w,cx,2).count).some(count=>count>0));
 w.height=(x,z)=>76+x*.1;let total=0;
 for(let cx=0;cx<15;cx++){
  const cell=fieldCell(w,cx,2);total+=cell.count;
  for(let i=0;i<cell.count;i++){const x=cell.root[i*3],z=cell.root[i*3+2];assert.ok(surfaceAltitude(x,z,w.height(x,z),100,w.config.seed)<SNOW_LINE+1e-6);}
 }
 assert.ok(total>0);
});

test('75 percent of cells choose one to three deterministic clumps',()=>{
 const w=world();w.extent=100000;const counts=[0,0,0,0];
 for(let i=0;i<10000;i++){
  const cx=i%100-50,cz=Math.floor(i/100)-50,clumps=fieldClumps(w,cx,cz);counts[clumps.length]++;
  assert.deepEqual(clumps,fieldClumps(w,cx,cz));
 }
 assert.ok(counts[0]>2300&&counts[0]<2700);
 for(const count of counts.slice(1))assert.ok(count>2300&&count<2700);
 w.height=()=>30;w.normal=(x,z,out)=>Object.assign(out,{slope:0});w.trail=(x,z,out)=>Object.assign(out,{distance:1000});
 for(let cx=0;cx<20;cx++)assert.equal(fieldCell(w,cx,2).count,fieldClumps(w,cx,2).length*352);
});

test('cell boundary retirement is bounded and interrupted movement preserves packed owners',()=>{
 const field=new TriangleField(new T.Scene(),world(),{coverageSamples:0,coverageStep:{value:1}}),viewer=new T.Vector3(0,32,30);drain(field,viewer);
 let removed=0;const remove=field.remove.bind(field);field.remove=record=>{removed++;remove(record);};
 for(const x of [8,16,-8,24]){
  removed=0;field.update(new T.Vector3(x,32,30));assert.ok(removed<=2);assert.ok(field.evictions.length>0);
  assert.ok(field.slots.length<=field.capacity);assert.equal(field.instanceCount,[...field.cells.values()].reduce((sum,r)=>sum+r.count,0));
 }
 drain(field,new T.Vector3(24,32,30));assert.equal(field.cells.size,225);assert.equal(field.evictions.length,0);
 for(const record of field.cells.values())for(let i=0;i<record.count;i++)assert.equal(field.owners[record.bladeSlots[i]],record);
 field.dispose();
});

test('wind changes only a shared uniform without touching geometry or instance buffers',()=>{
 const field=new TriangleField(new T.Scene(),world(),{coverageSamples:0,coverageStep:{value:1}});drain(field,new T.Vector3(0,32,30));
 const attributes=Object.values(field.geometry.attributes),versions=attributes.map(a=>a.version),arrays=attributes.map(a=>a.array.slice()),count=field.geometry.instanceCount;
 for(const time of [0,2,5,7,11,12,14])field.setTime(time);
 assert.equal(field.material.uniforms.fieldWindTime,field.windTime);assert.equal(field.windTime.value,14);assert.equal(field.geometry.instanceCount,count);
 attributes.forEach((a,i)=>{assert.equal(a.version,versions[i]);assert.deepEqual(a.array,arrays[i]);});field.dispose();
});
