import { test } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "../../projects/forest/vendor/three.module.js";
import { ChessBoard } from "../../projects/chess/src/ChessBoard.mjs";
import { coordinateLabels } from "../../projects/chess/src/BoardCoordinates.mjs";
test("left ranks and bottom files match player-facing squares for either color", () => {
  const parent = new THREE.Group();
  parent.position.set(0.2, -0.35, -0.7);
  parent.rotation.y = 0.8;
  const board = new ChessBoard(parent);
  for (const color of ["w", "b", "w"]) {
    board.setPlayerColor(color);
    parent.updateMatrixWorld(true);
    const labels = coordinateLabels(color),
      files = labels.filter((l) => l.z === 0.2525),
      ranks = labels.filter((l) => l.x === -0.2525);
    assert.equal(
      files.map((l) => l.text).join(""),
      color === "w" ? "abcdefgh" : "hgfedcba",
    );
    assert.equal(
      ranks.map((l) => l.text).join(""),
      color === "w" ? "12345678" : "87654321",
    );
    for (let i = 0; i < 8; i++) {
      const point = parent.worldToLocal(
        board.squareToWorld(`${files[i].text}${color === "w" ? "1" : "8"}`),
      );
      assert.ok(Math.abs(point.x - files[i].x) < 1e-9);
      const left = parent.worldToLocal(
        board.squareToWorld(`${color === "w" ? "a" : "h"}${ranks[i].text}`),
      );
      assert.ok(Math.abs(left.z - ranks[i].z) < 1e-9);
    }
    assert.deepEqual(board.coordinates.labels, labels);
    assert.equal(board.coordinates.root.rotation.y, 0);
  }
});
