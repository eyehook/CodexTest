import { test } from "node:test";
import assert from "node:assert/strict";
import { Chess } from "../../projects/chess/vendor/chess/chess.mjs";
import { EngineController } from "../../projects/chess/src/EngineController.mjs";
import { MoveEvaluation, moveToken } from "../../projects/chess/src/MoveEvaluation.mjs";
import { parseMoveEvaluation, moveDeltaLabel } from "../../projects/chess/src/Evaluation.mjs";
const fen = new Chess().fen();
const score = (value, type = "cp") => ({ value, type });
const flush = () => new Promise((resolve) => setImmediate(resolve));
function canvasFixture() {
  const calls = [];
  const ctx = Object.fromEntries(["clearRect", "save", "restore", "translate", "rotate", "strokeText", "fillText"]
    .map((name) => [name, (...args) => calls.push([name, ...args])]));
  return { canvas: { getContext: () => ctx }, calls };
}
class Worker {
  commands = [];
  postMessage(command) {
    this.commands.push(command);
    queueMicrotask(() => {
      if (command === "uci") {
        this.emit("option name UCI_Elo type spin default 1320 min 1320 max 3190"); this.emit("uciok");
      }
      if (command === "isready") this.emit("readyok");
    });
  }
  emit(data) { this.onmessage?.({ data }); }
  terminate() { this.terminated = true; }
}
test("root MultiPV scores parse move, depth and player sign, skipping bound scores", () => {
  const line = "info depth 6 multipv 4 score cp -900 nodes 100 pv d1h5 g6h5";
  assert.deepEqual(parseMoveEvaluation(line, fen), { move: "d1h5", reply: "g6h5", depth: 6, type: "cp", value: -900, fen });
  assert.equal(parseMoveEvaluation(line, fen.replace(" w ", " b ")).value, 900);
  assert.equal(parseMoveEvaluation(line.replace("nodes", "lowerbound nodes"), fen), null);
  assert.equal(parseMoveEvaluation("info depth 3 score cp 10", fen), null);
});
test("deltas use pawn units for either side and never turn mates into pawn values", () => {
  assert.equal(moveDeltaLabel(score(30), score(-870), "w"), "-9.0");
  assert.equal(moveDeltaLabel(score(-30), score(870), "b"), "-9.0");
  assert.equal(moveDeltaLabel(score(30), score(31), "w"), "0.0");
  assert.equal(moveDeltaLabel(score(0), score(150), "w"), "+1.5");
  for (const color of ["w", "b"]) {
    for (const cp of [-10, -9, -6, 0, 6, 9, 10])
      assert.equal(moveDeltaLabel(score(0), score(cp), color), "0.0");
    const sign = color === "w" ? 1 : -1;
    assert.equal(moveDeltaLabel(score(0), score(11 * sign), color), "+0.1");
    assert.equal(moveDeltaLabel(score(0), score(-11 * sign), color), "-0.1");
    assert.equal(moveDeltaLabel(score(0), score(16 * sign), color), "+0.2");
    assert.equal(moveDeltaLabel(score(0), score(-16 * sign), color), "-0.2");
  }
  assert.equal(moveDeltaLabel(score(0), score(3, "mate"), "w"), "M3");
  assert.equal(moveDeltaLabel(score(0), score(3, "mate"), "b"), "-M3");
  assert.equal(moveDeltaLabel(score(3, "mate"), score(0), "w"), "Mate lost");
  assert.equal(moveDeltaLabel(score(-3, "mate"), score(0), "w"), "Escapes mate");
});
test("analysis publishes complete equal-depth sets and restores UCI options", async () => {
  let worker; const engine = new EngineController({ createWorker: () => worker = new Worker() });
  await engine.initialize(1500);
  const snapshots = [];
  const pending = engine.analyzeMoves(fen, ["e2e4", "d2d4"], { onUpdate: (s) => snapshots.push(s) });
  worker.emit("info depth 4 multipv 1 score cp 30 pv e2e4");
  worker.emit("info depth 3 multipv 2 score cp 20 pv d2d4");
  assert.equal(snapshots.length, 0);
  worker.emit("info depth 4 multipv 2 score cp 10 pv d2d4");
  worker.emit("info depth 5 multipv 1 score cp 50 pv e2e4");
  worker.emit("bestmove e2e4");
  const result = await pending;
  assert.equal(result.size, 2); assert.equal(result.get("e2e4").value, 30);
  assert.equal(snapshots.length, 1);
  assert.ok(worker.commands.includes("setoption name MultiPV value 2"));
  assert.ok(worker.commands.includes("go movetime 500"));
  assert.ok(worker.commands.includes("setoption name MultiPV value 1"));
  assert.equal(engine.busy, false); engine.dispose();
});
test("disposing analysis rejects the pending search and ignores late worker scores", async () => {
  let worker; const engine = new EngineController({ createWorker: () => worker = new Worker() });
  await engine.initialize(1500); let calls = 0;
  const pending = engine.analyzeMoves(fen, ["e2e4"], { onUpdate: () => calls++ });
  const rejection = assert.rejects(pending, /cancelled/);
  engine.dispose(); worker.emit("info depth 6 score cp 10 pv e2e4"); worker.emit("bestmove e2e4");
  await rejection; assert.equal(calls, 0);
});
function fixture() {
  const game = { game: new Chess(), phase: "grabbing", epoch: 1, playerColor: "w" };
  const settings = { evaluateMove: true };
  let held = { from: "e2" }, resolveSearch, rejectSearch, onUpdate, calls = 0, disposed = 0, baselineCalls = 0, fallbackCalls = 0;
  const positions = [];
  const overlay = { entries: [], set(entries) { this.entries = entries; }, clear() { this.entries = []; } };
  const engine = {
    ready: true, busy: false,
    async scorePosition(fen) {
      positions.push(fen);
      if (fen === game.game.fen()) { baselineCalls++; return score(30); }
      const position = new Chess(fen);
      return score(position.get("e4")?.color === "w" ? -870 : 30);
    },
    async bestMove(fen) {
      fallbackCalls++;
      return new Chess(fen).moves({ verbose: true })[0];
    },
    analyzeMoves(_, moves, options) {
      assert.equal(options.milliseconds, 1000);
      calls++; this.busy = true; onUpdate = options.onUpdate;
      assert.ok(moves.length > 0);
      return new Promise((resolve, reject) => { resolveSearch = (s) => { this.busy = false; resolve(s); }; rejectSearch = reject; });
    },
    dispose() { disposed++; this.busy = false; rejectSearch?.(new Error("cancelled")); },
  };
  const analysis = new MoveEvaluation({ game, settings, overlay, getHeld: () => held, createEngine: () => engine });
  const scores = () => new Map(game.game.moves({ verbose: true }).map((m) => [moveToken(m), { ...score(9999), reply: "e7e5" }]));
  return { game, settings, overlay, engine, analysis, setHeld: (h) => held = h,
    positions, fallbackCalls: () => fallbackCalls,
    resolve: () => resolveSearch(scores()), reject: () => rejectSearch(new Error("analysis failed")), publish: async () => { resolveSearch(scores()); await analysis.pending; }, calls: () => calls, baselineCalls: () => baselineCalls, disposed: () => disposed };
}
test("held piece gets only its legal destinations; baseline comes from the current position and cache avoids repeat search", async () => {
  const f = fixture(); f.analysis.update(); await flush();
  assert.deepEqual(f.overlay.entries, []); // Regular tiles while evaluation is pending.
  await f.publish(); assert.equal(f.overlay.entries.find((x) => x.square === "e4").delta, -9);
  assert.equal(f.overlay.entries.find((x) => x.square === "e4").text, "-9.0");
  f.resolve(); await f.analysis.pending;
  f.setHeld(null); f.analysis.update(); await flush(); assert.equal(f.overlay.entries.length, 0);
  f.setHeld({ from: "g1" }); f.analysis.update(); await flush();
  assert.deepEqual(f.overlay.entries.map((x) => x.square).sort(), ["f3", "h3"]);
  assert.equal(f.calls(), 1);
});
for (const interruption of ["restart", "disabled", "promotion", "opponent"]) {
  test(`${interruption} clears hints and rejects stale publications`, async () => {
    const f = fixture(); f.analysis.update(); await flush();
    if (interruption === "restart") { f.game.epoch++; f.game.phase = "loading"; }
    if (interruption === "disabled") f.settings.evaluateMove = false;
    if (interruption === "promotion") f.game.phase = "promotion";
    if (interruption === "opponent") f.game.phase = "thinking";
    f.analysis.update(); await flush();
    await f.publish(); await flush();
    assert.equal(f.overlay.entries.length, 0); assert.equal(f.disposed(), 1);
  });
}
test("analysis starts before pickup and caches every piece with one search per turn", async () => {
  const f = fixture(); f.game.phase = "player"; f.setHeld(null);
  f.analysis.update(); await flush(); assert.equal(f.calls(), 1); assert.equal(f.overlay.entries.length, 0);
  await f.publish(); assert.equal(f.overlay.entries.length, 0);
  f.resolve(); await f.analysis.pending;
  f.game.phase = "grabbing"; f.setHeld({ from: "e2" }); f.analysis.update(); await flush();
  assert.equal(f.overlay.entries.find((x) => x.square === "e4").delta, -9);
  f.setHeld({ from: "g1" }); f.analysis.update(); await flush();
  assert.deepEqual(f.overlay.entries.map((x) => x.square).sort(), ["f3", "h3"]);
  for (let i = 0; i < 100; i++) f.analysis.update(); await flush();
  assert.equal(f.calls(), 1);
});
test("release, repickup and hidden Options/tracking preserve the in-flight turn search", async () => {
  const f = fixture(); f.analysis.update(); await flush();
  f.game.phase = "player"; f.setHeld(null); f.analysis.update(); await flush();
  assert.equal(f.disposed(), 0);
  f.game.phase = "grabbing"; f.setHeld({ from: "g1" }); f.analysis.update(false);
  await f.publish(); assert.equal(f.overlay.entries.length, 0);
  f.resolve(); await f.analysis.pending;
  f.analysis.update(true);
  assert.deepEqual(f.overlay.entries.map((x) => x.square).sort(), ["f3", "h3"]);
  assert.equal(f.calls(), 1); assert.equal(f.disposed(), 0);
});
test("analysis waits for committed opponent move, skips game over and starts once on each new player turn", async () => {
  const f = fixture(); f.setHeld(null); f.game.phase = "moving";
  f.game.game.move("e4"); f.analysis.update(); await flush(); assert.equal(f.calls(), 0);
  f.game.game.move("e5"); f.game.phase = "player"; f.analysis.update(); await flush();
  assert.equal(f.calls(), 1); f.resolve(); await f.analysis.pending;
  f.game.game.move("Nf3"); f.game.phase = "thinking"; f.analysis.update(); await flush();
  f.game.game.move("Nc6"); f.game.phase = "moving"; f.analysis.update(); await flush();
  assert.equal(f.calls(), 1);
  f.game.phase = "player"; f.analysis.update(); await flush();
  assert.equal(f.calls(), 2); f.resolve(); await f.analysis.pending;
  f.game.game.load("7k/6Q1/5K2/8/8/8/8/8 b - - 0 1");
  f.game.playerColor = "b"; f.game.phase = "player"; f.analysis.update(); await flush();
  assert.equal(f.calls(), 2); assert.equal(f.overlay.entries.length, 0);
});
test("Black analyzes after White's opening; failure does not retry on every pickup", async () => {
  const f = fixture(); f.setHeld(null); f.game.playerColor = "b"; f.game.phase = "player";
  f.analysis.update(); await flush(); assert.equal(f.calls(), 0);
  f.game.game.move("e4"); f.analysis.update(); await flush(); assert.equal(f.calls(), 1);
  f.reject(); await f.analysis.pending;
  f.game.phase = "grabbing"; f.setHeld({ from: "e7" }); f.analysis.update(); await flush();
  f.game.phase = "player"; f.setHeld(null); f.analysis.update(); await flush();
  assert.equal(f.calls(), 1);
});
test("disabled option creates no engine and no hints", async () => {
  const f = fixture(); f.settings.evaluateMove = false; f.analysis.update(); await flush();
  assert.equal(f.calls(), 0); assert.equal(f.overlay.entries.length, 0);
});

