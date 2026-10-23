import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import * as THREE from "../../projects/forest/vendor/three.module.js";
import { GLTFLoader } from "../../projects/forest/vendor/GLTFLoader.js";
import {
  RiggedAvatar,
  repairMirroredWinding,
} from "../../projects/chess/src/RiggedAvatar.mjs";
import {
  ChessBoard,
  squarePosition,
  squareName,
} from "../../projects/chess/src/ChessBoard.mjs";
import { OpponentAnimator } from "../../projects/chess/src/OpponentAnimator.mjs";
import { Chess } from "../../projects/chess/vendor/chess/chess.mjs";
const bytes = await readFile(
  new URL("../../projects/chess/assets/opponent/manlp.glb", import.meta.url),
);
async function fixture() {
  const root = new THREE.Group();
  root.position.set(0.12, -0.35, -0.65);
  root.rotation.y = 0.8;
  const gltf = await new GLTFLoader().parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    "",
  );
  const avatar = new RiggedAvatar(root, gltf.scene);
  return { root, avatar };
}
test("actual Blender skeleton reaches all squares and carry heights with fixed arm lengths", async () => {
  const { root, avatar } = await fixture();
  let skins = 0;
  avatar.model.traverse((o) => {
    if (o.isSkinnedMesh) skins++;
  });
  assert.equal(skins, 24);
  for (let i = 0; i < 64; i++)
    for (const y of [0.04, 0.12, 0.23, 0.38]) {
      const point = squarePosition(squareName(i));
      point.y = y;
      root.updateMatrixWorld(true);
      const target = root.localToWorld(point);
      avatar.selectArm(avatar.closestArm(target));
      const error = avatar.setHandTarget(target);
      assert.ok(error < 0.001, `${squareName(i)} height=${y} error=${error}`);
      for (const arm of avatar.arms) {
        const shoulder = arm.upper.getWorldPosition(new THREE.Vector3()),
          elbow = arm.lower.getWorldPosition(new THREE.Vector3()),
          wrist = arm.hand.getWorldPosition(new THREE.Vector3());
        assert.ok(
          Math.abs(shoulder.distanceTo(elbow) - arm.upperLength) < 1e-6,
        );
        assert.ok(Math.abs(elbow.distanceTo(wrist) - arm.lowerLength) < 1e-6);
        assert.ok(
          arm.upper.scale.distanceTo(new THREE.Vector3(1, 1, 1)) < 1e-6,
        );
      }
    }
  avatar.reset();
  assert.equal(avatar.lean, 0);
  for (const arm of avatar.arms)
    assert.ok(
      avatar.localPosition(arm.hand).distanceTo(arm.wristRest) < 0.001,
      "relaxed wrists return to their original resting positions",
    );
  assert.equal(avatar.face, undefined);
});
for (const flipped of [false, true])
  test(`rigged capture and castling work on ${flipped ? "Black" : "White"}-facing board`, async () => {
    for (const [fen, request] of [
      ["4k3/8/8/8/8/4p3/3P4/4K3 b - - 0 1", "exd2+"],
      ["r3k2r/8/8/8/8/8/8/R3K2R b KQkq - 0 1", "O-O-O"],
    ]) {
      const { root, avatar } = await fixture(),
        board = new ChessBoard(root),
        game = new Chess(fen);
      board.sync(game);
      board.setPlayerColor(flipped ? "b" : "w");
      const opponent = new OpponentAnimator(board, avatar),
        move = new Chess(fen).move(request);
      let done = false,
        error,
        carried = false;
      opponent.movePiece(move).then(
        () => (done = true),
        (e) => {
          error = e;
          done = true;
        },
      );
      for (let i = 0; i < 1800 && !done; i++) {
        board.update(1 / 72);
        opponent.update(1 / 72);
        avatar.update(1 / 72);
        root.updateMatrixWorld(true);
        const piece = board.pieces.get(move.from);
        if (piece?.parent === avatar.attachment) {
          carried = true;
          assert.ok(
            piece
              .getWorldScale(new THREE.Vector3())
              .distanceTo(new THREE.Vector3(1, 1, 1)) < 1e-6,
          );
        }
        await Promise.resolve();
      }
      if (error) throw error;
      assert.ok(done);
      assert.ok(carried);
      assert.equal(opponent.state, "rest");
      assert.equal(avatar.lean, 0);
      assert.ok(
        board.pieces.get(move.to).position.distanceTo(squarePosition(move.to)) <
          1e-9,
      );
    }
  });

