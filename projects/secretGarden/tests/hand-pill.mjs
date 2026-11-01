import test from 'node:test';
import assert from 'node:assert/strict';
import {Group} from '../../../shared/vendor/three-r180/three.module.js';
import {HandPill} from '../hand-pill.mjs';
test('hand pill follows grip ownership and hides on missing tracking or unsupported input',()=>{
 const grip=new Group(),hand=new HandPill(grip),source={handedness:'right',gamepad:{mapping:'xr-standard'}};
 assert.equal(hand.mesh.parent,grip);assert.equal(hand.mesh.visible,false);
 hand.update(source,true);assert.equal(hand.mesh.visible,true);assert.equal(hand.mesh.geometry,hand.geometry);
 hand.update(source,false);assert.equal(hand.mesh.visible,false);
 hand.update({...source,hand:{}},true);assert.equal(hand.mesh.visible,false);
 hand.update({...source,handedness:'none'},true);assert.equal(hand.mesh.visible,false);
 assert.equal(hand.mesh.castShadow,false);assert.equal(hand.mesh.receiveShadow,false);
 hand.dispose();assert.equal(grip.children.length,0);
});