test("deltas subtract the independent current score rather than the best candidate score", async () => {
  const f = fixture(); f.analysis.update(); await flush();
  // Candidate scores supplied by the engine may improve on its baseline estimate.
  f.resolve(); await f.analysis.pending;
  const base = f.analysis.cache.baseline;
  assert.equal(base.value, 30); assert.equal(f.baselineCalls(), 1);
  assert.equal(f.overlay.entries.find((x) => x.square === "e3").delta, 0);
  f.analysis.cancel(true);
  const g = fixture();
  const scorePosition = g.engine.scorePosition.bind(g.engine);
  g.engine.scorePosition = async (fen) => fen === g.game.game.fen() ? score(-70) : scorePosition(fen);
  g.analysis.update(); await flush(); await g.publish();
  assert.equal(g.overlay.entries.find((x) => x.square === "e3").delta, 1);
  assert.equal(g.overlay.entries.find((x) => x.square === "e3").text, "+1.0");
  assert.equal(g.overlay.entries.find((x) => x.square === "e4").delta, -8);
  g.resolve(); await g.analysis.pending;
  g.setHeld({ from: "g1" }); g.analysis.update(); await flush();
  assert.equal(g.calls(), 1);
});
test("canceling during current-position evaluation never starts a candidate search", async () => {
  const f = fixture(); let resolveBaseline;
  f.engine.scorePosition = () => new Promise((resolve) => { resolveBaseline = resolve; });
  f.analysis.update(); await flush();
  assert.equal(f.calls(), 0);
  f.game.epoch++; f.game.phase = "loading"; f.analysis.update(); await flush();
  resolveBaseline(score(30)); await f.analysis.pending;
  assert.equal(f.calls(), 0); assert.equal(f.overlay.entries.length, 0);
});
test("missing current-position score leaves tiles ordinary without inventing a baseline", async () => {
  const f = fixture(); f.engine.scorePosition = async () => null;
  f.analysis.update(); await f.analysis.pending;
  assert.equal(f.calls(), 0);
  assert.equal(f.overlay.entries.every((entry) => entry.delta === null), true);
  f.analysis.update(); await flush(); assert.equal(f.calls(), 0);
});
test("tile colors grade signed deltas, preserve neutral white and saturate large/mate results", async () => {
  const { evaluationColor } = await import("../../projects/chess/src/MoveEvaluationOverlay.mjs");
  assert.equal(evaluationColor(0).getHex(), 0xffffff);
  assert.equal(evaluationColor(0.1).getHex(), 0xffffff);
  assert.equal(evaluationColor(-0.100001).getHex(), 0xffcccc);
  assert.equal(evaluationColor(0.100001).getHex(), 0xccffcc);
  assert.equal(evaluationColor(-9).getHex(), 0xe44d45);
  assert.equal(evaluationColor(9).getHex(), 0x28b463);
  assert.equal(evaluationColor(-Infinity).getHex(), 0xe44d45);
  assert.equal(evaluationColor(Infinity).getHex(), 0x28b463);
  assert.equal(evaluationColor(null), null);
  assert.equal(evaluationColor(NaN), null);
  const a = evaluationColor(-0.5), b = evaluationColor(-1.5);
  assert.ok(a.g > b.g && a.b > b.b);
});
test("evaluation colors use existing tiles, keep pending tiles normal and survive hover on a Black board", async () => {
  const THREE = await import("../../projects/forest/vendor/three.module.js");
  const { MoveEvaluationOverlay } = await import("../../projects/chess/src/MoveEvaluationOverlay.mjs");
  const { ChessBoard } = await import("../../projects/chess/src/ChessBoard.mjs");
  const parent = new THREE.Group(); parent.position.set(0.2, -0.3, -0.8); parent.rotation.y = 0.7;
  const board = new ChessBoard(parent); board.setPlayerColor("b");
  const chess = new Chess(); board.sync(chess);
  const state = { game: chess, selected: "e2", last: null };
  board.highlight(state);
  const childCount = board.root.children.length;
  const { canvas } = canvasFixture();
  const overlay = new MoveEvaluationOverlay(board, { createCanvas: () => canvas });
  const color = (square) => {
    const index = (Number(square[1]) - 1) * 8 + square.charCodeAt(0) - 97;
    const value = new THREE.Color();
    board.squares.getColorAt(index, value);
    return value.getHex();
  };
  overlay.set([]);
  assert.equal(color("e3"), 0x607571); assert.equal(color("e4"), 0xd9d1b9);
  board.setInteraction({ over: "e4", valid: true });
  assert.equal(color("e4"), 0xd9d1b9);
  overlay.set([{ square: "e3", delta: 0 }, { square: "e4", delta: -9 }]);
  assert.equal(color("e3"), 0xffffff); assert.equal(color("e4"), 0xe44d45);
  board.setInteraction({ over: "e3", valid: true });
  assert.equal(color("e3"), 0xffffff); assert.equal(color("e4"), 0xe44d45);
  assert.equal(color("e2"), 0xe9ba59);
  assert.equal(board.root.children.length, childCount + 1); // One shared text atlas.
  overlay.clear(); assert.equal(color("e4"), 0x67bd9e);
  state.selected = null; board.setInteraction(); board.highlight(state);
  assert.equal(color("e4"), 0xd9d1b9);
});
test("promotion tiles use the best available choice; missing scores leave regular tiles", async () => {
  const { squareEvaluations } = await import("../../projects/chess/src/MoveEvaluationOverlay.mjs");
  const squares = squareEvaluations([
    { square: "a8", promotion: "q", delta: -9 },
    { square: "a8", promotion: "n", delta: 0 },
    { square: "b8", delta: null },
  ]);
  assert.equal(squares.get("a8"), 0); assert.equal(squares.has("b8"), false);
});
test("numeric color deltas respect either player and mate outcomes", async () => {
  const { moveEvaluationDelta } = await import("../../projects/chess/src/Evaluation.mjs");
  assert.equal(moveEvaluationDelta(score(30), score(-870), "w"), -9);
  assert.equal(moveEvaluationDelta(score(-30), score(870), "b"), -9);
  assert.equal(moveEvaluationDelta(null, score(10), "w"), null);
  assert.equal(moveEvaluationDelta(score(0), score(2, "mate"), "w"), Infinity);
  assert.equal(moveEvaluationDelta(score(0), score(2, "mate"), "b"), -Infinity);
  assert.equal(moveEvaluationDelta(score(2, "mate"), score(4, "mate"), "w"), 0);
  assert.equal(moveEvaluationDelta(score(2, "mate"), score(1000), "w"), -Infinity);
});

