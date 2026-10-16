import assert from 'node:assert/strict';
import {DEFAULTS, CONTROLS, setSetting} from '../projects/surface/settings.mjs';
import {createSurface, FIXED_STEP, GRID_SIZE} from '../projects/surface/simulation.mjs';
import * as THREE from '../projects/forest/vendor/three.module.js';
import {VRPanel} from '../projects/surface/VRPanel.js';
const settings = {...DEFAULTS, rainInterval: 0.5};
const s = createSurface({settings, random: () => 0.5});
for (let i = 0; i < 60; i++) s.advance(FIXED_STEP);
assert.equal(s.drops, 1);
settings.paused = true;
const frozen = s.heights.slice();
for (let i = 0; i < 120; i++) s.advance(FIXED_STEP);
assert.deepEqual(s.heights, frozen); assert.equal(s.drops, 1);
settings.paused = false; settings.rainInterval = 1;
for (let i = 0; i < 120; i++) s.advance(FIXED_STEP);
assert.equal(s.drops, 2);
setSetting(settings, 'damping', 999); assert.equal(settings.damping, 4);
setSetting(settings, 'damping', NaN); assert.equal(settings.damping, 4);
function decay(damping) {
  const wave = createSurface({settings: {...DEFAULTS, damping, rainStrength: 0}});
  wave.heights[32 * GRID_SIZE + 32] = 1;
  for (let i = 0; i < 240; i++) wave.advance(FIXED_STEP);
  return wave.velocities.reduce((sum, v) => sum + v * v, 0);
}
assert.ok(decay(4) < decay(0.1), 'Live damping controls decay');
for (const damping of [0, 4]) {
  const wave = createSurface({settings: {...DEFAULTS, damping, springStrength: 150, restoringStrength: 10, rainStrength: 40, rainInterval: 0.5}});
  for (let i = 0; i < 120 * 30; i++) wave.advance(FIXED_STEP);
  assert.ok(wave.heights.every(Number.isFinite));
  assert.ok(Math.max(...wave.heights.map(Math.abs)) < 10, 'Allowed high spring settings remain stable');
}
// Verify controller panel actions and actual ray-to-button mapping with Three.js.
const context = new Proxy({}, {get: () => () => {}});
globalThis.document = {createElement: () => ({width: 0, height: 0, getContext: () => context})};
const scene = new THREE.Scene(), rig = new THREE.Group(); scene.add(rig);
const controllers = [new THREE.Group(), new THREE.Group()];
const actions = [];
const panel = new VRPanel(scene, rig, {xr: {getController: i => controllers[i]}}, settings, action => actions.push(action));
panel.activate({row: 0, sign: -1}); assert.equal(settings.damping, 3.95);
panel.activate({action: 0}); panel.activate({action: 1}); panel.activate({action: 2});
assert.deepEqual(actions.slice(-3), ['pause', 'reset', 'defaults']);
panel.enabled = true; panel.mesh.visible = true;
panel.follow(new THREE.Vector3(0, 1.65, 0), new THREE.Quaternion());
const x = (800 / 1024 - 0.5) * 1.45, y = (0.5 - 180 / 1280) * 1.8125;
const target = panel.mesh.localToWorld(new THREE.Vector3(x, y, 0));
controllers[0].position.copy(target).add(new THREE.Vector3(0, 0, 1).applyQuaternion(panel.mesh.quaternion));
controllers[0].quaternion.copy(panel.mesh.quaternion); scene.updateMatrixWorld(true);
assert.equal(panel.hit(controllers[0]).row, 0); assert.equal(panel.hit(controllers[0]).sign, -1);
assert.equal(panel.rows.length, CONTROLS.length);
console.log('Surface tuning: pause/resume, live interval/damping, bounds, extreme stability, VR actions and controller ray targeting pass.');
