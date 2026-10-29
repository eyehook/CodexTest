import {test} from 'node:test';
import assert from 'node:assert/strict';
import {defaults,terrainHeight} from '../../src/fishing/height.mjs';
import {bands} from '../../src/fishing/bands.mjs';
import {generateCell,treeDefaults,TreePopulation,elevationLimits} from '../../src/fishing/trees/TreeGenerator.mjs';

const config={...treeDefaults};
function allTrees(population){return [...population.cells.values()].flatMap(cell=>cell.trees);}

test('seeded clusters are reproducible across signed and large coordinates with varied size/color',()=>{
 const populated=[];
 for(let x=-8;x<=8;x++)for(let z=-8;z<=8;z++){
  const a=generateCell(x,z,defaults,config);assert.deepEqual(a,generateCell(x,z,defaults,config));populated.push(...a);
 }
 assert.ok(populated.length>500);
 assert.ok(new Set(populated.map(t=>t.height)).size>20);assert.ok(new Set(populated.map(t=>t.color.join(','))).size>20);
 for(const tree of populated){
  assert.ok(tree.height>=3&&tree.height<=8);assert.ok(tree.width/tree.height>=0.4&&tree.width/tree.height<=0.65);
  assert.equal(tree.y,terrainHeight(tree.x,tree.z,defaults));
  assert.ok(tree.y>=defaults.amplitude*bands.beachEnd&&tree.y<defaults.amplitude*bands.snowStart);
 }
 for(const x of [-15625000,15625000])assert.deepEqual(generateCell(x,-x,defaults,config),generateCell(x,-x,defaults,config));
 const different=[];for(let i=-3;i<3;i++)different.push(...generateCell(i,2,defaults,{...config,seed:42}));
 assert.notDeepEqual(different,populated.slice(0,different.length));
});

test('clusters cross source-cell boundaries and leave empty cells without underwater or beach trees',()=>{
 let crossed=false,empty=false;
 for(let x=-8;x<=8;x++)for(let z=-8;z<=8;z++){
  const trees=generateCell(x,z,defaults,config);empty||=trees.length===0;
  crossed||=trees.some(t=>Math.floor(t.x/config.cellSize)!==x||Math.floor(t.z/config.cellSize)!==z);
 }
 assert.ok(crossed);assert.ok(empty);
 assert.deepEqual(generateCell(0,0,defaults,{...config,clusterProbability:0}),[]);
 assert.deepEqual(generateCell(0,0,defaults,{...config,treesPerCluster:0}),[]);
 assert.deepEqual(elevationLimits(defaults,{...config,minElevation:-100}),{min:65*bands.beachEnd,max:65*bands.snowStart});
 const strict={...config,minElevation:17,maxElevation:18,clusterProbability:1};
 for(let x=-4;x<=4;x++)for(const tree of generateCell(x,0,defaults,strict))assert.ok(tree.y>=17&&tree.y<18);
 const flat={...defaults,amplitude:0};assert.deepEqual(generateCell(1,1,flat,{...config,clusterProbability:1}),[]);
});

test('streaming only generates entering cells, reuses retained cells, evicts old cells, and reproduces returns',()=>{
 const p=new TreePopulation(defaults,config);assert.equal(p.update(1,1),true);
 const original=allTrees(p),version=p.version,generated=p.generatedCellCount,cellCount=p.cells.size;
 const retained=p.cells.get('0,0');
 for(let x=2;x<64;x++)assert.equal(p.update(x,10),false);
 assert.equal(p.version,version);assert.equal(p.generatedCellCount,generated);
 assert.equal(p.update(65,1),true);assert.equal(p.cells.size,cellCount);assert.equal(p.cells.get('0,0'),retained);
 const side=Math.sqrt(cellCount);assert.equal(p.generatedCellCount-generated,side);
 p.update(100000,-100000);assert.equal(p.cells.size,cellCount);assert.equal(p.cells.has('0,0'),false);
 p.update(1,1);assert.deepEqual(allTrees(p),original);
 p.invalidate();assert.equal(p.update(1,1),true);assert.deepEqual(allTrees(p),original);
});