test("skin vertices follow the armature and restart cancels carried pieces safely", async () => {
  const { root, avatar } = await fixture();
  let mesh;
  avatar.model.traverse((o) => {
    if (o.isSkinnedMesh && o.name.includes("arm_lower") && !mesh) mesh = o;
  });
  const point = () => {
    root.updateMatrixWorld(true);
    mesh.skeleton.update();
    return mesh
      .getVertexPosition(0, new THREE.Vector3())
      .applyMatrix4(mesh.matrixWorld);
  };
  const before = point();
  avatar.selectArm(1);
  avatar.setHandTarget(root.localToWorld(new THREE.Vector3(0.18, 0.1, 0.18)));
  const moved = point();
  assert.ok(
    moved.distanceTo(before) > 0.03,
    "skinned vertices really deform with bones",
  );
  avatar.reset();
  assert.ok(point().distanceTo(before) < 1e-5);
  const board = new ChessBoard(root),
    game = new Chess();
  game.move("e4");
  board.sync(game);
  const opponent = new OpponentAnimator(board, avatar),
    move = new Chess(game.fen()).move("e5");
  const pending = opponent.movePiece(move);
  for (let i = 0; i < 300 && opponent.state !== "carry"; i++) {
    board.update(1 / 72);
    opponent.update(1 / 72);
    await Promise.resolve();
  }
  assert.equal(opponent.state, "carry");
  opponent.cancel();
  board.sync(game);
  await pending;
  assert.equal(board.pieces.size, 32);
  assert.equal(avatar.lean, 0);
  for (const arm of avatar.arms)
    assert.equal(arm.attachment.children.length, 0);
});

test("mirrored right arm triangles face outward and remain opaque", async () => {
  const { avatar } = await fixture();
  const right = [];
  avatar.model.traverse((object) => {
    if (!object.isSkinnedMesh) return;
    assert.equal(object.material.transparent, false);
    assert.equal(object.material.opacity, 1);
    assert.equal(
      repairMirroredWinding(object.geometry),
      0,
      "winding repair is idempotent",
    );
    if (/GEO-(arm_upper|arm_lower|hand)_.*R/.test(object.name))
      right.push(object);
  });
  assert.equal(right.length, 3);
  for (const mesh of right)
    assert.ok(mesh.userData.repairedWinding > 0, mesh.name);
});

