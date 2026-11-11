import {createTerrainSampler} from './terrain-sampler.mjs?v=banks-1';
import {createSurfaceQuery} from './surface-query.mjs';
const dataOnly = object => Object.fromEntries(Object.entries(object).filter(([, value]) => typeof value !== 'function'));

export function snapshotWorld(world) {
  const landscape = dataOnly(world.landscape);
  return {...dataOnly(world), landscape, mountain: landscape, surface: dataOnly(world.surface)};
}

// Restore read-only gameplay queries from a generated world. No regeneration.
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

