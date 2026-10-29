import { test } from "node:test";
import assert from "node:assert/strict";
import * as T from "../../../shared/vendor/three-r180/three.module.js";
import { ObjectManager, primitiveGeometry } from "../objects.js";
import {
  defaults,
  objectDefaults,
  OBJECT_TYPES,
  setUniformScale,
  InteractionState,
  saveScene,
  loadScene,
  validateScene,
  lightDefaults,
  STORAGE_KEY,
} from "../model.js";
const make = () => {
  const scene = new T.Scene(),
    settings = defaults(),
    interaction = new InteractionState();
  return {
    scene,
    settings,
    interaction,
    manager: new ObjectManager(scene, settings, interaction),
  };
};
const storage = () => {
  const map = new Map();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => map.set(k, v),
  };
};
test("four primitives have half-meter dimensions, square pyramid base and white Standard materials", () => {
  const { manager } = make();
  for (const type of OBJECT_TYPES) {
    const r = manager.create(type);
    r.root.geometry.computeBoundingBox();
    const size = r.root.geometry.boundingBox.getSize(new T.Vector3());
    for (const axis of ["x", "y", "z"])
      assert(Math.abs(size[axis] - 0.5) < 1e-6, `${type} ${axis}`);
    assert.equal(r.root.material.type, "MeshStandardMaterial");
    assert.equal(r.root.material.metalness, 0);
    assert.equal(r.root.material.roughness, 0.5);
    assert.equal(r.root.material.opacity, 1);
    assert.equal(r.root.castShadow, true);
    assert.equal(r.root.receiveShadow, true);
  }
  const p = primitiveGeometry("pyramid"),
    pos = p.attributes.position;
  for (let i = 0; i < pos.count; i++)
    if (pos.getY(i) < -0.24 && Math.hypot(pos.getX(i), pos.getZ(i)) > 0.1) {
      assert(Math.abs(Math.abs(pos.getX(i)) - 0.25) < 1e-6);
      assert(Math.abs(Math.abs(pos.getZ(i)) - 0.25) < 1e-6);
    }
  p.dispose();
  manager.dispose();
});
test("materials are independent; geometry is shared and retained until manager disposal", () => {
  const { manager } = make(),
    a = manager.create("sphere"),
    b = manager.create("sphere");
  assert.equal(a.root.geometry, b.root.geometry);
  assert.notEqual(a.root.material, b.root.material);
  let geometryDisposed = 0,
    materialDisposed = 0;
  a.root.geometry.addEventListener("dispose", () => geometryDisposed++);
  a.root.material.addEventListener("dispose", () => materialDisposed++);
  a.data.material.color = [255, 0, 0];
  a.data.material.metalness = 0.8;
  manager.apply(a);
  assert.deepEqual(b.data.material.color, [255, 255, 255]);
  assert.equal(b.root.material.metalness, 0);
  manager.remove(a.data.id);
  assert.equal(materialDisposed, 1);
  assert.equal(geometryDisposed, 0);
  manager.dispose();
  assert.equal(geometryDisposed, 1);
});
test("All is absolute, axes are independent, and last All survives axis edits", () => {
  const { manager } = make(),
    r = manager.create("cube");
  setUniformScale(r.data, 2.5);
  manager.apply(r);
  assert.deepEqual(r.root.scale.toArray(), [2.5, 2.5, 2.5]);
  r.data.scale[0] = 4;
  r.data.scale[2] = 0.1;
  manager.apply(r);
  assert.deepEqual(r.root.scale.toArray(), [4, 2.5, 0.1]);
  assert.equal(r.data.allScale, 2.5);
  setUniformScale(r.data, 2.5);
  manager.apply(r);
  assert.deepEqual(r.root.scale.toArray(), [2.5, 2.5, 2.5]);
  assert.throws(() => setUniformScale(r.data, NaN));
  manager.dispose();
});
test("hover, selection and grabs use a removable overlay without changing material properties", () => {
  const { manager, interaction } = make(),
    r = manager.create("cylinder"),
    before = r.root.material.color.getHex();
  r.hovered = true;
  manager.update();
  assert(r.outline.visible);
  assert.equal(r.outline.material.color.getHex(), 0x59cfff);
  interaction.select(r.data.id);
  manager.update();
  assert.equal(r.outline.material.color.getHex(), 0x6effa4);
  interaction.beginGrab("left", r.data.id);
  manager.update();
  assert.equal(r.outline.material.color.getHex(), 0xff944d);
  interaction.clear();
  r.hovered = false;
  manager.update();
  assert(!r.outline.visible);
  assert.equal(r.root.material.color.getHex(), before);
  manager.dispose();
});
test("global shadow changes preserve per-object cast/receive preferences", () => {
  const { manager, settings } = make(),
    r = manager.create("pyramid");
  r.data.receiveShadow = false;
  manager.apply(r);
  settings.shadows = false;
  manager.apply(r);
  assert(!r.root.castShadow);
  assert(r.data.castShadow);
  assert(!r.root.receiveShadow);
  settings.shadows = true;
  manager.apply(r);
  assert(r.root.castShadow);
  assert(!r.root.receiveShadow);
  manager.dispose();
});
test("version 1 light-only saves migrate without rewriting storage or losing light properties", () => {
  const s = storage(),
    old = { version: 1, settings: defaults(), lights: [lightDefaults("spot")] };
  old.lights[0].shadows = true;
  s.setItem(STORAGE_KEY, JSON.stringify(old));
  const loaded = loadScene(s);
  assert.equal(loaded.version, 2);
  assert.deepEqual(loaded.lights, old.lights);
  assert.deepEqual(loaded.objects, []);
  assert.equal(JSON.parse(s.getItem(STORAGE_KEY)).version, 1);
});
test("v2 saves round-trip object transforms, Standard material, flags and last All", () => {
  const s = storage(),
    o = objectDefaults("cube");
  o.position = [1, 2, -3];
  o.rotation = [0, Math.SQRT1_2, 0, Math.SQRT1_2];
  o.scale = [0.1, 10, 2.5];
  o.allScale = 3;
  o.material = {
    type: "standard",
    color: [31, 99, 200],
    metalness: 0.8,
    roughness: 0.16,
  };
  o.castShadow = false;
  saveScene(s, defaults(), [lightDefaults("point")], [o]);
  assert.deepEqual(loadScene(s).objects, [o]);
  assert.equal(loadScene(s).lights.length, 1);
  const live = [];
  live.push(o);
  live.length = 0;
  assert.equal(loadScene(s).objects.length, 1);
});
test("invalid object data and cross-collection identity collisions fail before restore", () => {
  const o = objectDefaults("sphere"),
    raw = { version: 2, settings: defaults(), lights: [], objects: [o] };
  for (const bad of [
    { ...o, scale: [0, 1, 1] },
    { ...o, material: { ...o.material, type: "physical" } },
    { ...o, material: { ...o.material, roughness: 2 } },
    { ...o, castShadow: "true" },
  ])
    assert.throws(() => validateScene({ ...raw, objects: [bad] }));
  const light = lightDefaults("point", o.id);
  assert.throws(() => validateScene({ ...raw, lights: [light] }));
});
test("nonuniformly scaled grabbed objects serialize world transforms and keep scale through release", () => {
  const { manager, scene } = make(),
    r = manager.create("cube"),
    grip = new T.Group();
  scene.add(grip);
  grip.position.set(0.5, 1, -0.5);
  grip.rotation.set(0.1, 0.3, 0);
  r.root.position.set(1, 1.2, -1);
  r.data.scale = [0.1, 10, 2.5];
  manager.apply(r);
  const before = r.root.getWorldPosition(new T.Vector3());
  grip.attach(r.root);
  assert(r.root.getWorldPosition(new T.Vector3()).distanceTo(before) < 1e-8);
  grip.position.x += 0.7;
  grip.rotateY(0.5);
  const world = r.root.getWorldPosition(new T.Vector3());
  const serialized = manager.serialize()[0];
  assert.deepEqual(serialized.scale, [0.1, 10, 2.5]);
  assert.deepEqual(serialized.position, world.toArray());
  scene.attach(r.root);
  assert(r.root.position.distanceTo(world) < 1e-8);
  assert.doesNotThrow(() =>
    validateScene({
      version: 2,
      settings: defaults(),
      lights: [],
      objects: [serialized],
    }),
  );
  manager.dispose();
});
