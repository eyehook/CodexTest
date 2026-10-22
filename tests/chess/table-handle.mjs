import { test } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "../../projects/forest/vendor/three.module.js";
import { TableHandle } from "../../projects/chess/src/TableHandle.mjs";
import { Settings } from "../../projects/chess/src/Settings.mjs";
function fixture() {
  const scene = new THREE.Group(),
    anchor = new THREE.Group(),
    world = new THREE.Group();
  scene.add(anchor);
  anchor.add(world);
  anchor.position.set(1, 1.2, -2);
  anchor.rotation.y = 0.7;
  let saves = 0,
    allowed = true;
  const settings = new Settings({
    getItem: () => null,
    setItem: () => saves++,
  });
  const apply = () =>
    world.position.set(settings.offset, settings.height, -settings.distance);
  apply();
  const handle = new TableHandle({
    parent: world,
    settings,
    canGrab: () => allowed,
    onMove: apply,
    onEnd: () => {
      apply();
      settings.save();
    },
  });
  const point = (x, y, z) => {
    anchor.updateWorldMatrix(true, true);
    return anchor.localToWorld(new THREE.Vector3(x, y, z));
  };
  const start = point(0, settings.height, -settings.distance + 0.345);
  return {
    handle,
    settings,
    world,
    point,
    start,
    saves: () => saves,
    allow: (value) => (allowed = value),
  };
}
test("positioning controller adds no handle mesh to the table", () => {
  const f = fixture();
  assert.equal(f.world.children.length, 0);
});
test("drag is anchored to seated axes, follows height/distance without cumulative drift, saves once on release", () => {
  const f = fixture();
  assert.ok(f.handle.begin("left", f.start, 3));
  const end = f.start
    .clone()
    .add(f.point(0.12, 0.08, 0.12).sub(f.point(0, 0, 0)));
  for (let i = 0; i < 20; i++) f.handle.move(end);
  assert.ok(Math.abs(f.settings.height - -0.27) < 1e-10);
  assert.ok(Math.abs(f.settings.distance - 0.53) < 1e-10);
  assert.ok(Math.abs(f.settings.offset - 0.12) < 1e-10);
  assert.ok(Math.abs(f.world.position.x - 0.12) < 1e-10);
  assert.equal(f.saves(), 0);
  assert.equal(f.handle.begin("right", end, 3), false);
  f.handle.end();
  f.handle.end();
  assert.equal(f.saves(), 1);
  assert.equal(f.handle.active, null);
});
test("height/distance retain bounds and return naturally from clamped reach", () => {
  const f = fixture();
  f.handle.begin("left", f.start, 0);
  f.handle.move(f.start.clone().add(f.point(3, 3, -3).sub(f.point(0, 0, 0))));
  assert.equal(f.settings.offset, 0.25);
  assert.equal(f.settings.height, -0.1);
  assert.equal(f.settings.distance, 1);
  f.handle.move(f.start);
  assert.ok(Math.abs(f.settings.offset) < 1e-10);
  assert.ok(Math.abs(f.settings.height + 0.35) < 1e-10);
  assert.ok(Math.abs(f.settings.distance - 0.65) < 1e-10);
  f.handle.move(f.start.clone().add(f.point(-3, -3, 3).sub(f.point(0, 0, 0))));
  assert.equal(f.settings.offset, -0.25);
  assert.equal(f.settings.height, -0.65);
  assert.equal(f.settings.distance, 0.45);
});
test("handle cannot begin when chess movement locks table positioning", () => {
  const f = fixture();
  f.allow(false);
  assert.equal(f.handle.begin("left", f.start, 0), false);
  assert.equal(f.handle.active, null);
});

test("left/right adjustments persist and later grabs start from the saved offset", () => {
  const f = fixture();
  let saved;
  f.settings.storage = {
    setItem: (_, value) => (saved = value),
    getItem: () => saved,
  };
  f.handle.begin("left", f.start, 0);
  const right = f.start.clone().add(f.point(0.16, 0, 0).sub(f.point(0, 0, 0)));
  f.handle.move(right);
  f.handle.end();
  assert.ok(Math.abs(new Settings(f.settings.storage).offset - 0.16) < 1e-10);
  f.handle.begin("right", right, 0);
  f.handle.move(right.clone().add(f.point(-0.22, 0, 0).sub(f.point(0, 0, 0))));
  assert.ok(Math.abs(f.settings.offset + 0.06) < 1e-10);
});
