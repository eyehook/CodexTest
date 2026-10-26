import { test } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "../../projects/forest/vendor/three.module.js";
import { Chess } from "../../projects/chess/vendor/chess/chess.mjs";
import { ChessBoard } from "../../projects/chess/src/ChessBoard.mjs";
import { GameController } from "../../projects/chess/src/GameController.mjs";
import { UndoDialog } from "../../projects/chess/src/UndoDialog.mjs";
function fixture(fen, color = "w") {
  const world = new THREE.Group(), board = new ChessBoard(world);
  const engine = { ready: true, dispose() { throw Error("Undo must not kill the idle opponent engine"); } };
  const game = new GameController({ board, engine, opponent: { cancel() {} } });
  game.game = new Chess(fen); game.playerColor = color; game.phase = "player";
  board.setPlayerColor(color);
  const sync = () => { board.sync(game.game); game.notify(game.status()); };
  const play = (...moves) => { moves.forEach((move) => game.game.move(move)); sync(); };
  sync(); return { world, board, game, play };
}
test("undo removes player's last move and opponent reply, updates history/epoch and permits repeated takebacks", () => {
  const f = fixture(); const initial = f.game.game.fen(); f.play("e4", "e5"); const previous = f.game.game.fen();
  f.play("Nf3", "Nc6"); const epoch = f.game.epoch;
  assert.equal(f.game.undoLastPlayerMove(), true);
  assert.equal(f.game.game.fen(), previous); assert.deepEqual(f.game.game.history(), ["e4", "e5"]);
  assert.equal(f.game.last.san, "e5"); assert.equal(f.game.epoch, epoch + 1); assert.equal(f.game.phase, "player");
  assert.equal(f.game.undoLastPlayerMove(), true); assert.equal(f.game.game.fen(), initial);
  assert.equal(f.game.canUndo(), false); assert.equal(f.game.undoLastPlayerMove(), false);
});
test("Black cannot undo the opponent opening; takeback preserves it after Black has played", () => {
  const f = fixture(undefined, "b"); f.play("e4"); const opening = f.game.game.fen();
  assert.equal(f.game.canUndo(), false);
  f.play("e5", "Nf3"); assert.equal(f.game.canUndo(), true); f.game.undoLastPlayerMove();
  assert.equal(f.game.game.fen(), opening); assert.deepEqual(f.game.game.history(), ["e4"]);
  assert.equal(f.board.root.rotation.y, Math.PI); assert.equal(f.game.game.turn(), "b");
});
test("undo rebuilds both captured trays and restores captured pieces", () => {
  const f = fixture(); f.play("e4", "d5"); const previous = f.game.game.fen(); f.play("exd5", "Qxd5");
  assert.equal(f.board.capturedPieces.length, 2); f.game.undoLastPlayerMove();
  assert.equal(f.game.game.fen(), previous); assert.equal(f.board.capturedPieces.length, 0);
  assert.equal(f.board.pieces.size, 32); assert.equal(f.board.pieces.get("e4").userData.type, "p");
  assert.equal(f.board.pieces.get("d5").userData.type, "p");
});
test("castling rights, en-passant state and promotion types restore from authoritative history", () => {
  for (const [fen, prep, moves] of [
    ["r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1", [], ["O-O", "O-O-O"]],
    [undefined, ["e4", "a6", "e5", "d5"], ["exd6", "Nf6"]],
    ["7k/P7/8/8/8/8/8/7K w - - 0 1", [], ["a8=Q+", "Kh7"]],
  ]) {
    const f = fixture(fen); f.play(...prep); const before = f.game.game.fen();
    f.play(...moves); f.game.undoLastPlayerMove(); assert.equal(f.game.game.fen(), before);
    assert.equal(f.board.capturedPieces.length, 0);
    if (fen?.includes("P7")) assert.equal(f.board.pieces.get("a7").userData.type, "p");
  }
});
test("undo is locked during thinking, motion, promotion, errors and game over", () => {
  const f = fixture(); f.play("e4", "e5"); const fen = f.game.game.fen();
  for (const phase of ["thinking", "moving", "promotion", "loading", "error", "over"]) {
    f.game.phase = phase; assert.equal(f.game.canUndo(), false); assert.equal(f.game.undoLastPlayerMove(), false);
    assert.equal(f.game.game.fen(), fen);
  }
});
function modalFixture() {
  const f = fixture(); f.play("e4", "e5");
  const scene = new THREE.Scene(); scene.add(f.world);
  const sources = [0, 1].map(() => ({ targetRaySpace: {}, gamepad: {
    mapping: "xr-standard", axes: [0, 0, 0, 0], buttons: Array.from({ length: 6 }, () => ({ value: 0 })),
  } }));
  let resets = 0;
  const input = { hands: sources.map((source) => ({ source })), reset() { resets++; } };
  const dialog = new UndoDialog({ scene, world: f.world, input, game: f.game,
    label: (text, w, h) => { const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial()); mesh.userData.text = text; return mesh; },
  });
  const camera = new THREE.PerspectiveCamera(), position = new THREE.Vector3();
  const frame = { getPose: () => ({ transform: { position, orientation: new THREE.Quaternion() } }) };
  const update = (tracked = true, blocked = false) => dialog.update(frame, {}, tracked, camera, blocked);
  const stick = (i, x) => { sources[i].gamepad.axes[2] = x; return update(); };
  const aim = (index) => { dialog.root.updateWorldMatrix(true, true); dialog.targets[index].getWorldPosition(position); position.z = 0; };
  update(); return { ...f, sources, input, dialog, update, stick, aim, camera, frame, resets: () => resets };
}
for (const hand of [0, 1]) {
  test(`left on thumbstick ${hand} opens once, No cancels, and holding left cannot reopen`, () => {
    const f = modalFixture(); const fen = f.game.game.fen();
    f.camera.lookAt(0, -1, -1);
    assert.equal(f.stick(hand, -0.8), true); assert.equal(f.dialog.open, true);
    assert.equal(f.world.visible, false);
    const offset = f.dialog.root.position.clone().sub(f.camera.getWorldPosition(new THREE.Vector3())).normalize();
    assert.ok(offset.dot(f.camera.getWorldDirection(new THREE.Vector3())) > 0.999);
    assert.ok(f.dialog.root.children.filter((mesh) => mesh.isMesh).every((mesh) =>
      mesh.material.transparent && !mesh.material.depthTest));
    assert.ok(f.dialog.root.children.some((mesh) => mesh.userData.text === "Do you want to undo your last move?"));
    f.aim(1); f.update(); f.sources[hand].gamepad.buttons[0].value = 1; f.update();
    assert.equal(f.dialog.open, false); assert.equal(f.world.visible, true); assert.equal(f.game.game.fen(), fen);
    f.update(); assert.equal(f.dialog.open, false);
  });
}
test("Yes pointer click restores the prior player turn and hides pointer rays", () => {
  const f = modalFixture(); f.stick(0, -0.8); f.aim(0); f.update();
  f.sources[0].gamepad.buttons[0].value = 1; f.update();
  assert.equal(f.dialog.open, false); assert.equal(f.world.visible, true); assert.deepEqual(f.game.game.history(), []);
  assert.equal(f.dialog.pointers.every((pointer) => !pointer.visible), true);
});
test("held trigger is consumed on open, and tracking recovery/Options cannot synthesize a left press", () => {
  const f = modalFixture(); f.sources[0].gamepad.buttons[0].value = 1;
  f.stick(0, -0.8); f.aim(0); f.update(); assert.equal(f.dialog.open, true);
  f.dialog.close(); f.update(false); f.update(); assert.equal(f.dialog.open, false);
  f.stick(0, 0); f.sources[0].gamepad.axes[2] = -0.8; f.update(true, true);
  f.update(); assert.equal(f.dialog.open, false);
  f.stick(0, 0); f.stick(0, -0.8); assert.equal(f.dialog.open, true);
});
test("stale dialog closes on restart without undoing a different game", () => {
  const f = modalFixture(); f.stick(0, -0.8); f.game.epoch++; f.game.game.reset();
  f.update(); assert.equal(f.dialog.open, false); assert.deepEqual(f.game.game.history(), []);
});

