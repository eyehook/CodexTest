import { test } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "../../shared/vendor/three-r180/three.module.js";
import {
  parseEvaluation,
  opponentEvaluation,
  expressionAmount,
} from "../../projects/chess/src/Evaluation.mjs";
import { OpponentFace } from "../../projects/chess/src/OpponentFace.mjs";
import { EngineController } from "../../projects/chess/src/EngineController.mjs";
import { GameController } from "../../projects/chess/src/GameController.mjs";
import { Chess } from "../../projects/chess/vendor/chess/chess.mjs";
const fen = new Chess().fen(),
  blackFen = fen.replace(" w ", " b ");
test("evaluation scores normalize side-to-move then opponent perspective for either player color", () => {
  const white = parseEvaluation(
    "info depth 8 multipv 1 score cp 125 nodes 50",
    fen,
  );
  assert.equal(white.value, 125);
  const black = parseEvaluation("info depth 8 score cp -125", blackFen);
  assert.equal(black.value, 125);
  assert.equal(opponentEvaluation(white, "w").value, -125);
  assert.equal(opponentEvaluation(white, "b").value, 125);
  assert.equal(
    parseEvaluation("info depth 9 score mate -3", blackFen).value,
    3,
  );
  assert.equal(
    parseEvaluation("info depth 9 multipv 2 score cp 400", fen),
    null,
  );
  assert.equal(
    parseEvaluation("info depth 9 score cp 300 lowerbound", fen),
    null,
  );
  assert.equal(parseEvaluation("bestmove e2e4", fen), null);
});
test("mouth is neutral near equality, curves proportionally and saturates for mate", () => {
  assert.equal(expressionAmount(null), 0);
  assert.equal(expressionAmount({ type: "cp", value: 20 }), 0);
  assert.equal(expressionAmount({ type: "cp", value: -20 }), 0);
  assert.ok(
    expressionAmount({ type: "cp", value: 300 }) >
      expressionAmount({ type: "cp", value: 100 }),
  );
  assert.equal(
    expressionAmount({ type: "cp", value: -300 }),
    -expressionAmount({ type: "cp", value: 300 }),
  );
  assert.equal(expressionAmount({ type: "mate", value: 3 }), 1);
  assert.equal(expressionAmount({ type: "mate", value: -3 }), -1);
  const face = new OpponentFace(new THREE.Group()),
    buffer = face.positions;
  assert.equal(face.eyes.length, 2);
  for (const eye of face.eyes) {
    assert.equal(eye.geometry.type, "SphereGeometry");
    assert.equal(eye.material.color.getHex(), 0x050505);
  }
  const middle = (face.segments / 2) * 6 + 1,
    edge = 1;
  face.setEvaluation({ type: "cp", value: 400 });
  face.update(1 / 72);
  assert.ok(face.amount > 0 && face.amount < face.target);
  for (let i = 0; i < 200; i++) face.update(1 / 72);
  assert.ok(face.positions[middle] < face.positions[edge]);
  face.setEvaluation({ type: "cp", value: -400 });
  for (let i = 0; i < 200; i++) face.update(1 / 72);
  assert.ok(face.positions[middle] > face.positions[edge]);
  assert.equal(face.positions, buffer);
  face.setEvaluation(null);
  assert.equal(face.amount, 0);
  assert.equal(face.positions[middle], face.positions[edge]);
});
class FakeWorker {
  constructor() {
    this.commands = [];
  }
  postMessage(command) {
    this.commands.push(command);
    queueMicrotask(() => {
      if (command === "uci") {
        this.emit(
          "option name UCI_Elo type spin default 1320 min 1320 max 3190",
        );
        this.emit("uciok");
      }
      if (command === "isready") this.emit("readyok");
    });
  }
  emit(data) {
    this.onmessage?.({ data });
  }
  terminate() {}
}
test("analysis uses bounded full strength, parses score, restores playing strength and rejects stale results", async () => {
  let worker;
  const engine = new EngineController({
    createWorker: () => (worker = new FakeWorker()),
  });
  await engine.initialize(1500);
  const pending = engine.evaluate(blackFen);
  assert.ok(
    worker.commands.includes("setoption name UCI_LimitStrength value false"),
  );
  assert.ok(worker.commands.includes("go movetime 150"));
  await assert.rejects(engine.bestMove(fen));
  worker.emit("info depth 6 score cp -240");
  worker.emit("bestmove e7e5");
  const score = await pending;
  assert.equal(score.value, 240);
  assert.equal(
    worker.commands.at(-1),
    "setoption name UCI_LimitStrength value true",
  );
  assert.equal(engine.busy, false);
  const old = worker;
  const stale = engine.evaluate(fen);
  const rejection = assert.rejects(stale, /cancelled/);
  await engine.initialize(1500);
  old.emit("info depth 9 score cp 900");
  old.emit("bestmove e2e4");
  await rejection;
  assert.equal(engine.lastEvaluation, null);
  engine.dispose();
});
function gameFixture() {
  const scores = [];
  const board = { sync() {}, highlight() {}, setPlayerColor() {} };
  const engine = {
    dispose() {},
    async initialize() {},
    async evaluate(fen) {
      return { type: "cp", value: 200, fen };
    },
    async bestMove() {
      return { from: "e2", to: "e4" };
    },
  };
  const game = new GameController({
    board,
    engine,
    opponent: { cancel() {}, async movePiece() {} },
    onEvaluation: (s) => scores.push(s),
  });
  return { game, engine, scores };
}
test("game starts and completes turns without requesting expression analysis", async () => {
  const f = gameFixture();
  f.engine.evaluate = () => {
    throw new Error("Unexpected expression analysis");
  };
  const phases = [];
  f.game.onChange = (state) => phases.push(state.phase);
  await f.game.restart(1500, "white");
  assert.equal(f.game.phase, "player");
  await f.game.restart(1500, "black");
  assert.equal(f.game.phase, "player");
  assert.equal(f.game.game.history().length, 1);
  assert.ok(!phases.includes("evaluating"));
});
