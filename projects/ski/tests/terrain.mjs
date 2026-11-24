import assert from 'node:assert/strict';
import test from 'node:test';
import {Group, MeshBasicMaterial} from '../../../shared/vendor/three-r180/three.module.js';
import {createTerrain, makeTileIndices} from '../terrain.mjs';

test('mixed terrain LODs share edge segments and preserve triangle winding at corners', () => {
  for (const step of [2, 4, 8, 16, 32]) {
    for (const variant of [[2, 4, 8, 16], [32, 32, 32, 32], [2, 2, 2, 2], [32, 2, 2, 32]]) {
      const edges = variant.map(edge => Math.max(edge, step));
      const side = 256 / step;
      const stride = side + 1;
      const boundary = Array.from({length: 4}, () => new Set());
      const indices = makeTileIndices(step, edges);
      let area = 0;
      for (let i = 0; i < indices.length; i += 3) {
        const points = Array.from(indices.subarray(i, i + 3), index => [
          index % stride, Math.floor(index / stride),
        ]);
        const [[ax, az], [bx, bz], [cx, cz]] = points;
        const twiceArea = (bz - az) * (cx - ax) - (bx - ax) * (cz - az);
        assert.ok(twiceArea >= 0);
        area += twiceArea / 2;
        for (const [x, z] of points) {
          if (x === 0) boundary[0].add(z * step);
          if (x === side) boundary[1].add(z * step);
          if (z === 0) boundary[2].add(x * step);
          if (z === side) boundary[3].add(x * step);
        }
      }
      assert.equal(area, side ** 2);
      for (const [i, edge] of edges.entries()) {
        assert.deepEqual([...boundary[i]].sort((a, b) => a - b),
          Array.from({length: 256 / edge + 1}, (_, j) => j * edge));
      }
    }
  }
});

test('queued terrain updates retain buffers for stitching and reuse sampled LODs on revisit', () => {
  const root = new Group();
  const map = {metadata: {columns: 1025, rows: 257}, height: (x, z) => 500 + 0.01 * x + 0.02 * z,
    normal: (_x, _z, out) => Object.assign(out, {x: 0, y: 1, z: 0})};
  const terrain = createTerrain(root, map, new MeshBasicMaterial());
  const settle = x => { for (let i = 0; i < 10; i++) terrain.update(x, 120); };
  settle(128);
  const [first, second] = root.children;
  const original = first.geometry;
  const originalPositions = original.getAttribute('position').array;
  const index = original.index;
  const initialVersion = index.version;
  const secondCoarse = second.geometry;

  settle(144);
  assert.notEqual(second.geometry, secondCoarse);
  assert.equal(first.geometry, original);
  assert.equal(first.geometry.index, index);
  assert.ok(index.version > initialVersion);
  const secondFine = second.geometry;
  settle(128);
  assert.equal(second.geometry, secondFine);
  settle(96);
  assert.notEqual(second.geometry, secondFine);
  settle(900);
  assert.notEqual(first.geometry, original);
  settle(128);
  assert.equal(first.geometry.getAttribute('position').array, originalPositions);
});
