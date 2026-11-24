import assert from 'node:assert/strict';
import test from 'node:test';
import {applyPisteAdjustments, createHeightmap} from '../heightmap.mjs';

test('sparse piste adjustments affect elevation, interpolation and surface normals', () => {
  const samples = new ArrayBuffer(8);
  const base = new DataView(samples);
  for (let i = 0; i < 4; i++) base.setUint16(i * 2, 100, true);
  const patches = new DataView(new ArrayBuffer(10));
  patches.setUint32(0, 1, true);
  patches.setInt8(4, -50);
  patches.setUint32(5, 3, true);
  patches.setInt8(9, 25);
  applyPisteAdjustments(samples, patches.buffer);
  const map = createHeightmap({columns: 2, rows: 2, spacingMeters: 1,
    elevationOffsetMeters: 500, elevationScaleMeters: 0.01}, samples);
  assert.equal(map.height(0, 0), 501);
  assert.equal(map.height(1, 0), 500.5);
  assert.equal(map.height(1, 1), 501.25);
  assert.equal(map.height(0.5, 0.5), 500.9375);
  assert.ok(map.normal(0.5, 0.5, {}).z < 0);
  assert.throws(() => applyPisteAdjustments(samples, new ArrayBuffer(4)), /Invalid piste adjustment/);
});
