import { test } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "../../projects/forest/vendor/three.module.js";
import { TableControls } from "../../projects/chess/src/TableControls.mjs";
test("tabletop buttons use finite physical contact after table translation and rotation", () => {
  const root = new THREE.Group();
  root.position.set(0.2, -0.3, -0.7);
  root.rotation.y = 0.8;
  const button = new THREE.Mesh(
    new THREE.PlaneGeometry(0.16, 0.065),
    new THREE.MeshBasicMaterial(),
  );
  button.rotation.x = -Math.PI / 2;
  button.position.set(0.34, -0.033, 0.345);
  root.add(button);
  root.updateMatrixWorld(true);
  const controls = { root, targets: [button] };
  const hit = (point) =>
    TableControls.prototype.touchTarget.call(
      controls,
      button.localToWorld(point),
    );
  assert.equal(hit(new THREE.Vector3(0, 0, 0.035)), button);
  assert.equal(hit(new THREE.Vector3(0, 0, 0.08)), null);
  assert.equal(hit(new THREE.Vector3(0.2, 0, 0.01)), null);
  root.visible = false;
  assert.equal(hit(new THREE.Vector3(0, 0, 0.01)), null);
});

test("move columns group committed SAN by full-move number and retain newest rows", async () => {
  const { moveRows } = await import(
    "../../projects/chess/src/TableControls.mjs"
  );
  const { Chess } = await import("../../projects/chess/vendor/chess/chess.mjs");
  const game = new Chess();
  for (let i = 0; i < 5; i++)
    for (const san of ["Nf3", "Nf6", "Ng1", "Ng8"]) game.move(san);
  let rows = moveRows(game.history({ verbose: true }));
  assert.equal(rows.length, 8);
  assert.equal(rows[0].number, 3);
  assert.deepEqual(rows.at(-1), { number: 10, white: "Ng1", black: "Ng8" });
  game.move("Nf3");
  rows = moveRows(game.history({ verbose: true }));
  assert.deepEqual(rows.at(-1), { number: 11, white: "Nf3", black: "" });
  assert.deepEqual(moveRows([]), []);
  assert.deepEqual(
    moveRows([
      { before: "8/8/8/8/8/8/8/8 b - - 0 27", color: "b", san: "O-O" },
    ]),
    [{ number: 27, white: "", black: "O-O" }],
  );
});
test("move list and optional evaluation gauge replace the status panel above the board", () => {
  const previous = globalThis.document,
    painted = [];
  globalThis.document = {
    createElement: () => ({
      getContext: () => ({
        fillRect() {},
        measureText: (t) => ({ width: t.length * 20 }),
        fillText: (...args) => painted.push(args),
      }),
    }),
  };
  try {
    const controls = new TableControls(new THREE.Group());
    assert.ok(controls.root.position.x > 0.3);
    assert.ok(controls.root.position.y > 0.55);
    assert.ok(controls.root.position.z < -0.52);
    assert.equal(controls.status, undefined);
    assert.equal(controls.gauge.root.visible, false);
    assert.ok(controls.moves.position.y < controls.gauge.root.position.y);
    assert.ok(painted.some(([text]) => text === "White"));
    assert.ok(painted.some(([text]) => text === "Black"));
    controls.update("Your turn", [{ color: "w", san: "e4" }]);
    assert.ok(painted.some(([text, x]) => text === "1." && x === 30));
    assert.ok(painted.some(([text, x]) => text === "e4" && x === 155));
    const count = painted.length;
    controls.update("Your turn", [{ color: "w", san: "e4" }]);
    assert.equal(painted.length, count);
    controls.update("New game", []);
    assert.equal(controls.movesKey, "[]");
  } finally {
    globalThis.document = previous;
  }
});
