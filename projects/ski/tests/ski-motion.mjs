import assert from 'node:assert/strict';
import test from 'node:test';
import {advanceSkiAngle, SkiMotion, SkiSteering} from '../ski-motion.mjs';

const speed = ski => Math.hypot(ski.vx, ski.vz);

function travel(ski, seconds, {x = 500, z = 500, hz = 90, steering = 0, brake = 0, tuck = 0} = {}) {
  let yaw = 0;
  for (let i = 0; i < seconds * hz; i++) {
    ski.updateTuck(1 / hz, tuck);
    ski.advance(1 / hz, x, z, steering, brake, yaw);
    ({x, z} = ski);
    yaw = ski.rigYaw;
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

test('a second push adds no speed and full braking stops on steep terrain', () => {
  const ski = new SkiMotion((x, z) => 500 + z, 1000, 1000);
  ski.push(0, -1);
  const initialSpeed = speed(ski);
  ski.push(1, 0);
  assert.equal(ski.vx, 0);
  assert.equal(speed(ski), initialSpeed);
  travel(ski, 2, {brake: 1});
  assert.equal(ski.active, false);
  assert.equal(speed(ski), 0);
});

test('steering changes course in both directions without adding speed on flat ground', () => {
  for (const steering of [-1, 1]) {
    const ski = new SkiMotion(() => 500, 1000, 1000);
    ski.push(0, -1);
    const result = travel(ski, 1, {steering});
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


test('cross-slope gravity causes drift without turning the neutral rig', () => {
  const ski = new SkiMotion(x => 500 - x * 0.35, 1000, 1000);
  ski.push(0, -1);
  const result = travel(ski, 2);
  assert.ok(result.x > 500);
  assert.ok(ski.vx > 0);
  assert.equal(result.yaw, 0);
});

test('ski deflection accumulates at 1–45 degrees per second and recenters at neutral', () => {
  const radians = degrees => degrees * Math.PI / 180;
  const halfSecond = advanceSkiAngle(0, -1, 0.5);
  assert.equal(halfSecond, radians(22.5));
  assert.equal(advanceSkiAngle(halfSecond, -1, 0.5), radians(45));
  assert.equal(advanceSkiAngle(halfSecond, -1, 1), radians(45));
  assert.equal(advanceSkiAngle(0, 1, 0.5), -radians(22.5));
  assert.ok(Math.abs(advanceSkiAngle(0, 1e-8, 1) + radians(1)) < 1e-8);
  assert.equal(advanceSkiAngle(halfSecond, 1, 0.5), 0);
  assert.equal(advanceSkiAngle(halfSecond, 0, 0.25), radians(11.25));
  assert.equal(advanceSkiAngle(halfSecond, 0, 1), 0);
});

test('a fast uphill approach takes air at a crest and lands with its horizontal momentum', () => {
  const height = z => 500 + Math.max(0, Math.min(3, (500 - z) * 0.35));
  const contacts = [];
  const ski = new SkiMotion((x, z) => height(z), 1000, 1000, (airborne, velocity) => {
    contacts.push({airborne, velocity, verticalSpeed: ski.vy});
  });
  ski.push(0, -1);
  ski.vz = -11.5;
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
      if (alreadyAirborne) {
        assert.equal(speed(ski), before);
        assert.equal(ski.vx, 0);
        assert.equal(x, 500);
        assert.ok(ski.angle < 0 && ski.angle >= -Math.PI / 4);
      }
    }
    assert.ok(ski.y >= height(z));
  }
  assert.ok(airtime > 0.35 && airtime < 1.25);
  assert.ok(maxClearance > 0.3 && maxClearance < 2);
  assert.equal(ski.airborne, false);
  assert.equal(ski.y, height(z));
  assert.ok(ski.active);
  ski.stop();
  assert.deepEqual(contacts.map(contact => contact.airborne), [true, false]);
  assert.ok(contacts[1].velocity > 0);
  assert.equal(contacts[1].velocity, -contacts[1].verticalSpeed);
});

test('slow crests and steady inclines keep the skier grounded', () => {
  const slow = new SkiMotion((x, z) => 500 + Math.min(3, (500 - z) * 0.35), 1000, 1000);
  const steady = new SkiMotion((x, z) => 500 + (500 - z) * 0.35, 1000, 1000);
  slow.push(0, -1);
  steady.push(0, -1);
  steady.vz = -11.5;
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
  gentle.vz = -8.5;
  gentle.advance(1 / 120, 500, 500, 0, 0);
  assert.ok(speed(gentle) > 8);
  assert.equal(gentle.airborne, false);
});

test('either stick owns steering past 5% until it returns to neutral', () => {
  const steering = new SkiSteering();
  assert.equal(steering.read(0.05, -0.05), 0);
  assert.ok(steering.read(0, -0.06) < 0);
  assert.ok(steering.read(1, -0.1) < 0);
  assert.ok(steering.read(0.2, 0.05) > 0);
  assert.ok(steering.read(0.06, -1) > 0);
  assert.equal(steering.read(0, 0), 0);
  assert.equal(steering.read(1, -1), 1);
  steering.reset();
  assert.equal(steering.read(0.2, -1), -1);
  assert.equal(steering.read(1, undefined), 1);
});

test('the rig starts following the skis immediately without snapping to their angle', () => {
  const ski = new SkiMotion(() => 500, 1000, 1000);
  ski.push(0, -1);
  ski.advance(1 / 90, 500, 500, 1, 0, 0);
  assert.ok(ski.angle < 0 && ski.angle >= -Math.PI / 4);
  assert.ok(Math.abs(ski.angle + Math.PI / 360) < 1e-12);
  assert.ok(ski.rigYaw < 0 && ski.rigYaw > ski.angle);
  assert.ok(ski.vx > 0);
});

test('tucking eases view height relative to seated offset and reduces drag without a push', () => {
  const height = (_x, z) => 500 + z * 0.35;
  const upright = new SkiMotion(height, 1000, 1000);
  const tucked = new SkiMotion(height, 1000, 1000);
  const flat = new SkiMotion(() => 500, 1000, 1000);
  for (const ski of [upright, tucked, flat]) ski.push(0, -1);

  tucked.updateTuck(1 / 90, 1);
  assert.ok(tucked.viewOffset(1.2, 0.55) < 1.2 && tucked.viewOffset(1.2, 0.55) > 1.15);
  assert.equal(speed(tucked), 5.5);
  travel(tucked, 6, {tuck: 1});
  travel(upright, 6);
  travel(flat, 6, {tuck: 1});
  assert.ok(speed(tucked) > speed(upright) + 1);
  assert.ok(speed(flat) < 5.5);
  assert.ok(Math.abs(tucked.viewOffset(1.2, 0.55) + 0.55 - 1) < 1e-12);
  assert.ok(Math.abs(tucked.viewOffset(0, 1.7) + 1.7 - 1) < 1e-12);
  tucked.updateTuck(1 / 90, 0);
  assert.ok(tucked.viewOffset(1.2, 0.55) > 1 - 0.55 && tucked.viewOffset(1.2, 0.55) < 1.2);
  travel(tucked, 2);
  assert.equal(tucked.viewOffset(1.2, 0.55), 1.2);
});

test('a pole push adds 5 m/s from walking and at all forward ski speeds', () => {
  const ski = new SkiMotion(() => 500, 1000, 1000);
  ski.polePush(0, -1);
  assert.equal(ski.active, true);
  assert.equal(ski.vz, -5);
  for (const initial of [4, 8, 15, 20, 25, 45]) {
    ski.vz = -initial;
    ski.polePush(1, 0);
    assert.equal(ski.vx, 0);
    assert.ok(Math.abs(speed(ski) - (initial + 5)) < 1e-12);
  }
  ski.airborne = true;
  ski.vz = -4;
  ski.polePush(1, 0);
  assert.equal(speed(ski), 4);
});

test('a pole push counters backward travel along the skis and preserves sideways momentum', () => {
  const ski = new SkiMotion(() => 500, 1000, 1000);
  for (const [initial, expected] of [[8, 3], [3, -2]]) {
    ski.push(0, -1);
    ski.vx = 2;
    ski.vz = initial;
    ski.polePush(0, -1);
    assert.equal(ski.vx, 2);
    assert.equal(ski.vz, expected);
  }

  ski.vx = 0;
  ski.vz = 5;
  ski.polePush(0, -1);
  assert.equal(ski.vz, 0);
  assert.equal(ski.active, false);
});

test('releasing a tuck adds immediate upward momentum on flat snow or a steady incline', () => {
  const dt = 1 / 120;
  for (const grade of [0, -0.22, 0.22]) {
    const height = (_x, z) => 500 + (z - 500) * grade;
    const ski = new SkiMotion(height, 1000, 1000);
    ski.push(0, -1);
    assert.equal(ski.popPending, false);
    for (let i = 0; i < 120; i++) ski.updateTuck(dt, 1);
    ski.updateTuck(dt, 0);
    ski.advance(dt, 500, 500, 0, 0);
    assert.equal(ski.airborne, true);
    assert.ok(ski.y > height(ski.x, ski.z));
    assert.ok(Math.abs(ski.vy - (-5.5 * grade + 2.5 - 9.81 * dt)) < 1e-9);
    assert.equal(ski.popPending, false);
  }
});
