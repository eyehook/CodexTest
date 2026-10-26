import { test } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "../../projects/forest/vendor/three.module.js";
import { OptionsMenu } from "../../projects/chess/src/OptionsMenu.mjs";
import { Settings } from "../../projects/chess/src/Settings.mjs";
class TestMenu extends OptionsMenu {
  paint(mesh, text) { mesh.userData.text = text; }
}
function fixture() {
  let saved = null, resets = 0;
  const storage = { getItem: () => saved, setItem: (_, value) => { saved = value; } };
  const settings = new Settings(storage), scene = new THREE.Scene(), world = new THREE.Group();
  scene.add(world);
  const sources = [0, 1].map(() => ({ targetRaySpace: {}, gamepad: {
    mapping: "xr-standard", buttons: Array.from({ length: 6 }, () => ({ pressed: false })),
  } }));
  const input = { hands: sources.map((source) => ({ source })), reset() { resets++; } };
  const menu = new TestMenu({ scene, world, settings, input, label: (_, w, h) =>
    new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial()) });
  const camera = new THREE.PerspectiveCamera();
  const position = new THREE.Vector3();
  const frame = { getPose: () => ({ transform: { position, orientation: new THREE.Quaternion() } }) };
  const update = (tracked = true) => menu.update(frame, {}, tracked, camera);
  const press = (i, button, down) => { sources[i].gamepad.buttons[button].pressed = down; return update(); };
  update();
  const aim = (index) => {
    menu.root.updateWorldMatrix(true, true);
    menu.targets[index].getWorldPosition(position); position.z = 0;
  };
  return { menu, settings, storage, world, sources, position, update, press, aim, resets: () => resets };
}
test("Evaluate Move defaults off, validates stored booleans, and round-trips with other settings", () => {
  const f = fixture();
  assert.equal(f.settings.evaluateMove, false);
  f.settings.evaluateMove = true; f.settings.side = "black"; f.settings.save();
  const restored = new Settings(f.storage);
  assert.equal(restored.evaluateMove, true); assert.equal(restored.side, "black");
  assert.equal(new Settings({ getItem: () => '{"evaluateMove":"false"}' }).evaluateMove, false);
  assert.doesNotThrow(() => new Settings({ getItem() { throw Error(); } }).save());
});
test("Y/B edges open once, hide scene, save draft on close and restore scene", () => {
  const f = fixture();
  f.press(0, 5, true);
  assert.equal(f.menu.open, true); assert.equal(f.world.visible, false);
  f.update(); assert.equal(f.menu.open, true);
  f.menu.activate(f.menu.targets[0]);
  assert.equal(f.settings.evaluateMove, false);
  f.press(0, 5, false); f.press(1, 5, true);
  assert.equal(f.menu.open, false); assert.equal(f.world.visible, true);
  assert.equal(new Settings(f.storage).evaluateMove, true);
  assert.equal(f.resets(), 2);
  f.update(); assert.equal(f.menu.open, false);
});
test("either pointer toggles on fresh trigger only; Save Changes closes and hides both rays", () => {
  const f = fixture();
  f.press(0, 0, true); // Held trigger must not select on opening.
  f.press(0, 5, true);
  f.aim(0); f.update();
  assert.equal(f.menu.draft.evaluateMove, false);
  assert.equal(f.menu.pointers[0].visible, true);
  f.press(0, 0, false); f.press(0, 0, true);
  assert.equal(f.menu.draft.evaluateMove, true);
  f.update(); assert.equal(f.menu.draft.evaluateMove, true);
  f.press(1, 0, true); assert.equal(f.menu.draft.evaluateMove, false);
  f.press(1, 0, false);
  f.aim(f.menu.targets.length - 1); f.press(1, 0, true);
  assert.equal(f.menu.open, false);
  assert.equal(f.menu.pointers.every((p) => !p.visible), true);
});
test("tracking recovery consumes held buttons and disables rays until tracked", () => {
  const f = fixture();
  f.press(0, 5, true); f.press(0, 5, false);
  f.aim(0);
  f.update(false);
  assert.equal(f.menu.pointers.every((p) => !p.visible), true);
  f.sources[0].gamepad.buttons[0].pressed = true;
  f.sources[0].gamepad.buttons[5].pressed = true;
  f.update();
  assert.equal(f.menu.open, true); assert.equal(f.menu.draft.evaluateMove, false);
  f.press(0, 0, false); f.press(0, 0, true);
  assert.equal(f.menu.draft.evaluateMove, true);
});

test("Show Evaluation toggle is independent, defaults off and persists on Save Changes", () => {
  const f = fixture();
  assert.equal(f.settings.showEvaluation, false);
  f.press(0, 5, true); f.aim(1); f.update(); f.press(0, 0, true);
  assert.equal(f.menu.draft.showEvaluation, true);
  assert.equal(f.menu.draft.evaluateMove, false);
  assert.equal(f.settings.showEvaluation, false);
  f.press(0, 0, false); f.aim(f.menu.targets.length - 1); f.press(0, 0, true);
  assert.equal(f.menu.open, false);
  assert.equal(new Settings(f.storage).showEvaluation, true);
  assert.equal(new Settings(f.storage).evaluateMove, false);
  assert.equal(new Settings({ getItem: () => '{"showEvaluation":"true"}' }).showEvaluation, false);
});

test("another modal blocks Options without leaving a deferred menu-button press", () => {
  const f = fixture(); f.menu.canOpen = () => false;
  f.press(0, 5, true); assert.equal(f.menu.open, false);
  f.menu.canOpen = () => true; f.update(); assert.equal(f.menu.open, false);
  f.press(0, 5, false); f.press(0, 5, true); assert.equal(f.menu.open, true);
});
