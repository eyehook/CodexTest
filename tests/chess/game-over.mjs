import { test } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "../../shared/vendor/three-r180/three.module.js";
import { Chess } from "../../projects/chess/vendor/chess/chess.mjs";
import {
  gameOverResult,
  GameOverPanel,
} from "../../projects/chess/src/GameOverPanel.mjs";
const blackMated = new Chess("7k/6Q1/6K1/8/8/8/8/8 b - - 0 1");
const whiteMated = new Chess("8/8/8/8/8/6k1/6q1/7K w - - 0 1");
test("game over reports player-relative wins, losses and draws", () => {
  for (const [game, loser] of [
    [blackMated, "b"],
    [whiteMated, "w"],
  ]) {
    assert.ok(game.isCheckmate());
    for (const playerColor of ["w", "b"])
      assert.equal(
        gameOverResult({ phase: "over", game, playerColor }),
        playerColor === loser ? "You Lost!" : "You Won!",
      );
  }
  for (const fen of [
    "7k/5Q2/6K1/8/8/8/8/8 b - - 0 1",
    "7k/8/8/8/8/8/8/K7 w - - 0 1",
  ]) {
    const game = new Chess(fen);
    assert.ok(game.isDraw());
    assert.equal(
      gameOverResult({ phase: "over", game, playerColor: "w" }),
      "Draw!",
    );
  }
  assert.equal(
    gameOverResult({ phase: "player", game: new Chess(), playerColor: "w" }),
    null,
  );
});
test("billboard selects result artwork and retains New Game contact; restart hides it", () => {
  const previous = globalThis.document;
  const painted = [];
  globalThis.document = {
    createElement: () => ({
      getContext: () => ({
        fillRect() {},
        measureText: (t) => ({ width: t.length * 20 }),
        fillText: (t) => painted.push(t),
      }),
    }),
  };
  try {
    const world = new THREE.Group();
    world.position.set(0.2, -0.3, -0.7);
    world.rotation.y = 0.8;
    const loaded = [];
    const panel = new GameOverPanel(world, {
      loadTexture: (url) => {
        loaded.push(url);
        return new THREE.Texture();
      },
    });
    assert.equal(panel.root.visible, false);
    panel.update({ phase: "over", game: blackMated, playerColor: "w" });
    assert.equal(loaded.length, 3);
    assert.ok(loaded.every((url) => url.includes("/assets/game-over/")));
    assert.equal(panel.title.material.map, panel.art["You Won!"]);
    panel.update({ phase: "over", game: blackMated, playerColor: "b" });
    assert.equal(panel.title.material.map, panel.art["You Lost!"]);
    panel.update({
      phase: "over",
      game: new Chess("7k/8/8/8/8/8/8/K7 w - - 0 1"),
      playerColor: "w",
    });
    assert.equal(panel.title.material.map, panel.art["Draw!"]);
    assert.deepEqual(painted, ["New Game"]);
    assert.equal(panel.root.visible, true);
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(0.5, 1.2, 1);
    panel.faceCamera(camera);
    world.updateMatrixWorld(true);
    const point = panel.button.getWorldPosition(new THREE.Vector3());
    assert.equal(panel.touchTarget(point), panel.button);
    assert.equal(panel.button.userData.action, "restart");
    panel.highlight([panel.button]);
    assert.equal(panel.buttonHighlight.visible, true);
    panel.highlight([]);
    assert.equal(panel.buttonHighlight.visible, false);
    panel.highlight([panel.button]);
    assert.equal(panel.button.material.color.getHex(), 0xffd57c);
    panel.update({ phase: "loading", game: new Chess(), playerColor: "w" });
    assert.equal(panel.root.visible, false);
    assert.equal(panel.targets.length, 0);
    assert.equal(panel.touchTarget(point), null);
  } finally {
    globalThis.document = previous;
  }
});
