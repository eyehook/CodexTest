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
  assert.equal(skins, 34);
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

test("HeadLP face assembly replaces the original head and follows its bone", async () => {
  const { root, avatar } = await fixture();
  const eyes = [];
  avatar.model.traverse((o) => {
    if (o.name.startsWith("GEO-eye_")) eyes.push(o);
  });
  assert.equal(eyes.length, 2);
  const parts = [];
  avatar.model.traverse((o) => {
    if (
      /^GEO-(head|ear|eye|eyelid_lower|eyelid_upper|nose|nose_bridge)_/.test(
        o.name,
      )
    )
      parts.push(o);
  });
  assert.equal(parts.length, 11);
  assert.ok(parts.some((o) => o.name.startsWith("GEO-nose_")));
  assert.ok(parts.some((o) => o.name.startsWith("GEO-eyelid_upper_")));
  assert.ok(!avatar.model.getObjectByName("Opponent_eye_L"));
  for (const part of parts) {
    part.geometry.computeBoundingBox();
    const center = part.geometry.boundingBox.getCenter(new THREE.Vector3());
    assert.ok(center.y < 1.0, "head is fitted to the existing body height");
  }

  for (const eye of eyes) {
    assert.ok(eye.isSkinnedMesh);
    assert.ok(eye.geometry.index.count / 3 <= 400);
    assert.equal(
      eye.material,
      parts.find((o) => o.name.startsWith("GEO-head_")).material,
      "eyes share the face material",
    );
    const idx = eye.skeleton.bones.indexOf(avatar.bones.head);
    const weights = eye.geometry.attributes.skinWeight,
      indices = eye.geometry.attributes.skinIndex;
    for (let i = 0; i < weights.count; i++) {
      assert.equal(indices.getX(i), idx);
      assert.equal(weights.getX(i), 1);
    }
  }
});

test("head follows world-space piece targets smoothly while the torso leans", async () => {
  const { root, avatar } = await fixture();
  const faceForward = new THREE.Vector3(0, 0, 1).applyQuaternion(
    avatar.headModelRest.clone().invert(),
  );
  for (const lean of [0, 0.6])
    for (const x of [-0.22, 0.22]) {
      avatar.reset();
      avatar.setPosture(lean);
      const target = root.localToWorld(new THREE.Vector3(x, 0.15, 0.1));
      avatar.setLookTarget(target);
      const before = avatar.head.quaternion.clone();
      avatar.update(1 / 72);
      assert.ok(avatar.head.quaternion.angleTo(before) > 0.001);
      assert.ok(
        avatar.head.quaternion.angleTo(before) < 0.2,
        "no abrupt head snap",
      );
      for (let i = 0; i < 120; i++) avatar.update(1 / 72);
      const facing = faceForward
        .clone()
        .applyQuaternion(
          avatar.head.getWorldQuaternion(new THREE.Quaternion()),
        );
      const direction = target
        .clone()
        .sub(avatar.head.getWorldPosition(new THREE.Vector3()))
        .normalize();
      assert.ok(
        facing.angleTo(direction) < 0.03,
        "face points toward piece in rotated table frame",
      );
      avatar.setLookTarget(null);
      for (let i = 0; i < 120; i++) avatar.update(1 / 72);
      assert.ok(avatar.head.quaternion.angleTo(avatar.headRest) < 1e-5);
    }
  avatar.setLookTarget(root.localToWorld(new THREE.Vector3(0, 0, 0)));
  avatar.update(0.1);
  avatar.reset();
  assert.equal(avatar.lookTarget, null);
  assert.ok(avatar.head.quaternion.angleTo(avatar.headRest) < 1e-6);
});

test("move gaze tracks the piece through pickup and carry and clears on return/cancel", async () => {
  const { root, avatar } = await fixture();
  const board = new ChessBoard(root);
  board.sync(new Chess());
  const opponent = new OpponentAnimator(board, avatar);
  const piece = board.pieces.get("a7");
  const pending = opponent.movePiece({ from: "a7", to: "a6", flags: "n" });
  let sawCarry = false,
    sawReturn = false;
  for (let i = 0; i < 500 && opponent.state !== "rest"; i++) {
    board.update(1 / 72);
    opponent.update(1 / 72);
    avatar.update(1 / 72);
    if (opponent.state === "carry") {
      sawCarry = true;
      const expected = piece.localToWorld(
        piece.geometry.boundingBox.getCenter(new THREE.Vector3()),
      );
      assert.ok(avatar.lookTarget.distanceTo(expected) < 1e-6);
    }
    if (opponent.state === "return") {
      sawReturn = true;
      assert.equal(avatar.lookTarget, null);
    }
    await Promise.resolve();
  }
  await pending;
  assert.ok(sawCarry && sawReturn);
  const cancelled = opponent.movePiece({ from: "h7", to: "h6", flags: "n" });
  opponent.update(1 / 72);
  avatar.update(1 / 72);
  opponent.cancel();
  await cancelled;
  assert.equal(opponent.lookPiece, null);
  assert.equal(avatar.lookTarget, null);
  assert.ok(avatar.head.quaternion.angleTo(avatar.headRest) < 1e-6);
});

