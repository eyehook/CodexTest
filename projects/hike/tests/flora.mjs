import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../../../shared/vendor/three-r180/three.module.js';
import {generatePines,plantSuitability,PINE_RULES,TREE_STRIDE} from '../flora-placement.mjs';
import {AveragedHeightmap} from '../averaged-heightmap.mjs';
import {createPineVariants} from '../pine-geometry.mjs';
import {Flora,selectPineVisibility,pineFadeShader,FLORA_RENDER} from '../flora.mjs';
import {cachedWorld} from './helpers/world-fixture.mjs';
function synthetic(seed=42){return {extent:360,config:{seed,trailWidth:5},landscape:{heights:new Float32Array([0,100])},height:(x,z)=>50+x*.04+z*.02,normal(x,z,out){Object.assign(out,{x:-.04,y:1,z:-.02,slope:2.56});return out;},trail(x,z,out){out.distance=Math.abs(z);return out;}};}
test('pine clusters are deterministic, seed-dependent, spaced and clear of the trail',()=>{
 const world=synthetic(),a=generatePines(world,{densityMultiplier:1}),b=generatePines(world,{densityMultiplier:1}),other=generatePines(synthetic(43),{densityMultiplier:1}),near={};
 assert.deepEqual(a.trees,b.trees);assert.deepEqual(a.cells,b.cells);assert.notDeepEqual(a.trees,other.trees);assert.ok(a.count>100);assert.ok(a.clusters>10);
 let count=0;const variants=new Set();
 for(let c=0;c<a.cells.length;c+=2){assert.ok(a.cells[c+1]===0||(a.cells[c+1]>=5&&a.cells[c+1]<=20));count+=a.cells[c+1];}
 assert.equal(count,a.count);
 for(let i=0;i<a.count;i++){
  const k=i*TREE_STRIDE,x=a.trees[k],y=a.trees[k+1],z=a.trees[k+2];variants.add(a.trees[k+7]);
  assert.ok(Math.abs(y-world.height(x,z))<.0001);world.trail(x,z,near);assert.ok(near.distance>=world.config.trailWidth/2+PINE_RULES.trailMargin);
  for(let j=0;j<i;j++){const q=j*TREE_STRIDE;assert.ok(Math.hypot(x-a.trees[q],z-a.trees[q+2])>=PINE_RULES.minSpacing-.0001);}
 }
 assert.equal(variants.size,4);
});
test('species suitability uses normalized elevation and soft slope/treeline fades',()=>{
 const range={min:100,max:300};assert.equal(plantSuitability(100,0,range),0);assert.equal(plantSuitability(280,0,range),0);assert.equal(plantSuitability(200,33,range),0);
 assert.ok(plantSuitability(200,0,range)>plantSuitability(250,0,range));assert.ok(plantSuitability(200,26,range)>plantSuitability(200,30,range));
 assert.equal(plantSuitability(200,10,range),plantSuitability(1200,10,{min:1100,max:1300}));
});
test('four reusable pine variants contain 3–5 low-poly foliage tiers and colored trunks',()=>{
 const variants=createPineVariants();assert.equal(variants.length,4);
 for(const v of variants){assert.ok(v.sections>=3&&v.sections<=5);assert.ok(v.geometry.attributes.position.count/3<100);assert.equal(v.geometry.attributes.color.count,v.geometry.attributes.position.count);const normals=v.geometry.attributes.normal.array;for(let i=0;i<normals.length;i+=9)for(let j=0;j<3;j++){assert.equal(normals[i+j],normals[i+3+j]);assert.equal(normals[i+j],normals[i+6+j]);}v.geometry.computeBoundingBox();assert.ok(v.geometry.boundingBox.min.y<0);assert.ok(Math.abs(v.geometry.boundingBox.max.y-v.height)<.0001);v.geometry.dispose();}
});
test('3D visibility prefetches outside the fade boundary and retains a small removal hysteresis',()=>{
 assert.equal(selectPineVisibility(0),1);assert.equal(selectPineVisibility(450),1);assert.equal(selectPineVisibility(500),1);assert.equal(selectPineVisibility(516),1);assert.equal(selectPineVisibility(517),0);
 assert.equal(selectPineVisibility(524,1),1);assert.equal(selectPineVisibility(524.01,1),0);
});
function rendererFixture(){
 const trees=new Float32Array([0,40,10,1,1,0,1,0,.5,0,40,290,1,1,0,1,1,.5,0,40,601,1,1,0,1,2,.5]);
 return {trees,count:3,cells:new Uint32Array([0,3]),minCell:0,columns:1,cellSize:512};
}
test('instanced flora reuses buffers, throttles updates and keeps roots independent of terrain snaps',()=>{
 const scene=new T.Scene(),data=rendererFixture(),original=data.trees.slice(),flora=new Flora(scene,data,null);
 const viewer=new T.Vector3(0,41.7,0);flora.update(viewer);assert.equal(flora.instanceCount,2);assert.equal(flora.drawCalls,2);assert.equal(flora.material.alphaToCoverage,false);assert.equal(flora.material.transparent,false);assert.equal(flora.material.depthWrite,true);
 flora.setCoverageSamples(0);assert.equal(flora.material.alphaToCoverage,false);flora.setCoverageSamples(4);assert.equal(flora.material.alphaToCoverage,true);assert.equal(flora.batches[1].instanceMatrix.updateRanges[0].count,16);assert.equal(flora.batches[1].instanceColor.updateRanges[0].count,3);
 const buffer=flora.batches[1].instanceMatrix.array,version=flora.batches[1].instanceMatrix.version,positions=buffer.slice(),matrix=new T.Matrix4();
 flora.batches[0].getMatrixAt(0,matrix);assert.equal(matrix.elements[13],40);
 viewer.x=.1;assert.equal(flora.update(viewer),false);assert.equal(flora.batches[1].instanceMatrix.version,version);assert.deepEqual(buffer,positions);assert.equal(flora.viewer.value.x,.1);
 // A mesh-origin snap cannot affect world-space vegetation or its source data.
 const terrain=new T.Group();scene.add(terrain);terrain.position.set(16,0,-32);flora.update(viewer,true);assert.deepEqual(data.trees,original);assert.equal(flora.batches[1].instanceMatrix.array,buffer);
 viewer.set(900,0,900);flora.update(viewer,true);assert.equal(flora.instanceCount,0);
 flora.dispose();flora.dispose();assert.equal(flora.batches.length,4);assert.equal(flora.material.map,null);assert.equal(scene.children.includes(flora.group),false);
});
test('3D fade shares a world-space root distance between both XR eyes and supports coverage/fallback',()=>{
 const viewer={value:new T.Vector3(20,2,-30)},fade={value:new T.Vector2(450,500)},shader={uniforms:{},vertexShader:'#include <begin_vertex>',fragmentShader:'#include <alphatest_fragment>'};
 pineFadeShader(shader,viewer,fade,{value:.25});assert.equal(shader.uniforms.pineViewer,viewer);assert.equal(shader.uniforms.pineFadeRange,fade);
 assert.ok(shader.vertexShader.includes('modelMatrix*instanceMatrix[3]'));assert.ok(!shader.vertexShader.includes('cameraPosition'));
 assert.ok(shader.fragmentShader.includes('smoothstep(pineFadeRange.x,pineFadeRange.y,vPineDistance)'));assert.ok(shader.fragmentShader.includes('diffuseColor.a*=clamp'));assert.ok(shader.fragmentShader.includes('floor(vPinePattern*8.0)'));
});
const world=await cachedWorld();
test('default mountain pines satisfy actual detailed slopes, treeline, trail and averaged-ground checks',()=>{
 const before=world.route.map(p=>({...p})),forest=generatePines(world),normal={},near={},map=new AveragedHeightmap((x,z)=>world.height(x,z));
 const baseline=generatePines(world,{densityMultiplier:1});assert.ok(forest.count/baseline.count>9.5&&forest.count/baseline.count<10.5,'approximately ten times the old accepted tree count');assert.ok(forest.minSpacing<baseline.minSpacing);
 assert.ok(forest.count>1000);assert.ok(forest.clusters>100);assert.deepEqual(world.route,before);
 for(let i=0;i<forest.count;i+=Math.ceil(forest.count/1500)){
  const k=i*TREE_STRIDE,x=forest.trees[k],z=forest.trees[k+2],height=world.height(x,z);world.normal(x,z,normal);world.trail(x,z,near);
  assert.ok(Math.abs(height-forest.trees[k+1])<.02);assert.ok(normal.slope<32.01);assert.ok(near.distance>=world.config.trailWidth/2+3.49);assert.ok((height-forest.range.min)/(forest.range.max-forest.range.min)<.821);
  assert.ok(Math.abs(map.sample(x,z)-height)<.66);
 }
});

