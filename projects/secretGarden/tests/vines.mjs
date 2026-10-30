import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../../shared/vendor/three-r180/three.module.js';
import {generateVine} from '../vine-generator.mjs';
import {componentPose,growthAmount,MAX_COMPONENTS} from '../generator.mjs';
import {PlantManager} from '../manager.mjs';
import {PlantRenderer} from '../renderer.mjs';
const bounds={minX:-4,maxX:4,minY:-1,maxY:2};
test('wall vines are deterministic, bounded, connected and mature in ten seconds',()=>{
  let blooms=0;
  for(let seed=0;seed<500;seed++){
    const p=generateVine(seed,bounds);assert.deepEqual(p,generateVine(seed,bounds));
    assert.ok(p.parts.length<MAX_COMPONENTS);const poses=componentPose(p,10);
    assert.ok(p.parts.some(x=>x.kind==='leaf'&&x.shape===3));
    for(const part of p.parts){
      assert.equal(growthAmount(part,0),0);assert.equal(growthAmount(part,10),1);
      if(part.parent!==null)assert.ok(part.parent<part.id);
      if(part.kind==='stem'){
        for(const pos of part.role==='flower-stalk'?[]:[part.start,part.end]){assert.ok(pos[0]>=bounds.minX&&pos[0]<=bounds.maxX);assert.ok(pos[1]>=bounds.minY&&pos[1]<=bounds.maxY);assert.equal(pos[2],0);}
        part.end.forEach((v,i)=>assert.ok(Math.abs(v-poses[part.id].end[i])<1e-9));
      }
      if(part.kind==='flower')blooms++;
    }
  }
  assert.ok(blooms>0);
});
test('the same vine seed adapts deterministically to wall top, floor and end boundaries',()=>{
  const high={...bounds,minY:-2.8,maxY:.12},low={...bounds,minY:-.1,maxY:2.8},edge={...bounds,minX:-.1,maxX:2};
  assert.notDeepEqual(generateVine(18,high).parts,generateVine(18,low).parts);
  for(const b of [high,low,edge]){
    const p=generateVine(18,b);
    for(const stem of p.parts.filter(p=>p.kind==='stem'&&p.role!=='flower-stalk')){
      assert.ok(stem.end[0]>=b.minX&&stem.end[0]<=b.maxX);assert.ok(stem.end[1]>=b.minY&&stem.end[1]<=b.maxY);
    }
  }
});
test('incompatible planting clears copied seeds while merely aiming at another surface preserves them',()=>{
  let seed=100;
  const r={create:()=>({}),update:()=>{},remove:()=>{}};
  const m=new PlantManager(r,()=>seed++,()=>.3,()=>1);
  const wall={type:'wall',yaw:Math.PI,halfLength:4.572,height:3.048,normal:new THREE.Vector3(0,0,-1)};
  const vine=m.plant(new THREE.Vector3(0,1,6.858),0,wall);m.copy(vine.id);
  assert.equal(m.canClone('wall'),true);assert.equal(m.canClone('ground'),false);
  const ground=m.plant(new THREE.Vector3(),1);assert.notEqual(ground.seed,vine.seed);assert.equal(m.clonedSeed,null);assert.equal(m.clonedSurface,null);
  m.copy(vine.id);
  const clone=m.plant(new THREE.Vector3(0,1,6.858),2,wall);assert.deepEqual(clone.structure,vine.structure);assert.equal(clone.rotationY,Math.PI);assert.equal(clone.scale,1);
  m.copy(ground.id);assert.equal(m.canClone('ground'),true);assert.equal(m.canClone('wall'),false);
  const randomVine=m.plant(new THREE.Vector3(0,1,6.858),3,wall);assert.notEqual(randomVine.seed,ground.seed);assert.equal(m.clonedSeed,null);assert.equal(m.clonedSurface,null);
  assert.notEqual(m.plant(new THREE.Vector3(),4).seed,ground.seed);
});
test('wall vines migrate into mature batches and remain selectable and deletable',()=>{
  const scene=new THREE.Scene(),r=new PlantRenderer(scene),m=new PlantManager(r,()=>8);
  const wall={type:'wall',yaw:Math.PI,halfLength:4.572,height:3.048,normal:new THREE.Vector3(0,0,-1)};
  const vine=m.plant(new THREE.Vector3(0,1,6.858),0,wall);m.update(10);
  assert.ok(vine.visual.matureSlots.length);assert.ok(r.matureBatches.pools.has('leaf3'));
  const mesh=vine.visual.batches.find(x=>x.key==='leaf3').mesh,matrix=new THREE.Matrix4();mesh.getMatrixAt(0,matrix);
  const center=new THREE.Vector3(0,.45,0).applyMatrix4(matrix).applyMatrix4(mesh.matrixWorld);
  const ray=new THREE.Raycaster(center.clone().add(new THREE.Vector3(0,0,-2)),new THREE.Vector3(0,0,1));
  assert.equal(ray.intersectObjects(m.targets,true)[0].object.userData.plantId,vine.id);
  m.remove(vine.id);assert.equal(scene.children.length,0);r.dispose();
});

