const metadataUrl = new URL('./data/mount-snow-1m.json', import.meta.url);

async function getAsset(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Could not load ${url.pathname}: HTTP ${response.status}`);
  return response;
}

async function loadGrid(url) {
  const response = await getAsset(url);
  const stream = response.body.pipeThrough(new DecompressionStream('gzip'));
  return new Response(stream).arrayBuffer();
}

export function applyPisteAdjustments(data, adjustments) {
  const samples = new DataView(data);
  const patches = new DataView(adjustments);
  const recordBytes = 5;
  if (patches.byteLength % recordBytes !== 0) throw new Error('Invalid piste adjustment asset');
  for (let i = 0; i < patches.byteLength; i += recordBytes) {
    const offset = patches.getUint32(i, true) * 2;
    const next = samples.getUint16(offset, true) + patches.getInt8(i + 4);
    if (next < 0 || next > 65535) throw new Error('Piste adjustment exceeds the elevation grid range');
    samples.setUint16(offset, next, true);
  }
}

export async function loadHeightmap(url = metadataUrl) {
  const manifestUrl = new URL(url, import.meta.url);
  manifestUrl.search ||= new URL(import.meta.url).search;
  const metadata = await (await getAsset(manifestUrl)).json();
  const patchUrl = metadata.pisteAdjustmentAsset && new URL(metadata.pisteAdjustmentAsset, manifestUrl);
  if (patchUrl) patchUrl.search = manifestUrl.search;
  const gradingUrl = metadata.terminalGradingAsset && new URL(metadata.terminalGradingAsset, manifestUrl);
  if (gradingUrl) gradingUrl.search = manifestUrl.search;
  const [data, adjustments, grading] = await Promise.all([
    loadGrid(new URL(metadata.asset, manifestUrl)),
    patchUrl ? loadGrid(patchUrl) : null,
    gradingUrl ? loadGrid(gradingUrl) : null,
  ]);
  if (adjustments) applyPisteAdjustments(data, adjustments);
  if (grading) {
    const records = new DataView(grading);
    const samples = new DataView(data);
    if (records.byteLength % 6 !== 0) throw new Error('Invalid terminal grading asset');
    for (let i = 0; i < records.byteLength; i += 6) {
      samples.setUint16(records.getUint32(i, true) * 2, records.getUint16(i + 4, true), true);
    }
  }
  return createHeightmap(metadata, data);
}

export function createHeightmap(metadata, data) {
  const { columns, rows, spacingMeters, elevationOffsetMeters, elevationScaleMeters } = metadata;
  if (data.byteLength !== columns * rows * 2) {
    throw new Error('Heightmap byte length does not match the grid dimensions');
  }
  const samples = new DataView(data);

  function height(x, z) {
    const column = Math.max(0, Math.min(columns - 1, x / spacingMeters));
    const row = Math.max(0, Math.min(rows - 1, z / spacingMeters));
    if (Number.isInteger(column) && Number.isInteger(row)) {
      return elevationOffsetMeters + elevationScaleMeters * samples.getUint16((row * columns + column) * 2, true);
    }
    const left = Math.min(columns - 2, Math.floor(column));
    const top = Math.min(rows - 2, Math.floor(row));
    const u = column - left;
    const v = row - top;
    const upperIndex = (top * columns + left) * 2;
    const lowerIndex = upperIndex + columns * 2;
    const upperLeft = samples.getUint16(upperIndex, true);
    const upperRight = samples.getUint16(upperIndex + 2, true);
    const lowerLeft = samples.getUint16(lowerIndex, true);
    const lowerRight = samples.getUint16(lowerIndex + 2, true);
    const upper = upperLeft + (upperRight - upperLeft) * u;
    const lower = lowerLeft + (lowerRight - lowerLeft) * u;
    return elevationOffsetMeters + elevationScaleMeters * (upper + (lower - upper) * v);
  }

  function normal(x, z, out) {
    const dx = height(x - spacingMeters, z) - height(x + spacingMeters, z);
    const dz = height(x, z - spacingMeters) - height(x, z + spacingMeters);
    const dy = 2 * spacingMeters;
    const length = Math.hypot(dx, dy, dz);
    out.x = dx / length;
    out.y = dy / length;
    out.z = dz / length;
    out.slope = Math.atan2(Math.hypot(dx, dz), dy) * 180 / Math.PI;
    return out;
  }

  // Terrain mesh coordinates are whole sample indices on the Mount Snow 1 m DEM.
  function writeTerrainRow(points, normals, cursor, startX, z, step, count) {
    const row = z * columns;
    const north = Math.max(0, z - 1) * columns;
    const south = Math.min(rows - 1, z + 1) * columns;
    const dy = 2 * spacingMeters;
    for (let i = 0; i < count; i++) {
      const x = Math.min(columns - 1, startX + i * step);
      const dx = elevationScaleMeters * (samples.getUint16(2 * (row + Math.max(0, x - 1)), true)
        - samples.getUint16(2 * (row + Math.min(columns - 1, x + 1)), true));
      const dz = elevationScaleMeters * (samples.getUint16(2 * (north + x), true)
        - samples.getUint16(2 * (south + x), true));
      const inverseLength = 1 / Math.sqrt(dx * dx + dy * dy + dz * dz);
      points[cursor] = x;
      points[cursor + 1] = elevationOffsetMeters + elevationScaleMeters * samples.getUint16(2 * (row + x), true);
      points[cursor + 2] = z;
      normals[cursor++] = dx * inverseLength;
      normals[cursor++] = dy * inverseLength;
      normals[cursor++] = dz * inverseLength;
    }
  }

  return { metadata, height, normal, writeTerrainRow };
}
