import test from 'node:test';
import assert from 'node:assert/strict';
import {generatePlant,componentPose,growthAmount,MAX_COMPONENTS} from '../generator.mjs';
import {PlantManager} from '../manager.mjs';
test('seed output is independent of call order and unrelated randomness',()=>{
  for(const seed of [0,1,1234,4294967295]){const a=generatePlant(seed);generatePlant(seed+40);Math.random();assert.deepEqual(generatePlant(seed),a);}
});
test('seed sweep is bounded, finite, connected and fully mature at ten seconds',()=>{
  const forms=new Set();
  for(let seed=0;seed<1200;seed++){
    const p=generatePlant(seed);forms.add(p.parameters.form);assert.ok(p.parts.length<=MAX_COMPONENTS);
    const mature=componentPose(p,10);
    for(const part of p.parts){
      assert.equal(growthAmount(part,0),0);assert.equal(growthAmount(part,10),1);
      if(part.parent!==null){assert.ok(part.parent<part.id);assert.equal(p.parts[part.parent].kind,'stem');}
      assert.ok(mature[part.id].anchor.every(Number.isFinite));
      if(part.kind==='stem'){part.end.forEach((v,i)=>assert.ok(Math.abs(mature[part.id].end[i]-v)<1e-10));}
    }
  }
  assert.deepEqual([...forms].sort(),['bush','flower','tree']);
});
test('growth poses depend on age, not intermediate frame sequence',()=>{
  const p=generatePlant(88),expected=componentPose(p,4.125);
  for(let t=0;t<4;t+=1/72)componentPose(p,t);
  assert.deepEqual(componentPose(p,4.125),expected);
  assert.notDeepEqual(expected,componentPose(p,10));
});
test('clone instances share mature structure but have independent ages and IDs; overlap is allowed',()=>{
  let updates=0,removals=0;const rotations=[];let yaw=0;
  const renderer={create:(_structure,_position,_id,rotation)=>{rotations.push(rotation);return {};},update:()=>updates++,remove:()=>removals++};
  const manager=new PlantManager(renderer,()=>123,()=>yaw+=.75),position={clone(){return {...this};},x:0,y:0,z:0};
  const a=manager.plant(position,0);manager.copy(a.id);const b=manager.plant(position,5);
  assert.deepEqual(rotations,[.75,1.5]);assert.equal(a.rotationY,.75);assert.equal(b.rotationY,1.5);
  assert.notEqual(a.id,b.id);assert.deepEqual(a.structure,b.structure);assert.equal(b.born,5);
  manager.update(10);assert.equal(a.state,'mature');assert.equal(b.state,'growing');
  manager.update(15);const done=updates;manager.update(100);assert.equal(updates,done);
  manager.remove(a.id);assert.equal(removals,1);assert.equal(manager.instances.size,1);
  manager.copy(null);assert.equal(manager.clonedSeed,null);assert.equal(manager.label,'RANDOM');
});
test('blooms vary in silhouette, depth, orientation and clustered arrangement',()=>{
  const forms=new Set();let clustered=0,single=0,nodding=0;
  for(let seed=0;seed<400;seed++){
    const p=generatePlant(seed),flowers=p.parts.filter(p=>p.kind==='flower');
    if(!flowers.length)continue;
    forms.add(p.parameters.bloomForm);
    assert.ok(p.parameters.flowerSaturation>=0&&p.parameters.flowerSaturation<=1);
    assert.ok(p.parameters.flowerBrightness>=.25&&p.parameters.flowerBrightness<=1);
    if(p.parameters.clusterCount>1){clustered++;assert.ok(flowers.some(f=>p.parts[f.parent].radius<.02));}
    else single++;
    for(const f of flowers){assert.ok(Math.abs(Math.hypot(...f.normal)-1)<1e-9);assert.ok(Math.abs(f.normal[1])<.99);if(f.normal[1]<0)nodding++;assert.equal(growthAmount(f,10),1);}
  }
  assert.equal(forms.size,6);assert.ok(clustered>0&&single>0&&nodding>0);
});

