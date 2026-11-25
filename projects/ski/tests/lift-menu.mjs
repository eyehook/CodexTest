import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import * as THREE from '../../../shared/vendor/three-r180/three.module.js';
import {LiftMenu} from '../lift-menu.mjs';

const groups = JSON.parse(readFileSync(new URL('../data/mount-snow-lifts.json', import.meta.url)));

test('all 19 arrivals are past their upper terminal and clear of rendered buildings', () => {
  const buildings = JSON.parse(readFileSync(new URL('../data/mount-snow-buildings.json', import.meta.url)));
  const lifts = Object.values(groups).flat();
  assert.equal(lifts.length, 19);
  assert.equal(new Set(lifts.map(lift => lift.osmWay)).size, 19);
  for (const lift of lifts) {
    assert.ok(lift.upper.elevationMeters > lift.lowerElevationMeters);
    const dx = lift.x - lift.upper.x;
    const dz = lift.z - lift.upper.z;
    const [prevX, prevZ] = lift.route.at(lift.pylonIndices.at(-1) ?? -2);
    const routeX = lift.upper.x - prevX;
    const routeZ = lift.upper.z - prevZ;
    assert.ok(Math.abs(Math.hypot(dx, dz) - 10) < 0.02, lift.name);
    assert.ok(dx * routeX + dz * routeZ > 0, lift.name);
    assert.ok(Math.abs(dx * routeZ - dz * routeX) / Math.hypot(routeX, routeZ) < 0.03, lift.name);
    for (const building of buildings) {
      const x = lift.x - building.x;
      const z = lift.z - building.z;
      const cos = Math.cos(building.yaw);
      const sin = Math.sin(building.yaw);
      const edgeX = Math.max(0, Math.abs(x * cos - z * sin) - building.width / 2);
      const edgeZ = Math.max(0, Math.abs(x * sin + z * cos) - building.depth / 2);
      assert.ok(Math.hypot(edgeX, edgeZ) >= 2, lift.name);
    }
    assert.ok(lift.x > 0 && lift.x < 5323 && lift.z > 0 && lift.z < 3915);
  }
});

function setup(t, useHands) {
  const originalDocument = globalThis.document;
  globalThis.document = {createElement: () => ({getContext: () => ({fillRect() {}, fillText() {}})})};
  t.after(() => {
    if (originalDocument === undefined) delete globalThis.document;
    else globalThis.document = originalDocument;
  });
  const rig = new THREE.Group();
  rig.position.set(1550, 900, 1000);
  rig.rotation.y = 1.4;
  const menu = new LiftMenu(rig, groups);
  const viewer = {position: new THREE.Vector3(0.16, 1.7, 0.08), orientation: new THREE.Quaternion()};
  const grip = {position: new THREE.Vector3(0.16, 1.7, -0.52),
    orientation: new THREE.Quaternion().setFromAxisAngle(useHands ? new THREE.Vector3(1, 0, 0)
      : new THREE.Vector3(0, 1, 0), -Math.PI / 2)};
  const aim = {position: new THREE.Vector3(), orientation: new THREE.Quaternion()};
  const index = {position: new THREE.Vector3()};
  const thumb = {position: new THREE.Vector3(0.05, 0, 0)};
  const trigger = {value: 0};
  const y = {pressed: false};
  const left = {handedness: 'left', gripSpace: grip, gamepad: {buttons: [0, 0, 0, 0, 0, y]}};
  const right = {handedness: 'right', targetRaySpace: aim, targetRayMode: 'tracked-pointer', gripSpace: aim,
    gamepad: {buttons: [trigger]}};
  if (useHands) {
    left.hand = new Map([['middle-finger-metacarpal', grip]]);
    right.hand = new Map([['index-finger-tip', index], ['thumb-tip', thumb]]);
  }
  const frame = {getPose: transform => ({transform}), getJointPose: transform => ({transform})};
  const update = () => menu.update(frame, {}, [right, left], viewer);
  const down = pressed => {
    trigger.value = Number(pressed);
    thumb.position.x = pressed ? 0.01 : 0.05;
  };
  const point = row => {
    const mesh = menu.panel;
    aim.position.set(0, (0.5 - (110 + row * 62 + 25) / 616) * mesh.geometry.parameters.height, 0)
      .applyQuaternion(mesh.quaternion).add(mesh.position);
    aim.position.z += 0.15;
  };
  return {menu, update, down, point, grip, aim, y};
}

test('Y toggles once per press and tracked pill markers survive menu closure', t => {
  const {menu, update, grip, aim, y} = setup(t, false);
  y.pressed = true;
  update();
  assert.equal(menu.visible, false);
  assert.ok(menu.hands.left.visible && menu.hands.right.visible);
  assert.deepEqual(menu.hands.left.position, grip.position);
  assert.deepEqual(menu.hands.right.position, aim.position);
  y.pressed = false;
  update();
  y.pressed = true;
  update();
  assert.equal(menu.visible, true);
  const before = menu.panel.position.clone();
  grip.position.x += 0.1;
  grip.position.y += 0.06;
  update();
  assert.equal(menu.visible, true);
  assert.ok(menu.panel.position.x - before.x > 0.09);
  assert.ok(menu.panel.position.y - before.y > 0.05);
  y.pressed = false;
  update();
  y.pressed = true;
  update();
  assert.equal(menu.visible, false);
  assert.ok(menu.hands.left.visible && menu.hands.right.visible);
  menu.hide();
  assert.ok(!menu.hands.left.visible && !menu.hands.right.visible);
});

for (const useHands of [false, true]) {
  test(`Y opens the map and a fresh ${useHands ? 'pinch' : 'trigger'} chooses a lift`, t => {
    const {menu, update, down, point, y} = setup(t, useHands);
    down(true);
    update();
    y.pressed = true;
    update();
    assert.equal(menu.visible, true);
    point(0);
    assert.equal(update(), undefined);
    assert.equal(menu.area, null);
    down(false);
    update();
    down(true);
    update();
    assert.equal(menu.area, 'Main Face');
    point(1);
    assert.equal(update(), undefined);
    down(false);
    update();
    down(true);
    assert.equal(update()?.name, 'Bluebird Express');
    assert.equal(menu.visible, false);
    update();
    assert.equal(menu.visible, false);
    y.pressed = false;
    update();
    y.pressed = true;
    update();
    assert.equal(menu.visible, true);
  });
}
