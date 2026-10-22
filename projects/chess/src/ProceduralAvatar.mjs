import * as THREE from "../../forest/vendor/three.module.js";
import { OpponentAvatar } from "./OpponentAvatar.mjs";
import { solveArm } from "./ArmIK.mjs";
import { OpponentFace } from "./OpponentFace.mjs?v=blink-1";
const up = new THREE.Vector3(0, 1, 0);
export class ProceduralAvatar extends OpponentAvatar {
  constructor(parent) {
    super();
    this.root = new THREE.Group();
    parent.add(this.root);
    const cloth = new THREE.MeshStandardMaterial({
      color: 0x818f86,
      roughness: 1,
    });
    const skin = new THREE.MeshStandardMaterial({
      color: 0xb8a58b,
      roughness: 1,
    });
    const add = (geometry, material, x, y, z) => {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(x, y, z);
      this.root.add(mesh);
      return mesh;
    };
    add(
      new THREE.CylinderGeometry(0.18, 0.135, 0.38, 4),
      cloth,
      0,
      0.15,
      -0.52,
    ).rotation.y = Math.PI / 4;
    this.head = add(
      new THREE.BoxGeometry(0.18, 0.18, 0.18),
      skin,
      0,
      0.46,
      -0.52,
    );
    this.face = new OpponentFace(this.head);
    add(new THREE.CylinderGeometry(0.035, 0.04, 0.07, 8), skin, 0, 0.35, -0.52);
    // Chair back makes the seated pose legible without adding legs or idle motion.
    add(
      new THREE.BoxGeometry(0.39, 0.43, 0.045),
      new THREE.MeshStandardMaterial({ color: 0x374248 }),
      0,
      0.13,
      -0.69,
    );
    this.upper = add(
      new THREE.CylinderGeometry(0.028, 0.035, 1, 8),
      cloth,
      0,
      0,
      0,
    );
    this.lower = add(
      new THREE.CylinderGeometry(0.023, 0.028, 1, 8),
      cloth,
      0,
      0,
      0,
    );
    this.hand = add(new THREE.BoxGeometry(0.042, 0.025, 0.05), skin, 0, 0, 0);
    this.attachment = new THREE.Group();
    this.hand.add(this.attachment);
    const staticUpper = add(
        new THREE.CylinderGeometry(0.029, 0.035, 1, 8),
        cloth,
        0,
        0,
        0,
      ),
      staticLower = add(
        new THREE.CylinderGeometry(0.023, 0.028, 1, 8),
        cloth,
        0,
        0,
        0,
      );
    this.segment(
      staticUpper,
      new THREE.Vector3(-0.16, 0.3, -0.43),
      new THREE.Vector3(-0.27, 0.04, -0.51),
    );
    this.segment(
      staticLower,
      new THREE.Vector3(-0.27, 0.04, -0.51),
      new THREE.Vector3(-0.26, 0.03, -0.3),
    );
    add(new THREE.BoxGeometry(0.042, 0.025, 0.05), skin, -0.26, 0.03, -0.3);
    this.shoulder = new THREE.Vector3(0.16, 0.3, -0.43);
    this.restLocal = new THREE.Vector3(0.28, 0.04, -0.31);
    this.reset();
  }
  setEvaluation(score) {
    this.face.setEvaluation(score);
  }
  update(dt) {
    this.face.update(dt);
  }
  get restTarget() {
    this.root.updateWorldMatrix(true, false);
    return this.root.localToWorld(this.restLocal.clone());
  }
  segment(mesh, a, b) {
    mesh.position.copy(a).add(b).multiplyScalar(0.5);
    mesh.scale.y = a.distanceTo(b);
    mesh.quaternion.setFromUnitVectors(up, b.clone().sub(a).normalize());
  }
  setHandTarget(worldPosition) {
    this.root.updateWorldMatrix(true, false);
    const target = this.root.worldToLocal(worldPosition.clone());
    const pose = solveArm(this.shoulder, target);
    this.segment(this.upper, pose.shoulder, pose.elbow);
    this.segment(this.lower, pose.elbow, pose.hand);
    this.hand.position.copy(pose.hand);
    this.hand.quaternion.identity();
    this.root.updateWorldMatrix(true, true);
    return this.getHandPosition().distanceTo(worldPosition);
  }
  getHandPosition() {
    this.root.updateWorldMatrix(true, true);
    return this.hand.getWorldPosition(new THREE.Vector3());
  }
  reset() {
    this.setHandTarget(this.restTarget);
  }
}
