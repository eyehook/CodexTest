import * as THREE from "../../forest/vendor/three.module.js";

const smooth = (t) => t * t * (3 - 2 * t);
export class EyelidBlink {
  constructor(model, { random = Math.random } = {}) {
    this.random = random;
    this.lids = [];
    this.closure = null;
    model.updateWorldMatrix(true, true);
    const eyes = [];
    model.traverse((mesh) => {
      if (!mesh.isSkinnedMesh || !mesh.name.startsWith("GEO-eye_")) return;
      mesh.geometry.computeBoundingBox();
      eyes.push({ mesh, center: mesh.geometry.boundingBox.getCenter(new THREE.Vector3()).applyMatrix4(mesh.matrixWorld) });
    });
    const lateral = new THREE.Vector3(1, 0, 0).transformDirection(model.matrixWorld);
    model.traverse((mesh) => {
      if (!mesh.isSkinnedMesh || !/^GEO-eyelid_(upper|lower)_/.test(mesh.name)) return;
      mesh.geometry.computeBoundingBox();
      const center = mesh.geometry.boundingBox.getCenter(new THREE.Vector3()).applyMatrix4(mesh.matrixWorld);
      const eye = [...eyes].sort((a, b) => center.distanceToSquared(a.center) - center.distanceToSquared(b.center))[0];
      if (!eye) return;
      // Deform bind-space geometry so normal head skinning remains authoritative.
      // Rotating the SkinnedMesh object itself would be canceled by attached binds.
      mesh.geometry = mesh.geometry.clone();
      const inverse = mesh.matrixWorld.clone().invert();
      const pivot = eye.center.clone().applyMatrix4(inverse);
      const axis = lateral.clone().transformDirection(inverse);
      const position = mesh.geometry.attributes.position, normal = mesh.geometry.attributes.normal;
      position.setUsage(THREE.DynamicDrawUsage);
      normal?.setUsage(THREE.DynamicDrawUsage);
      const restPositions = position.array.slice(), restNormals = normal?.array.slice();
      let radius = 0;
      const point = new THREE.Vector3();
      for (let i = 0; i < position.count; i++) radius = Math.max(radius, point.fromBufferAttribute(position, i).distanceTo(pivot));
      mesh.geometry.boundingSphere = new THREE.Sphere(pivot.clone(), radius);
      mesh.geometry.boundingBox = new THREE.Box3().setFromCenterAndSize(pivot, new THREE.Vector3().setScalar(radius * 2));
      this.lids.push({ mesh, eye: eye.mesh, pivot, axis, restPositions, restNormals,
        angle: mesh.name.includes("eyelid_upper") ? 0.50 : -0.16 });
    });
    this.reset();
  }
  sample(min, max) {
    const value = this.random();
    return min + (max - min) * (Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0.5);
  }
  reset() {
    this.elapsed = null;
    this.wait = this.sample(2.5, 6.5);
    this.setClosure(0);
  }
  setClosure(amount) {
    amount = Math.max(0, Math.min(1, amount));
    if (amount === this.closure) return;
    this.closure = amount;
    const q = new THREE.Quaternion(), point = new THREE.Vector3();
    for (const lid of this.lids) {
      const position = lid.mesh.geometry.attributes.position, normal = lid.mesh.geometry.attributes.normal;
      if (amount === 0) {
        position.array.set(lid.restPositions);
        if (normal) normal.array.set(lid.restNormals);
      } else {
        q.setFromAxisAngle(lid.axis, lid.angle * amount);
        for (let i = 0; i < position.count; i++) {
          point.fromArray(lid.restPositions, i * 3).sub(lid.pivot).applyQuaternion(q).add(lid.pivot);
          position.setXYZ(i, point.x, point.y, point.z);
          if (normal) {
            point.fromArray(lid.restNormals, i * 3).applyQuaternion(q);
            normal.setXYZ(i, point.x, point.y, point.z);
          }
        }
      }
      position.needsUpdate = true;
      if (normal) normal.needsUpdate = true;
    }
  }
  update(dt) {
    dt = Number.isFinite(dt) ? Math.max(0, Math.min(dt, 0.05)) : 0;
    if (dt === 0 || !this.lids.length) return;
    if (this.elapsed === null) {
      this.wait -= dt;
      if (this.wait > 0) return;
      this.elapsed = -this.wait;
      this.closeTime = this.sample(0.055, 0.085);
      this.holdTime = this.sample(0.015, 0.035);
      this.openTime = this.sample(0.09, 0.14);
    } else this.elapsed += dt;
    const total = this.closeTime + this.holdTime + this.openTime;
    if (this.elapsed >= total) {
      const remainder = this.elapsed - total;
      this.elapsed = null;
      this.wait = this.sample(2.5, 6.5) - remainder;
      this.setClosure(0);
    } else if (this.elapsed < this.closeTime) {
      this.setClosure(smooth(this.elapsed / this.closeTime));
    } else if (this.elapsed < this.closeTime + this.holdTime) {
      this.setClosure(1);
    } else {
      this.setClosure(1 - smooth((this.elapsed - this.closeTime - this.holdTime) / this.openTime));
    }
  }
}
