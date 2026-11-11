import {fileURLToPath} from 'node:url';
import {createWorld, DEFAULTS} from '../../world.mjs';
import {createTerrainSampler} from '../../terrain-sampler.mjs';
import {createSurfaceQuery} from '../../surface-query.mjs';
import {fingerprintModules, loadDiskFixture} from './disk-cache.mjs';

const directory = process.env.HIKE_TEST_CACHE_DIR || fileURLToPath(new URL('../../.test-cache/', import.meta.url));
const generatorVersion = fingerprintModules(new URL('../../world.mjs', import.meta.url));
const schema = 'hike-world-fixture-v1';
const dataOnly = object => Object.fromEntries(Object.entries(object).filter(([, value]) => typeof value !== 'function'));

export function snapshotWorld(world) {
  const landscape = dataOnly(world.landscape);
  return {...dataOnly(world), landscape, mountain: landscape, surface: dataOnly(world.surface)};
}

// Test-only rehydration, never used by the game. The worker's read-only sampler
// already supports this exact CPU data. Fresh-world parity tests guard against
// this adapter masking differences between gameplay and worker queries.
export function restoreWorld(snapshot) {
  const reader = createTerrainSampler(snapshot.samplingData);
  const surface = {...snapshot.surface, ...createSurfaceQuery(snapshot.surface.queryData)};
  const landscape = {...snapshot.landscape};
  const {heights, gridSize: n, gridStep: step, extent, boundaryHeight} = landscape;
  function rawHeight(x, z) {
    const gx = (x + extent) / step, gz = (z + extent) / step;
    if (gx < 0 || gz < 0 || gx >= n - 1 || gz >= n - 1) return boundaryHeight;
    const ix = Math.floor(gx), iz = Math.floor(gz), u = gx - ix, v = gz - iz, i = iz * n + ix;
    return (heights[i] * (1 - u) + heights[i + 1] * u) * (1 - v)
      + (heights[i + n] * (1 - u) + heights[i + n + 1] * u) * v;
  }
  landscape.height = rawHeight;
  surface.slope = ids => {
    const [a, b, c] = ids.map(id => surface.vertices[id]);
    const dx = b.x - a.x, dz = b.z - a.z, ex = c.x - a.x, ez = c.z - a.z, det = dx * ez - dz * ex;
    if (!det) return 0;
    return Math.atan(Math.hypot(((b.y - a.y) * ez - (c.y - a.y) * dz) / det,
      (dx * (c.y - a.y) - ex * (b.y - a.y)) / det)) * 180 / Math.PI;
  };
  function trail(x, z, out = {}, global = false) {
    reader.trail(x, z, out, global);
    if (out.distance <= snapshot.config.trailWidth / 2) {
      const value = surface.sample(x, z);
      if (value !== null) out.height = value;
    }
    return out;
  }
  return {...snapshot, landscape, mountain: landscape, surface, rawHeight,
    height: reader.height, normal: (x, z, out = {}) => reader.normal(x, z, out), trail};
}

export async function cachedWorld(options = {}) {
  if (process.env.HIKE_TEST_CACHE === 'off') return createWorld(options);
  const version = [schema, await generatorVersion, process.versions.v8, process.platform, process.arch].join(':');
  const entry = await loadDiskFixture({directory, version, configuration: {...DEFAULTS, ...options},
    build: () => snapshotWorld(createWorld(options))});
  return restoreWorld(entry.value);
}
