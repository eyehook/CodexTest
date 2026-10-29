import { test } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "../../shared/vendor/three-r180/three.module.js";
import { OpponentFace } from "../../projects/chess/src/OpponentFace.mjs";
import { ProceduralAvatar } from "../../projects/chess/src/ProceduralAvatar.mjs";
test("head is a cube with eyes and mouth positioned on its front face", () => {
  const avatar = new ProceduralAvatar(new THREE.Group());
  assert.equal(avatar.head.geometry.type, "BoxGeometry");
  const { width, height, depth } = avatar.head.geometry.parameters;
  assert.equal(width, height);
  assert.equal(height, depth);
  for (const eye of avatar.face.eyes) assert.ok(eye.position.z > depth / 2);
  assert.ok(
    avatar.face.positions[2] > depth / 2 &&
      avatar.face.positions[2] < depth / 2 + 0.003,
  );
});
for (const rate of [30, 72, 120])
  test(`blinks close and reopen both eyes at ${rate} Hz with a neutral mouth`, () => {
    const face = new OpponentFace(new THREE.Group(), { random: () => 0 });
    let minimum = 1;
    for (let frame = 0; frame < rate * 3; frame++) {
      face.update(1 / rate);
      minimum = Math.min(minimum, face.eyeOpenness);
      assert.equal(face.eyes[0].scale.y, face.eyes[1].scale.y);
      assert.ok(face.eyeOpenness >= 0.04 && face.eyeOpenness <= 1);
    }
    assert.ok(minimum < 0.1);
    assert.equal(face.eyeOpenness, 1);
    assert.equal(face.amount, 0);
  });
test("successive intervals are randomized in range and expressions continue during blinks", () => {
  const values = [0, 1, 0.5];
  let index = 0;
  const face = new OpponentFace(new THREE.Group(), {
    random: () => values[index++ % values.length],
  });
  assert.equal(face.blinkWait, 2.5);
  face.setEvaluation({ type: "cp", value: 500 });
  for (let i = 0; i < 280; i++) face.update(0.01);
  assert.equal(index, 2);
  assert.ok(face.blinkWait > 6.3 && face.blinkWait <= 6.5);
  assert.ok(face.amount > 0.8);
  for (let i = 0; i < 660; i++) face.update(0.01);
  assert.equal(index, 3);
  assert.ok(face.blinkWait > 4.2 && face.blinkWait <= 4.5);
});
test("paused updates do not advance blink timing or create a catch-up burst", () => {
  const face = new OpponentFace(new THREE.Group(), { random: () => 0.5 }),
    wait = face.blinkWait;
  face.update(0);
  assert.equal(face.blinkWait, wait);
  face.update(60);
  assert.ok(Math.abs(face.blinkWait - (wait - 0.05)) < 1e-10);
  assert.equal(face.eyeOpenness, 1);
});
