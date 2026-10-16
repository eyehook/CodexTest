import {DEFAULTS} from '../projects/surface/settings.mjs';
import assert from 'node:assert/strict';
import {createSurface, FIXED_STEP, GRID_SIZE} from '../projects/surface/simulation.mjs';
const s = createSurface({settings: {...DEFAULTS, damping: 0.28, springStrength: 36, restoringStrength: 0.35, rainStrength: 16, rainInterval: 5}, random: () => 0.5});
assert.equal(s.heights.length, 64 * 64);
for (let i = 0; i < 599; i++) s.advance(FIXED_STEP);
assert.equal(s.drops, 0);
assert.ok(s.heights.every(h => h === 0));
s.advance(FIXED_STEP);
assert.equal(s.drops, 1);
assert.ok(s.heights[s.lastDrop] < 0);
assert.equal(s.heights.filter(h => h !== 0).length, 1, 'Drop directly affects exactly one point');
s.advance(FIXED_STEP);
assert.ok(s.heights[s.lastDrop + 1] < 0, 'Impulse propagates to neighbor');
assert.ok(s.heights[s.lastDrop + GRID_SIZE] < 0);
for (let i = 0; i < 599; i++) s.advance(FIXED_STEP);
assert.equal(s.drops, 2);
for (let i = 0; i < 120 * 60; i++) s.advance(FIXED_STEP);
assert.ok(s.heights.every(Number.isFinite));
assert.ok(Math.max(...s.heights.map(Math.abs)) < 2, 'Long-running rain stays bounded');
s.reset();
assert.equal(s.drops, 0);
assert.ok(s.heights.every(h => h === 0));
assert.ok(s.velocities.every(v => v === 0));
// A free disturbance loses mechanical energy to damping without new rain.
s.heights[Math.floor(GRID_SIZE / 2) * GRID_SIZE + Math.floor(GRID_SIZE / 2)] = 1;
function energy() {
  let sum = 0;
  for (let z = 0; z < GRID_SIZE; z++) for (let x = 0; x < GRID_SIZE; x++) {
    const i = z * GRID_SIZE + x, h = s.heights[i];
    sum += 0.5 * s.velocities[i] ** 2 + 0.175 * h ** 2;
    if (x + 1 < GRID_SIZE) sum += 18 * (h - s.heights[i + 1]) ** 2;
    if (z + 1 < GRID_SIZE) sum += 18 * (h - s.heights[i + GRID_SIZE]) ** 2;
  }
  return sum;
}
const initialEnergy = energy();
for (let i = 0; i < 480; i++) s.advance(FIXED_STEP);
assert.ok(energy() < initialEnergy * 0.5, 'Damping dissipates wave energy');
// Different render rates must produce the same physics after the same elapsed time.
const a = createSurface({settings: {...DEFAULTS, damping: 0.28, springStrength: 36, restoringStrength: 0.35, rainStrength: 16, rainInterval: 5}, random: () => 0.5}), b = createSurface({settings: {...DEFAULTS, damping: 0.28, springStrength: 36, restoringStrength: 0.35, rainStrength: 16, rainInterval: 5}, random: () => 0.5});
for (let i = 0; i < 360; i++) a.advance(1 / 60);
for (let i = 0; i < 540; i++) b.advance(1 / 90);
assert.deepEqual(a.heights, b.heights);
assert.deepEqual(a.velocities, b.velocities);
console.log('Surface: rain timing, single-point impulse, propagation, damping, stability, reset, and render-rate independence passed.');

// Both random coordinate extremes must reach the outermost cells.
for (const [randomValue, expected] of [[0, 0], [1 - Number.EPSILON, GRID_SIZE * GRID_SIZE - 1]]) {
  const edgeRain = createSurface({settings: {...DEFAULTS, damping: 0.28, springStrength: 36, restoringStrength: 0.35, rainStrength: 16, rainInterval: 5}, random: () => randomValue});
  for (let i = 0; i < 600; i++) edgeRain.advance(FIXED_STEP);
  assert.equal(edgeRain.lastDrop, expected);
  assert.ok(edgeRain.heights[expected] < 0);
}
console.log('Raindrops can reach both outermost grid corners.');