test("neck blends from chest to head and its collar stays anchored during head turns", async () => {
  const { root, avatar } = await fixture();
  let neck;
  avatar.model.traverse((o) => {
    if (o.name.startsWith("GEO-neck_")) neck = o;
  });
  const rest = neck.geometry.attributes.position;
  const upper = [], collar = [];
  for (let i = 0; i < rest.count; i++) {
    if (rest.getY(i) > 0.72) upper.push(Math.abs(rest.getX(i)));
    if (rest.getY(i) < 0.64) collar.push(Math.abs(rest.getX(i)));
  }
  assert.ok(upper.length && Math.max(...upper) < 0.05, "upper neck no longer flares under ears");
  assert.ok(Math.max(...collar) > 0.1, "broad lower collar is preserved");
  const chest = neck.skeleton.bones.indexOf(avatar.bones.chest),
    head = neck.skeleton.bones.indexOf(avatar.bones.head);
  const weights = neck.geometry.attributes.skinWeight,
    ids = neck.geometry.attributes.skinIndex;
  const groups = { bottom: [], top: [], blend: [] };
  for (let i = 0; i < weights.count; i++) {
    let cw = 0,
      hw = 0,
      total = 0;
    for (let j = 0; j < 4; j++) {
      const w = weights.getComponent(i, j),
        id = ids.getComponent(i, j);
      total += w;
      if (id === chest) cw += w;
      if (id === head) hw += w;
    }
    assert.ok(Math.abs(total - 1) < 1e-6);
    assert.ok(Math.abs(cw + hw - 1) < 1e-6);
    if (cw > 0.999) groups.bottom.push(i);
    else if (hw > 0.999) groups.top.push(i);
    else groups.blend.push(i);
  }
  for (const group of Object.values(groups)) assert.ok(group.length > 0);
  const points = () => {
    root.updateMatrixWorld(true);
    neck.skeleton.update();
    return Array.from({ length: weights.count }, (_, i) =>
      neck
        .getVertexPosition(i, new THREE.Vector3())
        .applyMatrix4(neck.matrixWorld),
    );
  };
  for (const lean of [0, 0.6, 1]) {
    avatar.reset();
    avatar.setPosture(lean);
    const before = points();
    avatar.setLookTarget(root.localToWorld(new THREE.Vector3(0.22, 0.08, 0.1)));
    for (let i = 0; i < 120; i++) avatar.update(1 / 72);
    const after = points();
    assert.ok(
      groups.bottom.every((i) => before[i].distanceTo(after[i]) < 1e-6),
      "collar follows chest without being pulled by head",
    );
    assert.ok(
      groups.top.some((i) => before[i].distanceTo(after[i]) > 0.005),
      "upper neck follows head",
    );
    assert.ok(after.every((p) => p.toArray().every(Number.isFinite)));
  }
  avatar.reset();
});

test("opponent smoothly watches player-held pieces on either board orientation without moving arms", async () => {
  for (const color of ["w", "b"]) {
    const { root, avatar } = await fixture();
    const board = new ChessBoard(root);
    board.sync(new Chess());
    board.setPlayerColor(color);
    const opponent = new OpponentAnimator(board, avatar),
      piece = board.pieces.get(color === "w" ? "e2" : "e7");
    const wrists = avatar.arms.map((arm) =>
      arm.hand.getWorldPosition(new THREE.Vector3()),
    );
    for (const x of [-0.2, 0.2]) {
      piece.position.set(x, 0.12, 0);
      opponent.update(1 / 72, piece);
      const expected = piece.localToWorld(
        piece.geometry.boundingBox.getCenter(new THREE.Vector3()),
      );
      assert.ok(avatar.lookTarget.distanceTo(expected) < 1e-6);
      const before = avatar.head.quaternion.clone();
      avatar.update(1 / 72);
      assert.ok(
        avatar.head.quaternion.angleTo(before) < 0.2,
        "gaze change is smoothed",
      );
      for (let i = 0; i < 80; i++) {
        opponent.update(1 / 72, piece);
        avatar.update(1 / 72);
      }
    }
    avatar.arms.forEach((arm, i) =>
      assert.ok(
        arm.hand.getWorldPosition(new THREE.Vector3()).distanceTo(wrists[i]) <
          1e-6,
      ),
    );
    opponent.update(1 / 72, null);
    assert.equal(avatar.lookTarget, null);
    for (let i = 0; i < 120; i++) avatar.update(1 / 72);
    assert.ok(avatar.head.quaternion.angleTo(avatar.headRest) < 1e-5);
  }
});

