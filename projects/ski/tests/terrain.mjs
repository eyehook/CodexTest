import assert from 'node:assert/strict';
import test from 'node:test';
import {makeTileIndices} from '../terrain.mjs';

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
