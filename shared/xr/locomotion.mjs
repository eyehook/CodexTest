import {Vector3} from '../vendor/three-r180/three.module.js';

import {deadzone, readMovementAxes} from './input.mjs';

export class Locomotion {
  constructor(rig, settings = {}) {
    this.rig = rig;
    this.settings = {moveSpeed: 1.5, turnSpeed: Math.PI / 3, deadzone: 0.15, rescaleDeadzone: true, maxDelta: 0.05, ...settings};
    this.axes = {x: 0, z: 0, turn: 0};
    this.forward = new Vector3();
    this.right = new Vector3();
    this.pivot = new Vector3();
    this.after = new Vector3();
  }
  update(dt, sources, viewer) {
    const axes = readMovementAxes(sources, this.axes);
    this.move(dt, axes.x, axes.z, axes.turn, viewer);
  }
  // Viewer position/orientation must be local to the rig's reference space.
  move(dt, x, z, turn, viewer, enabled = true) {
    if (!enabled || !viewer || !Number.isFinite(dt) || dt <= 0) return;
    const c = this.settings;
    dt = Math.min(dt, c.maxDelta);
    x = deadzone(x, c.deadzone, c.rescaleDeadzone);
    z = deadzone(z, c.deadzone, c.rescaleDeadzone);
    turn = deadzone(turn, c.deadzone, c.rescaleDeadzone);
    this.rig.updateMatrixWorld(true);
    // Rotate the rig about the tracked headset, avoiding an orbit around the rig origin.
    this.pivot.copy(viewer.position).applyMatrix4(this.rig.matrixWorld);
    this.rig.rotation.y -= turn * c.turnSpeed * dt;
    this.rig.updateMatrixWorld(true);
    this.after.copy(viewer.position).applyMatrix4(this.rig.matrixWorld);
    this.rig.position.x += this.pivot.x - this.after.x;
    this.rig.position.z += this.pivot.z - this.after.z;

    // Head-directed horizontal walking. Pitch does not change speed or altitude.
    this.forward.set(0,0,-1).applyQuaternion(viewer.orientation).applyQuaternion(this.rig.quaternion);
    this.forward.y = 0;
    if (this.forward.lengthSq() < 1e-8) this.forward.set(0,0,-1).applyQuaternion(this.rig.quaternion);
    this.forward.normalize();
    this.right.set(-this.forward.z,0,this.forward.x);
    const scale = c.moveSpeed * dt / Math.max(1, Math.hypot(x,z));
    this.rig.position.addScaledVector(this.right,x*scale).addScaledVector(this.forward,-z*scale);
    this.rig.updateMatrixWorld(true);
  }
}
