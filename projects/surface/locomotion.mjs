import {Vector3} from '../forest/vendor/three.module.js';

export function deadzone(value, threshold) {
  if (!Number.isFinite(value) || Math.abs(value) <= threshold) return 0;
  return Math.sign(value) * Math.min(1, (Math.abs(value) - threshold) / (1 - threshold));
}

export class Locomotion {
  constructor(rig, settings = {moveSpeed: 1.5, turnSpeed: Math.PI / 3, deadzone: 0.15}) {
    this.rig = rig;
    this.settings = settings;
    this.forward = new Vector3();
    this.right = new Vector3();
    this.pivot = new Vector3();
    this.after = new Vector3();
  }
  update(dt, sources, viewer) {
    if (!viewer || !Number.isFinite(dt) || dt <= 0) return;
    dt = Math.min(dt, 0.05);
    const c = this.settings;
    let x = 0, z = 0, turn = 0;
    for (const source of sources) {
      const pad = source.gamepad;
      if (!pad || pad.mapping !== 'xr-standard') continue;
      if (source.handedness === 'left') {
        x = deadzone(pad.axes[2], c.deadzone);
        z = deadzone(pad.axes[3], c.deadzone);
      } else if (source.handedness === 'right') {
        turn = deadzone(pad.axes[2], c.deadzone);
      }
    }
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
