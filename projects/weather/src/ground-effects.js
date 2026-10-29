import * as THREE from '../../../shared/vendor/three-r180/three.module.js';
// Independent fixed pools. No per-impact objects, per-frame geometry or animation allocations.
export class ImpactPool {
  constructor(capacity, kind, random = Math.random) {
    this.capacity = capacity; this.kind = kind; this.random = random;
    this.segmentCount = kind === 'splash' ? 4 : 12; this.lifetime = kind === 'splash' ? 0.2 : 0.45;
    this.active = new Uint8Array(capacity); this.free = new Uint16Array(capacity); this.freeCount = capacity;
    this.x = new Float32Array(capacity); this.y = new Float32Array(capacity); this.z = new Float32Array(capacity);
    this.age = new Float64Array(capacity); this.launchX = new Float32Array(capacity); this.launchZ = new Float32Array(capacity);
    this.directions = new Float32Array(capacity * 4); this.lengths = new Float32Array(capacity * 4);
    this.vertices = new Float32Array(capacity * this.segmentCount * 6);
    this.colors = kind === 'ripple' ? new Float32Array(capacity * this.segmentCount * 8).fill(1) : null;
    if (this.colors) for (let i = 3; i < this.colors.length; i += 4) this.colors[i] = 0;
    this.circleX = new Float32Array(13); this.circleZ = new Float32Array(13);
    for (let i = 0; i < capacity; i++) this.free[i] = capacity - 1 - i;
    for (let i = 0; i <= 12; i++) { this.circleX[i] = Math.cos(i / 12 * Math.PI * 2); this.circleZ[i] = Math.sin(i / 12 * Math.PI * 2); }
  }
  spawn(x, y, z, vx = 0, age = 0, vy = -6, vz = 0) {
    if (!this.freeCount || age >= this.lifetime) return -1;
    const slot = this.free[--this.freeCount]; this.active[slot] = 1;
    this.x[slot] = x; this.y[slot] = y; this.z[slot] = z; // Reflect the incoming downward velocity about the flat ground normal, then
    // scale to the stylized splash's 2.4 m/s upward launch speed.
    const scale = 2.4 / Math.max(0.001, Math.abs(vy));
    this.launchX[slot] = vx * scale; this.launchZ[slot] = vz * scale; this.age[slot] = age;
    if (this.kind === 'splash') for (let n = 0; n < 4; n++) {
      this.directions[slot * 4 + n] = (n + this.random() * 0.7) * Math.PI / 2;
      this.lengths[slot * 4 + n] = 0.03 * (0.8 + this.random() * 0.4);
    }
    this.write(slot); return slot;
  }
  release(slot) {
    if (!this.active[slot]) return;
    this.active[slot] = 0; this.free[this.freeCount++] = slot;
    const start = slot * this.segmentCount * 6; this.vertices.fill(0, start, start + this.segmentCount * 6);
    if (this.colors) { const colorStart = slot * this.segmentCount * 8; for (let i = colorStart + 3; i < colorStart + this.segmentCount * 8; i += 4) this.colors[i] = 0; }
  }
  clear() { for (let i = 0; i < this.capacity; i++) this.release(i); }
  update(dt) {
    for (let i = 0; i < this.capacity; i++) if (this.active[i]) {
      this.age[i] += dt;
      if (this.age[i] + 1e-9 >= this.lifetime) this.release(i); else this.write(i);
    }
  }
  write(slot) {
    const t = this.age[slot] / this.lifetime, base = slot * this.segmentCount * 6;
    if (this.kind === 'ripple') {
      const radius = 0.02 + 0.23 * t;
      const fade = Math.max(0, Math.min(1, (t - 0.5) * 2));
      const alpha = 1 - fade * fade * (3 - 2 * fade);
      const colorBase = slot * this.segmentCount * 8;
      for (let n = 0; n < 12; n++) {
        const j = base + n * 6;
        this.colors[colorBase + n * 8 + 3] = alpha; this.colors[colorBase + n * 8 + 7] = alpha;
        this.vertices[j] = this.x[slot] + this.circleX[n] * radius; this.vertices[j + 1] = this.y[slot] + 0.01; this.vertices[j + 2] = this.z[slot] + this.circleZ[n] * radius;
        this.vertices[j + 3] = this.x[slot] + this.circleX[n + 1] * radius; this.vertices[j + 4] = this.y[slot] + 0.01; this.vertices[j + 5] = this.z[slot] + this.circleZ[n + 1] * radius;
      }
    } else {
      const height = 4 * 0.12 * t * (1 - t), radius = 0.08 * t;
      for (let n = 0; n < 4; n++) {
        const j = base + n * 6, angle = this.directions[slot * 4 + n], length = this.lengths[slot * 4 + n];
        const dx = Math.cos(angle), dz = Math.sin(angle), x = this.x[slot] + radius * dx + this.launchX[slot] * this.age[slot], z = this.z[slot] + radius * dz + this.launchZ[slot] * this.age[slot];
        const sx = this.launchX[slot] + dx * 0.4, sy = 2.4 * (1 - 2 * t), sz = this.launchZ[slot] + dz * 0.4;
        const segmentScale = length / Math.max(0.000001, Math.sqrt(sx * sx + sy * sy + sz * sz));
        this.vertices[j] = x; this.vertices[j + 1] = this.y[slot] + 0.005 + height; this.vertices[j + 2] = z;
        this.vertices[j + 3] = x + sx * segmentScale; this.vertices[j + 4] = this.y[slot] + 0.005 + Math.max(0, height + sy * segmentScale); this.vertices[j + 5] = z + sz * segmentScale;
      }
    }
  }
}
export class GroundEffects {
  constructor(scene, ground = null, random = Math.random) {
    this.ground = ground; this.random = random; this.splashes = new ImpactPool(300, 'splash', random); this.ripples = new ImpactPool(200, 'ripple', random);
    this.group = new THREE.Group(); scene.add(this.group);
    this.splashObject = this.createBatch(this.splashes, 0xd5dadd); this.rippleObject = this.createBatch(this.ripples, 0xc8d0d5);
    this.enabled = true; this.splashEnabled = true; this.rippleEnabled = true; this.splashProbability = 0.15; this.rippleProbability = 0.1;
  }
  get groundY() { return this.ground?.position.y ?? 0; }
  createBatch(pool, color) {
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.BufferAttribute(pool.vertices, 3).setUsage(THREE.DynamicDrawUsage));
    const ripple = pool.kind === 'ripple';
    if (ripple) geometry.setAttribute('color', new THREE.BufferAttribute(pool.colors, 4).setUsage(THREE.DynamicDrawUsage));
    const object = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color, vertexColors: ripple, transparent: ripple, blending: ripple ? THREE.NormalBlending : THREE.NoBlending, depthTest: true, depthWrite: !ripple }));
    object.frustumCulled = false; this.group.add(object); return object;
  }
  configure(parameters) {
    this.enabled = Boolean(parameters.groundEffects); this.splashEnabled = Boolean(parameters.splashes); this.rippleEnabled = Boolean(parameters.ripples);
    this.splashProbability = parameters.splashProbability / 100; this.rippleProbability = parameters.rippleProbability / 100;
    if (!this.enabled || !this.splashEnabled) this.splashes.clear();
    if (!this.enabled || !this.rippleEnabled) this.ripples.clear();
    this.splashObject.visible = this.enabled && this.splashEnabled; this.rippleObject.visible = this.enabled && this.rippleEnabled;
    this.upload();
  }
  impact(x, y, z, vx, age = 0, vy = -6, vz = 0) {
    if (!this.enabled) return;
    // Independent trials; a full splash pool never prevents a ripple trial.
    if (this.splashEnabled && this.random() < this.splashProbability) this.splashes.spawn(x, y, z, vx, age, vy, vz);
    if (this.rippleEnabled && this.random() < this.rippleProbability) this.ripples.spawn(x, y, z, 0, age);
  }
  update(dt) {
    if (!this.enabled) return;
    if (this.splashEnabled) this.splashes.update(dt); if (this.rippleEnabled) this.ripples.update(dt);
  }
  upload() {
    this.splashObject.geometry.attributes.position.needsUpdate = true; this.rippleObject.geometry.attributes.position.needsUpdate = true;
    this.rippleObject.geometry.attributes.color.needsUpdate = true;
  }
  dispose() { this.group.removeFromParent(); for (const object of this.group.children) { object.geometry.dispose(); object.material.dispose(); } }
}
