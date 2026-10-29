import * as THREE from "../../../shared/vendor/three-r180/three.module.js";
import { expressionAmount } from "./Evaluation.mjs?v=shared-r180-1";
export class OpponentFace {
  constructor(head, { random = Math.random, frontZ = 0.09 } = {}) {
    this.random = random;
    this.frontZ = frontZ;
    this.blinkWait = this.nextBlink();
    this.blinkElapsed = null;
    this.eyeOpenness = 1;
    this.root = new THREE.Group();
    head.add(this.root);
    const ink = new THREE.MeshBasicMaterial({
      color: 0x050505,
      side: THREE.DoubleSide,
    });
    const eyeGeometry = new THREE.SphereGeometry(0.008, 6, 4);
    this.eyes = [-0.032, 0.032].map((x) => {
      const eye = new THREE.Mesh(eyeGeometry, ink);
      eye.position.set(x, 0.025, this.frontZ + 0.005);
      this.root.add(eye);
      return eye;
    });
    this.segments = 24;
    this.positions = new Float32Array((this.segments + 1) * 2 * 3);
    const indices = [];
    for (let i = 0; i < this.segments; i++) {
      const a = i * 2;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(this.positions, 3).setUsage(
        THREE.DynamicDrawUsage,
      ),
    );
    geometry.setIndex(indices);
    geometry.boundingSphere = new THREE.Sphere(
      new THREE.Vector3(0, -0.029, this.frontZ + 0.0015),
      0.06,
    );
    this.mouth = new THREE.Mesh(geometry, ink);
    this.root.add(this.mouth);
    this.amount = this.target = 0;
    this.draw();
  }
  setEvaluation(score) {
    this.target = expressionAmount(score);
    if (!score) {
      this.amount = 0;
      this.draw();
    }
  }
  draw() {
    for (let i = 0; i <= this.segments; i++) {
      const t = (i / this.segments) * 2 - 1;
      const x = t * 0.033;
      // Positive advantage bends down at the center: a U-shaped smile.
      const y = -0.029 - this.amount * 0.022 * (1 - t * t);
      const offset = i * 6;
      this.positions.set(
        [
          x,
          y - 0.00175,
          this.frontZ + 0.0015,
          x,
          y + 0.00175,
          this.frontZ + 0.0015,
        ],
        offset,
      );
    }
    this.mouth.geometry.attributes.position.needsUpdate = true;
  }
  nextBlink() {
    return 2.5 + Math.max(0, Math.min(1, this.random())) * 4;
  }
  updateBlink(dt) {
    const elapsed = Math.max(0, Math.min(dt, 0.05));
    if (this.blinkElapsed === null) {
      this.blinkWait -= elapsed;
      if (this.blinkWait > 0) return;
      this.blinkElapsed = -this.blinkWait;
    } else this.blinkElapsed += elapsed;
    const t = this.blinkElapsed;
    const smooth = (value) => value * value * (3 - 2 * value);
    if (t >= 0.18) {
      this.blinkElapsed = null;
      this.blinkWait = this.nextBlink() - (t - 0.18);
      this.eyeOpenness = 1;
    } else if (t < 0.06) this.eyeOpenness = 1 - 0.96 * smooth(t / 0.06);
    else if (t < 0.085) this.eyeOpenness = 0.04;
    else this.eyeOpenness = 0.04 + 0.96 * smooth((t - 0.085) / 0.095);
    for (const eye of this.eyes) eye.scale.y = this.eyeOpenness;
  }
  update(dt) {
    this.updateBlink(dt);
    if (Math.abs(this.target - this.amount) < 1e-4) return;
    this.amount +=
      (this.target - this.amount) *
      (1 - Math.exp(-6 * Math.max(0, Math.min(dt, 0.05))));
    if (Math.abs(this.target - this.amount) < 1e-4) this.amount = this.target;
    this.draw();
  }
}