for (const index of [0, 1])
  test(`hand ${index} pinches at fingertips rather than wrist`, async () => {
    const { root, avatar } = await fixture();
    const board = new ChessBoard(root);
    board.sync(new Chess());
    const piece = board.pieces.get("e7");
    avatar.prepareGrip(piece);
    avatar.selectArm(index);
    const target = root.localToWorld(
      new THREE.Vector3(index === 0 ? -0.12 : 0.12, 0.08, 0),
    );
    assert.ok(avatar.setHandTarget(target) < 0.001);
    avatar.setPinch(1);
    root.updateMatrixWorld(true);
    const arm = avatar.arms[index];
    const tips = arm.fingers
      .slice(0, 2)
      .map((f) =>
        f.joints
          .at(-1)
          .bone.localToWorld(new THREE.Vector3(0, f.joints.at(-1).length, 0)),
      );
    const middle = tips[0].clone().add(tips[1]).multiplyScalar(0.5);
    const expectedContact = arm.hand.localToWorld(
      arm.pinchCenter.clone().addScaledVector(arm.pinchDirection, -arm.gap / 2),
    );
    assert.ok(
      tips[0].distanceTo(tips[1]) < 0.022,
      "index reaches near the thumb, slightly lower",
    );
    assert.ok(
      tips[0].distanceTo(expectedContact) < 1e-5,
      "thumb retains its original side contact",
    );
    const wristRoot = avatar.localPosition(arm.hand),
      contactRoot = avatar.localPosition(arm.attachment);
    const handForward = new THREE.Vector3(0, 1, 0).applyQuaternion(arm.gripQ);
    const forearm = arm.pose.hand.clone().sub(arm.pose.elbow).normalize();
    const palm = arm.palmNormal.clone().applyQuaternion(arm.gripQ);
    assert.ok(palm.y < -0.85, "anatomical palm faces down toward board");
    assert.ok(
      handForward.angleTo(forearm) < 0.35,
      "hand stays nearly straight with forearm",
    );
    assert.ok(
      contactRoot.clone().sub(wristRoot).dot(handForward) > 0.07,
      "pinch is in front of the hand",
    );
    const knuckles = arm.fingers
      .slice(0, 2)
      .map((f) => avatar.localPosition(f.bone));
    const knuckleMidpoint = knuckles[0]
      .clone()
      .add(knuckles[1])
      .multiplyScalar(0.5);
    assert.ok(
      contactRoot.clone().sub(knuckleMidpoint).dot(handForward) > 0.005,
      "pinch is slightly in front of the thumb/index knuckles",
    );
    assert.ok(
      contactRoot.y < knuckleMidpoint.y - 0.015,
      "pinch stays below the knuckles for overhead pickup",
    );
    const wristWorld = arm.hand.getWorldPosition(new THREE.Vector3());
    for (const finger of arm.fingers.slice(2)) {
      const base = finger.bone.getWorldPosition(new THREE.Vector3());
      assert.equal(finger.joints.length, 3);
      const last = finger.joints.at(-1);
      const tip = last.bone.localToWorld(new THREE.Vector3(0, last.length, 0));
      assert.ok(
        tip.distanceTo(wristWorld) < base.distanceTo(wristWorld),
        "curled tip rests toward palm",
      );
      for (const joint of finger.joints) {
        assert.ok(
          joint.bone.quaternion.angleTo(joint.restQ) > 0.05,
          "all phalanges participate in curl",
        );
        assert.ok(
          joint.bone.scale.distanceTo(new THREE.Vector3(1, 1, 1)) < 1e-6,
        );
      }
    }
    for (let i = 0; i < 2; i++)
      assert.ok(
        arm.fingers[i].bone.getWorldPosition(new THREE.Vector3()).y > tips[i].y,
        "pinch fingers reach down",
      );
    assert.ok(tips[0].distanceTo(tips[1]) < 0.022);
    assert.ok(
      arm.hand.getWorldPosition(new THREE.Vector3()).distanceTo(middle) > 0.05,
    );
    for (const finger of arm.fingers)
      assert.ok(finger.bone.quaternion.angleTo(finger.restQ) > 0.1);
    avatar.setPinch(0);
    for (const finger of arm.fingers)
      for (const joint of finger.joints)
        assert.ok(joint.bone.quaternion.angleTo(joint.restQ) < 1e-6);
  });
test("pinch closes before pickup and opens after piece is placed", async () => {
  const { root, avatar } = await fixture(),
    board = new ChessBoard(root),
    game = new Chess();
  game.move("e4");
  board.sync(game);
  const move = new Chess(game.fen()).move("e5"),
    piece = board.pieces.get("e7");
  const opponent = new OpponentAnimator(board, avatar);
  let done = false,
    sawPinch = false,
    sawRelease = false,
    carried = false,
    error;
  opponent.movePiece(move).then(
    () => (done = true),
    (e) => {
      error = e;
      done = true;
    },
  );
  for (let i = 0; i < 1000 && !done; i++) {
    board.update(1 / 72);
    opponent.update(1 / 72);
    const arm = avatar.arms[avatar.activeArm];
    if (opponent.state === "pinch") {
      sawPinch = true;
      assert.equal(piece.parent, board.root);
    }
    if (opponent.state === "carry") {
      carried = true;
      assert.equal(arm.pinch, 1);
      assert.equal(piece.parent, avatar.attachment);
    }
    if (opponent.state === "release") {
      sawRelease = true;
      assert.equal(piece.parent, board.root);
      assert.ok(piece.position.distanceTo(squarePosition("e5")) < 1e-9);
    }
    await Promise.resolve();
  }
  if (error) throw error;
  assert.ok(done && sawPinch && sawRelease && carried);
  for (const arm of avatar.arms) assert.equal(arm.pinch, 0);
});