test("debug numbers lie on tile surfaces, use piece depth, rotate glyphs for Black and clear while pending", async () => {
  const THREE = await import("../../projects/forest/vendor/three.module.js");
  const { MoveEvaluationOverlay } = await import("../../projects/chess/src/MoveEvaluationOverlay.mjs");
  const { ChessBoard } = await import("../../projects/chess/src/ChessBoard.mjs");
  const board = new ChessBoard(new THREE.Group());
  const { canvas, calls } = canvasFixture();
  const overlay = new MoveEvaluationOverlay(board, { createCanvas: () => canvas });
  overlay.set([]); assert.equal(overlay.surface, undefined);
  const entries = [{ square: "e4", delta: -9, text: "-9.0" }];
  overlay.set(entries);
  assert.equal(overlay.surface.parent, board.root);
  assert.equal(overlay.surface.rotation.x, -Math.PI / 2);
  assert.ok(overlay.surface.position.y > 0 && overlay.surface.position.y < 0.001);
  assert.equal(overlay.surface.material.depthTest, true);
  assert.equal(overlay.surface.material.depthWrite, false);
  assert.deepEqual(calls.filter(([name]) => name === "translate"), [["translate", 576, 576]]);
  assert.deepEqual(calls.filter(([name]) => name === "fillText"), [["fillText", "-9.0", 0, 0]]);
  const version = overlay.surface.material.map.version;
  overlay.set(entries); assert.equal(overlay.surface.material.map.version, version);
  board.setPlayerColor("b"); overlay.set(entries);
  assert.deepEqual(calls.filter(([name]) => name === "rotate"), [["rotate", Math.PI]]);
  overlay.set([{ square: "a8", promotion: "q", delta: -9, text: "-9.0" },
    { square: "a8", promotion: "n", delta: 0, text: "0.0" }]);
  assert.deepEqual(calls.filter(([name]) => name === "fillText").at(-1), ["fillText", "0.0", 0, 0]);
  overlay.set([]); assert.equal(overlay.surface.visible, false);
  assert.equal(board.moveEvaluationActive, true);
  overlay.clear(); assert.equal(board.moveEvaluationActive, false);
});

