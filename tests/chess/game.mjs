import { test } from "node:test";
import assert from "node:assert/strict";
import { Chess } from "../../projects/chess/vendor/chess/chess.mjs";
import { GameController } from "../../projects/chess/src/GameController.mjs";
import { EngineController } from "../../projects/chess/src/EngineController.mjs";
import { Settings, effectiveElo } from "../../projects/chess/src/Settings.mjs";
import { squarePosition } from "../../projects/chess/src/ChessBoard.mjs";
const tick = () => new Promise((r) => setTimeout(r, 0));
function fixture() {
  const board = { sync() {}, highlight() {}, async animateMove() {} };
  const engine = {
    dispose() {},
    async initialize() {},
    async bestMove() {
      return { from: "e7", to: "e5" };
    },
  };
  const opponent = { cancel() {}, async movePiece() {} };
  return new GameController({ board, engine, opponent });
}
test("settings defaults, persistence, corruption, engine clamp", () => {
  let value = "invalid";
  const store = { getItem: () => value, setItem: (_, v) => (value = v) };
  const a = new Settings(store);
  assert.equal(a.elo, 1500);
  a.elo = 1350;
  a.save();
  assert.equal(new Settings(store).elo, 1350);
  assert.equal(effectiveElo(1350, { min: 1400, max: 3190 }), 1400);
  assert.throws(() => effectiveElo(123, {}));
  value = '{"height":99,"distance":-2}';
  const b = new Settings(store);
  assert.equal(b.height, -0.1);
  assert.equal(b.distance, 0.45);
});
test("board orientation and queen positions", () => {
  assert.ok(squarePosition("a1").x < squarePosition("h1").x);
  assert.ok(squarePosition("e1").z > squarePosition("e8").z);
  const g = new Chess();
  assert.equal(g.get("d1").type, "q");
  assert.equal(g.get("d8").type, "q");
});
test("rules: castling, en passant, all promotions, mate and draws", () => {
  const castle = new Chess("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1");
  castle.move("O-O");
  assert.equal(castle.get("f1").type, "r");
  castle.move("O-O-O");
  assert.equal(castle.get("d8").type, "r");
  const ep = new Chess();
  for (const m of ["e4", "a6", "e5", "d5"]) ep.move(m);
  assert.ok(ep.move("exd6").flags.includes("e"));
  assert.equal(ep.get("d5"), undefined);
  for (const promotion of ["q", "r", "b", "n"]) {
    const p = new Chess("7k/P7/8/8/8/8/8/7K w - - 0 1");
    p.move({ from: "a7", to: "a8", promotion });
    assert.equal(p.get("a8").type, promotion);
  }
  const mate = new Chess();
  for (const m of ["f3", "e5", "g4", "Qh4#"]) mate.move(m);
  assert.ok(mate.isCheckmate());
  assert.ok(new Chess("7k/5Q2/6K1/8/8/8/8/8 b - - 0 1").isStalemate());
  assert.ok(new Chess("7k/8/8/8/8/8/8/7K w - - 0 1").isInsufficientMaterial());
  const repeat = new Chess();
  for (const m of ["Nf3", "Nf6", "Ng1", "Ng8", "Nf3", "Nf6", "Ng1", "Ng8"])
    repeat.move(m);
  assert.ok(repeat.isThreefoldRepetition());
  assert.ok(new Chess("7k/8/8/8/8/8/R7/7K w - - 100 60").isDrawByFiftyMoves());
});
test("full turn commits after animation and rejects Black selection", async () => {
  const g = fixture();
  await g.restart(1500);
  g.beginGrab("e7");
  assert.equal(g.selected, null);
  const fen = g.game.fen();
  g.beginGrab("e2");
  g.dropGrab("e4");
  assert.equal(g.phase, "moving");
  assert.equal(g.game.fen(), fen);
  await tick();
  assert.equal(g.game.get("e4").color, "w");
  assert.equal(g.game.get("e5").color, "b");
  assert.equal(g.phase, "player");
});
test("restart prevents stale search from committing", async () => {
  const g = fixture();
  await g.restart(1500);
  let resolve;
  g.engine.bestMove = () => new Promise((r) => (resolve = r));
  g.beginGrab("e2");
  g.dropGrab("e4");
  await tick();
  assert.equal(g.phase, "thinking");
  await g.restart(1500);
  resolve({ from: "e7", to: "e5" });
  await tick();
  assert.equal(g.game.fen(), new Chess().fen());
  assert.equal(g.phase, "player");
});
test("restart during animation cancels transaction; invalid engine reply pauses safely", async () => {
  const g = fixture();
  await g.restart(1500);
  let release;
  g.opponent.movePiece = () => new Promise((r) => (release = r));
  g.beginGrab("e2");
  g.dropGrab("e4");
  await tick();
  await g.restart(1500);
  release();
  await tick();
  assert.equal(g.game.fen(), new Chess().fen());
  g.engine.bestMove = async () => ({ from: "a8", to: "a1" });
  g.beginGrab("e2");
  g.dropGrab("e4");
  await tick();
  assert.equal(g.phase, "error");
  assert.equal(g.game.turn(), "b");
});
test("promotion requires an explicit choice", async () => {
  const g = fixture();
  await g.restart(1500);
  g.game.load("7k/P7/8/8/8/8/8/7K w - - 0 1");
  g.beginGrab("a7");
  g.dropGrab("a8");
  assert.equal(g.phase, "promotion");
  assert.equal(g.game.get("a7").type, "p");
  g.promote("n");
  await tick();
  assert.equal(g.game.get("a8").type, "n");
  assert.equal(g.phase, "over");
});
class FakeWorker {
  constructor() {
    this.commands = [];
    this.terminated = false;
  }
  postMessage(c) {
    this.commands.push(c);
    queueMicrotask(() => {
      if (c === "uci") {
        this.emit(
          "option name UCI_Elo type spin default 1320 min 1320 max 3190",
        );
        this.emit("uciok");
      }
      if (c === "isready") this.emit("readyok");
    });
  }
  emit(data) {
    this.onmessage?.({ data });
  }
  terminate() {
    this.terminated = true;
  }
}
test("UCI handshake, discovered range, bounded search, overlap and stale worker", async () => {
  let worker;
  const e = new EngineController({
    createWorker: () => (worker = new FakeWorker()),
  });
  await e.initialize(1350);
  assert.equal(e.elo, 1350);
  assert.ok(
    worker.commands.includes("setoption name UCI_LimitStrength value true"),
  );
  const search = e.bestMove(new Chess().fen());
  await assert.rejects(e.bestMove(new Chess().fen()));
  assert.ok(worker.commands.includes("go movetime 300"));
  worker.emit("bestmove e2e4");
  assert.deepEqual(await search, { from: "e2", to: "e4" });
  const old = worker;
  const cancelled = e.bestMove(new Chess().fen());
  const rejection = assert.rejects(cancelled, /cancelled/);
  await e.initialize(1500);
  await rejection;
  old.emit("bestmove a1a8");
  assert.ok(e.ready);
  e.dispose();
});
test("invalid UCI bestmove is rejected", async () => {
  let worker;
  const e = new EngineController({
    createWorker: () => (worker = new FakeWorker()),
  });
  await e.initialize(1500);
  const p = e.bestMove(new Chess().fen());
  worker.emit("bestmove (none)");
  await assert.rejects(p, /Invalid/);
  e.dispose();
});
