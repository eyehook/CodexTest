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
  const {model} = createLiftModels(scene, {height}, groups);
  assert.equal(model.children.length, 19);
  assert.equal(scene.children[0], model);
  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const scale = new THREE.Vector3();
  const pylonWidth = {Chairlift: 0.65, 'Rope tow': 0.24};
  let renderedPylons = 0;
  for (const [i, lift] of lifts.entries()) {
    const mesh = model.children[i];
    assert.equal(mesh.name, lift.name);
    assert.ok(mesh.isInstancedMesh && mesh.count >= 3 && Number.isFinite(mesh.boundingSphere.radius));
    const supports = [];
    for (let box = 0; box < mesh.count; box++) {
      mesh.getMatrixAt(box, matrix);
      assert.ok(matrix.elements.every(Number.isFinite));
      scale.setFromMatrixScale(matrix);
      if (Math.abs(scale.x - pylonWidth[lift.type]) < 1e-6) {
        supports.push(new THREE.Vector3().setFromMatrixPosition(matrix));
      }
    }
    if (lift.type !== 'Carpet') {
      const indices = [0, ...lift.pylonIndices, lift.route.length - 1];

      assert.equal(supports.length, indices.length, lift.name);
      for (const [i, index] of indices.entries()) {
        const [x, z] = lift.route[index];
        const terminal = i === 0 || i === indices.length - 1;
        const centerHeight = lift.type === 'Chairlift' ? (terminal ? 0.975 : 4) : 0.25;
        assert.ok(supports[i].distanceTo(new THREE.Vector3(x, height(x, z) + centerHeight, z)) < 0.001,
          lift.name);
      }
      renderedPylons += supports.length - 2;
    }
    const [x, z] = lift.route[0];
    const chairlift = lift.type === 'Chairlift';
    const terminalMesh = chairlift ? mesh.children[0] : mesh;
    if (chairlift) {
      const chairs = mesh.children[1];
      assert.ok(chairs.isInstancedMesh && chairs.count >= 2);
      assert.equal(chairs.geometry, model.children.find(m => m.children.length).children[1].geometry);
      assert.equal(terminalMesh.geometry.type, 'CylinderGeometry');
    }
    terminalMesh.getMatrixAt(0, matrix);
    position.setFromMatrixPosition(matrix);
    assert.ok(position.distanceTo(new THREE.Vector3(x, height(x, z) + (chairlift ? 2.95 : 0.8), z)) < 0.001);
    assert.deepEqual(lift.route.at(-1), [lift.upper.x, lift.upper.z]);
  }
  assert.equal(renderedPylons, 185);
});

test('the closest base within fifteen meters highlights and returns its unloading destination', () => {
  const first = {name: 'First', type: 'Carpet', route: [[0, 0], [0, 30]], x: 0, z: 38};
  const second = {name: 'Second', type: 'Carpet', route: [[4, 0], [4, 30]], x: 4, z: 38};
  const {model, highlightNearestBase} = createLiftModels(
    new THREE.Scene(), {height: () => 0}, {area: [first, second]});
  const color = new THREE.Color();
  const baseColor = mesh => {
    mesh.getColorAt(0, color);
    return color.getHex();
  };
  const [firstMesh, secondMesh] = model.children;
  const original = baseColor(firstMesh);

  assert.equal(highlightNearestBase(-15.01, 0), null);
  assert.equal(highlightNearestBase(-15, 0), first);
  const highlight = baseColor(firstMesh);
  assert.notEqual(highlight, original);
  assert.equal(baseColor(secondMesh), original);

  assert.equal(highlightNearestBase(3, 0), second);
  assert.equal(baseColor(firstMesh), original);
  assert.equal(baseColor(secondMesh), highlight);

  assert.equal(highlightNearestBase(...second.route.at(-1)), null);
  assert.equal(baseColor(secondMesh), original);
});
