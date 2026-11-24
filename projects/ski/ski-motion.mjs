// Project gravity onto the slope while supported. In the air, integrate
// vertical gravity independently of horizontal momentum.
const GRAVITY = 9.81;
const PUSH_SPEED = 5.5;
const BOOST_SPEED = 3.0;
const SLIDE_RESISTANCE = 0.38;
const SKIER_MASS_KG = 165 * 0.45359237;
const AIR_DENSITY = 1.225;
const DRAG_AREA = 0.55;
const AIR_DRAG = 0.5 * AIR_DENSITY * DRAG_AREA / SKIER_MASS_KG;
const BRAKE_ACCELERATION = 13;
const STOP_SPEED = 0.18;
const SLOPE_RADIUS = 3;
const MAX_TURN_RATE = 1.35;
const EDGE_ACCELERATION = 8;
const STEP = 1 / 120;
const CONTACT_SAMPLE_DISTANCE = 1.5;
const HEADING_DEAD_ZONE = 5 * Math.PI / 180;
const HEADING_FOLLOW_SPEED = 1;
const HEADING_RESPONSE = 6;
const MAX_YAW_RATE = 85 * Math.PI / 180;

export class SkiMotion {
  constructor(height, width, depth) {
    this.height = height;
    this.width = width;
    this.depth = depth;
    this.stop();
  }

  stop() {
    this.active = false;
    this.vx = 0;
    this.vz = 0;
    this.vy = 0;
    this.airborne = false;
  }

  push(forwardX, forwardZ) {
    if (this.airborne) return;
    if (this.active) {
      const speed = Math.hypot(this.vx, this.vz);
      const scale = 1 + BOOST_SPEED / speed;
      this.vx *= scale;
      this.vz *= scale;
    } else {
      this.vx = forwardX * PUSH_SPEED;
      this.vz = forwardZ * PUSH_SPEED;
      this.active = true;
    }
  }

  followYaw(yaw, dt) {
    if (!this.active || !(dt > 0) || Math.hypot(this.vx, this.vz) < HEADING_FOLLOW_SPEED) return yaw;
    const elapsed = Math.min(dt, 0.05);
    const course = Math.atan2(-this.vx, -this.vz);
    const difference = course - yaw;
    const error = Math.atan2(Math.sin(difference), Math.cos(difference));
    const remaining = Math.max(0, Math.abs(error) - HEADING_DEAD_ZONE);
    const step = remaining * (1 - Math.exp(-HEADING_RESPONSE * elapsed));
    return yaw + Math.sign(error) * Math.min(step, MAX_YAW_RATE * elapsed);
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

  advanceGroundVelocity(step, steering, brake) {
    const speed = Math.hypot(this.vx, this.vz);
    const turn = steering * Math.min(MAX_TURN_RATE, EDGE_ACCELERATION / speed) * step;
    const cos = Math.cos(turn);
    const sin = Math.sin(turn);
    const vx = this.vx * cos - this.vz * sin;
    const vz = this.vx * sin + this.vz * cos;

    const dx = (this.height(this.x + SLOPE_RADIUS, this.z) -
      this.height(this.x - SLOPE_RADIUS, this.z)) / (2 * SLOPE_RADIUS);
    const dz = (this.height(this.x, this.z + SLOPE_RADIUS) -
      this.height(this.x, this.z - SLOPE_RADIUS)) / (2 * SLOPE_RADIUS);
    const gravity = GRAVITY / (1 + dx * dx + dz * dz);
    const nextVX = vx - gravity * dx * step;
    const nextVZ = vz - gravity * dz * step;
    const forceSpeed = Math.hypot(nextVX, nextVZ);
    const resistance = SLIDE_RESISTANCE + AIR_DRAG * speed * speed + BRAKE_ACCELERATION * brake;
    const nextSpeed = forceSpeed - resistance * step;
    // A stopped skier stands rather than automatically sliding backwards.
    if (nextSpeed <= STOP_SPEED || nextVX * vx + nextVZ * vz <= 0) {
      this.stop();
      return;
    }
    this.vx = nextVX * nextSpeed / forceSpeed;
    this.vz = nextVZ * nextSpeed / forceSpeed;
  }

  advance(dt, x, z, steering, brake) {
    this.x = x;
    this.z = z;
    if (!this.active || !(dt > 0)) return;
    if (!this.airborne) this.y = this.height(x, z);
    const elapsed = Math.min(dt, 0.05);
    const steps = Math.ceil(elapsed / STEP);
    const step = elapsed / steps;

    for (let i = 0; i < steps; i++) {
      if (!this.airborne) {
        this.advanceGroundVelocity(step, steering, brake);
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
