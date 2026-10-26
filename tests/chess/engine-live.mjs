import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import {
  EngineController,
  ENGINE_URL,
} from "../../projects/chess/src/EngineController.mjs";
import { Chess } from "../../projects/chess/vendor/chess/chess.mjs";
function nodeWorker() {
  const child = spawn(process.execPath, [fileURLToPath(ENGINE_URL)], {
    stdio: ["pipe", "pipe", "pipe"],
  });
  const worker = {
    postMessage: (command) => child.stdin.write(command + "\n"),
    terminate: () => child.kill(),
  };
  createInterface({ input: child.stdout }).on("line", (data) =>
    worker.onmessage?.({ data }),
  );
  child.on("error", (error) => worker.onerror?.({ message: error.message }));
  child.stderr.on("data", () => {});
  return worker;
}
test("actual bundled WASM completes UCI handshake and returns legal moves after reset", async () => {
  const e = new EngineController({ createWorker: nodeWorker });
  try {
    await e.initialize(1350);
    assert.equal(e.elo, 1350);
    assert.equal(e.range.min, 1320);
    const game = new Chess();
    for (let i = 0; i < 4; i++) {
      const m = await e.bestMove(game.fen());
      assert.doesNotThrow(() => game.move(m));
    }
    e.dispose();
    await e.initialize(2000);
    assert.equal(e.elo, 2000);
    for (const [fen, sign] of [
      ["7k/8/8/8/8/8/8/KQ6 w - - 0 1", 1],
      ["7k/8/8/8/8/8/8/KQ6 b - - 0 1", 1],
      ["kq6/8/8/8/8/8/8/7K b - - 0 1", -1],
    ]) {
      const score = await e.evaluate(fen);
      assert.ok(
        score && score.value * sign > 0,
        "actual WASM score uses White perspective",
      );
      assert.equal(score.fen, fen);
    }
    const m = await e.bestMove(new Chess().fen());
    assert.ok(new Chess().move(m));
  } finally {
    e.dispose();
  }
});

test("bounded MultiPV detects an undefended queen loss for either playing color", async () => {
  const e = new EngineController({ createWorker: nodeWorker });
  try {
    await e.initialize(1500);
    for (const [fen, blunder, color] of [
      ["rnbqkbnr/pppppp1p/6p1/8/8/4P3/PPPP1PPP/RNBQKBNR w KQkq - 0 2", "d1h5", "w"],
      ["rnbqkbnr/pppp1ppp/4p3/8/8/6P1/PPPPPP1P/RNBQKBNR b KQkq - 0 2", "d8h4", "b"],
    ]) {
      const game = new Chess(fen);
      const moves = game.moves({ verbose: true }).map((m) => m.from + m.to + (m.promotion ?? ""));
      const baseline = await e.evaluate(fen);
      assert.ok(baseline && baseline.type === "cp");
      const scores = await e.analyzeMoves(fen, moves, { milliseconds: 350 });
      assert.equal(scores.size, moves.length);
      const sign = color === "w" ? 1 : -1;
      const loss = (scores.get(blunder).value - baseline.value) * sign / 100;
      console.log(`${color} queen loss: ${loss.toFixed(1)} pawns at depth ${scores.get(blunder).depth}`);
      assert.ok(loss < -6, `Expected clear queen loss, got ${loss}`);
    }
  } finally { e.dispose(); }
});

test("static position scoring uses bundled NNUE and resolves checked positions", async () => {
  const e = new EngineController({ createWorker: nodeWorker });
  try {
    await e.initialize(1500);
    for (const fen of [new Chess().fen(), "7k/8/8/8/8/8/8/KQ6 w - - 0 1",
      "7k/8/8/8/8/8/r7/KQ6 w - - 0 1"]) {
      const result = await e.scorePosition(fen);
      assert.ok(result && Number.isFinite(result.value));
      assert.equal(result.fen, fen);
      if (fen !== new Chess().fen()) assert.ok(result.value > 0);
    }
  } finally { e.dispose(); }
});

test("cached two-ply hints use actual board scores and detect hanging queens for either player", async () => {
  const { MoveEvaluation } = await import("../../projects/chess/src/MoveEvaluation.mjs");
  for (const [fen, from, destination, color] of [
    ["rnbqkbnr/pppppp1p/6p1/8/8/4P3/PPPP1PPP/RNBQKBNR w KQkq - 0 2", "d1", "h5", "w"],
    ["rnbqkbnr/pppp1ppp/4p3/8/8/6P1/PPPPPP1P/RNBQKBNR b KQkq - 0 2", "d8", "h4", "b"],
  ]) {
    const game = { game: new Chess(fen), phase: "player", epoch: 1, playerColor: color };
    const analysis = new MoveEvaluation({ game, settings: { evaluateMove: true },
      getHeld: () => null, overlay: { clear() {}, set() {} },
      createEngine: () => new EngineController({ createWorker: nodeWorker }),
    });
    try {
      analysis.update(); await analysis.pending;
      assert.ok(analysis.cache);
      const result = analysis.cache.byPiece.get(from).find((entry) => entry.square === destination);
      console.log(`${color} static before/after queen delta: ${result.text}`);
      assert.ok(result.delta < -6);
      assert.equal(game.game.fen(), fen);
    } finally { analysis.cancel(true); }
  }
});