test("separate wire glasses retain metal material, open rims and rigid head attachment", async () => {
  const { root, avatar } = await fixture();
  const glasses = avatar.model.getObjectByName("GEO-wire_rim_glasses");
  assert.ok(glasses?.isSkinnedMesh);
  assert.equal(glasses.material.name, "Wire rim brushed silver");
  assert.ok(glasses.material.metalness > 0.6);
  assert.equal(glasses.material.transparent, false);
  assert.ok(glasses.geometry.index.count / 3 < 4000);
  const head = glasses.skeleton.bones.indexOf(avatar.head);
  const weights = glasses.geometry.attributes.skinWeight, ids = glasses.geometry.attributes.skinIndex;
  for (let i = 0; i < weights.count; i++) {
    assert.equal(ids.getX(i), head);
    assert.equal(weights.getX(i), 1);
  }
  root.updateMatrixWorld(true); glasses.skeleton.update();
  for (const x of [-0.0315, 0.0315]) {
    const origin = avatar.model.localToWorld(new THREE.Vector3(x, 0.7814, 0.25));
    const direction = new THREE.Vector3(0, 0, -1).transformDirection(avatar.model.matrixWorld);
    const ray = new THREE.Raycaster(origin, direction);
    assert.equal(ray.intersectObject(glasses, false).length, 0, "open rim contains no lens surface");
  }
  const sample = () => {
    root.updateMatrixWorld(true); glasses.skeleton.update();
    return [0, 512, weights.count - 1].map((i) => {
      const world = glasses.getVertexPosition(i, new THREE.Vector3()).applyMatrix4(glasses.matrixWorld);
      return { world, local: avatar.head.worldToLocal(world.clone()) };
    });
  };
  const before = sample();
  avatar.setLookTarget(root.localToWorld(new THREE.Vector3(0.22, 0.08, 0.1)));
  for (let i = 0; i < 120; i++) avatar.update(1 / 72);
  const after = sample();
  assert.ok(after.some((p, i) => p.world.distanceTo(before[i].world) > 0.005));
  assert.ok(after.every((p, i) => p.local.distanceTo(before[i].local) < 1e-5));
  avatar.reset();
  assert.ok(sample().every((p, i) => p.world.distanceTo(before[i].world) < 1e-5));
});

test("separate handlebar mustache sits below the actual nose and follows the head rigidly", async () => {
  const { root, avatar } = await fixture();
  const mustache = avatar.model.getObjectByName("mustache");
  assert.ok(mustache?.isSkinnedMesh);
  assert.ok(avatar.model.getObjectByName("GEO-wire_rim_glasses"));
  assert.equal(mustache.material.name, "Mustache dark brown hair");
  assert.equal(mustache.material.transparent, false);
  assert.ok(mustache.material.roughness >= 0.8);
  assert.ok(mustache.geometry.index.count / 3 < 3000);
  const weights = mustache.geometry.attributes.skinWeight, ids = mustache.geometry.attributes.skinIndex;
  const head = mustache.skeleton.bones.indexOf(avatar.head);
  for (let i = 0; i < weights.count; i++) {
    assert.equal(ids.getX(i), head); assert.equal(weights.getX(i), 1);
  }
  root.updateMatrixWorld(true); mustache.skeleton.update();
  const positions = Array.from({ length: weights.count }, (_, i) =>
    avatar.model.worldToLocal(mustache.getVertexPosition(i, new THREE.Vector3()).applyMatrix4(mustache.matrixWorld)));
  const body = positions.filter((p) => Math.abs(p.x) < 0.025);
  assert.ok(body.length > 0);
  assert.ok(Math.max(...body.map((p) => p.y)) < 0.745, "body must anchor below the nose, not the nose bridge");
  assert.ok(Math.min(...positions.map((p) => p.x)) < -0.06);
  assert.ok(Math.max(...positions.map((p) => p.x)) > 0.06);
  const sample = () => {
    root.updateMatrixWorld(true); mustache.skeleton.update();
    return [0, 600, weights.count - 1].map((i) => {
      const world = mustache.getVertexPosition(i, new THREE.Vector3()).applyMatrix4(mustache.matrixWorld);
      return { world, local: avatar.head.worldToLocal(world.clone()) };
    });
  };
  const before = sample();
  avatar.setLookTarget(root.localToWorld(new THREE.Vector3(-0.22, 0.08, 0.1)));
  for (let i = 0; i < 120; i++) avatar.update(1 / 72);
  const after = sample();
  assert.ok(after.some((p, i) => p.world.distanceTo(before[i].world) > 0.005));
  assert.ok(after.every((p, i) => p.local.distanceTo(before[i].local) < 1e-5));
  avatar.reset(); assert.ok(sample().every((p, i) => p.world.distanceTo(before[i].world) < 1e-5));
});


