import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from '../../../shared/vendor/three-r180/three.module.js';
import {createSkis} from '../skis.mjs';

test('the ski pair follows the tracked horizontal footprint and tilts over the snow', () => {
  const rig = new THREE.Group();
  rig.position.set(500, 600, 800);
  const height = (x, z) => 600 - (z - 800) * 0.2;
  const {pair, update} = createSkis(rig, height);
  const view = {position: new THREE.Vector3(0.2, 1.8, -0.1)};
  const motion = {active: true, airborne: false, angle: Math.PI / 4};
  update(view, motion, true);
  assert.equal(pair.children.length, 2);
  assert.deepEqual(pair.position.toArray(), [0.2, 0, -0.1]);
  assert.equal(pair.rotation.y, Math.PI / 4);
  assert.ok(pair.children.every(ski => ski.rotation.x > 0));
  motion.airborne = true;
  update(view, motion, true);
  assert.ok(pair.children.every(ski => ski.rotation.x === 0));
  assert.equal(pair.visible, true);
  update(view, motion, false);
  assert.equal(pair.visible, false);
});
