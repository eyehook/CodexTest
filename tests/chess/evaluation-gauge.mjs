import { test } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "../../projects/forest/vendor/three.module.js";
import { Chess } from "../../projects/chess/vendor/chess/chess.mjs";
import { EvaluationGauge, playerEvaluation, needleRotation, gaugeColor } from "../../projects/chess/src/EvaluationGauge.mjs";
import { CurrentEvaluation } from "../../projects/chess/src/CurrentEvaluation.mjs";
import { MoveEvaluation } from "../../projects/chess/src/MoveEvaluation.mjs";
const tick = () => new Promise((resolve) => setImmediate(resolve));
const cp = (value) => ({ type: "cp", value });
function canvasFixture() {
  const calls = [];
  const ctx = Object.fromEntries(["clearRect", "beginPath", "moveTo", "arc", "closePath", "fill", "stroke", "lineTo", "fillText"]
    .map((name) => [name, (...args) => calls.push([name, ...args])]));
  return { canvas: { getContext: () => ctx }, calls };
}
test("semicircle maps player scores to left/center/right, with clamped mates and smooth red/white/green arc", () => {
  assert.equal(playerEvaluation(cp(250), "w"), 2.5);
  assert.equal(playerEvaluation(cp(250), "b"), -2.5);
  assert.equal(playerEvaluation({ type: "mate", value: -3 }, "b"), 5);
  assert.equal(needleRotation(-8), Math.PI / 2);
  assert.equal(needleRotation(0), 0);
  for (const value of [-0.1, -0.09, 0.09, 0.1]) assert.equal(needleRotation(value), 0);
  assert.ok(needleRotation(-0.11) > 0);
  assert.ok(needleRotation(0.11) < 0);
  assert.equal(needleRotation(8), -Math.PI / 2);
  assert.equal(gaugeColor(0).getHex(), 0xe94b48);
  assert.equal(gaugeColor(0.5).getHex(), 0xffffff);
  assert.equal(gaugeColor(1).getHex(), 0x2cbd63);
  assert.ok(gaugeColor(0.25).g > gaugeColor(0).g);
});
test("gauge is optional, draws a semicircular arc and black needle, and hides an unknown score", () => {
  const { canvas, calls } = canvasFixture();
  const gauge = new EvaluationGauge(new THREE.Group(), { createCanvas: () => canvas });
  gauge.update(false, cp(100), "w"); assert.equal(gauge.face, undefined);
  gauge.update(true, cp(-500), "w");
  assert.equal(gauge.root.visible, true); assert.equal(gauge.needle.material.color.getHex(), 0);
  assert.equal(gauge.needle.rotation.z, 0);
  for (let i = 0; i < 40; i++) gauge.tick(1 / 60);
  assert.equal(gauge.needle.rotation.z, Math.PI / 2);
  const tip = new THREE.Vector3(0, 0.188, 0).applyQuaternion(gauge.needle.quaternion);
  assert.ok(tip.x < -0.18 && Math.abs(tip.y) < 1e-6);
  assert.ok(calls.some(([name, , , , start, end]) => name === "arc" && start === Math.PI && end === Math.PI * 2));
  const version = gauge.face.material.map.version;
  gauge.update(true, cp(500), "w");
  assert.equal(gauge.needle.rotation.z, Math.PI / 2);
  for (let i = 0; i < 40; i++) gauge.tick(1 / 60);
  assert.equal(gauge.needle.rotation.z, -Math.PI / 2);
  assert.equal(gauge.face.material.map.version, version);
  gauge.update(true, null, "w"); assert.equal(gauge.needle.visible, false);
  gauge.update(false, cp(0), "w"); assert.equal(gauge.root.visible, false);
});
function fixture() {
  const game = { game: new Chess(), epoch: 1, playerColor: "w", phase: "player" };
  const settings = { showEvaluation: true, evaluateMove: false };
  let resolve, calls = 0, disposed = 0;
  const received = [];
  const engine = { ready: true, busy: false,
    scorePosition(fen) { calls++; this.busy = true; return new Promise((r) => { resolve = (score) => { this.busy = false; r({ ...score, fen }); }; }); },
    dispose() { disposed++; this.busy = false; },
  };
  const current = new CurrentEvaluation({ game, settings, createEngine: () => engine, onChange: (s) => received.push(s) });
  return { game, settings, current, received, engine, resolve: (score) => resolve(score), calls: () => calls, disposed: () => disposed };
}
test("gauge scores only the beginning of a player turn and holds the old value through the opponent turn", async () => {
  const f = fixture(); f.current.update(); await tick(); assert.equal(f.calls(), 1);
  f.resolve(cp(120)); await f.current.pending; assert.equal(f.received.at(-1).value, 120);
  f.current.update(); assert.equal(f.calls(), 1);
  const received = f.received.length;
  f.game.game.move("e4"); f.game.phase = "thinking"; f.current.update(); await tick();
  assert.equal(f.calls(), 1); assert.equal(f.received.at(-1).value, 120);
  f.game.game.move("e5"); f.game.phase = "moving"; f.current.update(); await tick();
  assert.equal(f.calls(), 1);
  f.game.phase = "player"; f.current.update(); await tick();
  assert.equal(f.calls(), 2); assert.equal(f.received.length, received);
  f.resolve(cp(-80)); await f.current.pending; assert.equal(f.received.at(-1).value, -80);
});
test("gauge reuses a shared move-hint baseline and ignores stale/reset/off results", async () => {
  const f = fixture(); let resolveShared;
  f.current.getSharedScore = () => new Promise((resolve) => { resolveShared = resolve; });
  f.current.update(); await tick(); assert.equal(f.calls(), 0);
  resolveShared(cp(80)); await f.current.pending;
  assert.equal(f.received.at(-1).value, 80); assert.equal(f.calls(), 0);
  f.game.game.move("e4"); f.game.game.move("e5"); f.current.update(); await tick();
  f.settings.showEvaluation = false; f.current.update(); resolveShared(cp(900)); await f.current.pending;
  assert.equal(f.received.at(-1), null);
});
test("game over retains the last player-turn score and new-game loading clears it", async () => {
  const f = fixture(); f.current.update(); await tick(); f.resolve(cp(80)); await f.current.pending;
  const received = f.received.length;
  f.game.game.load("7k/6Q1/5K2/8/8/8/8/8 b - - 0 1"); f.game.phase = "over";
  f.current.update(); await tick();
  assert.equal(f.received.length, received); assert.equal(f.calls(), 1);
  f.game.game.load("7k/8/5KQ1/8/8/8/8/8 b - - 0 1"); f.current.update(); await tick();
  assert.equal(f.received.at(-1).value, 80); assert.equal(f.calls(), 1);
  f.game.epoch++; f.game.phase = "loading"; f.current.update();
  assert.equal(f.received.at(-1), null);
});
test("MoveEvaluation shares its baseline before the expensive reply search and retains it after dropping", async () => {
  const game = { game: new Chess(), phase: "player", epoch: 1, playerColor: "w" };
  let finishSearch, scoreCalls = 0;
  const engine = { ready: true, busy: false,
    async scorePosition(fen) { scoreCalls++; return { ...cp(25), fen }; },
    analyzeMoves() { this.busy = true; return new Promise((r) => { finishSearch = r; }); },
    dispose() { this.busy = false; finishSearch?.(new Map()); },
  };
  const hints = new MoveEvaluation({ game, settings: { evaluateMove: true }, getHeld: () => null,
    overlay: { clear() {}, set() {} }, createEngine: () => engine });
  hints.update(); const shared = hints.baselineFor(game.game.fen(), 1);
  assert.equal((await shared).value, 25); assert.equal(scoreCalls, 1);
  assert.equal(hints.baselineFor(game.game.fen(), 1).value, 25);
  hints.cancel(); await hints.pending;
  assert.equal(hints.baselineFor(game.game.fen(), 1).value, 25);
});