test("gaze stays on the board between player release and opponent pickup", async () => {
  const { root, avatar } = await fixture();
  const board = new ChessBoard(root);
  board.sync(new Chess());
  const opponent = new OpponentAnimator(board, avatar);
  const playerPiece = board.pieces.get("e2");
  opponent.update(1 / 72, playerPiece);
  const releasedTarget = avatar.lookTarget.clone();
  for (let i = 0; i < 36; i++) {
    opponent.update(1 / 72, null, true);
    avatar.update(1 / 72);
    assert.ok(avatar.lookTarget.distanceTo(releasedTarget) < 1e-6);
    assert.equal(opponent.state, "rest");
  }
  const pending = opponent.movePiece({ from: "a7", to: "a6", flags: "n" });
  opponent.update(1 / 72, null, true);
  const piece = board.pieces.get("a7");
  assert.ok(avatar.lookTarget.distanceTo(piece.localToWorld(
    piece.geometry.boundingBox.getCenter(new THREE.Vector3()),
  )) < 1e-6, "own moving piece takes gaze priority");
  opponent.cancel();
  await pending;
  assert.equal(avatar.lookTarget, null);
  assert.equal(opponent.boardLookTarget, null);
  opponent.update(1 / 72, null, true);
  assert.ok(avatar.lookTarget.distanceTo(root.localToWorld(new THREE.Vector3())) < 1e-6,
    "initial computer turn watches board without a previous held piece");
  opponent.update(1 / 72);
  assert.equal(avatar.lookTarget, null);
});

test("player-turn idle gaze alternates slowly between player and different board pieces", async () => {
  for (const color of ["w", "b"]) {
    const { root, avatar } = await fixture();
    const board = new ChessBoard(root);
    board.sync(new Chess());
    board.setPlayerColor(color);
    const opponent = new OpponentAnimator(board, avatar, { random: () => 0.5 });
    const wrists = avatar.arms.map((arm) => arm.hand.getWorldPosition(new THREE.Vector3()));
    const changes = [];
    let previousTarget, previousChange = 0, maxTurn = 0;
    for (let frame = 0; frame < 72 * 23; frame++) {
      const before = avatar.head.quaternion.clone();
      opponent.update(1 / 72, null, false, true);
      avatar.update(1 / 72);
      maxTurn = Math.max(maxTurn, before.angleTo(avatar.head.quaternion));
      assert.equal(avatar.gazeResponse, 1.5);
      const target = opponent.idleGaze.piece;
      if (frame === 0 || target !== previousTarget) {
        if (frame > 0) assert.ok(Math.abs((frame - previousChange) / 72 - 4.5) < 0.03);
        changes.push(target);
        previousTarget = target;
        previousChange = frame;
      }
      if (target) {
        assert.ok(avatar.lookTarget.distanceTo(target.localToWorld(
          target.geometry.boundingBox.getCenter(new THREE.Vector3()),
        )) < 1e-6);
      } else assert.equal(avatar.lookTarget, null);
    }
    assert.equal(changes.length, 6);
    assert.equal(changes[0], null);
    assert.ok(changes[1] && changes[3] && changes[5]);
    assert.equal(changes[2], null);
    assert.equal(changes[4], null);
    assert.notEqual(changes[1], changes[3]);
    assert.notEqual(changes[3], changes[5]);
    assert.ok(maxTurn > 0.001 && maxTurn < 0.04, "slow head motion without a snap");
    avatar.arms.forEach((arm, i) => assert.ok(
      arm.hand.getWorldPosition(new THREE.Vector3()).distanceTo(wrists[i]) < 1e-6,
    ));
    const remaining = opponent.idleGaze.remaining;
    for (let i = 0; i < 100; i++) opponent.update(0, null, false, true);
    assert.equal(opponent.idleGaze.remaining, remaining, "paused time does not advance idle gaze");
    const held = board.pieces.get(color === "w" ? "e2" : "e7");
    opponent.update(1 / 72, held, false, true);
    assert.equal(opponent.idleGaze, null);
    assert.equal(avatar.gazeResponse, 10, "held pieces retain responsive tracking");
    const heldTarget = avatar.lookTarget.clone();
    opponent.update(1 / 72, null, true);
    assert.ok(avatar.lookTarget.distanceTo(heldTarget) < 1e-6, "thinking retains held-piece gaze");
    opponent.update(1 / 72);
    assert.equal(avatar.lookTarget, null, "outside player turn idle gaze stops");
    opponent.update(1 / 72, null, false, true);
    opponent.cancel();
    assert.equal(opponent.idleGaze, null);
    assert.equal(opponent.lastIdlePiece, null);
    assert.equal(avatar.lookTarget, null);
  }
});

