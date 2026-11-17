import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../../../shared/vendor/three-r180/three.module.js';
import {shapePlan,shapeFamily,shapeFamilies} from '../shapes.mjs';
import {chamber} from '../chamber.mjs';

const parts=['Curve','Section','Profile','Deform','Frame'];
test('generated shapes are seekable, diverse, finite and constrained within each family',()=>{
  const identities=new Set();
  for(let seed=0;seed<48;seed++)for(let index=0;index<64;index++){
    const p=shapePlan(seed,index);
    assert.deepEqual(p,shapePlan(seed,index));
    assert.ok(Object.values(p).flat().every(Number.isFinite));
    assert.ok(Number.isInteger(p.curve[2]) && Number.isInteger(p.curve[3]));
    assert.ok(p.curve[0]>p.curve[1]);
    assert.equal(p.curve[2],shapeFamily(seed,index));
    assert.ok(p.folds>=1 && p.folds<=3);
    assert.ok(p.curve[3]<=3);
    if(p.curve[2]===1)assert.ok(p.profile[1]>.01 && p.profile[1]<.24);
    if(p.curve[2]===4)assert.ok(p.section[0]/p.curve[0]<.23);
    assert.ok(p.section[0]>0 && p.section[1]>0);
    assert.ok(Math.abs(p.profile[1])<1);
    assert.ok(p.frame[3]>0 && p.frame[3]<4);
    identities.add(JSON.stringify(p));
    assert.notDeepEqual(p,shapePlan(seed,index+7));
  }
  assert.equal(identities.size,48*64);
});

test('generated endpoints morph continuously and preserve musical response and geometry',()=>{
  const scene=new T.Scene(),update=chamber(scene,123),shell=scene.children[0],u=shell.material.uniforms;
  update(31.999);
  const end=parts.map(part=>u['to'+part].value.toArray());
  update(32);
  assert.equal(u.blend.value,0);
  assert.deepEqual(parts.map(part=>u['from'+part].value.toArray()),end);
  assert.deepEqual(u.toCurve.value.toArray(),shapePlan(123,1).curve);
  update(34.5,{pulse:.8,volume:.4,melody:.7,pitch:.3});
  assert.equal(u.blend.value,.5);
  assert.equal(u.f1.value,shapePlan(123,0).folds);
  assert.equal(u.f2.value,shapePlan(123,1).folds);
  assert.equal(u.pulse.value,.8);assert.equal(u.volume.value,.4);
  assert.equal(u.melody.value,.7);assert.equal(u.pitch.value,.3);
  update(37);assert.equal(u.blend.value,1);
  assert.equal(shell.geometry.instanceCount,43);
  assert.equal(shell.children[0].geometry.attributes.position.count,1440);
  update(32);assert.deepEqual(u.toCurve.value.toArray(),shapePlan(123,1).curve);
});

test('every eleven shapes visit all requested families without adjacent repeats',()=>{
  for(let seed=0;seed<48;seed++)for(let block=0;block<8;block++){
    const families=Array.from({length:11},(_,i)=>shapeFamily(seed,block*11+i));
    assert.equal(new Set(families).size,11);
    assert.deepEqual([...families].sort((a,b)=>a-b),Array.from({length:11},(_,i)=>i));
    assert.notEqual(families.at(-1),shapeFamily(seed,(block+1)*11));
  }
  assert.deepEqual(shapeFamilies,['Sphere','Cone','Cylinder','Torus','Simple knot',
    'Hourglass','Bowl','Spiral','Saddle','Figure eight','Möbius strip']);
});

test('repeat visits to every family vary proportions, twist and deformation substantially',()=>{
  for(let family=0;family<11;family++){
    const plans=[];
    for(let index=0;index<330;index++)if(shapeFamily(123,index)===family)plans.push(shapePlan(123,index));
    const range=pick=>Math.max(...plans.map(pick))-Math.min(...plans.map(pick));
    assert.ok(range(p=>p.profile[0])>.8);
    assert.ok(range(p=>p.profile[2])>.4);
    assert.ok(range(p=>p.section[2])>1);
    assert.ok(range(p=>p.deform[2])>.25);
    assert.ok(range(p=>p.frame[0])>.3);
  }
});
