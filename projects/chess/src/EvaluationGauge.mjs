import * as THREE from "../../forest/vendor/three.module.js";
export function playerEvaluation(score, color) {
  if (!score || !Number.isFinite(score.value)) return null;
  const value = score.value * (color === "w" ? 1 : -1);
  return score.type === "mate" ? Math.sign(value) * 5 : value / 100;
}
export function needleRotation(value) {
  if (Math.abs(value) <= 0.1) return 0;
  return -THREE.MathUtils.clamp(value, -5, 5) * Math.PI / 10 || 0;
}
export function gaugeColor(t) {
  t = THREE.MathUtils.clamp(t, 0, 1);
  return t <= 0.5
    ? new THREE.Color(0xe94b48).lerp(new THREE.Color(0xffffff), t * 2)
    : new THREE.Color(0xffffff).lerp(new THREE.Color(0x2cbd63), (t - 0.5) * 2);
}
export class EvaluationGauge {
  constructor(parent, { createCanvas = () => document.createElement("canvas") } = {}) {
    this.createCanvas = createCanvas;
    this.root = new THREE.Group(); parent.add(this.root);
    this.root.visible = false;
    this.targetAngle = 0;
    this.elapsed = this.duration = 0.55;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute([
      -0.005, -0.006, 0, 0.005, -0.006, 0, 0, 0.188, 0,
    ], 3));
    this.needle = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.DoubleSide }));
    this.needle.position.z = 0.004;
    this.needle.visible = false;
    this.root.add(this.needle);
    this.hub = new THREE.Mesh(new THREE.CircleGeometry(0.009, 24), this.needle.material);
    this.hub.position.z = 0.005;
    this.hub.visible = false;
    this.root.add(this.hub);
  }
  createFace() {
    const canvas = this.createCanvas(); canvas.width = 880; canvas.height = 520;
    const ctx = canvas.getContext("2d"), cx = 440, cy = 440, radius = 365;
    ctx.clearRect(0, 0, 880, 520);
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, radius, Math.PI, Math.PI * 2); ctx.closePath();
    ctx.fillStyle = "#edf0eb"; ctx.fill();
    ctx.lineWidth = 54;
    for (let i = 0; i < 360; i++) {
      ctx.beginPath();
      ctx.arc(cx, cy, radius, Math.PI + i * Math.PI / 360, Math.PI + (i + 1.5) * Math.PI / 360);
      ctx.strokeStyle = gaugeColor((i + 0.5) / 360).getStyle(); ctx.stroke();
    }
    ctx.lineWidth = 2; ctx.strokeStyle = "#64736c";
    for (const r of [radius - 27, radius + 27]) {
      ctx.beginPath(); ctx.arc(cx, cy, r, Math.PI, Math.PI * 2); ctx.stroke();
    }
    ctx.strokeStyle = "#182322"; ctx.lineWidth = 3;
    for (let i = 0; i <= 10; i++) {
      const a = Math.PI + i * Math.PI / 10;
      ctx.beginPath(); ctx.moveTo(cx + 324 * Math.cos(a), cy + 324 * Math.sin(a));
      ctx.lineTo(cx + 339 * Math.cos(a), cy + 339 * Math.sin(a)); ctx.stroke();
    }
    ctx.fillStyle = "#edf0eb"; ctx.font = "600 36px system-ui";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("−5", 75, 490); ctx.fillText("+5", 805, 490);
    ctx.fillText("0", 440, 22);
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
    this.face = new THREE.Mesh(new THREE.PlaneGeometry(0.44, 0.26),
      new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
    this.face.position.y = 0.09; this.root.add(this.face);
  }
  update(visible, score, color) {
    this.root.visible = !!visible;
    if (!visible) return;
    if (!this.face) this.createFace();
    this.value = playerEvaluation(score, color);
    this.needle.visible = this.hub.visible = this.value !== null;
    if (this.value === null) {
      this.needle.rotation.z = this.targetAngle = 0;
      this.elapsed = this.duration;
    } else {
      const target = needleRotation(this.value);
      if (target !== this.targetAngle) {
        this.startAngle = this.needle.rotation.z;
        this.targetAngle = target;
        this.elapsed = 0;
      }
    }
  }
  tick(dt) {
    if (!this.root.visible || !this.needle.visible || this.elapsed >= this.duration) return;
    dt = Number.isFinite(dt) ? Math.max(0, Math.min(dt, 0.05)) : 0;
    this.elapsed = Math.min(this.duration, this.elapsed + dt);
    const t = this.elapsed / this.duration;
    const eased = t * t * (3 - 2 * t);
    this.needle.rotation.z = this.startAngle + (this.targetAngle - this.startAngle) * eased;
  }

}
