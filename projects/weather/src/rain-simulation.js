import { SimulationVolume } from './simulation.js?v=shared-r180-1';
// Segment-to-sphere test includes the whole streak, not just its leading point.
export function intersectsHead(ax, ay, az, bx, by, bz, head, radius = 0.5) {
  const dx = bx - ax, dy = by - ay, dz = bz - az;
  const lengthSq = dx * dx + dy * dy + dz * dz;
  const t = lengthSq ? Math.max(0, Math.min(1, ((head.x - ax) * dx + (head.y - ay) * dy + (head.z - az) * dz) / lengthSq)) : 0;
  return (ax + t * dx - head.x) ** 2 + (ay + t * dy - head.y) ** 2 + (az + t * dz - head.z) ** 2 <= radius * radius;
}
export class RainSimulation {
  constructor(max = 50000, random = Math.random, groundY = 0) {
    this.groundY = groundY; this.onImpact = null;
    this.random = random; this.volume = new SimulationVolume(30, 12); this.time = 0;
    this.positions = new Float32Array(max * 3); this.speeds = new Float32Array(max);
    this.segments = new Float32Array(max * 6);
    for (let n = 0; n < max; n++) {
      this.volume.randomPosition(this.positions, n * 3, random);
      this.positions[n * 3 + 1] = groundY + random() * this.volume.height;
      this.speeds[n] = 4 + random() * 5;
    }
  }
  spawn(i, vx, vy, vz) {
    const v = this.volume, random = this.random, p = this.positions;
    const horizontal = Math.hypot(vx, vz);
    // Match inlet area × normal speed: top flux vs the cylinder's projected side flux.
    const topFlux = Math.PI * v.radius * v.radius * -vy;
    const sideFlux = 2 * v.radius * v.height * horizontal;
    if (random() * (topFlux + sideFlux) < topFlux || horizontal < 1e-8) {
      v.randomPosition(p, i, random); p[i + 1] = this.groundY + v.height;
    } else {
      // Uniform projected chord coordinate gives cosine-weighted upwind boundary entry.
      const cross = (random() * 2 - 1) * v.radius;
      const along = -Math.sqrt(Math.max(0, v.radius * v.radius - cross * cross)) + 0.0001;
      const ux = vx / horizontal, uz = vz / horizontal;
      p[i] = v.x + ux * along - uz * cross; p[i + 2] = v.z + uz * along + ux * cross;
      p[i + 1] = this.groundY + random() * v.height;
    }
  }
  resetVolume(position) {
    this.volume.follow(position.x, position.z); this.time = 0;
    for (let i = 0; i < this.positions.length; i += 3) {
      this.volume.randomPosition(this.positions, i, this.random);
      this.positions[i + 1] = this.groundY + this.random() * this.volume.height;
    }
  }
  update(dt, parameters, head) {
    this.time += dt;
    const relocate = Math.hypot(head.x - this.volume.x, head.z - this.volume.z) > this.volume.radius;
    this.volume.follow(head.x, head.z);
    const { count, wind, turbulence, fallSpeed, trailDuration } = parameters;
    const p = this.positions, segments = this.segments, strength = turbulence / 100, trail = trailDuration / 1000;
    const v = this.volume;
    for (let n = 0; n < count; n++) {
      const i = n * 3, j = n * 6;
      if (relocate) { v.randomPosition(p, i, this.random); p[i + 1] = this.groundY + this.random() * v.height; }
      // Shared smooth spatial field: adjacent drops receive similar lateral velocities.
      const vx = wind + strength * (Math.sin(p[i + 2] * 0.35 + this.time * 0.7) + 0.4 * Math.sin(p[i] * 0.2 + this.time * 0.9));
      const vz = strength * (Math.cos(p[i] * 0.35 + this.time * 0.6) + 0.4 * Math.sin(p[i + 2] * 0.2 - this.time * 0.8));
      const vy = -this.speeds[n] * fallSpeed;
      const oldX = p[i], oldY = p[i + 1], oldZ = p[i + 2];
      p[i] += vx * dt; p[i + 1] += vy * dt; p[i + 2] += vz * dt;
      if (oldY > this.groundY && p[i + 1] <= this.groundY && this.onImpact) {
        const fraction = (oldY - this.groundY) / (oldY - p[i + 1]);
        const impactX = oldX + (p[i] - oldX) * fraction, impactZ = oldZ + (p[i + 2] - oldZ) * fraction;
        if ((impactX - v.x) ** 2 + (impactZ - v.z) ** 2 <= v.radius ** 2) this.onImpact(impactX, this.groundY, impactZ, vx, dt * (1 - fraction), vy, vz);
      }
      if (p[i + 1] <= this.groundY || p[i + 1] > this.groundY + v.height || (p[i] - v.x) ** 2 + (p[i + 2] - v.z) ** 2 > v.radius ** 2) this.spawn(i, vx, vy, vz);
      // v * duration is exactly normalized(v) * speed * duration, without vectors or sqrt.
      let ax = p[i], ay = p[i + 1], az = p[i + 2];
      let bx = ax - vx * trail, by = ay - vy * trail, bz = az - vz * trail;
      if (intersectsHead(ax, ay, az, bx, by, bz, head)) {
        // Move this pooled drop to the top, away from the head; no fading or new allocation.
        v.randomPosition(p, i, this.random); p[i + 1] = this.groundY + v.height;
        if (intersectsHead(p[i], p[i + 1], p[i + 2], p[i] - vx * trail, p[i + 1] - vy * trail, p[i + 2] - vz * trail, head, 0.51)) {
          p[i] = head.x - v.radius * 0.75; p[i + 2] = head.z;
        }
        ax = p[i]; ay = p[i + 1]; az = p[i + 2]; bx = ax - vx * trail; by = ay - vy * trail; bz = az - vz * trail;
      }
      // Clip the back end to the active cylinder/top without changing streak orientation.
      let fraction = 1;
      if (by > this.groundY + v.height) fraction = Math.min(fraction, (this.groundY + v.height - ay) / (by - ay));
      const dx = bx - ax, dz = bz - az, rx = ax - v.x, rz = az - v.z;
      const aa = dx * dx + dz * dz;
      if (aa > 0 && (bx - v.x) ** 2 + (bz - v.z) ** 2 > v.radius ** 2) {
        const bb = 2 * (rx * dx + rz * dz), cc = rx * rx + rz * rz - v.radius ** 2;
        fraction = Math.min(fraction, Math.max(0, (-bb + Math.sqrt(Math.max(0, bb * bb - 4 * aa * cc))) / (2 * aa)));
      }
      segments[j] = ax; segments[j + 1] = ay; segments[j + 2] = az;
      segments[j + 3] = ax + (bx - ax) * fraction; segments[j + 4] = ay + (by - ay) * fraction; segments[j + 5] = az + (bz - az) * fraction;
    }
  }
}
