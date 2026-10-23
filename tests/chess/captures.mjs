import { test } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "../../projects/forest/vendor/three.module.js";
import { Chess } from "../../projects/chess/vendor/chess/chess.mjs";
import { squarePosition } from "../../projects/chess/src/ChessBoard.mjs";
import { ChessBoard } from "../../projects/chess/src/ChessBoard.mjs";
function fixture(fen) {
  const world = new THREE.Group(),
    board = new ChessBoard(world),
    game = new Chess(fen);
  board.sync(game);
  return { world, board, game };
}
test("capture previews appear beside board, synchronize once and reset with a new game", () => {
  const f = fixture();
  for (const move of ["e4", "d5"]) f.game.move(move);
  f.board.sync(f.game);
  const clone = new Chess(f.game.fen()),
    move = clone.move("exd5"),
    victim = f.board.pieces.get("d5");
  f.board.placeHeld(move);
  assert.equal(victim.parent, f.board.capturedRoot);
  assert.equal(f.board.capturedPieces.length, 1);
  assert.equal(victim.userData.color, "b");
  assert.ok(victim.position.distanceTo(squarePosition("d5")) < 1e-9);
  assert.equal(f.board.capturePhase, "arc");
  assert.equal(victim.userData.square, undefined);
  f.game.move("exd5");
  f.board.sync(f.game);
  f.board.sync(f.game);
  assert.equal(f.board.capturedPieces.length, 1);
  assert.equal(f.board.capturedPieces[0].geometry, f.board.geometries.p);
  f.game.reset();
  f.board.sync(f.game);
  assert.equal(f.board.capturedPieces.length, 0);
});
test("interrupted capture restores victim and committed capture trays from authoritative history", () => {
  const f = fixture();
  for (const m of ["e4", "d5", "exd5", "Qxd5"]) f.game.move(m);
  f.board.sync(f.game);
  assert.equal(f.board.capturedPieces.length, 2);
  const before = f.game.fen();
  const clone = new Chess(before);
  const move = clone.move("Nc3");
  f.board.removeCapture(move);
  assert.equal(f.board.capturedPieces.length, 2);
  f.game.reset();
  for (const m of ["e4", "d5"]) f.game.move(m);
  f.board.sync(f.game);
  const c = new Chess(f.game.fen()),
    capture = c.move("exd5");
  f.board.placeHeld(capture);
  assert.equal(f.board.capturedPieces.length, 1);
  f.board.sync(f.game);
  assert.equal(f.board.capturedPieces.length, 0);
  assert.equal(f.board.pieces.get("d5").userData.color, "b");
});
test("en passant and captured promoted pieces use actual captured type, not missing starting material", () => {
  const ep = fixture();
  for (const m of ["e4", "a6", "e5", "d5", "exd6"]) ep.game.move(m);
  ep.board.sync(ep.game);
  assert.equal(ep.board.capturedPieces.length, 1);
  assert.equal(ep.board.capturedPieces[0].userData.type, "p");
  const f = fixture("7r/P6k/8/8/8/8/8/7K w - - 0 1");
  assert.equal(f.board.capturedPieces.length, 0);
  f.game.move("a8=Q");
  f.game.move("Rxa8");
  f.board.sync(f.game);
  assert.equal(f.board.capturedPieces.length, 1);
  assert.equal(f.board.capturedPieces[0].userData.type, "q");
  assert.equal(f.board.capturedPieces[0].userData.color, "w");
});
test("full trays fit table, avoid controls and remain fixed when changing playing side", () => {
  const f = fixture();
  for (const color of ["w", "b"])
    for (let i = 0; i < 15; i++)
      f.board.addCaptured(
        new THREE.Mesh(f.board.geometries.q, f.board.materials[color]),
        color,
        "q",
      );
  const positions = f.board.capturedPieces.map((p) => p.position.clone());
  f.board.setPlayerColor("b");
  f.world.position.set(0.2, -0.35, -0.7);
  f.world.rotation.y = 0.6;
  f.world.updateMatrixWorld(true);
  for (const [i, piece] of f.board.capturedPieces.entries()) {
    assert.ok(piece.position.distanceTo(positions[i]) < 1e-10);
    assert.ok(
      Math.abs(piece.position.x) > 0.45 && Math.abs(piece.position.x) < 0.6,
    );
    assert.ok(Math.abs(piece.position.z) < 0.21);
  }
  assert.equal(f.board.pieces.size, 32);
});

for (const rate of [30, 72, 120])
  test(`capture follows a continuous arc at ${rate} Hz`, async () => {
    const f = fixture();
    for (const m of ["e4", "d5"]) f.game.move(m);
    f.board.sync(f.game);
    f.board.setPlayerColor("b");
    f.world.position.set(0.2, -0.3, -0.7);
    f.world.rotation.y = 0.6;
    f.world.updateMatrixWorld(true);
    const clone = new Chess(f.game.fen()),
      move = clone.move("exd5");
    const victim = f.board.pieces.get("d5"),
      start = victim.getWorldPosition(new THREE.Vector3());
    let done = false;
    const pending = f.board.removeCapture(move).then((ok) => {
      assert.ok(ok);
      done = true;
    });
    assert.ok(
      victim.getWorldPosition(new THREE.Vector3()).distanceTo(start) < 1e-9,
    );
    let previous = victim.position.clone();
    const phases = new Set();
    let highest = -Infinity;
    for (let frame = 0; frame < rate * 3 && !done; frame++) {
      phases.add(f.board.capturePhase);
      f.board.update(1 / rate);
      await Promise.resolve();
      assert.equal(f.board.capturedPieces[0], victim);
      assert.equal(victim.visible, true);
      assert.ok(
        victim.position.distanceTo(previous) < 0.09,
        "no teleport between frames",
      );
      if (frame === 4) assert.ok(Math.abs(victim.position.x - previous.x) > 0);
      highest = Math.max(highest, victim.position.y);
      previous.copy(victim.position);
    }
    await pending;
    assert.ok(phases.has("arc"));
    assert.ok(highest >= 0.1269);
    assert.ok(Math.abs(victim.position.y + 0.029) < 1e-9);
    assert.ok(victim.position.x > 0.45);
    assert.equal(f.game.history().length, 2);
  });
for (const progress of [0.1, 0.4, 0.7])
  test(`restart during capture arc at ${progress}s removes pending flight and restores victim`, async () => {
    const f = fixture();
    for (const m of ["e4", "d5"]) f.game.move(m);
    f.board.sync(f.game);
    const clone = new Chess(f.game.fen()),
      move = clone.move("exd5");
    const pending = f.board.removeCapture(move);
    for (let i = 0; i < Math.ceil(progress * 72); i++) {
      f.board.update(1 / 72);
      await Promise.resolve();
    }
    assert.equal(f.board.capturePhase, "arc");
    f.board.sync(f.game);
    assert.equal(await pending, false);
    assert.equal(f.board.motion.jobs.size, 0);
    assert.equal(f.board.capturedPieces.length, 0);
    assert.equal(f.board.pieces.get("d5").userData.color, "b");
  });
