import assert from 'node:assert/strict';
import test from 'node:test';
import {SkiMotion} from '../ski-motion.mjs';

const speed = ski => Math.hypot(ski.vx, ski.vz);

function travel(ski, seconds, {x = 500, z = 500, hz = 90, steering = 0, brake = 0} = {}) {
  let yaw = 0;
  for (let i = 0; i < seconds * hz; i++) {
    ski.advance(1 / hz, x, z, steering, brake);
    ({x, z} = ski);
    yaw = ski.followYaw(yaw, 1 / hz);
  }
  return {x, z, yaw};
}

test('gravity accelerates a skier downhill and slows the same push uphill', () => {
  const height = (x, z) => 500 + z * 0.35;
  const downhill = new SkiMotion(height, 1000, 1000);
  const uphill = new SkiMotion(height, 1000, 1000);
  downhill.push(0, -1);
  uphill.push(0, 1);
  assert.ok(travel(downhill, 3).z < 475);
  assert.ok(speed(downhill) > 11);
  assert.ok(travel(uphill, 3).z > 500);
  assert.equal(uphill.active, false);
  assert.equal(speed(uphill), 0);
});

test('a second push boosts the current course and full braking stops on steep terrain', () => {
  const ski = new SkiMotion((x, z) => 500 + z, 1000, 1000);
  ski.push(0, -1);
  const initialSpeed = speed(ski);
  ski.push(1, 0);
  assert.equal(ski.vx, 0);
  assert.equal(speed(ski), initialSpeed + 3);
  travel(ski, 2, {brake: 1});
  assert.equal(ski.active, false);
  assert.equal(speed(ski), 0);
});

test('steering changes course in both directions without adding speed on flat ground', () => {
  for (const steering of [-1, 1]) {
    const ski = new SkiMotion(() => 500, 1000, 1000);
    ski.push(0, -1);
    const result = travel(ski, 0.5, {steering});
    assert.ok((result.x - 500) * steering > 0.5);
    assert.ok(result.yaw * steering < 0);
    assert.ok(speed(ski) < 5.5);
  }
});

test('the map boundary stops skiing and integration is consistent across frame rates', () => {
  const edge = new SkiMotion(() => 500, 1000, 1000);
  edge.push(0, -1);
  assert.equal(travel(edge, 1, {z: 1}).z, 0);
  assert.equal(edge.active, false);

  const height = (x, z) => 500 + z * 0.35 + x * 0.1;
  const first = new SkiMotion(height, 1000, 1000);
  const second = new SkiMotion(height, 1000, 1000);
  first.push(0, -1);
  second.push(0, -1);
  const a = travel(first, 4, {hz: 72, steering: 0.3});
  const b = travel(second, 4, {hz: 120, steering: 0.3});
  assert.ok(Math.hypot(a.x - b.x, a.z - b.z) < 0.1);
  assert.ok(Math.abs(speed(first) - speed(second)) < 0.05);
});


test('rig follows downhill drift without steering and leaves a small heading dead zone', () => {
  const ski = new SkiMotion(x => 500 - x * 0.35, 1000, 1000);
  ski.push(0, -1);
  assert.equal(ski.followYaw(0.05, 1 / 90), 0.05);
  const {yaw} = travel(ski, 2);
  const course = Math.atan2(-ski.vx, -ski.vz);
  assert.ok(yaw < -0.3);
  assert.ok(Math.abs(yaw - course) < 0.18);
  assert.ok(Math.abs(yaw - course) > 0.07);
});

test('rig follows the shortest route across the yaw wrap and stops turning when stationary', () => {
  const ski = new SkiMotion(() => 500, 1000, 1000);
  const course = -Math.PI + 0.2;
  ski.push(-Math.sin(course), -Math.cos(course));
  const yaw = Math.PI - 0.2;
  const next = ski.followYaw(yaw, 1 / 90);
  assert.ok(next > yaw && next - yaw < 0.02);
  ski.stop();
  assert.equal(ski.followYaw(next, 1 / 90), next);
});
