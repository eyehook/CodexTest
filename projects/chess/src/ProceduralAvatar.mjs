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
    this.body = new THREE.Group();
    this.body.position.set(0, -0.04, -0.52);
    this.root.add(this.body);
    const add = (parent, geometry, material, x = 0, y = 0, z = 0) => {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(x, y, z);
      parent.add(mesh);
      return mesh;
    };
    add(
      this.body,
      new THREE.CylinderGeometry(0.18, 0.135, 0.38, 4),
      cloth,
      0,
      0.19,
      0,
    ).rotation.y = Math.PI / 4;
    this.head = add(
      this.body,
      new THREE.BoxGeometry(0.18, 0.18, 0.18),
      skin,
      0,
      0.5,
      0,
    );
    this.face = new OpponentFace(this.head);
    add(
      this.body,
      new THREE.CylinderGeometry(0.035, 0.04, 0.07, 8),
      skin,
      0,
      0.39,
      0,
    );
    const upperGeometry = new THREE.CylinderGeometry(0.028, 0.035, 1, 8);
    const lowerGeometry = new THREE.CylinderGeometry(0.023, 0.028, 1, 8);
    const handGeometry = new THREE.BoxGeometry(0.042, 0.025, 0.05);
    this.arms = [-1, 1].map((side) => {
      const hand = add(this.root, handGeometry, skin);
      const attachment = new THREE.Group();
      hand.add(attachment);
      return {
        side,
        upper: add(this.root, upperGeometry, cloth),
        lower: add(this.root, lowerGeometry, cloth),
        hand,
        attachment,
        shoulderLocal: new THREE.Vector3(side * 0.16, 0.34, 0.09),
        rest: new THREE.Vector3(side * 0.28, 0.04, -0.31),
      };
    });
    this.activeArm = 1;
    this.upperLength = 0.3;
    this.lowerLength = 0.28;
    this.lean = 0;
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
    return this.root.localToWorld(this.arms[this.activeArm].rest.clone());
  }
  segment(mesh, a, b) {
    mesh.position.copy(a).add(b).multiplyScalar(0.5);
    mesh.scale.y = a.distanceTo(b);
    mesh.quaternion.setFromUnitVectors(up, b.clone().sub(a).normalize());
  }
  get attachment() {
    return this.arms[this.activeArm].attachment;
  }
  closestArm(worldPosition) {
    this.root.updateWorldMatrix(true, false);
    const target = this.root.worldToLocal(worldPosition.clone());
    return this.arms[0].rest.distanceToSquared(target) <
      this.arms[1].rest.distanceToSquared(target)
      ? 0
      : 1;
  }
  selectArm(index) {
    this.activeArm = index;
  }
  poseArm(arm, target) {
    const shoulder = arm.shoulderLocal.clone().applyMatrix4(this.body.matrix);
    const pose = solveArm(shoulder, target, {
      upper: this.upperLength,
      lower: this.lowerLength,
      pole: new THREE.Vector3(arm.side * 0.45, -0.45, -0.35),
    });
    this.segment(arm.upper, pose.shoulder, pose.elbow);
    this.segment(arm.lower, pose.elbow, pose.hand);
    arm.hand.position.copy(pose.hand);
    arm.hand.quaternion.identity();
    arm.pose = pose;
  }
  setHandTarget(worldPosition) {
    this.root.updateWorldMatrix(true, false);
    const target = this.root.worldToLocal(worldPosition.clone());
    // Hip-pivot lean increases continuously toward the player's half of the board.
    this.lean = Math.max(0, Math.min(1, (target.z + 0.15) / 0.36));
    this.body.rotation.x = this.lean * 0.5;
    this.body.position.z = -0.52 + this.lean * 0.04;
    this.body.updateMatrix();
    for (let i = 0; i < this.arms.length; i++)
      this.poseArm(
        this.arms[i],
        i === this.activeArm ? target : this.arms[i].rest,
      );
    this.root.updateWorldMatrix(true, true);
    return this.getHandPosition().distanceTo(worldPosition);
  }
  getHandPosition() {
    this.root.updateWorldMatrix(true, true);
    return this.arms[this.activeArm].hand.getWorldPosition(new THREE.Vector3());
  }
  reset() {
    this.lean = 0;
    this.body.rotation.x = 0;
    this.body.position.z = -0.52;
    this.body.updateMatrix();
    for (const arm of this.arms) this.poseArm(arm, arm.rest);
    this.root.updateWorldMatrix(true, true);
  }
}
