import {deadzone} from '../../shared/xr/input.mjs';

// Project gravity onto the slope while supported. In the air, integrate
// vertical gravity independently of horizontal momentum.
const GRAVITY = 9.81;
const PUSH_SPEED = 5.5;
const TUCK_DROP = 0.45;
const TUCK_RESPONSE = 6;
const TUCK_DRAG_RATIO = 0.48;
const SLIDE_RESISTANCE = 0.38;
const SKIER_MASS_KG = 165 * 0.45359237;
const AIR_DENSITY = 1.225;
const DRAG_AREA = 0.55;
const AIR_DRAG = 0.5 * AIR_DENSITY * DRAG_AREA / SKIER_MASS_KG;
const BRAKE_ACCELERATION = 13;
const STOP_SPEED = 0.18;
const SLOPE_RADIUS = 3;
const MAX_SKI_ANGLE = Math.PI / 4;
const MIN_SKI_YAW_RATE = Math.PI / 180;
const MAX_SKI_YAW_RATE = Math.PI / 4;
const EDGE_RESPONSE = 4;
const EDGE_ACCELERATION = 8;
const STEP = 1 / 120;
const CONTACT_SAMPLE_DISTANCE = 1.5;
const RIG_YAW_RESPONSE = 1.1;
const MAX_RIG_YAW_RATE = 40 * Math.PI / 180;

export function advanceSkiAngle(angle, steering, dt) {
  if (steering === 0) {
    return Math.sign(angle) * Math.max(0, Math.abs(angle) - MAX_SKI_YAW_RATE * dt);
  }
  const magnitude = Math.min(1, Math.abs(steering));
  const rate = MIN_SKI_YAW_RATE + magnitude * (MAX_SKI_YAW_RATE - MIN_SKI_YAW_RATE);
  const next = angle - Math.sign(steering) * rate * dt;
  return Math.max(-MAX_SKI_ANGLE, Math.min(MAX_SKI_ANGLE, next));
}

const STEERING_DEAD_ZONE = 0.05;

export class SkiSteering {
  owner = null;

  reset() {
    this.owner = null;
  }

  read(left, right) {
    left = deadzone(left, STEERING_DEAD_ZONE);
    right = deadzone(right, STEERING_DEAD_ZONE);
    if (this.owner === 'left' && left !== 0) return left;
    if (this.owner === 'right' && right !== 0) return right;
    if (left === 0 && right === 0) {
      this.reset();
      return 0;
    }
    this.owner = Math.abs(left) >= Math.abs(right) ? 'left' : 'right';
    return this.owner === 'left' ? left : right;
  }
}

export class SkiMotion {
  constructor(height, width, depth) {
    this.height = height;
    this.width = width;
    this.depth = depth;
    this.tuck = 0;
    this.stop();
  }

  stop() {
    this.active = false;
    this.vx = 0;
    this.vz = 0;
    this.vy = 0;
    this.airborne = false;
    this.angle = 0;
  }

  push(forwardX, forwardZ) {
    if (this.active) return;
    this.vx = forwardX * PUSH_SPEED;
    this.vz = forwardZ * PUSH_SPEED;
    this.active = true;
  }

  updateTuck(dt, pressure) {
    const target = this.active ? pressure : 0;
    this.tuck += (target - this.tuck) * (1 - Math.exp(-TUCK_RESPONSE * Math.min(dt, 0.05)));
    if (Math.abs(this.tuck - target) < 0.001) this.tuck = target;
  }

  viewOffset(seatedHeight) {
    return seatedHeight - TUCK_DROP * this.tuck;
  }

  takeoffVelocity(x, z, ground, nextGround, dt) {
    const speed = Math.hypot(this.vx, this.vz);
    const travelTime = CONTACT_SAMPLE_DISTANCE / speed;
    const dx = this.vx * travelTime;
    const dz = this.vz * travelTime;
    const behind = this.height(x - dx, z - dz);
    const ahead = this.height(x + dx, z + dz);
    const surfaceAcceleration = ((ahead - ground) - (ground - behind)) / (travelTime * travelTime);
    // Contact can push upward, but it cannot pull the skier down faster than gravity.
    if (surfaceAcceleration >= -GRAVITY) return undefined;
    const verticalSpeed = (ground - behind) / travelTime;
    const projectedHeight = ground + (verticalSpeed - GRAVITY * dt / 2) * dt;
    return projectedHeight > nextGround ? verticalSpeed : undefined;
  }