test("each endpoint is scored after exactly the candidate and its PV reply, not with the root search score", async () => {
  const f = fixture(); f.analysis.update(); await flush(); await f.publish();
  const branch = new Chess(f.game.game.fen()); branch.move("e4"); branch.move("e5");
  assert.ok(f.positions.includes(branch.fen()));
  assert.equal(f.positions.length, 21); // Baseline plus twenty two-ply endpoints.
  assert.equal(f.fallbackCalls(), 0);
  assert.equal(f.overlay.entries.find((entry) => entry.square === "e4").delta, -9);
  assert.deepEqual(f.game.game.history(), []);
});
test("missing PV response is explicitly searched and applied before endpoint scoring", async () => {
  const f = fixture();
  f.engine.analyzeMoves = async (_, moves) => new Map(moves.map((move) => [move, score(9999)]));
  f.analysis.update(); await f.analysis.pending;
  assert.equal(f.fallbackCalls(), 20);
  assert.equal(f.positions.length, 21);
  for (const fen of f.positions.slice(1)) assert.equal(fen.split(" ")[1], "w");
});
test("terminal candidate or reply is scored without requesting an illegal continuation", async () => {
  for (const [fen, token, reply, expected] of [
    ["7k/5Q2/5K2/8/8/8/8/8 w - - 0 1", "f7g7", null, Infinity],
    ["7k/5Q2/5K2/8/8/8/8/8 w - - 0 1", "f7g6", null, -0.3],
    ["8/8/8/8/8/5kq1/P7/7K w - - 0 1", "a2a3", "g3g2", -Infinity],
  ]) {
    const position = new Chess(fen);
    const candidate = position.moves({ verbose: true }).find((move) => moveToken(move) === token);
    assert.ok(candidate);
    position.moves = () => [candidate];
    const game = { game: position, phase: "grabbing", epoch: 1, playerColor: "w" };
    let evaluations = 0, continuations = 0, entries = [];
    const engine = { ready: true,
      scorePosition: async () => { evaluations++; return score(30); },
      analyzeMoves: async () => new Map([[token, { ...score(9999), reply }]]),
      bestMove: async () => { continuations++; throw Error("Unexpected continuation"); },
    };
    const analysis = new MoveEvaluation({ game, settings: { evaluateMove: true },
      getHeld: () => ({ from: token.slice(0, 2) }), createEngine: () => engine,
      overlay: { clear() { entries = []; }, set(value) { entries = value; } },
    });
    analysis.update(); await analysis.pending;
    assert.equal(entries[0].delta, expected);
    assert.equal(evaluations, 1); assert.equal(continuations, 0);
  }
});
test("static eval parsing is White-relative, and checked positions fall back to depth one", async () => {
  const { parseStaticEvaluation } = await import("../../projects/chess/src/Evaluation.mjs");
  assert.equal(parseStaticEvaluation("Final evaluation       +1.25 (white side)", fen).value, 125);
  assert.equal(parseStaticEvaluation("Final evaluation       +1.25 (white side)", fen.replace(" w ", " b ")).value, 125);
  assert.equal(parseStaticEvaluation("Final evaluation: none (in check)", fen), null);
  let worker; const engine = new EngineController({ createWorker: () => worker = new Worker() });
  await engine.initialize(1500);
  const pending = engine.scorePosition(fen);
  worker.emit("Final evaluation       +0.30 (white side)");
  assert.equal((await pending).value, 30);
  assert.equal(worker.commands.includes("eval"), true);
  assert.equal(worker.commands.some((command) => command.startsWith("go ")), false);
  const checked = engine.scorePosition(fen);
  worker.emit("Final evaluation: none (in check)"); await flush();
  assert.ok(worker.commands.includes("go depth 1"));
  worker.emit("info depth 1 score cp 25 pv e2e4"); worker.emit("bestmove e2e4");
  assert.equal((await checked).value, 25);
  engine.dispose();
});