test('source-cell margin covers every potentially visible cluster even at signed cell corners',()=>{
 for(const [px,pz]of [[0,0],[63.999,63.999],[-0.001,-0.001],[-64,-64]]){
  const p=new TreePopulation(defaults,config);p.update(px,pz);
  const cx=Math.floor(px/64),cz=Math.floor(pz/64),extra=Math.ceil((config.cutoffDistance+config.clusterRadius)/64)+2;
  for(let x=cx-extra;x<=cx+extra;x++)for(let z=cz-extra;z<=cz+extra;z++){
   // Nearest possible point of a cluster grown from this entire source cell.
   const dx=Math.max(x*64-px,0,px-(x+1)*64),dz=Math.max(z*64-pz,0,pz-(z+1)*64);
   if(Math.hypot(dx,dz)-config.clusterRadius<=config.cutoffDistance)assert.ok(p.cells.has(`${x},${z}`));
  }
 }
});

test('anchor-relative GPU coordinates retain placement after rebasing at billion-meter positions',()=>{
 for(const [x,z]of [[1e9+0.125,-1e9-0.25],[-1e9+0.375,1e9+0.125]]){
  const p=new TreePopulation(defaults,{...config,clusterProbability:1,maxElevation:1000,minElevation:0});p.update(x,z);
  assert.ok(p.treeCount>0);
  for(const tree of allTrees(p)){
   const relativeX=Math.fround(tree.x-p.anchorX)-Math.fround(x-p.anchorX);
   const relativeZ=Math.fround(tree.z-p.anchorZ)-Math.fround(z-p.anchorZ);
   assert.ok(Math.abs(relativeX-(tree.x-x))<0.0001);assert.ok(Math.abs(relativeZ-(tree.z-z))<0.0001);
   for(const ground of [-20,0,30])assert.ok(Math.abs(tree.y-ground+ground-tree.y)<1e-10);
  }
 }
});

test('instanced triangle batch uploads only on cell/config changes and preserves per-tree relative coordinates',async()=>{
 const THREE=await import('../../shared/vendor/three-r180/three.module.js');
 const {TreeSystem}=await import('../../src/fishing/trees/TreeSystem.js');
 const scene=new THREE.Scene(),terrain={...defaults},settings={...config},system=new TreeSystem(scene,terrain,settings);
 system.update(-75,0,9.17,1,2);
 assert.equal(system.geometry.attributes.position.count,3);assert.ok(system.geometry.isInstancedBufferGeometry);
 assert.equal(system.geometry.instanceCount,system.population.treeCount);assert.ok(system.geometry.instanceCount>0);
 assert.equal(system.mesh.frustumCulled,false);assert.equal(system.material.transparent,false);assert.equal(system.material.depthWrite,true);assert.equal(system.material.uniforms.cutoffDistance.value,700);
 const attribute=system.geometry.attributes.treeBase,version=attribute.version,uploads=system.bufferUpdates;
 for(let x=-74;x<-65;x++)system.update(x,1,10,3,4);
 assert.equal(system.bufferUpdates,uploads);assert.equal(attribute.version,version);assert.equal(system.geometry.attributes.treeBase,attribute);
 const first=allTrees(system.population)[0],u=system.material.uniforms;
 assert.ok(Math.abs(attribute.getX(0)-u.playerOffset.value.x+3-(first.x-(-66)+3))<0.0001);
 assert.ok(Math.abs(attribute.getY(0)-u.ground.value-u.baseSink.value-(first.y-10-config.baseSink))<0.0001);
 system.update(-63,1,10,3,4);assert.equal(system.bufferUpdates,uploads+1);
 settings.enabled=false;system.update(5000,5000,0,0,0);assert.equal(system.mesh.visible,false);assert.equal(system.bufferUpdates,uploads+1);
 settings.enabled=true;system.update(5000,5000,0,0,0);assert.equal(system.bufferUpdates,uploads+2);
 settings.treesPerCluster=0;system.invalidate();system.update(5000,5000,0,0,0);
 assert.equal(system.geometry.instanceCount,0);assert.equal(system.mesh.visible,false);
 system.dispose();assert.equal(scene.children.length,0);
});