for (const hz of [30, 72, 120]) {
  test(`needle sweeps smoothly without overshoot at ${hz} Hz`, () => {
    const { canvas } = canvasFixture();
    const gauge = new EvaluationGauge(new THREE.Group(), { createCanvas: () => canvas });
    gauge.update(true, cp(-500), "w");
    for (let i = 0; i < hz; i++) gauge.tick(1 / hz);
    const old = gauge.needle.rotation.z;
    gauge.update(true, cp(500), "w"); assert.equal(gauge.needle.rotation.z, old);
    let previous = old, intermediate = false;
    for (let i = 0; i < Math.ceil(hz * gauge.duration) + 1; i++) {
      gauge.tick(1 / hz);
      const angle = gauge.needle.rotation.z;
      assert.ok(angle <= previous + 1e-9 && angle >= -Math.PI / 2);
      intermediate ||= angle < old && angle > -Math.PI / 2;
      previous = angle;
    }
    assert.ok(intermediate); assert.equal(gauge.needle.rotation.z, -Math.PI / 2);
  });
}
test("needle retargets from its current angle and pauses while hidden", () => {
  const { canvas } = canvasFixture();
  const gauge = new EvaluationGauge(new THREE.Group(), { createCanvas: () => canvas });
  gauge.update(true, cp(500), "w"); for (let i = 0; i < 10; i++) gauge.tick(1 / 60);
  const midway = gauge.needle.rotation.z;
  gauge.update(true, cp(-500), "w"); assert.equal(gauge.needle.rotation.z, midway);
  gauge.tick(0); assert.equal(gauge.needle.rotation.z, midway);
  gauge.update(false, null, "w"); gauge.tick(0.05); assert.equal(gauge.needle.rotation.z, midway);
  gauge.update(true, cp(-500), "w"); for (let i = 0; i < 40; i++) gauge.tick(1 / 60);
  assert.equal(gauge.needle.rotation.z, Math.PI / 2);
});
test("Black waits for White's move and shares exactly the hint baseline at the start of its turn", async () => {
  const f = fixture(); f.game.playerColor = "b"; f.game.phase = "thinking";
  let sharedCalls = 0;
  f.current.getSharedScore = async () => { sharedCalls++; return cp(-150); };
  f.current.update(); await tick(); assert.equal(sharedCalls, 0); assert.equal(f.calls(), 0);
  f.game.game.move("e4"); f.game.phase = "moving"; f.current.update(); await tick();
  assert.equal(sharedCalls, 0);
  f.game.phase = "player"; f.current.update(); await f.current.pending;
  assert.equal(sharedCalls, 1); assert.equal(f.calls(), 0);
  assert.equal(playerEvaluation(f.received.at(-1), "b"), 1.5);
});
