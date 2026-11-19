import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../../shared/vendor/three-r180/three.module.js';
import {ButtonGesture,BeveledButton} from '../../shared/ui/beveled-button.mjs';
test('hover, press and release activate once; initial held triggers are seeded',()=>{
 const g=new ButtonGesture();assert.equal(g.sample('a',true,true),false);assert.equal(g.owner,null);
 g.sample('a',true,false);g.sample('a',true,true);assert.equal(g.owner,'a');assert.equal(g.sample('a',true,true),false);assert.equal(g.sample('a',true,false),true);assert.equal(g.sample('a',true,false),false);
});
test('leaving cancels immediately and returning with trigger held cannot re-arm',()=>{
 const g=new ButtonGesture();g.sample('a',true,false);g.sample('a',true,true);g.sample('a',false,true);assert.equal(g.owner,null);
 g.sample('a',true,true);assert.equal(g.sample('a',true,false),false);g.sample('a',true,true);assert.equal(g.sample('a',true,false),true);
});
test('pointer ownership, tracking reseed and disconnected-pointer pruning cancel safely',()=>{
 const g=new ButtonGesture();g.sample('a',true,false);g.sample('b',true,false);g.sample('a',true,true);g.sample('b',true,true);assert.equal(g.owner,'a');
 g.sample('a',true,true,true);assert.equal(g.owner,null);assert.equal(g.sample('a',true,false),false);
 g.sample('a',true,true);g.retain(['b']);assert.equal(g.owner,null);assert.equal(g.hovered.has('a'),false);
 g.reset();assert.equal(g.hovered.size,0);assert.equal(g.previous.size,0);
});
test('beveled mesh depresses without moving its hit target; hidden/disabled buttons reject activation and disposal is idempotent',()=>{
 const old=globalThis.document;globalThis.document={createElement:()=>({getContext:()=>({fillText(){}})})};
 try{
  let calls=0;const b=new BeveledButton({label:'Again',onActivate:()=>calls++}),parent=new T.Group();parent.add(b.mesh);
  assert.equal(b.cap.geometry.type,'ExtrudeGeometry');b.mesh.updateMatrixWorld(true);const before=b.hitMesh.matrixWorld.clone();
  b.sample('a',true,false);const normal=b.material.color.getHex();b.sample('a',true,true);assert.ok(b.face.position.z<0);assert.notEqual(b.material.color.getHex(),normal);
  b.mesh.updateMatrixWorld(true);assert.deepEqual(b.hitMesh.matrixWorld.elements,before.elements);
  parent.visible=false;b.sample('a',true,false);assert.equal(calls,0);parent.visible=true;
  b.sample('a',true,false);b.sample('a',true,true);b.sample('a',false,true);assert.equal(b.face.position.z,0);b.sample('a',true,false);assert.equal(calls,0);
  b.sample('a',true,true);b.sample('a',true,false);assert.equal(calls,1);
  b.enabled=false;b.sample('a',true,true);b.sample('a',true,false);assert.equal(calls,1);
  let disposed=0;b.cap.geometry.addEventListener('dispose',()=>disposed++);b.dispose();b.dispose();assert.equal(disposed,1);assert.equal(b.mesh.parent,null);
 }finally{globalThis.document=old;}
});

test('WebXR array-like collections support retained presses and disconnect cancellation without Array methods',()=>{
 const a={},b={},sources={0:a,1:b,length:2,[Symbol.iterator]:function*(){yield a;yield b;}},g=new ButtonGesture();
 assert.equal(sources.includes,undefined);g.sample(a,true,false);g.sample(a,true,true);g.retain(sources);assert.equal(g.owner,a);
 g.sample(b,true,false);g.retain({0:b,length:1});assert.equal(g.owner,null);assert.equal(g.previous.has(a),false);assert.equal(g.hovered.has(a),false);
 g.sample(b,true,true);g.retain({length:0});assert.equal(g.owner,null);assert.equal(g.hovered.size,0);
});
