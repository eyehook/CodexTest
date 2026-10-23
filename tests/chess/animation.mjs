import { test } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "../../projects/forest/vendor/three.module.js";
import { Chess } from "../../projects/chess/vendor/chess/chess.mjs";
import {
  ChessBoard,
  squarePosition,
} from "../../projects/chess/src/ChessBoard.mjs";
import { ProceduralAvatar } from "../../projects/chess/src/ProceduralAvatar.mjs";
import { OpponentAnimator } from "../../projects/chess/src/OpponentAnimator.mjs";
function setup(fen) {
  const root = new THREE.Group();
  root.position.set(0.13, -0.35, -0.65);
  root.rotation.y = 0.7;
  const board = new ChessBoard(root),
    avatar = new ProceduralAvatar(root),
    opponent = new OpponentAnimator(board, avatar),
    game = new Chess(fen);
  board.sync(game);
  root.updateMatrixWorld(true);
  return { root, board, avatar, opponent, game };
}
async function run(o, p, rate = 72, check = () => {}) {
  let done = false,
    error;
  p.then(
    () => (done = true),
    (e) => {
      error = e;
      done = true;
    },
  );
  for (let i = 0; i < rate * 20 && !done; i++) {
    o.board.update(1 / rate);
    o.update(1 / rate);
    check();
    await Promise.resolve();
  }
  assert.ok(done, "animation completes");
  if (error) throw error;
}
for (const rate of [30, 72, 120])
  test(`capture transaction preserves transforms and lands at ${rate}Hz`, async () => {
    const { root, board, avatar, opponent, game } = setup(
      "4k3/8/8/8/8/4p3/3P4/4K3 b - - 0 1",
    );
    const before = game.fen();
    const clone = new Chess(before);
    const move = clone.move({ from: "e3", to: "d2" });
    const piece = board.pieces.get("e3");
    let carried = false,
      minCarry = Infinity;
    await run(opponent, opponent.movePiece(move), rate, () => {
      if (opponent.state === "carry") {
        carried = true;
        root.updateMatrixWorld(true);
        const local = root.worldToLocal(
          piece.getWorldPosition(new THREE.Vector3()),
        );
        minCarry = Math.min(minCarry, local.y);
        assert.ok(
          piece
            .getWorldScale(new THREE.Vector3())
            .distanceTo(new THREE.Vector3(1, 1, 1)) < 1e-8,
        );
        assert.equal(piece.parent, avatar.attachment);
      }
    });
    assert.ok(carried);
    assert.ok(minCarry > 0.23);
    assert.equal(game.fen(), before);
    assert.equal(piece.parent, board.root);
    assert.ok(piece.position.distanceTo(squarePosition("d2")) < 1e-9);
    assert.equal(opponent.state, "rest");
  });
test("capture and en passant remove the right target", async () => {
  const f = setup("4k3/8/8/8/3P4/4p3/8/4K3 b - - 0 1");
  f.game.load("4k3/8/8/8/8/4p3/3P4/4K3 b - - 0 1");
  f.board.sync(f.game);
  const clone = new Chess(f.game.fen()),
    move = clone.move("exd2+");
  const victim = f.board.pieces.get("d2");
  await run(f.opponent, f.opponent.movePiece(move));
  assert.equal(victim.parent, f.board.capturedRoot);
  assert.equal(f.board.pieces.get("d2").userData.square, "d2");
  const ep = setup("4k3/8/8/8/3pP3/8/8/4K3 b - e3 0 1");
  const ec = new Chess(ep.game.fen()),
    em = ec.move("dxe3");
  const pawn = ep.board.pieces.get("e4");
  await run(ep.opponent, ep.opponent.movePiece(em));
  assert.equal(pawn.parent, ep.board.capturedRoot);
});
test("Black castling carries king and rook; promotion synchronizes to new type", async () => {
  for (const san of ["O-O", "O-O-O"]) {
    const f = setup("r3k2r/8/8/8/8/8/8/R3K2R b KQkq - 0 1");
    const c = new Chess(f.game.fen()),
      m = c.move(san);
    await run(f.opponent, f.opponent.movePiece(m));
    assert.ok(f.board.pieces.get(san === "O-O" ? "f8" : "d8"));
    assert.ok(f.board.pieces.get(san === "O-O" ? "g8" : "c8"));
  }
  const f = setup("7k/8/8/8/8/8/p7/7K b - - 0 1");
  const c = new Chess(f.game.fen()),
    m = c.move({ from: "a2", to: "a1", promotion: "q" });
  await run(f.opponent, f.opponent.movePiece(m));
  f.game.move({ from: m.from, to: m.to, promotion: m.promotion });
  f.board.sync(f.game);
  assert.equal(f.board.pieces.get("a1").geometry, f.board.geometries.q);
});
test("cancel during pickup and carry rebuilds without orphaned pieces", async () => {
  for (const phase of ["reach", "lower", "lift", "carry", "place", "return"]) {
    const f = setup();
    f.game.move("e4");
    f.board.sync(f.game);
    const c = new Chess(f.game.fen()),
      m = c.move("e5");
    const p = f.opponent.movePiece(m);
    for (let i = 0; i < 1000 && f.opponent.state !== phase; i++) {
      f.opponent.update(1 / 72);
      await Promise.resolve();
    }
    assert.equal(f.opponent.state, phase);
    f.opponent.cancel();
    f.board.sync(f.game);
    await run(f.opponent, p);
    assert.equal(f.board.pieces.size, 32);
    assert.equal(f.avatar.attachment.children.length, 0);
    assert.ok(f.board.pieces.get("e7"));
  }
});

