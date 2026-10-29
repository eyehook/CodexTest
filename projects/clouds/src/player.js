import * as THREE from '../../../shared/vendor/three-r180/three.module.js';
const deadzone = value => Math.abs(value) < 0.15 ? 0 : (value - Math.sign(value) * 0.15) / 0.85;
export class PlayerController {
  constructor(scene, renderer) {
    this.localHead = new THREE.Vector3(); this.localOrientation = new THREE.Quaternion();
    this.renderer = renderer; this.rig = new THREE.Group(); scene.add(this.rig);
    this.camera = new THREE.PerspectiveCamera(65, innerWidth / innerHeight, 0.05, 1200);
    this.camera.position.y = 1.65; this.camera.rotation.order = 'YXZ'; this.rig.add(this.camera);
    this.controllers = [0, 1].map(i => {
      const c = renderer.xr.getController(i);
      c.addEventListener('connected', event => { c.userData.inputSource = event.data; });
      c.addEventListener('disconnected', () => { delete c.userData.inputSource; });
      this.rig.add(c); return c;
    });
    this.keys = new Set(); this.position = new THREE.Vector3(); this.forward = new THREE.Vector3();
    this.right = new THREE.Vector3(); this.up = new THREE.Vector3(0, 1, 0); this.offset = new THREE.Vector3();
    this.abort = new AbortController(); const options = { signal: this.abort.signal };
    window.addEventListener('keydown', e => { if (!/INPUT|BUTTON/.test(e.target.tagName)) this.keys.add(e.code); }, options);
    window.addEventListener('keyup', e => this.keys.delete(e.code), options);
    window.addEventListener('blur', () => { this.keys.clear(); this.drag = false; }, options);
    renderer.domElement.addEventListener('pointerdown', e => { this.drag = true; renderer.domElement.setPointerCapture(e.pointerId); }, options);
    renderer.domElement.addEventListener('pointerup', () => this.drag = false, options);
    renderer.domElement.addEventListener('pointermove', e => {
      if (!this.drag || renderer.xr.isPresenting) return;
      this.camera.rotation.y -= e.movementX * 0.003;
      this.camera.rotation.x = THREE.MathUtils.clamp(this.camera.rotation.x - e.movementY * 0.003, -1.4, 1.4);
    }, options);
    this.startXR = () => { this.keys.clear(); this.camera.position.set(0, 0, 0); this.camera.rotation.set(0, 0, 0); };
    this.endXR = () => { this.camera.position.set(0, 1.65, 0); this.camera.rotation.set(0, 0, 0); };
    renderer.xr.addEventListener('sessionstart', this.startXR); renderer.xr.addEventListener('sessionend', this.endXR);
  }
  getWorldPose(position, direction) {
    this.rig.updateMatrixWorld(true);
    if (this.renderer.xr.isPresenting) {
      position.copy(this.localHead).applyMatrix4(this.rig.matrixWorld);
      direction.set(0, 0, -1).applyQuaternion(this.localOrientation).applyQuaternion(this.rig.quaternion);
    } else {
      this.camera.getWorldPosition(position); this.camera.getWorldDirection(direction);
    }
    direction.y = 0;
    if (direction.lengthSq() < 1e-8) direction.set(0, 0, -1).applyQuaternion(this.rig.quaternion);
    direction.normalize();
  }
  update(dt, frame) {
    const activeSession = this.renderer.xr.getSession();
    if (activeSession) {
      const referenceSpace = this.renderer.xr.getReferenceSpace();
      const pose = referenceSpace && frame?.getViewerPose(referenceSpace);
      if (!pose) return null;
      this.localHead.copy(pose.transform.position); this.localOrientation.copy(pose.transform.orientation);
    }
    let strafe = 0, forward = 0, turn = 0;
    const session = this.renderer.xr.getSession();
    if (session) {
      for (const source of session.inputSources) {
        const axes = source.gamepad?.axes; if (!axes || source.gamepad.mapping !== 'xr-standard') continue;
        if (source.handedness === 'left') { strafe = deadzone(axes[2] ?? 0); forward = -deadzone(axes[3] ?? 0); }
        if (source.handedness === 'right') turn = -deadzone(axes[2] ?? 0);
      }
    } else {
      strafe = Number(this.keys.has('KeyD')) - Number(this.keys.has('KeyA'));
      forward = Number(this.keys.has('KeyW')) - Number(this.keys.has('KeyS'));
      turn = Number(this.keys.has('ArrowLeft')) - Number(this.keys.has('ArrowRight'));
    }
    // Rotate the rig about the tracked head, including room-scale horizontal offsets.
    this.getWorldPose(this.position, this.forward);
    if (turn) {
      this.offset.copy(this.rig.position).sub(this.position).applyAxisAngle(this.up, turn * Math.PI / 2 * dt);
      this.rig.position.x = this.position.x + this.offset.x; this.rig.position.z = this.position.z + this.offset.z;
      this.rig.rotation.y += turn * Math.PI / 2 * dt; this.rig.updateMatrixWorld(true);
    }
    this.getWorldPose(this.position, this.forward);
    this.right.crossVectors(this.forward, this.up);
    const scale = 3 * dt / Math.max(1, Math.hypot(strafe, forward));
    this.rig.position.addScaledVector(this.forward, forward * scale).addScaledVector(this.right, strafe * scale);
    this.getWorldPose(this.position, this.forward); return this.position;
  }
  dispose() {
    this.abort.abort(); this.renderer.xr.removeEventListener('sessionstart', this.startXR);
    this.renderer.xr.removeEventListener('sessionend', this.endXR); this.rig.removeFromParent();
  }
}