test('trees retain full 3D geometry and yaw in the distant fade band without textures',()=>{
 const data=rendererFixture();data.trees[2]=475;data.trees[5]=.7;
 const flora=new Flora(new T.Scene(),data,null);flora.update(new T.Vector3(0,40,0),true);
 const matrix=new T.Matrix4();flora.batches[0].getMatrixAt(0,matrix);
 assert.ok(Math.abs(matrix.elements[0]-Math.cos(.7))<1e-6);assert.ok(Math.abs(matrix.elements[8]-Math.sin(.7))<1e-6);assert.equal(matrix.elements[13],40);
 assert.ok(flora.batches[0].geometry.attributes.position.count>100);assert.equal(flora.material.map,null);assert.equal(flora.batches.length,4);assert.equal(FLORA_RENDER.fadeStart,450);assert.equal(FLORA_RENDER.far,500);flora.dispose();
});


test('budgeted passes defer safely and leave unchanged memberships on the GPU',()=>{
 const data=rendererFixture(),flora=new Flora(new T.Scene(),data,null,{maxWorkItems:1,budgetMs:100});
 const view=new T.Vector3(0,41,0);flora.update(view);assert.equal(flora.job.active,true);
 const phase=flora.job.phase,index=flora.job.index;
 assert.equal(flora.update(new T.Vector3(.1,41,0),false,false),false);assert.equal(flora.job.phase,phase);assert.equal(flora.job.index,index);assert.equal(flora.viewer.value.x,.1);
 let frames=0;while(flora.job.active&&frames++<100)flora.update(view);assert.ok(frames>1&&frames<100);assert.equal(flora.instanceCount,2);
 const versions=flora.batches.map(m=>m.instanceMatrix.version),colorVersions=flora.batches.map(m=>m.instanceColor.version);
 for(const mesh of flora.batches)mesh.computeBoundingSphere=()=>{throw Error('full bounds scan');};
 flora.update(new T.Vector3(2,41,0),true);assert.equal(flora.changedInstances,0);assert.deepEqual(flora.batches.map(m=>m.instanceMatrix.version),versions);assert.deepEqual(flora.batches.map(m=>m.instanceColor.version),colorVersions);
 flora.dispose();
});
test('incremental membership matches a full reference through removals, fade-boundary movement and teleports',()=>{
 const data=generatePines(synthetic(),{densityMultiplier:1}),flora=new Flora(new T.Scene(),data,null,{maxWorkItems:64,budgetMs:100}),expected=new Uint8Array(data.count),matrix=new T.Matrix4();
 for(const [x,z] of [[0,0],[100,120],[-150,-100],[600,0],[10000,10000],[0,0]]){
  const view=new T.Vector3(x,60,z);
  for(let id=0;id<data.count;id++){const k=id*TREE_STRIDE;expected[id]=selectPineVisibility(Math.hypot(data.trees[k]-x,data.trees[k+2]-z),expected[id],flora.settings);}
  flora.update(view);let frames=0;while(flora.job.active&&frames++<2000)flora.update(view);assert.ok(frames<2000);assert.deepEqual(flora.states,expected);
  const seen=new Set();
  for(const mesh of flora.batches)for(let slot=0;slot<mesh.count;slot++){
   const id=mesh.userData.pineIds[slot],k=id*TREE_STRIDE;assert.ok(!seen.has(id));seen.add(id);mesh.getMatrixAt(slot,matrix);
   assert.equal(matrix.elements[12],data.trees[k]);assert.equal(matrix.elements[14],data.trees[k+2]);
   const bound=new T.Sphere(new T.Vector3(matrix.elements[12],matrix.elements[13],matrix.elements[14]),0);assert.ok(mesh.boundingSphere.containsPoint(bound.center));
  }
  assert.equal(seen.size,expected.reduce((n,lod)=>n+(lod?1:0),0));
 }
 flora.dispose();
});
test('a large move replaces unfinished visibility work and keeps latest viewer facing',()=>{
 const flora=new Flora(new T.Scene(),rendererFixture(),null,{maxWorkItems:1,budgetMs:100});
 flora.update(new T.Vector3(0,40,0));flora.update(new T.Vector3(1000,40,1000));assert.equal(flora.job.x,1000);assert.equal(flora.viewer.value.x,1000);
 let frames=0;while(flora.job.active&&frames++<100)flora.update(new T.Vector3(1000,40,1000));assert.equal(flora.instanceCount,0);flora.dispose();
});
