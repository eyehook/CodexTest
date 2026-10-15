import {Vector3} from 'three';

export function deadzone(value, threshold) {
  if (!Number.isFinite(value) || Math.abs(value) <= threshold) return 0;
  return Math.sign(value) * Math.min(1, (Math.abs(value) - threshold) / (1 - threshold));
}

export class Locomotion {
  constructor(rig, settings) {
    this.rig = rig;
    this.settings = settings;
    this.forward = new Vector3();
    this.right = new Vector3();
    this.pivot = new Vector3();
    this.after = new Vector3();
    this.pressed = new Set();
    this.nextPressed = new Set();
  }
  reset() { this.pressed.clear(); this.nextPressed.clear(); }
  update(dt, sources, viewer, onToggle) {
    const c = this.settings;
    let x = 0, z = 0, turn = 0, toggle = false;
    this.nextPressed.clear();
    for (const source of sources) {
      const pad = source.gamepad;
      if (!pad || pad.mapping !== 'xr-standard') continue;
      if (source.handedness === 'left') {
        x = deadzone(pad.axes[2], c.deadzone);
        z = deadzone(pad.axes[3], c.deadzone);
      } else if (source.handedness === 'right') {
        turn = deadzone(pad.axes[2], c.deadzone);
      } else continue;
      // xr-standard primary face button: A on right, X on left.
      if (pad.buttons[4]?.pressed) {
        this.nextPressed.add(source);
        if (!this.pressed.has(source)) toggle = true;
      }
    }
    const swap = this.pressed; this.pressed = this.nextPressed; this.nextPressed = swap;
    if (toggle) onToggle(); // Simultaneous A/X presses toggle only once.

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
