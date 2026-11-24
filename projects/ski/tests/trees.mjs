import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from '../../../shared/vendor/three-r180/three.module.js';
import {createTrees, treeAt} from '../trees.mjs';

function canopy() {
  const columns = 501;
  const rows = 501;
  const coverage = new Uint8Array(columns * rows).fill(255);
  const heights = new DataView(new ArrayBuffer(coverage.length * 2));
  for (let i = 0; i < coverage.length; i++) heights.setUint16(i * 2, 1200, true);
  return {
    metadata: {columns, rows, spacingMeters: 2, heightScaleMeters: 0.01},
    coverage,
    heights,
    pistes: {columns, rows, spacingMeters: 2, mask: new Uint8Array(coverage.length)},
  };
}

test('the jittered canopy grid deterministically picks about 50% of eligible cells', () => {
  const data = canopy();
  const trees = [];
  for (let z = 0; z < 40; z++) {
    for (let x = 0; x < 40; x++) {
      const tree = treeAt(x, z, data, 1000, 1000);
      assert.deepEqual(tree, treeAt(x, z, data, 1000, 1000));
      if (tree) trees.push(tree);
    }
  }
  assert.ok(trees.length > 720 && trees.length < 880);
  assert.ok(trees.every(tree => tree.height >= 15.3 && tree.height <= 20.7 && tree.radius > 0));
  data.coverage.fill(0);
  for (let x = 0; x < 40; x++) assert.equal(treeAt(x, 0, data, 1000, 1000), null);
});

test('tree batches unload and reproduce their instance transforms when revisited', () => {
  const scene = new THREE.Scene();
  const map = {metadata: {columns: 1001, rows: 1001}, height: () => 500};
  const trees = createTrees(scene, map, canopy());
  trees.update(20, 20);
  const initial = trees.group.children[0].instanceMatrix.array.slice();
  const count = trees.group.children.length;
  assert.ok(count > 0 && count <= 36);
  trees.update(980, 980);
  assert.notDeepEqual(trees.group.children[0].instanceMatrix.array, initial);
  trees.update(20, 20);
  assert.deepEqual(trees.group.children[0].instanceMatrix.array, initial);
  assert.equal(trees.group.children.length, count);
});


test('trees stay off mapped pistes and their crowns clear adjacent piste cells', () => {
  const data = canopy();
  const candidates = Array.from({length: 30}, (_, i) => treeAt(i + 3, 4, data, 1000, 1000));
  const i = candidates.findIndex(Boolean);
  const tree = candidates[i];
  const {columns, mask} = data.pistes;
  const column = Math.round(tree.x / 2);
  const row = Math.round(tree.z / 2);
  mask[row * columns + column + 1] = 255;
  assert.equal(treeAt(i + 3, 4, data, 1000, 1000), null);
  mask.fill(0);
  mask[row * columns + column] = 255;
  assert.equal(treeAt(i + 3, 4, data, 1000, 1000), null);
});
