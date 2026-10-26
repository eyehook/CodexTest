import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import * as THREE from "../../projects/forest/vendor/three.module.js";
import { GLTFLoader } from "../../projects/forest/vendor/GLTFLoader.js";
import { RiggedAvatar } from "../../projects/chess/src/RiggedAvatar.mjs";
const bytes = await readFile(new URL("../../projects/chess/assets/opponent/manlp.glb", import.meta.url));
async function fixture(random = () => 0.5) {
  const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), "");
  const root = new THREE.Group(); root.position.set(0.12, -0.35, -0.65); root.rotation.y = 0.8;
  const avatar = new RiggedAvatar(root, gltf.scene, { random });
  return { root, avatar, blink: avatar.blink };
}
test("all four original lids pivot at their matching eyeball centers, with upper-dominant closure", async () => {
  const { blink } = await fixture();
  assert.equal(blink.lids.length, 4);
  for (const lid of blink.lids) {
    lid.eye.geometry.computeBoundingBox();
    const center = lid.eye.geometry.boundingBox.getCenter(new THREE.Vector3()).applyMatrix4(lid.eye.matrixWorld);
    assert.ok(lid.mesh.localToWorld(lid.pivot.clone()).distanceTo(center) < 1e-6);
    const upper = lid.mesh.name.includes("eyelid_upper");
    assert.equal(lid.angle, upper ? 0.50 : -0.16);
    assert.deepEqual(lid.mesh.geometry.attributes.position.array, lid.restPositions);
  }
  blink.setClosure(1);
  for (const lid of blink.lids) {
    const position = lid.mesh.geometry.attributes.position;
    const q = new THREE.Quaternion().setFromAxisAngle(lid.axis, lid.angle);
    for (let i = 0; i < position.count; i++) {
      const original = new THREE.Vector3().fromArray(lid.restPositions, i * 3);
      const moved = new THREE.Vector3().fromBufferAttribute(position, i);
      assert.ok(Math.abs(original.distanceTo(lid.pivot) - moved.distanceTo(lid.pivot)) < 1e-6);
      assert.ok(original.sub(lid.pivot).applyQuaternion(q).add(lid.pivot).distanceTo(moved) < 1e-6);
    }
  }
});
test("full blink closes both visible eye openings instead of shrinking the eyes", async () => {
  const { root, avatar, blink } = await fixture();
  const eyes = [...new Set(blink.lids.map((lid) => lid.eye))];
  const visibleCenter = (eye) => {
    root.updateMatrixWorld(true);
    const lids = blink.lids.filter((lid) => lid.eye === eye).map((lid) => lid.mesh);
    for (const mesh of [eye, ...lids]) { mesh.skeleton.update(); mesh.boundingSphere = null; mesh.boundingBox = null; mesh.material.side = THREE.DoubleSide; }
    const center = eye.geometry.boundingBox.getCenter(new THREE.Vector3()).applyMatrix4(eye.matrixWorld);
    const forward = new THREE.Vector3(0, 0, 1).transformDirection(avatar.model.matrixWorld);
    const ray = new THREE.Raycaster(center.clone().addScaledVector(forward, 0.1), forward.negate());
    return ray.intersectObjects([eye, ...lids], false)[0]?.object;
  };
  for (const eye of eyes) assert.equal(visibleCenter(eye), eye);
  blink.setClosure(1);
  for (const eye of eyes) {
    assert.notEqual(visibleCenter(eye), eye);
    assert.deepEqual(eye.scale.toArray(), [1, 1, 1]);
  }
});
for (const hz of [30, 72, 120]) {
  test(`natural blink closes/reopens at ${hz} Hz and restores exact rest geometry`, async () => {
    const { blink } = await fixture(); let peak = 0, moved = false;
    for (let i = 0; i < hz * 6; i++) {
      blink.update(1 / hz); peak = Math.max(peak, blink.closure); moved ||= blink.closure > 0;
    }
    assert.ok(moved && peak > 0.98); assert.equal(blink.closure, 0);
    assert.ok(blink.wait > 0);
    for (const lid of blink.lids) {
      assert.deepEqual(lid.mesh.geometry.attributes.position.array, lid.restPositions);
      assert.deepEqual(lid.mesh.geometry.attributes.normal.array, lid.restNormals);
    }
  });
}
test("random intervals vary, paused updates stay still, long gaps cannot trigger catch-up bursts", async () => {
  let value = 0;
  const { blink } = await fixture(() => value);
  assert.equal(blink.wait, 2.5); value = 1;
  const before = blink.wait; blink.update(0); blink.update(NaN);
  assert.equal(blink.wait, before);
  blink.update(1000); assert.ok(Math.abs(blink.wait - (before - 0.05)) < 1e-9);
  for (let i = 0; i < 56; i++) blink.update(0.05);
  assert.equal(blink.closure, 0); assert.ok(blink.wait > 6.3 && blink.wait <= 6.5);
});
test("blink geometry remains attached during head gaze/lean, and avatar reset opens lids", async () => {
  const { root, avatar, blink } = await fixture();
  blink.setClosure(1);
  const lid = blink.lids[0];
  const sample = () => {
    root.updateMatrixWorld(true); lid.mesh.skeleton.update();
    const world = lid.mesh.getVertexPosition(0, new THREE.Vector3()).applyMatrix4(lid.mesh.matrixWorld);
    return { world, local: avatar.head.worldToLocal(world.clone()) };
  };
  const before = sample();
  avatar.setPosture(0.6);
  avatar.setLookTarget(root.localToWorld(new THREE.Vector3(0.22, 0.08, 0.1)));
  for (let i = 0; i < 120; i++) avatar.update(0); // Gaze paused with blink.
  avatar.head.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), 0.4));
  const after = sample();
  assert.ok(before.local.distanceTo(after.local) < 1e-5);
  assert.ok(before.world.distanceTo(after.world) > 0.005);
  avatar.reset(); assert.equal(blink.closure, 0);
  for (const item of blink.lids) assert.deepEqual(item.mesh.geometry.attributes.position.array, item.restPositions);
});
