import { test } from "node:test";
import assert from "node:assert/strict";
import * as T from "../../../shared/vendor/three-r180/three.module.js";
import { ObjectManager } from "../objects.js";
import { SceneEntities } from "../entities.js";
import { defaults, InteractionState } from "../model.js";
test("duplicate preserves current world pose and every object property with a new ID and independent material data", () => {
  const scene = new T.Scene(),
    interaction = new InteractionState(),
    manager = new ObjectManager(scene, defaults(), interaction),
    entities = new SceneEntities({ records: new Map() }, manager);
  const source = manager.create("cube");
  Object.assign(source.data, {
    scale: [2, 0.4, 1.3],
    allScale: 0.5,
    castShadow: false,
    receiveShadow: false,
  });
  Object.assign(source.data.material, {
    color: [30, 80, 140],
    metalness: 0.8,
    roughness: 0.12,
  });
  manager.apply(source);
  source.root.position.set(1, 2, -3);
  source.root.rotation.set(0.1, 0.3, 0.2);
  const hand = new T.Group();
  scene.add(hand);
  hand.position.set(0.4, 1, 0.6);
  hand.rotation.y = 0.6;
  hand.attach(source.root);
  hand.position.x += 0.7;
  hand.rotateY(0.3);
  const position = source.root.getWorldPosition(new T.Vector3()),
    quaternion = source.root.getWorldQuaternion(new T.Quaternion()).normalize(),
    copy = entities.duplicate(source.data.id);
  assert.notEqual(copy.data.id, source.data.id);
  assert(copy.root.position.distanceTo(position) < 1e-8);
  assert(Math.abs(copy.root.quaternion.dot(quaternion)) > 1 - 1e-8);
  assert.deepEqual(copy.data.scale, source.data.scale);
  assert.equal(copy.data.allScale, 0.5);
  assert.deepEqual(copy.data.material, source.data.material);
  assert.notEqual(copy.data.material, source.data.material);
  assert.notEqual(copy.data.material.color, source.data.material.color);
  assert.notEqual(copy.root.material, source.root.material);
  assert.equal(copy.root.geometry, source.root.geometry);
  assert(!copy.data.castShadow && !copy.data.receiveShadow);
  copy.data.material.color[0] = 255;
  copy.data.scale[0] = 4;
  manager.apply(copy);
  assert.equal(source.data.material.color[0], 30);
  assert.equal(source.data.scale[0], 2);
  assert.equal(entities.duplicate("missing"), null);
  manager.dispose();
});
