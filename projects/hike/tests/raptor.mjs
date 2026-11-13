import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../../../shared/vendor/three-r180/three.module.js';
import {RAPTOR,Raptor,sampleRaptorFlight,selectRaptorFlightArea} from '../raptor.mjs';
import {cachedWorld} from './helpers/world-fixture.mjs';

test('varying orbit faces its derivative, banks inward and has continuous wingbeat boundaries',()=>{
 const p={},before={},after={},forward=new T.Vector3();let flapping=0;
 for(let t=.01;t<184;t+=.025){
  sampleRaptorFlight(t,p);sampleRaptorFlight(t-.0001,before);sampleRaptorFlight(t+.0001,after);
  assert.ok(Math.abs((after.x-before.x)/.0002-p.vx)<1e-6);
  assert.ok(Math.abs((after.z-before.z)/.0002-p.vz)<1e-6);
  forward.set(0,0,-1).applyEuler(new T.Euler(p.pitch,p.yaw,p.bank,'YXZ')).normalize();
  const velocity=new T.Vector3(p.vx,p.vy,p.vz).normalize();assert.ok(forward.distanceTo(velocity)<1e-12);
  assert.ok(Math.hypot(p.x,p.z)>=23.25-1e-8&&Math.hypot(p.x,p.z)<=26.75+1e-8);
  assert.ok(Math.abs(p.y)<=1.5&&p.bank<0&&p.bank>-.2);
  if(Math.abs(p.wing-RAPTOR.glideAngle)>.001)flapping++;
 }
 assert.ok(flapping/(184/.025)<.11,'gliding dominates');
 for(const s of RAPTOR.sequences)for(const t of [s.start,s.start+s.beats*RAPTOR.beatPeriod]){
  sampleRaptorFlight(t-.00001,before);sampleRaptorFlight(t+.00001,after);assert.ok(Math.abs(before.wing-after.wing)<1e-8);
 }
 sampleRaptorFlight(92-.00001,before);sampleRaptorFlight(92+.00001,after);assert.equal(before.wing,after.wing);
});
test('fixed world placement interpolates route distance and terrain queries stop after construction',()=>{
 let queries=0;const scene=new T.Scene(),world={route:[{x:10,z:20,distance:0},{x:1010,z:20,distance:1000}],height:()=>{queries++;return 30;}};
 const raptor=new Raptor(scene,world);assert.deepEqual(raptor.center.toArray(),[10+raptor.along,75,20]);
 const initialQueries=queries,center=raptor.center.clone();for(let t=0;t<200;t+=.016)raptor.update(t);
 assert.equal(queries,initialQueries);assert.deepEqual(raptor.center,center);
 const meshes=[];raptor.root.traverse(o=>{if(o.isMesh)meshes.push(o);});assert.equal(meshes.length,3);
 let triangles=0;for(const m of meshes){triangles+=m.geometry.attributes.position.count/3;assert.equal(m.castShadow,false);assert.equal(m.receiveShadow,false);assert.equal(m.material,raptor.material);}
 assert.ok(triangles<300);assert.equal(raptor.material.side,T.DoubleSide);
 assert.equal(raptor.material.depthTest,true);assert.equal(raptor.material.fog,true);
 raptor.update(0);raptor.root.updateMatrixWorld(true);const box=new T.Box3().setFromObject(raptor.root);
 assert.ok(box.getSize(new T.Vector3()).length()>1.4);
 raptor.update(19);assert.equal(raptor.left.rotation.z,-raptor.right.rotation.z);
 let releases=0;for(const resource of [raptor.material,raptor.bodyGeometry,raptor.wingGeometry])resource.addEventListener('dispose',()=>releases++);
 raptor.dispose();assert.equal(releases,3);assert.equal(scene.children.length,0);
});
test('random trail placement is seed-repeatable and keeps flight above local terrain',async()=>{
 const world=await cachedWorld(),raptor=new Raptor(new T.Scene(),world),projected=world.trail(raptor.center.x,raptor.center.z,{},true);
 assert.ok(Math.abs(projected.along-raptor.along)<.1);
 const repeat=new Raptor(new T.Scene(),world),other=new Raptor(new T.Scene(),{...world,config:{...world.config,seed:world.config.seed+1}});
 assert.equal(repeat.along,raptor.along);assert.notEqual(other.along,raptor.along);
 assert.ok(raptor.along>=200&&raptor.along<=world.totalLength-200);repeat.dispose();other.dispose();
 for(let time=0;time<30;time+=.1){raptor.update(time);const p=raptor.root.position;assert.ok(p.y-world.height(p.x,p.z)>8);}
 raptor.dispose();
});