test("opponent uses each closest arm for far-board moves, including a flipped board", async () => {
  for (const flipped of [false, true])
    for (const file of ["a", "h"]) {
      const f = setup("r3k2r/8/8/8/8/8/8/R3K2R b KQkq - 0 1");
      f.board.setPlayerColor(flipped ? "b" : "w");
      f.root.updateMatrixWorld(true);
      const from = `${file}8`,
        to = `${file}1`;
      const expected = f.avatar.closestArm(f.board.squareToWorld(from));
      let lean = 0;
      const move = new Chess(f.game.fen()).move({ from, to });
      await run(f.opponent, f.opponent.movePiece(move), 72, () => {
        lean = Math.max(lean, f.avatar.lean);
        if (["lift", "carry", "place"].includes(f.opponent.state))
          assert.equal(f.avatar.activeArm, expected);
        for (const arm of f.avatar.arms) {
          assert.ok(Math.abs(arm.upper.scale.y - 0.3) < 1e-9);
          assert.ok(Math.abs(arm.lower.scale.y - 0.28) < 1e-9);
        }
      });
      assert.ok(lean > 0.5);
      assert.equal(f.avatar.lean, 0);
      assert.ok(f.board.pieces.get(to));
    }
});

for (const rate of [30, 72, 120])
  test(`victim stays put until attacker nears destination at ${rate}Hz`, async () => {
    const f = setup("4k3/8/8/8/8/4p3/3P4/4K3 b - - 0 1");
    const move = new Chess(f.game.fen()).move("exd2+");
    const victim = f.board.pieces.get("d2"),
      attacker = f.board.pieces.get("e3");
    const initial = victim.getWorldPosition(new THREE.Vector3());
    const destination = squarePosition("d2"),
      source = squarePosition("e3");
    let started = false;
    await run(f.opponent, f.opponent.movePiece(move), rate, () => {
      if (victim.parent === f.board.root) {
        assert.ok(
          victim.getWorldPosition(new THREE.Vector3()).distanceTo(initial) <
            1e-9,
        );
        assert.equal(f.board.capturedPieces.length, 0);
      } else if (!started) {
        started = true;
        f.root.updateWorldMatrix(true);
        const point = f.board.root.worldToLocal(
          attacker.getWorldPosition(new THREE.Vector3()),
        );
        point.y = 0;
        assert.ok(
          point.distanceTo(destination) <=
            source.distanceTo(destination) * 0.15 + 1e-8,
        );
        assert.equal(f.opponent.state, "carry");
      }
    });
    assert.ok(started);
  });

test("attacking arm places and returns while captured piece is still in flight", async () => {
  const f = setup("4k3/8/8/8/8/4p3/3P4/4K3 b - - 0 1");
  const move = new Chess(f.game.fen()).move("exd2+");
  let placeDuringFlight = false,
    returnDuringFlight = false;
  await run(f.opponent, f.opponent.movePiece(move), 72, () => {
    assert.notEqual(f.opponent.state, "capture");
    if (f.board.capturePhase === "arc") {
      if (f.opponent.state === "place") placeDuringFlight = true;
      if (f.opponent.state === "return") returnDuringFlight = true;
    }
  });
  assert.ok(placeDuringFlight);
  assert.ok(returnDuringFlight);
  assert.equal(f.board.capturePhase, "idle");
});