test('trees retain a full branched crown without exhausting the component budget',()=>{
  let trees=0;
  for(let seed=0;seed<600;seed++){
    const p=generatePlant(seed);if(p.parameters.form!=='tree'||p.parameters.treeForm!=='open')continue;trees++;
    const stems=p.parts.filter(x=>x.kind==='stem'),leaves=p.parts.filter(x=>x.kind==='leaf');
    const root=stems.find(x=>x.parent===null);
    const scaffold=stems.filter(x=>x.parent===root.id);
    assert.ok(scaffold.length>=4&&scaffold.length<=5);
    assert.ok(stems.length>=53);assert.ok(leaves.length>=252);
    assert.ok(p.parts.length<MAX_COMPONENTS,'crown must fit without truncation');
    assert.ok(scaffold.some(s=>s.attachment>.85));assert.ok(scaffold.some(s=>s.attachment<.5));
  }
  assert.ok(trees>25);
});

test('clones sample independent uniform scale without changing the seed structure or compounding parent scale',()=>{
  const received=[],values=[.8,1.2];let samples=0;
  const renderer={create:(_s,_p,_id,_yaw,scale)=>{received.push(scale);return {};},update:()=>{},remove:()=>{}};
  const manager=new PlantManager(renderer,()=>123,()=>0,()=>values[samples++]);
  const position={clone(){return {...this};},x:0,y:0,z:0};
  const original=manager.plant(position,0);assert.equal(original.scale,1);assert.equal(samples,0);
  manager.copy(original.id);const small=manager.plant(position,1);
  assert.equal(manager.clonedSeed,123);const large=manager.plant(position,2);
  assert.equal(small.scale,.8);assert.equal(large.scale,1.2);
  assert.equal(manager.clonedSeed,123);assert.equal(manager.label,'CLONE: 123');
  assert.deepEqual(original.structure,small.structure);assert.deepEqual(small.structure,large.structure);
  manager.copy(null);manager.randomSeed=()=>456;const next=manager.plant(position,3);
  assert.equal(next.scale,1);assert.equal(next.seed,456);
  assert.deepEqual(received,[1,.8,1.2,1]);assert.equal(samples,2);
});

test('shrubs form low spreading crowns with predominantly horizontal limbs',()=>{
  let shrubs=0;
  for(let seed=0;seed<600;seed++){
    const p=generatePlant(seed);if(p.parameters.form!=='bush')continue;shrubs++;
    const stems=p.parts.filter(x=>x.kind==='stem');
    const woody=stems.filter(x=>x.radius>.004);
    const points=woody.flatMap(x=>[x.start,x.end]);
    const width=Math.max(...points.map(x=>x[0]))-Math.min(...points.map(x=>x[0]));
    const depth=Math.max(...points.map(x=>x[2]))-Math.min(...points.map(x=>x[2]));
    const height=Math.max(...points.map(x=>x[1]));
    assert.ok(Math.max(width,depth)>height*1.5);
    for(const s of stems.filter(x=>x.parent===null)){
      const horizontal=Math.hypot(s.end[0]-s.start[0],s.end[2]-s.start[2]);
      assert.ok(horizontal>s.end[1]-s.start[1]);
    }
  }
  assert.ok(shrubs>150);
});

test('all four active tree families have bounded foliage and distinct crown proportions',()=>{
  const forms=new Set();
  for(let seed=0;seed<1500;seed++){
    const p=generatePlant(seed);if(p.parameters.form!=='tree')continue;
    const form=p.parameters.treeForm;forms.add(form);
    const foliage=p.parts.filter(x=>x.kind==='foliage');
    assert.ok(p.parts.length<MAX_COMPONENTS);
    if(form==='open'){assert.equal(foliage.length,0);continue;}
    assert.ok(foliage.length>0);
    for(const f of foliage){
      assert.ok(f.scale.every(v=>Number.isFinite(v)&&v>0));
      assert.equal(growthAmount(f,0),0);assert.equal(growthAmount(f,10),1);
      if(form==='columnar'){assert.ok(f.scale[1]>f.scale[0]*4);assert.ok(p.parameters.heightMultiplier>=1.5&&p.parameters.heightMultiplier<=2);}
      if(form==='umbrella')assert.ok(f.scale[0]>f.scale[1]*3);
      assert.equal(f.shape,form==='pine'?'pine':form==='columnar'?'spire':'crown');
    }
    if(form==='pine'){
      assert.ok(foliage.length>=5&&foliage.length<=7);
      assert.ok(foliage.at(-1).scale[0]<foliage[0].scale[0]);
      assert.ok(foliage.at(-1).attachment>foliage[0].attachment);
    }
  }
  assert.deepEqual([...forms].sort(),['open','pine','rounded','umbrella']);
});