test('the raptor remains opaque and visible beyond the former fade range',()=>{
 const world={config:{seed:42},route:[{x:0,z:0,distance:0},{x:500,z:0,distance:500}],height:()=>30};
 const raptor=new Raptor(new T.Scene(),world),head=new T.Vector3();
 for(const distance of [0,225,250,275,300,1000]){
  head.copy(raptor.root.position);head.y+=distance;raptor.update(0,head);
  assert.equal(raptor.material.opacity,1);assert.equal(raptor.root.visible,true);
 }
 assert.equal(raptor.material.transparent,false);assert.equal(raptor.material.depthWrite,true);
 raptor.dispose();
});

test('spawn margins hold across seeds and trails too short for both margins hide the bird',()=>{
 const scene=new T.Scene(),world={config:{seed:0},route:[{x:0,z:0,distance:0},{x:1000,z:0,distance:1000}],height:()=>30};
 for(let seed=0;seed<64;seed++){
  world.config.seed=seed;const bird=new Raptor(scene,world);assert.ok(bird.along>=200&&bird.along<=800);bird.dispose();
 }
 world.route[1]={x:300,z:0,distance:300};const bird=new Raptor(scene,world);
 assert.equal(bird.root.visible,false);bird.update(0,bird.root.position);assert.equal(bird.root.visible,false);bird.dispose();
});

const placementWorld=()=>({config:{seed:42},route:[{x:0,z:0,distance:0},{x:1600,z:0,distance:1600}],height:()=>30});
test('cliff candidates are rejected and another seeded trail location is selected without raising altitude',()=>{
 const world=placementWorld(),first=selectRaptorFlightArea(world);
 world.height=(x,z)=>Math.abs(x-first.center.x)<35&&z>10?120:30;
 const selected=selectRaptorFlightArea(world);assert.ok(selected);assert.ok(selected.attempts>1);
 assert.ok(Math.abs(selected.center.x-first.center.x)>35);assert.equal(selected.center.y,75);
 assert.deepEqual(selected,selectRaptorFlightArea(world),'retries remain deterministic');
});
test('tree crowns and summit geometry also reject overlapping flight areas',()=>{
 for(const obstacle of ['tree','summit']){
  const world=placementWorld(),first=selectRaptorFlightArea(world);
  if(obstacle==='tree')world.flora={count:1,trees:new Float32Array([first.center.x+25,30,0,1,4,0,1,2,0])};
  else world.summit={x:first.center.x+25,y:100,z:0};
  const selected=selectRaptorFlightArea(world);assert.ok(selected);assert.ok(selected.attempts>1,obstacle);
  assert.ok(Math.abs(selected.center.x-first.center.x)>30,obstacle);
 }
});
test('exhausted unsafe candidates hide the bird and remain hidden when the player approaches',()=>{
 const world=placementWorld();world.height=(x,z)=>z>10?120:30;
 let queries=0;const height=world.height;world.height=(x,z)=>{queries++;return height(x,z);};
 assert.equal(selectRaptorFlightArea(world),null);assert.ok(queries<200000,'startup search is bounded');
 const bird=new Raptor(new T.Scene(),world);assert.equal(bird.hasFlightArea,false);assert.equal(bird.root.visible,false);
 bird.update(0,bird.root.position);assert.equal(bird.root.visible,false);bird.dispose();
});

test('averaged render terrain can reject an orbit even when its detailed ground is clear',()=>{
 const world=placementWorld();world.height=(x,z)=>z>=37&&z<=39?1000:30;
 // The cliff is outside the ~32 m checked disk, but its coarse render surface
 // spreads into it. Checking only detailed terrain would accept this location.
 assert.equal(selectRaptorFlightArea(world),null);
});
