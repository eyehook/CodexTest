import { test } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "../../shared/vendor/three-r180/three.module.js";
import { Chess } from "../../projects/chess/vendor/chess/chess.mjs";
import { Settings, resolveSide } from "../../projects/chess/src/Settings.mjs";
import {
  ChessBoard,
  squarePosition,
} from "../../projects/chess/src/ChessBoard.mjs";
import { GameController } from "../../projects/chess/src/GameController.mjs";
import { nearestPiece } from "../../projects/chess/src/HandInteraction.mjs";
import { ProceduralAvatar } from "../../projects/chess/src/ProceduralAvatar.mjs";
import { OpponentAnimator } from "../../projects/chess/src/OpponentAnimator.mjs";
const tick = () => new Promise((r) => setTimeout(r, 0));
function fixture(random = () => 0.1) {
  const world = new THREE.Group(),
    board = new ChessBoard(world),
    animated = [];
  const engine = {
    dispose() {},
    async initialize() {},
    async bestMove(fen) {
      const c = new Chess(fen);
      const move =
        c
          .moves({ verbose: true })
          .find((m) => m.from === "e2" && m.to === "e4") ||
        c.moves({ verbose: true })[0];
      return {
        from: move.from,
        to: move.to,
        ...(move.promotion ? { promotion: move.promotion } : {}),
      };
    },
  };
  const game = new GameController({
    board,
    engine,
    opponent: {
      cancel() {},
      async movePiece(move) {
        animated.push(move);
      },
    },
    random,
  });
  return { world, board, engine, game, animated };
}
test("side defaults, validation, persistence and deterministic random assignments", () => {
  let value = "{}";
  const storage = { getItem: () => value, setItem: (_, v) => (value = v) };
  const s = new Settings(storage);
  assert.equal(s.side, "white");
  s.side = "random";
  s.save();
  assert.equal(new Settings(storage).side, "random");
  value = '{"side":"invalid"}';
  assert.equal(new Settings(storage).side, "white");
  assert.equal(resolveSide("white"), "w");
  assert.equal(resolveSide("black"), "b");
  assert.equal(
    resolveSide("random", () => 0.49),
    "w",
  );
  assert.equal(
    resolveSide("random", () => 0.5),
    "b",
  );
});
test("Black player gets computer opening, own-piece pickup and subsequent White response", async () => {
  const f = fixture();
  await f.game.restart(1500, "black");
  assert.equal(f.game.playerColor, "b");
  assert.equal(f.game.game.turn(), "b");
  assert.equal(f.animated[0].color, "w");
  assert.equal(f.game.phase, "player");
  assert.match(f.game.status(), /Your turn · Black/);
  assert.equal(f.game.beginGrab("e4"), false);
  assert.equal(f.game.beginGrab("e7"), true);
  f.game.dropGrab("e5");
  await tick();
  assert.equal(f.game.game.get("e5").color, "b");
  assert.equal(f.game.game.turn(), "b");
  assert.equal(f.animated.length, 2);
  const p = squarePosition("d7");
  p.y = 0.1;
  assert.equal(nearestPiece(p, f.game), "d7");
});
test("board rotates only the playing surface, with chosen color closest to the player", async () => {
  const f = fixture();
  await f.game.restart(1500, "black");
  assert.ok(f.board.squareToWorld("e8").z > f.board.squareToWorld("e1").z);
  assert.equal(f.world.rotation.y, 0);
  await f.game.restart(1500, "white");
  assert.ok(f.board.squareToWorld("e1").z > f.board.squareToWorld("e8").z);
  assert.equal(f.game.game.history().length, 0);
});
test("random draws once per restart and retains chosen color throughout the game", async () => {
  let draws = 0;
  const f = fixture(() => (++draws === 1 ? 0.9 : 0.1));
  await f.game.restart(1500, "random");
  assert.equal(f.game.playerColor, "b");
  assert.equal(draws, 1);
  await f.game.restart(1500, "random");
  assert.equal(f.game.playerColor, "w");
  assert.equal(draws, 2);
});
test("restart rejects stale computer opening before changing sides", async () => {
  const f = fixture();
  let release;
  f.engine.bestMove = () => new Promise((r) => (release = r));
  const old = f.game.restart(1500, "black");
  await tick();
  assert.equal(f.game.phase, "thinking");
  await f.game.restart(1500, "white");
  release({ from: "e2", to: "e4" });
  await old;
  assert.equal(f.game.playerColor, "w");
  assert.equal(f.game.game.fen(), new Chess().fen());
  assert.equal(f.game.phase, "player");
});
test("Black player promotion uses the existing explicit selection flow", async () => {
  const f = fixture();
  await f.game.restart(1500, "black");
  f.game.game.load("7k/8/8/8/8/8/p7/7K b - - 0 1");
  f.board.sync(f.game.game);
  assert.ok(f.game.beginGrab("a2"));
  f.game.dropGrab("a1");
  assert.equal(f.game.phase, "promotion");
  f.game.promote("n");
  await tick();
  assert.equal(f.game.game.get("a1").color, "b");
  assert.equal(f.game.game.get("a1").type, "n");
  assert.equal(f.game.phase, "over");
});
test("opponent carries a White opening accurately on the flipped board", async () => {
  const root = new THREE.Group(),
    board = new ChessBoard(root),
    avatar = new ProceduralAvatar(root),
    opponent = new OpponentAnimator(board, avatar);
  board.setPlayerColor("b");
  const game = new Chess();
  board.sync(game);
  const clone = new Chess(),
    move = clone.move("e4");
  const piece = board.pieces.get("e2");
  let done = false;
  const pending = opponent.movePiece(move).then(() => (done = true));
  for (let i = 0; i < 1000 && !done; i++) {
    opponent.update(1 / 72);
    await Promise.resolve();
  }
  await pending;
  assert.ok(
    piece
      .getWorldPosition(new THREE.Vector3())
      .distanceTo(board.squareToWorld("e4")) < 1e-8,
  );
  assert.equal(game.fen(), new Chess().fen());
});
