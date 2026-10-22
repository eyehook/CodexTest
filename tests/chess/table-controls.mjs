import { test } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "../../projects/forest/vendor/three.module.js";
import { TableControls } from "../../projects/chess/src/TableControls.mjs";
test("tabletop buttons use finite physical contact after table translation and rotation", () => {
  const root = new THREE.Group();
  root.position.set(0.2, -0.3, -0.7);
  root.rotation.y = 0.8;
  const button = new THREE.Mesh(
    new THREE.PlaneGeometry(0.16, 0.065),
    new THREE.MeshBasicMaterial(),
  );
  button.rotation.x = -Math.PI / 2;
  button.position.set(0.34, -0.033, 0.345);
  root.add(button);
  root.updateMatrixWorld(true);
  const controls = { root, targets: [button] };
  const hit = (point) =>
    TableControls.prototype.touchTarget.call(
      controls,
      button.localToWorld(point),
    );
  assert.equal(hit(new THREE.Vector3(0, 0, 0.035)), button);
  assert.equal(hit(new THREE.Vector3(0, 0, 0.08)), null);
  assert.equal(hit(new THREE.Vector3(0.2, 0, 0.01)), null);
  root.visible = false;
  assert.equal(hit(new THREE.Vector3(0, 0, 0.01)), null);
});
