import * as THREE from "../../forest/vendor/three.module.js";
import { mergeGeometries } from "../../forest/vendor/BufferGeometryUtils.js";
import { HAND_RADIUS } from "./HandInteraction.mjs";
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
export class TableHandle {
  constructor({ parent, settings, canGrab, onMove, onEnd }) {
    Object.assign(this, { parent, settings, canGrab, onMove, onEnd });
    this.root = new THREE.Group();
    this.root.position.set(0, -0.015, 0.345);
    parent.add(this.root);
    const parts = [];
    const bar = new THREE.CylinderGeometry(0.009, 0.009, 0.15, 10);
    bar.rotateZ(Math.PI / 2);
    bar.translate(0, 0.012, 0);
    parts.push(bar);
    for (const x of [-0.065, 0.065]) {
      const post = new THREE.CylinderGeometry(0.008, 0.008, 0.035, 8);
      post.translate(x, -0.005, 0);
      parts.push(post);
    }
    const base = new THREE.BoxGeometry(0.18, 0.006, 0.045);
    base.translate(0, -0.022, 0);
    parts.push(base);
    const geometry = mergeGeometries(parts.map((g) => g.toNonIndexed()));
    parts.forEach((g) => g.dispose());
    this.material = new THREE.MeshStandardMaterial({
      color: 0xc8a665,
      metalness: 0.35,
      roughness: 0.5,
    });
    this.mesh = new THREE.Mesh(geometry, this.material);
    this.root.add(this.mesh);
    this.bounds = new THREE.Box3(
      new THREE.Vector3(-0.09, -0.025, -0.023),
      new THREE.Vector3(0.09, 0.023, 0.023),
    );
    this.active = null;
  }
  intersects(worldPoint) {
    this.root.updateWorldMatrix(true, false);
    const point = this.root.worldToLocal(worldPoint.clone());
    return this.bounds.distanceToPoint(point) <= HAND_RADIUS;
  }
  inAnchor(worldPoint) {
    // Drag in the seated anchor's axes, not the table's moving local frame.
    this.parent.parent.updateWorldMatrix(true, false);
    return this.parent.parent.worldToLocal(worldPoint.clone());
  }
  begin(owner, worldPoint, epoch) {
    if (this.active || !this.canGrab()) return false;
    this.active = {
      owner,
      epoch,
      start: this.inAnchor(worldPoint),
      offset: this.settings.offset,
      height: this.settings.height,
      distance: this.settings.distance,
    };
    return true;
  }
  move(worldPoint) {
    if (!this.active) return;
    const delta = this.inAnchor(worldPoint).sub(this.active.start);
    this.settings.offset = clamp(this.active.offset + delta.x, -0.25, 0.25);
    this.settings.height = clamp(this.active.height + delta.y, -0.65, -0.1);
    this.settings.distance = clamp(this.active.distance - delta.z, 0.45, 1);
    this.onMove();
  }
  end() {
    if (!this.active) return;
    this.active = null;
    this.onEnd();
  }
  highlight(hovered) {
    this.material.emissive.setHex(this.active || hovered ? 0x6e4f18 : 0);
  }
}
