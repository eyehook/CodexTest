import { test } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "../../projects/forest/vendor/three.module.js";
import { solveArm } from "../../projects/chess/src/ArmIK.mjs";
import {
  squarePosition,
  squareName,
} from "../../projects/chess/src/ChessBoard.mjs";
import { ProceduralAvatar } from "../../projects/chess/src/ProceduralAvatar.mjs";
test("all 64 board squares reachable at pickup and elevated transport heights", () => {
  const root = new THREE.Group();
  root.position.set(0.12, -0.35, -0.65);
  root.rotation.y = 0.8;
  const avatar = new ProceduralAvatar(root);
  for (let i = 0; i < 64; i++)
    for (const height of [0.045, 0.12, 0.38]) {
      const p = squarePosition(squareName(i));
      p.y = height;
      root.updateMatrixWorld(true);
      const target = root.localToWorld(p);
      avatar.selectArm(avatar.closestArm(target));
      assert.ok(
        avatar.setHandTarget(target) < 0.001,
        `${squareName(i)} y=${height}`,
      );
    }
});
test("IK keeps segment lengths and stable pole side, clamps extremes", () => {
  const shoulder = new THREE.Vector3(0.16, 0.3, -0.43),
    pole = new THREE.Vector3(0.6, 0.5, -0.2);
  let previous = null;
  for (let i = 0; i <= 200; i++) {
    const target = new THREE.Vector3(-0.2 + i * 0.002, 0.1, 0.1);
    const p = solveArm(shoulder, target, { pole });
    assert.ok(Math.abs(p.shoulder.distanceTo(p.elbow) - 0.42) < 1e-10);
    assert.ok(Math.abs(p.elbow.distanceTo(p.hand) - 0.4) < 1e-10);
    if (previous) assert.ok(p.elbow.distanceTo(previous) < 0.01);
    previous = p.elbow;
  }
  assert.ok(solveArm(shoulder, new THREE.Vector3(99, 99, 99)).clamped);
  const zero = solveArm(shoulder, shoulder);
  assert.ok(Number.isFinite(zero.elbow.x));
  assert.ok(zero.clamped);
});

test("matching natural-length arms select closest hand and lean without stretching", () => {
  const root = new THREE.Group();
  root.position.set(0.2, -0.35, -0.7);
  root.rotation.y = 0.9;
  const avatar = new ProceduralAvatar(root);
  assert.equal(avatar.arms[0].upper.geometry, avatar.arms[1].upper.geometry);
  assert.equal(avatar.arms[0].lower.geometry, avatar.arms[1].lower.geometry);
  assert.equal(avatar.arms[0].hand.geometry, avatar.arms[1].hand.geometry);
  const target = (x, y, z) => {
    root.updateMatrixWorld(true);
    return root.localToWorld(new THREE.Vector3(x, y, z));
  };
  for (const side of [-1, 1]) {
    const near = target(side * 0.21, 0.06, -0.21);
    avatar.selectArm(avatar.closestArm(near));
    assert.equal(avatar.activeArm, side === -1 ? 0 : 1);
    avatar.setHandTarget(near);
    const nearLean = avatar.lean;
    for (let i = 0; i <= 100; i++) {
      const far = target(side * 0.21, 0.06, -0.21 + (0.42 * i) / 100);
      assert.ok(avatar.setHandTarget(far) < 0.001);
      for (const arm of avatar.arms) {
        assert.ok(
          Math.abs(arm.pose.shoulder.distanceTo(arm.pose.elbow) - 0.3) < 1e-9,
        );
        assert.ok(
          Math.abs(arm.pose.elbow.distanceTo(arm.pose.hand) - 0.28) < 1e-9,
        );
      }
    }
    assert.ok(avatar.lean > nearLean);
    assert.ok(avatar.body.rotation.x <= 0.5);
    avatar.reset();
    assert.equal(avatar.lean, 0);
  }
});
