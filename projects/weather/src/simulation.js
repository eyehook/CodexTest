export class SimulationVolume {
  constructor(radius = 15, height = 12) { this.radius = radius; this.height = height; this.x = 0; this.z = 0; }
  follow(x, z) { this.x = x; this.z = z; }
  wrap(positions, i) {
    const x = positions[i] - this.x, z = positions[i + 2] - this.z;
    const distance = Math.hypot(x, z);
    if (distance > this.radius) {
      const wrapped = ((distance + this.radius) % (2 * this.radius)) - this.radius;
      positions[i] = this.x + x / distance * wrapped;
      positions[i + 2] = this.z + z / distance * wrapped;
    }
  }
  randomPosition(positions, i, random = Math.random) {
    const angle = random() * Math.PI * 2, radius = Math.sqrt(random()) * this.radius;
    positions[i] = this.x + Math.cos(angle) * radius; positions[i + 2] = this.z + Math.sin(angle) * radius;
  }
}
export class SnowSimulation {
  constructor(max = 50000, random = Math.random) {
    this.volume = new SimulationVolume(); this.random = random; this.time = 0;
    this.positions = new Float32Array(max * 3); this.sizes = new Float32Array(max);
    this.speeds = new Float32Array(max); this.phases = new Float32Array(max);
    for (let n = 0; n < max; n++) {
      this.volume.randomPosition(this.positions, n * 3, random);
      this.positions[n * 3 + 1] = random() * this.volume.height;
      const bias = random() ** 2;
      this.sizes[n] = 0.0013 + bias * 0.0063;
      this.speeds[n] = (1.2 - bias * 0.8) * (0.85 + random() * 0.3);
      this.phases[n] = random() * Math.PI * 2;
    }
  }
  resetVolume(position) {
    this.volume.follow(position.x, position.z); this.time = 0;
    for (let i = 0; i < this.positions.length; i += 3) {
      this.volume.randomPosition(this.positions, i, this.random);
      this.positions[i + 1] = 0 + this.random() * this.volume.height;
    }
  }
  update(dt, count, wind, turbulence, x, z) {
    this.time += dt; this.volume.follow(x, z);
    const p = this.positions, strength = turbulence / 100;
    for (let n = 0; n < count; n++) {
      const i = n * 3, phase = this.phases[n];
      p[i] += (wind + strength * (Math.sin(this.time * 0.7 + phase + p[i + 2] * 0.15) + 0.4 * Math.sin(this.time * 1.1 + phase))) * dt;
      p[i + 2] += strength * (Math.cos(this.time * 0.6 + phase + p[i] * 0.12) + 0.4 * Math.sin(this.time * 0.9 + phase)) * dt;
      p[i + 1] -= this.speeds[n] * dt;
      if (p[i + 1] <= 0) { p[i + 1] = this.volume.height + p[i + 1]; this.volume.randomPosition(p, i, this.random); }
      this.volume.wrap(p, i);
    }
  }
}
