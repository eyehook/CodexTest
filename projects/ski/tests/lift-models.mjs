import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import * as THREE from '../../../shared/vendor/three-r180/three.module.js';
import {createLiftModels} from '../lift-models.mjs';

test('all mapped lift types render distinct ground-aligned routes with finite transforms', () => {
  const groups = JSON.parse(readFileSync(new URL('../data/mount-snow-lifts.json', import.meta.url)));
  const lifts = Object.values(groups).flat();
  const scene = new THREE.Scene();
  const height = (x, z) => 700 + x * 0.08 - z * 0.025;
  const model = createLiftModels(scene, {height}, groups);
  assert.equal(model.children.length, 19);
  assert.equal(scene.children[0], model);
  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  for (const [i, lift] of lifts.entries()) {
    const mesh = model.children[i];
    assert.equal(mesh.name, lift.name);
    assert.ok(mesh.isInstancedMesh && mesh.count >= 3 && Number.isFinite(mesh.boundingSphere.radius));
    for (let box = 0; box < mesh.count; box++) {
      mesh.getMatrixAt(box, matrix);
      assert.ok(matrix.elements.every(Number.isFinite));
    }
    const [x, z] = lift.route[0];
    mesh.getMatrixAt(0, matrix);
    position.setFromMatrixPosition(matrix);
    assert.ok(position.distanceTo(new THREE.Vector3(x, height(x, z) + 0.8, z)) < 0.001);
    assert.deepEqual(lift.route.at(-1), [lift.upper.x, lift.upper.z]);
  }
});
