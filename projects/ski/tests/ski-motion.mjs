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

test('a fast uphill approach takes air at a crest and lands with its horizontal momentum', () => {
  const height = z => 500 + Math.max(0, Math.min(3, (500 - z) * 0.35));
  const ski = new SkiMotion((x, z) => height(z), 1000, 1000);
  ski.push(0, -1);
  ski.push(0, -1);
  ski.push(0, -1);
  let x = 500;
  let z = 497;
  let airtime = 0;
  let maxClearance = 0;
  for (let i = 0; i < 170; i++) {
    const alreadyAirborne = ski.airborne;
    const before = speed(ski);
    if (alreadyAirborne) ski.push(0, -1);
    ski.advance(1 / 120, x, z, alreadyAirborne ? 1 : 0, alreadyAirborne ? 1 : 0);
    ({x, z} = ski);
    if (ski.airborne) {
      airtime += 1 / 120;
      maxClearance = Math.max(maxClearance, ski.y - height(z));
      if (alreadyAirborne) assert.equal(speed(ski), before);
    }
    assert.ok(ski.y >= height(z));
  }
  assert.ok(airtime > 0.35 && airtime < 1.25);
  assert.ok(maxClearance > 0.3 && maxClearance < 2);
  assert.equal(x, 500);
  assert.equal(ski.airborne, false);
  assert.equal(ski.y, height(z));
  assert.ok(ski.active);
});

test('slow crests and steady inclines keep the skier grounded', () => {
  const slow = new SkiMotion((x, z) => 500 + Math.min(3, (500 - z) * 0.35), 1000, 1000);
  const steady = new SkiMotion((x, z) => 500 + (500 - z) * 0.35, 1000, 1000);
  slow.push(0, -1);
  steady.push(0, -1);
  steady.push(0, -1);
  steady.push(0, -1);
  let slowZ = 492;
  let steadyZ = 497;
  for (let i = 0; i < 100; i++) {
    slow.advance(1 / 120, 500, slowZ, 0, 0);
    steady.advance(1 / 120, 500, steadyZ, 0, 0);
    ({z: slowZ} = slow);
    ({z: steadyZ} = steady);
    assert.ok(!slow.airborne && !steady.airborne);
  }
  assert.ok(slowZ < 500 - 3 / 0.35);
});

test('contact depends on curvature and speed, including takeoff below 8 m/s', () => {
  const height = (_x, z) => 500 + Math.min(0, z - 500) * 0.75;
  const sharp = new SkiMotion(height, 1000, 1000);
  sharp.push(0, -1);
  sharp.advance(1 / 120, 500, 500, 0, 0);
  assert.ok(speed(sharp) < 8);
  assert.equal(sharp.airborne, true);
  assert.equal(sharp.vy < 0, true);

  const gentle = new SkiMotion((_x, z) => 500 + Math.min(0, z - 500) * 0.04, 1000, 1000);
  gentle.push(0, -1);
  gentle.push(0, -1);
  gentle.advance(1 / 120, 500, 500, 0, 0);
  assert.ok(speed(gentle) > 8);
  assert.equal(gentle.airborne, false);
});
