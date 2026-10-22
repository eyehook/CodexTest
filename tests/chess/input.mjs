import { test } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "../../projects/forest/vendor/three.module.js";
import { InputController } from "../../projects/chess/src/InputController.mjs";
import { Settings, effectiveElo } from "../../projects/chess/src/Settings.mjs";
test("both controller triggers require visible viewer and live tracked input", () => {
  const controllers = [new THREE.Group(), new THREE.Group()];
  const session = { visibilityState: "visible" };
  const selected = [];
  const renderer = {
    xr: {
      getController: (i) => controllers[i],
      getSession: () => session,
      isPresenting: true,
    },
    domElement: { addEventListener() {} },
  };
  const input = new InputController({
    renderer,
    scene: new THREE.Scene(),
    camera: new THREE.PerspectiveCamera(),
    board: { pieces: new Map(), squares: new THREE.Object3D() },
    ui: { root: { visible: false }, targets: [] },
    onSquare: (s) => selected.push(s),
    onAction() {},
  });
  input.hit = () => ({ object: { userData: { square: "e2" } }, distance: 1 });
  for (const c of controllers)
    c.dispatchEvent({ type: "connected", data: { targetRaySpace: {} } });
  const frame = { getPose: () => ({}) };
  input.update(frame, {}, true);
  for (const c of controllers) c.dispatchEvent({ type: "selectstart" });
  assert.equal(selected.length, 2);
  input.update(frame, {}, false);
  controllers[0].dispatchEvent({ type: "selectstart" });
  assert.equal(selected.length, 2);
  input.update({ getPose: () => null }, {}, true);
  controllers[0].dispatchEvent({ type: "selectstart" });
  assert.equal(selected.length, 2);
  input.update(frame, {}, true);
  session.visibilityState = "hidden";
  controllers[0].dispatchEvent({ type: "selectstart" });
  assert.equal(selected.length, 2);
  session.visibilityState = "visible";
  controllers[0].dispatchEvent({ type: "disconnected" });
  controllers[0].dispatchEvent({ type: "selectstart" });
  assert.equal(selected.length, 2);
  controllers[0].dispatchEvent({
    type: "connected",
    data: { targetRaySpace: {} },
  });
  input.update(frame, {}, true);
  controllers[0].dispatchEvent({ type: "selectstart" });
  assert.equal(selected.length, 3);
});
test("unavailable storage and malformed advertised range are safe", () => {
  const s = new Settings({
    getItem() {
      throw new Error("blocked");
    },
    setItem() {
      throw new Error("blocked");
    },
  });
  assert.equal(s.elo, 1500);
  assert.doesNotThrow(() => s.save());
  assert.throws(() => effectiveElo(1500, {}));
});
