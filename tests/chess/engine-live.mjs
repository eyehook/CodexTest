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