test("finger phalanges have skin weights and deform the original mesh", async () => {
  const { root, avatar } = await fixture();
  for (const arm of avatar.arms) {
    for (const finger of arm.fingers) {
      assert.equal(
        finger.joints.length,
        finger.bone.name.startsWith("thumb") ? 2 : 3,
      );
      for (const joint of finger.joints) {
        let weighted = false;
        avatar.model.traverse((mesh) => {
          if (!mesh.isSkinnedMesh) return;
          const index = mesh.skeleton.bones.indexOf(joint.bone);
          const ids = mesh.geometry.attributes.skinIndex,
            weights = mesh.geometry.attributes.skinWeight;
          for (let i = 0; i < ids.count; i++)
            for (let c = 0; c < 4; c++)
              if (
                ids.getComponent(i, c) === index &&
                weights.getComponent(i, c) > 0.1
              )
                weighted = true;
        });
        assert.ok(weighted, joint.bone.name + " influences mesh vertices");
      }
    }
  }
  let mesh;
  avatar.model.traverse((o) => {
    if (o.isSkinnedMesh && o.name.includes("finger_middle")) mesh = o;
  });
  const points = () => {
    root.updateMatrixWorld(true);
    mesh.skeleton.update();
    return Array.from(
      { length: mesh.geometry.attributes.position.count },
      (_, i) => mesh.getVertexPosition(i, new THREE.Vector3()),
    );
  };
  const before = points();
  for (const i of [0, 1]) {
    avatar.selectArm(i);
    avatar.setPinch(1);
  }
  assert.ok(points().some((p, i) => p.distanceTo(before[i]) > 0.01));
  avatar.reset();
  assert.ok(points().every((p, i) => p.distanceTo(before[i]) < 1e-5));
});

test("index extends straight from hand before bending down across piece widths", async () => {
  const { root, avatar } = await fixture();
  for (const armIndex of [0, 1])
    for (const gap of [0.008, 0.014, 0.025]) {
      const arm = avatar.arms[armIndex];
      avatar.configurePinch(arm, gap);
      avatar.selectArm(armIndex);
      avatar.setHandTarget(
        root.localToWorld(new THREE.Vector3(arm.side * 0.12, 0.08, 0)),
      );
      avatar.setPinch(1);
      const proximal = arm.fingers[1].bone;
      const direction = new THREE.Vector3(0, 1, 0).applyQuaternion(
        proximal.quaternion,
      );
      assert.ok(
        direction.distanceTo(new THREE.Vector3(0, 1, 0)) < 1e-6,
        "first index bone aligns with hand without lateral bend",
      );
      const indexBase = arm.fingers[1].bone.position;
      for (const joint of arm.fingers[1].joints.slice(1)) {
        const position = arm.hand.worldToLocal(
          joint.bone.getWorldPosition(new THREE.Vector3()),
        );
        assert.ok(
          position.y > indexBase.y + 0.008,
          "index knuckles extend forward rather than folding into palm",
        );
      }
      const tips = arm.fingers.slice(0, 2).map((f) => {
        const last = f.joints.at(-1);
        return last.bone.localToWorld(new THREE.Vector3(0, last.length, 0));
      });
      assert.ok(tips[0].distanceTo(tips[1]) < 0.022);
      const thumbLocal = arm.hand.worldToLocal(tips[0].clone());
      const indexLocal = arm.hand.worldToLocal(tips[1].clone());
      assert.ok(
        indexLocal.sub(thumbLocal).dot(arm.palmNormal) > 0.002,
        "index contact is lowered toward the board",
      );
      avatar.reset();
    }
});

test("alternating moves begin with the selected hand without lifting the resting previous hand", async () => {
  const { root, avatar } = await fixture();
  const board = new ChessBoard(root);
  board.sync(new Chess());
  const opponent = new OpponentAnimator(board, avatar);
  const originalTarget = avatar.setHandTarget.bind(avatar);
  let movedArms = [];
  avatar.setHandTarget = (p) => {
    movedArms.push(avatar.activeArm);
    return originalTarget(p);
  };
  for (const [from, to] of [
    ["a7", "a6"],
    ["h7", "h6"],
    ["a6", "a5"],
  ]) {
    root.updateMatrixWorld(true);
    const source = root.localToWorld(squarePosition(from));
    const expected = avatar.closestArm(source);
    movedArms = [];
    let done = false;
    const pending = opponent.movePiece({ from, to, flags: "n" }).then(() => {
      done = true;
    });
    for (let i = 0; i < 700 && !done; i++) {
      board.update(1 / 72);
      opponent.update(1 / 72);
      await Promise.resolve();
    }
    await pending;
    assert.equal(opponent.state, "rest");
    assert.ok(movedArms.length > 0);
    assert.ok(
      movedArms.every((index) => index === expected),
      "only the hand closest to this piece receives movement targets",
    );
  }
});
