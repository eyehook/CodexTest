import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from '../../../shared/vendor/three-r180/three.module.js';
import {createSkis, createSkiShadowUniforms} from '../skis.mjs';

test('the ski pair follows the tracked horizontal footprint and tilts over the snow', () => {
  const rig = new THREE.Group();
  rig.position.set(500, 600, 800);
  const height = (x, z) => 600 - (z - 800) * 0.2;
  const shadows = createSkiShadowUniforms();
  const {pair, update} = createSkis(rig, height, shadows);
  const view = {position: new THREE.Vector3(0.2, 1.8, -0.1)};
  const motion = {active: true, airborne: false, angle: Math.PI / 4};
  update(view, motion, true, true);
  assert.equal(shadows.skiShadowsEnabled.value, true);
  assert.equal(pair.children.length, 2);
  assert.deepEqual(pair.position.toArray(), [0.2, 0, -0.1]);
  assert.equal(pair.rotation.y, Math.PI / 4);
  assert.ok(pair.children.every(ski => ski.rotation.x > 0));
  assert.ok(shadows.skiShadowNormals.value.every(normal => Math.abs(normal.z) > 0.05));
  assert.ok(shadows.skiShadowCenters.value[0].distanceTo(shadows.skiShadowCenters.value[1]) > 0.27);
  motion.airborne = true;
  rig.position.y += 0.4;
  update(view, motion, true, true, 2);
  assert.ok(shadows.skiShadowCenters.value.every(center => Math.abs(center.y - 600.405) < 1e-9));
  assert.ok(shadows.skiShadowNormals.value.every(normal => Math.abs(normal.y - 1) < 1e-9));
  assert.ok(pair.children.every(ski => Math.abs(ski.rotation.x) < 1e-9));
  assert.equal(pair.visible, true);
  update(view, motion, false);
  assert.equal(pair.visible, false);
  assert.equal(shadows.skiShadowsEnabled.value, false);
});

test('skis follow downhill rig height immediately and smooth local fit and pitch', () => {
  const rig = new THREE.Group();
  rig.position.y = 500;
  let pitch = 0;
  let crossSlope = 0;
  const height = (x, z) => rig.position.y - z * pitch + x * crossSlope;
  const {pair, update} = createSkis(rig, height);
  const view = {position: new THREE.Vector3()};
  const motion = {active: true, airborne: false};
  update(view, motion, true);
  const ski = pair.children[1];
  const worldHeight = () => ski.position.y + rig.position.y;
  const initialHeight = worldHeight();

  rig.position.y -= 0.15;
  update(view, motion, true, false, 0.02);
  assert.ok(Math.abs(worldHeight() - (initialHeight - 0.15)) < 1e-9);

  pitch = 0.4;
  crossSlope = 0.2;
  update(view, motion, true, false, 0.02);
  const localRise = ski.position.x * crossSlope;
  assert.ok(ski.position.y > 0.005 && ski.position.y < 0.005 + localRise);
  assert.ok(ski.rotation.x > 0 && ski.rotation.x < Math.atan(pitch));
  update(view, motion, true, false, 0.16);
  const heightFraction = (ski.position.y - 0.005) / localRise;
  const pitchFraction = ski.rotation.x / Math.atan(pitch);
  assert.ok(Math.abs(heightFraction - 0.95) < 0.001);
  assert.ok(Math.abs(pitchFraction - 0.95) < 0.001);

  motion.airborne = true;
  rig.position.y += 0.4;
  update(view, motion, true, false, 2);
  const airHeight = worldHeight();
  assert.ok(Math.abs(ski.rotation.x) < 1e-9);
  motion.airborne = false;
  rig.position.y -= 0.4;
  update(view, motion, true, false, 0.02);
  assert.ok(worldHeight() < airHeight && worldHeight() > rig.position.y + 0.005);
  assert.ok(ski.rotation.x > 0 && ski.rotation.x < Math.atan(pitch));

  update(view, motion, false);
  rig.position.y = 900;
  update(view, motion, true);
  assert.ok(Math.abs(worldHeight() - (900.005 + localRise)) < 1e-9);
  assert.ok(Math.abs(ski.rotation.x - Math.atan(pitch)) < 1e-9);
});