test('scaled vine clones stay on all four support walls at low and high planting heights',()=>{
  const r={create:()=>({}),update:()=>{},remove:()=>{}},m=new PlantManager(r,()=>42,()=>0,()=>1.2);
  for(let side=0;side<4;side++)for(const y of [.15,2.85]){
    const a=side*Math.PI/2,halfLength=side%2?6.858:4.572;
    const normal=new THREE.Vector3(-Math.sin(a),0,-Math.cos(a));
    const wall={type:'wall',yaw:a+Math.PI,halfLength,adjacentHalfLength:side%2?4.572:6.858,height:3.048,normal};
    const position=new THREE.Vector3(Math.sin(a)*4.572,y,Math.cos(a)*6.858);
    const original=m.plant(position,0,wall);m.copy(original.id);const clone=m.plant(position,1,wall);
    assert.equal(clone.scale,1.2);
    const transform=new THREE.Matrix4().compose(clone.position,new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),clone.rotationY),new THREE.Vector3(1.2,1.2,1.2));
    for(const part of clone.structure.parts.filter(p=>p.kind==='stem'))for(const endpoint of [part.start,part.end]){
      const world=new THREE.Vector3().fromArray(endpoint).applyMatrix4(transform);
      assert.ok(world.y>=0&&world.y<=3.048);assert.ok(Math.abs(world.x)<=4.572+.001);assert.ok(Math.abs(world.z)<=6.858+.001);
    }
    m.copy(null);
  }
});

test('vines wrap either direction around all corners without diagonal shortcuts',()=>{
  const b={minX:-.12,maxX:.7,minY:-1,maxY:2,wrapDepth:.65};let left=false,right=false,opposite=false;
  for(let seed=0;seed<150;seed++){
    const p=generateVine(seed,b);assert.deepEqual(p,generateVine(seed,b));
    const poses=componentPose(p,10);assert.ok(p.parts.length<MAX_COMPONENTS);
    for(const stem of p.parts.filter(x=>x.kind==='stem'&&x.role!=='flower-stalk')){
      for(const point of [stem.start,stem.end]){
        assert.ok(point[0]>=b.minX-1e-8&&point[0]<=b.maxX+1e-8);
        assert.ok(point[2]>=-1e-8&&point[2]<=b.wrapDepth+1e-8);
        assert.ok(Math.min(Math.abs(point[0]-b.minX),Math.abs(point[0]-b.maxX),Math.abs(point[2]),Math.abs(point[2]-b.wrapDepth))<1e-8);
        if(point[2]>.01&&Math.abs(point[0]-b.minX)<1e-8)left=true;
        if(point[2]>.01&&Math.abs(point[0]-b.maxX)<1e-8)right=true;
        if(Math.abs(point[2]-b.wrapDepth)<1e-8)opposite=true;
      }
      assert.ok(Math.abs(stem.end[0]-stem.start[0])<1e-8||Math.abs(stem.end[2]-stem.start[2])<1e-8);
      stem.end.forEach((v,i)=>assert.ok(Math.abs(poses[stem.id].end[i]-v)<1e-8));
      assert.equal(growthAmount(stem,10),1);
    }
    assert.ok(p.parts.filter(x=>x.kind==='leaf').every(x=>x.orientation[3]==='YXZ'));
  }
  assert.ok(left&&right&&opposite);
});

test('vine blooms extend ahead of foliage on short outward growing stalks',()=>{
  let flowers=0;
  for(let seed=0;seed<150;seed++){
    const p=generateVine(seed,{...bounds,wrapDepth:3});
    for(const flower of p.parts.filter(x=>x.kind==='flower')){
      flowers++;const stalk=p.parts[flower.parent];assert.equal(stalk.role,'flower-stalk');
      const direction=stalk.end.map((v,i)=>v-stalk.start[i]),length=Math.hypot(...direction);
      assert.ok(length>=.06-1e-9&&length<=.09+1e-9);
      assert.ok(direction.reduce((n,v,i)=>n+v*flower.normal[i],0)>.059);
      assert.deepEqual(flower.position,stalk.end);assert.equal(growthAmount(flower,10),1);
    }
  }
  assert.ok(flowers>0);
});

test('flowering vine seeds include single-sphere blooms on outward stalks',()=>{
 let spheres=0,petals=0;
 for(let seed=0;seed<300;seed++){
  const p=generateVine(seed,{...bounds,wrapDepth:3});
  for(const flower of p.parts.filter(x=>x.kind==='flower')){
   if(flower.volume)spheres++;else petals++;
   assert.equal(p.parts[flower.parent].role,'flower-stalk');assert.equal(growthAmount(flower,10),1);
   assert.equal(flower.shape,p.parameters.bloomShape);
  }
 }
 assert.ok(spheres>0&&petals>0);
});