test("modal text/buttons always draw after the backdrop while either pointer moves and the view shifts", () => {
  const f = modalFixture(); f.stick(0, -0.8);
  const backdrop = f.dialog.root.children[0];
  const content = f.dialog.root.children.filter((mesh) => mesh.isMesh && mesh !== backdrop);
  // Keep one controller pointed away while the other moves over/outside controls.
  const leftSpace = f.sources[0].targetRaySpace;
  const rightPose = f.frame.getPose;
  f.frame.getPose = (space) => space === leftSpace
    ? { transform: { position: new THREE.Vector3(2, 1, 0), orientation: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2) } }
    : rightPose(space);
  for (const [x, y] of [[0.3, -0.25], [-0.3, 0.25], [0, 0]]) {
    f.camera.position.set(x, y, 0); f.camera.lookAt(f.dialog.root.position);
    for (const target of [0, 1, 0, 1]) {
      f.aim(target); f.update();
      assert.equal(f.dialog.open, true);
      assert.ok(content.every((mesh) => mesh.visible && mesh.material.opacity === 1 && mesh.renderOrder > backdrop.renderOrder));
      assert.ok(f.dialog.pointers.every((pointer) => pointer.renderOrder > Math.max(...content.map((mesh) => mesh.renderOrder))));
    }
  }
});

test("closing a modal restores its prior scene visibility rather than forcing it visible", () => {
  const f = modalFixture(); f.world.visible = false;
  f.stick(0, -0.8); assert.equal(f.world.visible, false);
  f.dialog.close(); assert.equal(f.world.visible, false);
});
