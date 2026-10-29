import * as THREE from "../../../shared/vendor/three-r180/three.module.js";
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
export class TableHandle {
  constructor({ parent, settings, canGrab, onMove, onEnd }) {
    Object.assign(this, { parent, settings, canGrab, onMove, onEnd });
    this.active = null;
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
}