  advanceGroundVelocity(step, heading, brake) {
    const speed = Math.hypot(this.vx, this.vz);
    const vx = this.vx;
    const vz = this.vz;

    const dx = (this.height(this.x + SLOPE_RADIUS, this.z) -
      this.height(this.x - SLOPE_RADIUS, this.z)) / (2 * SLOPE_RADIUS);
    const dz = (this.height(this.x, this.z + SLOPE_RADIUS) -
      this.height(this.x, this.z - SLOPE_RADIUS)) / (2 * SLOPE_RADIUS);
    const gravity = GRAVITY / (1 + dx * dx + dz * dz);
    let nextVX = vx - gravity * dx * step;
    let nextVZ = vz - gravity * dz * step;
    // Snow resists motion across the skis. Along-ski momentum carries through.
    const rightX = Math.cos(heading);
    const rightZ = -Math.sin(heading);
    const sideslip = nextVX * rightX + nextVZ * rightZ;
    const grip = Math.min(Math.abs(sideslip) * (1 - Math.exp(-EDGE_RESPONSE * step)),
      EDGE_ACCELERATION * step);
    nextVX -= Math.sign(sideslip) * grip * rightX;
    nextVZ -= Math.sign(sideslip) * grip * rightZ;
    const forceSpeed = Math.hypot(nextVX, nextVZ);
    const drag = AIR_DRAG * (1 - (1 - TUCK_DRAG_RATIO) * this.tuck) * speed * speed;
    const resistance = SLIDE_RESISTANCE + drag + BRAKE_ACCELERATION * brake;
    const nextSpeed = forceSpeed - resistance * step;
    // A stopped skier stands rather than automatically sliding backwards.
    if (nextSpeed <= STOP_SPEED || nextVX * vx + nextVZ * vz <= 0) {
      this.stop();
      return;
    }
    this.vx = nextVX * nextSpeed / forceSpeed;
    this.vz = nextVZ * nextSpeed / forceSpeed;
  }

  advance(dt, x, z, steering, brake, rigYaw = 0) {
    this.x = x;
    this.z = z;
    this.rigYaw = rigYaw;
    if (!this.active || !(dt > 0)) return;
    if (!this.airborne) this.y = this.height(x, z);
    const elapsed = Math.min(dt, 0.05);
    const steps = Math.ceil(elapsed / STEP);
    const step = elapsed / steps;

    for (let i = 0; i < steps; i++) {
      this.angle = advanceSkiAngle(this.angle, steering, step);
      const yawRate = Math.max(-MAX_RIG_YAW_RATE, Math.min(MAX_RIG_YAW_RATE, this.angle * RIG_YAW_RESPONSE));
      if (!this.airborne) {
        this.advanceGroundVelocity(step, this.rigYaw + this.angle, brake);
        if (!this.active) break;
      }
      const nextX = this.x + this.vx * step;
      const nextZ = this.z + this.vz * step;
      const clampedX = Math.max(0, Math.min(this.width, nextX));
      const clampedZ = Math.max(0, Math.min(this.depth, nextZ));
      if (clampedX !== nextX || clampedZ !== nextZ) {
        this.x = clampedX;
        this.z = clampedZ;
        this.stop();
        break;
      }

      const floor = this.height(nextX, nextZ);
      if (!this.airborne) {
        const takeoff = this.takeoffVelocity(this.x, this.z, this.y, floor, step);
        if (takeoff !== undefined) {
          this.vy = takeoff;
          this.airborne = true;
        }
      }
      this.x = nextX;
      this.z = nextZ;
      this.rigYaw += yawRate * step;
      if (this.airborne) {
        this.y += (this.vy - GRAVITY * step / 2) * step;
        this.vy -= GRAVITY * step;
        if (this.y > floor) continue;
        this.airborne = false;
        this.vy = 0;
      }
      this.y = floor;
    }
  }
}