test("idle dwell randomizes from three to six seconds and tolerates an empty board", async () => {
  const { root, avatar } = await fixture();
  const board = new ChessBoard(root);
  for (const random of [() => 0, () => 0.999]) {
    const opponent = new OpponentAnimator(board, avatar, { random });
    opponent.update(0, null, false, true);
    assert.ok(opponent.idleGaze.remaining >= 3 && opponent.idleGaze.remaining < 6);
    const initial = opponent.idleGaze.remaining;
    for (let i = 0; i < Math.ceil(initial * 72) + 1; i++)
      opponent.update(1 / 72, null, false, true);
    assert.equal(avatar.lookTarget, null);
    assert.ok(opponent.idleGaze.remaining > 2.9);
  }
});

test("player-facing idle gaze follows the live head position with smooth turns", async () => {
  for (const color of ["w", "b"]) {
    const { root, avatar } = await fixture();
    const board = new ChessBoard(root);
    board.sync(new Chess());
    board.setPlayerColor(color);
    const opponent = new OpponentAnimator(board, avatar, { random: () => 0.999 });
    const head = root.localToWorld(new THREE.Vector3(0, 0.65, 0.8));
    opponent.update(0, null, false, true, head);
    const initialDwell = opponent.idleGaze.remaining;
    const initialRotation = avatar.head.quaternion.clone();
    for (let i = 0; i < 144; i++) {
      head.x += 0.002;
      head.y += 0.0005;
      const before = avatar.head.quaternion.clone();
      opponent.update(1 / 72, null, false, true, head);
      avatar.update(1 / 72);
      assert.ok(avatar.lookTarget.distanceTo(head) < 1e-9, "uses current head position each frame");
      assert.ok(before.angleTo(avatar.head.quaternion) < 0.04, "head tracking remains smooth");
      assert.equal(opponent.idleGaze.piece, null);
    }
    assert.ok(initialRotation.angleTo(avatar.head.quaternion) > 0.1);
    assert.ok(Math.abs(opponent.idleGaze.remaining - (initialDwell - 2)) < 1e-8,
      "player movement does not reset the dwell");
    opponent.idleGaze.remaining = 0;
    opponent.update(0, null, false, true, head);
    const selected = opponent.idleGaze.piece;
    assert.ok(selected);
    head.addScalar(0.2);
    opponent.update(1 / 72, null, false, true, head);
    assert.ok(avatar.lookTarget.distanceTo(selected.localToWorld(
      selected.geometry.boundingBox.getCenter(new THREE.Vector3()),
    )) < 1e-9, "board glances remain on the selected piece despite head movement");
  }
});

test("random board glances can select every white and black piece on either orientation", async () => {
  const { root, avatar } = await fixture();
  const board = new ChessBoard(root);
  board.sync(new Chess());
  const pieces = [...board.pieces.values()];
  for (const color of ["w", "b"]) {
    board.setPlayerColor(color);
    const selectedColors = new Set();
    for (let index = 0; index < pieces.length; index++) {
      const opponent = new OpponentAnimator(board, avatar, {
        random: () => (index + 0.5) / pieces.length,
      });
      opponent.update(0, null, false, true);
      opponent.idleGaze.remaining = 0;
      opponent.update(0, null, false, true);
      assert.equal(opponent.idleGaze.piece, pieces[index]);
      selectedColors.add(opponent.idleGaze.piece.userData.color);
    }
    assert.deepEqual(selectedColors, new Set(["w", "b"]));
  }
});
