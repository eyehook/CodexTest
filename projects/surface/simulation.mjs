import {DEFAULTS} from './settings.mjs?v=shared-r180-1';
export const GRID_SIZE = 64;
// Cell width / center-to-center spacing in meters. Change this to resize the grid.
export const SPACING = DEFAULTS.spacing;
// Visible square width as a fraction of its cell; the remainder is the gap.
export const QUAD_FILL = DEFAULTS.quadFill;
export const FIXED_STEP = 1 / 120;
export const RAIN_INTERVAL = DEFAULTS.rainInterval;
export const RAIN_IMPULSE = DEFAULTS.rainStrength;

export function createSurface({random = Math.random, settings = {...DEFAULTS}} = {}) {
  const heights = new Float32Array(GRID_SIZE * GRID_SIZE);
  const velocities = new Float32Array(heights.length);
  let accumulator = 0, rainTime = 0, drops = 0, lastDrop = -1;

  function step() {
    rainTime += FIXED_STEP;
    if (rainTime + 1e-10 >= settings.rainInterval) {
      rainTime = 0;
      // Every grid cell, including the outermost rows and columns, is eligible.
      const x = Math.min(GRID_SIZE - 1, Math.floor(random() * GRID_SIZE));
      const z = Math.min(GRID_SIZE - 1, Math.floor(random() * GRID_SIZE));
      lastDrop = z * GRID_SIZE + x;
      velocities[lastDrop] -= settings.rainStrength; // A downward impulse to exactly one particle.
      drops++;
    }
    // All velocities use the same height state; only then integrate heights.
    for (let z = 0; z < GRID_SIZE; z++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        const i = z * GRID_SIZE + x, h = heights[i];
        const left = x > 0 ? heights[i - 1] : h;
        const right = x < GRID_SIZE - 1 ? heights[i + 1] : h;
        const back = z > 0 ? heights[i - GRID_SIZE] : h;
        const front = z < GRID_SIZE - 1 ? heights[i + GRID_SIZE] : h;
        const edge = Math.min(x, z, GRID_SIZE - 1 - x, GRID_SIZE - 1 - z);
        const damping = settings.damping + 3 * Math.max(0, (12 - edge) / 12) ** 2;
        const acceleration = settings.springStrength * (left + right + back + front - 4 * h) - settings.restoringStrength * h;
        velocities[i] = (velocities[i] + acceleration * FIXED_STEP) * Math.exp(-damping * FIXED_STEP);
      }
    }
    for (let i = 0; i < heights.length; i++) heights[i] += velocities[i] * FIXED_STEP;
  }
  return {
    heights, velocities,
    get drops() { return drops; },
    get lastDrop() { return lastDrop; },
    advance(dt) {
      if (settings.paused || !Number.isFinite(dt) || dt <= 0) return;
      // No catch-up burst after a hidden tab or interrupted XR frame.
      accumulator += Math.min(dt, 0.1);
      while (accumulator + 1e-10 >= FIXED_STEP) {
        step();
        accumulator = Math.max(0, accumulator - FIXED_STEP);
      }
    },
    reset() {
      heights.fill(0); velocities.fill(0);
      accumulator = 0; rainTime = 0; drops = 0; lastDrop = -1;
    }
  };
}