test("holding the hint highlights the strongest cached piece, clears on release/Options, and never re-searches", async () => {
  const f = fixture(); let held = true; const hints = [];
  f.game.phase = "player"; f.setHeld(null);
  f.analysis.getHintHeld = () => held;
  f.analysis.onHint = (square) => hints.push(square);
  f.engine.scorePosition = async (fen) => {
    const position = new Chess(fen);
    return score(position.get("f3")?.type === "n" ? 230 : 30);
  };
  f.analysis.update(); await flush();
  assert.equal(f.analysis.hintFrom, null); // Wait for all candidates before naming the best.
  await f.publish(); assert.equal(f.analysis.hintFrom, "g1");
  held = false; f.analysis.update(); assert.equal(hints.at(-1), null);
  held = true; f.analysis.update(); assert.equal(hints.at(-1), "g1");
  f.analysis.update(false); assert.equal(hints.at(-1), null);
  f.analysis.update(true); assert.equal(hints.at(-1), "g1");
  assert.equal(f.calls(), 1);
  f.settings.evaluateMove = false; f.analysis.update(); assert.equal(hints.at(-1), null);
});
test("board hint overrides hover while held and restores normal/selected materials on release", async () => {
  const THREE = await import("../../projects/forest/vendor/three.module.js");
  const { ChessBoard } = await import("../../projects/chess/src/ChessBoard.mjs");
  const board = new ChessBoard(new THREE.Group()); const position = new Chess(); board.sync(position);
  const state = { game: position, selected: null, last: null };
  board.highlight(state); board.setInteraction({ hovered: ["g1"] });
  const piece = board.pieces.get("g1");
  const count = board.root.children.length;
  board.setBestMoveHint("g1"); assert.equal(piece.material, board.bestMoveMaterials.w);
  board.setBestMoveHint(null); assert.equal(piece.material, board.hoverMaterial);
  board.setInteraction(); assert.equal(piece.material, board.materials.w);
  board.setBestMoveHint("g8"); assert.equal(board.pieces.get("g8").material, board.bestMoveMaterials.b);
  board.setBestMoveHint(null); assert.equal(board.pieces.get("g8").material, board.materials.b);
  assert.equal(board.root.children.length, count);
});

test("cached best-piece selection respects Black's perspective and still picks the least-bad move", async () => {
  for (const color of ["w", "b"]) {
    const f = fixture(); f.game.playerColor = color; f.game.phase = "player"; f.setHeld(null);
    if (color === "b") f.game.game.move("e4");
    const knightSquare = color === "w" ? "f3" : "f6";
    f.engine.scorePosition = async (fen) => {
      if (fen === f.game.game.fen()) return score(0);
      const knight = new Chess(fen).get(knightSquare)?.type === "n";
      // Both alternatives are worse from the player's perspective.
      return score((knight ? -50 : -200) * (color === "w" ? 1 : -1));
    };
    f.analysis.getHintHeld = () => true;
    f.analysis.update(); await flush(); await f.publish();
    assert.equal(f.analysis.hintFrom, color === "w" ? "g1" : "g8");
    assert.equal(f.calls(), 1);
  }
});
