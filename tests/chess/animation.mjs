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
  assert.equal(victim.parent, null);
  assert.equal(f.board.pieces.get("d2").userData.square, "d2");
  const ep = setup("4k3/8/8/8/3pP3/8/8/4K3 b - e3 0 1");
  const ec = new Chess(ep.game.fen()),
    em = ec.move("dxe3");
  const pawn = ep.board.pieces.get("e4");
  await run(ep.opponent, ep.opponent.movePiece(em));
  assert.equal(pawn.parent, null);
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
