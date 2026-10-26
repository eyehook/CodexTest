import { EyelidBlink } from "./EyelidBlink.mjs?v=eyelid-blink-1";
import * as THREE from "../../forest/vendor/three.module.js";
import { GLTFLoader } from "../../forest/vendor/GLTFLoader.js";
import { OpponentAvatar } from "./OpponentAvatar.mjs";
import { solveArm } from "./ArmIK.mjs";
export const OPPONENT_URL = new URL(
  "../assets/opponent/manlp.glb",
  import.meta.url,
);
const up = new THREE.Vector3(0, 1, 0);
// Mirrored source parts can export skin indices with reversed winding while
// their normals remain outward-facing. Repair once on load; keep opaque materials.
export function repairMirroredWinding(geometry) {
  const position = geometry.attributes.position,
    normal = geometry.attributes.normal;
  if (!position || !normal || !geometry.index) return 0;
  const index = geometry.index;
  const a = new THREE.Vector3(),
    b = new THREE.Vector3(),
    c = new THREE.Vector3();
  const n = new THREE.Vector3(),
    cross = new THREE.Vector3();
  let repaired = 0;
  for (let i = 0; i < index.count; i += 3) {
    const ia = index.getX(i),
      ib = index.getX(i + 1),
      ic = index.getX(i + 2);
    a.fromBufferAttribute(position, ia);
    b.fromBufferAttribute(position, ib);
    c.fromBufferAttribute(position, ic);
    cross.subVectors(b, a).cross(c.sub(a));
    n.fromBufferAttribute(normal, ia);
    if (cross.dot(n) < -1e-12) {
      index.setX(i + 1, ic);
      index.setX(i + 2, ib);
      repaired++;
    }
  }
  if (repaired) index.needsUpdate = true;
  return repaired;
}
export class RiggedAvatar extends OpponentAvatar {
  static async load(parent) {
    const gltf = await new GLTFLoader().loadAsync(
      OPPONENT_URL.href + "?v=neck-jaw-refit-1",
    );
    return new RiggedAvatar(parent, gltf.scene);
  }
  constructor(parent, model, { random = Math.random } = {}) {
    super();
    this.root = new THREE.Group();
    parent.add(this.root);
    this.model = model;
    this.root.add(model);
    model.position.set(0, -0.25, -0.52);
    this.root.updateWorldMatrix(true, true);
    this.bones = {};
    const cloth = new THREE.MeshStandardMaterial({
      color: 0x818f86,
      roughness: 1,
      metalness: 0,
    });
    const skin = new THREE.MeshStandardMaterial({
      color: 0xb8a58b,
      roughness: 1,
      metalness: 0,
    });
    model.traverse((o) => {
      if (o.isBone) this.bones[o.name] = o;
      if (o.isSkinnedMesh) {
        o.frustumCulled = false;
        o.userData.repairedWinding = repairMirroredWinding(o.geometry);
        // The supplied mesh has no materials; retain the previous opponent palette.
        if (!o.material.name)
          o.material = /GEO-(belly|chest|shoulder|arm_)/.test(o.name)
            ? cloth
            : skin;
      }
    });
    const bone = (name) => {
      if (!this.bones[name])
        throw new Error(`Opponent rig missing bone: ${name}`);
      return this.bones[name];
    };
    this.head = bone("head");
    this.headRest = this.head.quaternion.clone();
    this.headModelRest = model
      .getWorldQuaternion(new THREE.Quaternion())
      .invert()
      .multiply(this.head.getWorldQuaternion(new THREE.Quaternion()));
    this.lookTarget = null;
    this.spine = bone("spine");
    this.spineRest = this.spine.quaternion.clone();
    const rootQ = this.root.getWorldQuaternion(new THREE.Quaternion()).invert();
    this.arms = ["R", "L"].map((suffix, index) => {
      const upper = bone(`upper_arm${suffix}`),
        lower = bone(`forearm${suffix}`),
        hand = bone(`hand${suffix}`);
      const anchor = new THREE.Group();
      this.root.add(anchor);
      const orientation = (b) =>
        rootQ.clone().multiply(b.getWorldQuaternion(new THREE.Quaternion()));
      const upperQ = orientation(upper),
        lowerQ = orientation(lower),
        handQ = orientation(hand);
      return {
        upper,
        lower,
        hand,
        attachment: anchor,
        side: index === 0 ? -1 : 1,
        shoulderRest: this.localPosition(upper),
        wristRest: new THREE.Vector3(index === 0 ? -0.28 : 0.28, 0.04, -0.31),
        rest: new THREE.Vector3(),
        pinch: 0,
        fingers: [
          "thumb",
          "finger_index",
          "finger_middle",
          "finger_ring",
          "finger_pinky",
        ].map((name) => {
          const b = bone(`${name}${suffix}`);
          const chain = [b];
          for (let i = 2; i <= (name === "thumb" ? 2 : 3); i++)
            chain.push(bone(`${name}_0${i}${suffix}`));
          const joints = chain.map((joint, i) => ({
            bone: joint,
            restQ: joint.quaternion.clone().normalize(),
            length:
              i + 1 < chain.length
                ? chain[i + 1].position.length()
                : this.fingerLength(joint),
          }));
          return {
            joints,
            bone: b,
            restQ: b.quaternion.clone().normalize(),
            length: joints.reduce((sum, j) => sum + j.length, 0),
          };
        }),
        upperLength: lower.position.length(),
        lowerLength: hand.position.length(),
        upperQ,
        lowerQ,
        handQ,
        upperDirection: up.clone().applyQuaternion(upperQ),
        lowerDirection: up.clone().applyQuaternion(lowerQ),
        handDirection: up.clone().applyQuaternion(handQ),
      };
    });
    for (const arm of this.arms) {
      // Derive the anatomical palm normal from finger layout, including handedness.
      const radial = arm.fingers[1].bone.position
        .clone()
        .sub(arm.fingers[4].bone.position);
      arm.palmNormal = radial.cross(up).multiplyScalar(-arm.side).normalize();
      arm.palmRoll = 0;
      arm.gripQ = new THREE.Quaternion()
        .setFromUnitVectors(
          arm.handDirection,
          new THREE.Vector3(0, -0.55, 0.835).normalize(),
        )
        .multiply(arm.handQ);
      this.configurePinch(arm, 0.014);
    }
    this.blink = new EyelidBlink(model, { random });
    this.activeArm = 1;
    this.lean = 0;
    this.reset();
  }
  fingerLength(bone) {
    let length = 0;
    this.model.traverse((mesh) => {
      if (!mesh.isSkinnedMesh) return;
      const joint = mesh.skeleton.bones.indexOf(bone);
      if (joint < 0) return;
      const indices = mesh.geometry.attributes.skinIndex,
        weights = mesh.geometry.attributes.skinWeight;
      mesh.skeleton.update();
      for (let i = 0; i < indices.count; i++) {
        if (
          ![0, 1, 2, 3].some(
            (c) =>
              indices.getComponent(i, c) === joint &&
              weights.getComponent(i, c) > 0.5,
          )
        )
          continue;
        const point = new THREE.Vector3()
          .fromBufferAttribute(mesh.geometry.attributes.position, i)
          .applyMatrix4(mesh.bindMatrix)
          .applyMatrix4(mesh.skeleton.boneInverses[joint]);
        length = Math.max(length, point.y);
      }
    });
    if (length < 0.01) throw new Error(`Missing finger tip for ${bone.name}`);
    return length;
  }
  configurePinch(arm, gap) {
    const [thumb, index] = arm.fingers;
    // Assign contacts from the actual knuckle layout in each mirrored hand.
    // A fixed signed axis can send the thumb to the index side and cross them.
    const direction = index.bone.position.clone().sub(thumb.bone.position);
    direction
      .addScaledVector(up, -direction.dot(up))
      .addScaledVector(arm.palmNormal, -direction.dot(arm.palmNormal))
      .normalize();
    arm.pinchDirection = direction.clone();
    const thumbOffset = direction.clone().multiplyScalar(-gap / 2);
    const knuckleCenter = thumb.bone.position
      .clone()
      .add(index.bone.position)
      .multiplyScalar(0.5);
    // Place the pinch ahead of and below the knuckles. Its lateral midpoint
    // stays between them, leaving each fingertip on its own nearest side.
    arm.pinchCenter = knuckleCenter
      .clone()
      .addScaledVector(up, 0.022)
      .addScaledVector(arm.palmNormal, 0.025);
    arm.pinchCenter.addScaledVector(
      direction,
      knuckleCenter.clone().sub(arm.pinchCenter).dot(direction),
    );
    arm.gripQ.copy(
      new THREE.Quaternion()
        .setFromUnitVectors(arm.handDirection, new THREE.Vector3(0, 0, 1))
        .multiply(arm.handQ),
    );
    arm.gripOffset = arm.pinchCenter.clone().applyQuaternion(arm.gripQ);
    const restPose = solveArm(arm.shoulderRest, arm.wristRest, {
      upper: arm.upperLength,
      lower: arm.lowerLength,
      pole: new THREE.Vector3(arm.side * 0.45, -0.45, -0.35),
    });
    const savedRoll = arm.palmRoll;
    const restQ = this.handOrientation(
      arm,
      restPose.hand.clone().sub(restPose.elbow).normalize(),
    );
    arm.palmRoll = savedRoll;
    arm.rest
      .copy(arm.wristRest)
      .add(arm.pinchCenter.clone().applyQuaternion(restQ));
    for (let i = 0; i < arm.fingers.length; i++) {
      const finger = arm.fingers[i];
      if (i < 2) {
        // Temporary shared contact: index meets the unchanged thumb target.
        const contact = arm.pinchCenter.clone().add(thumbOffset);
        if (i === 1) this.solveIndex(finger, contact, arm.palmNormal);
        else
          this.solveFinger(
            finger,
            contact,
            arm.palmNormal,
            direction.clone().negate(),
          );
      } else {
        // Keep each knuckle in its own lane; bend all three joints into a
        // relaxed hook, instead of swinging a rigid finger into the palm.
        const forward = up.clone().applyQuaternion(index.restQ);
        const inward = arm.palmNormal.clone();
        const contact = finger.bone.position
          .clone()
          .addScaledVector(forward, -finger.length * 0.3)
          .addScaledVector(inward, finger.length * 0.25);
        this.solveFinger(finger, contact, forward.clone().negate());
      }
    }
    arm.gap = gap;
  }
  solveIndex(finger, thumbContact, palmNormal) {
    const origin = finger.bone.position.clone();
    // The proximal phalanx extends along the hand instead of yawing sideways.
    const knuckle = origin.clone().addScaledVector(up, finger.joints[0].length);
    const target = thumbContact.clone().addScaledVector(palmNormal, 0.008);
    target.y = Math.max(target.y, origin.y + 0.012);
    const a = finger.joints[1].length,
      b = finger.joints[2].length;
    const axis = target.clone().sub(knuckle);
    const distance = Math.max(
      Math.abs(a - b) + 1e-6,
      Math.min(a + b - 1e-6, axis.length()),
    );
    axis.normalize();
    target.copy(knuckle).addScaledVector(axis, distance);
    const along = (a * a - b * b + distance * distance) / (2 * distance);
    const bend = palmNormal
      .clone()
      .addScaledVector(axis, -palmNormal.dot(axis))
      .normalize();
    const middle = knuckle
      .clone()
      .addScaledVector(axis, along)
      .addScaledVector(bend, Math.sqrt(Math.max(0, a * a - along * along)));
    this.applyFingerPose(finger, [origin, knuckle, middle, target]);
  }
  applyFingerPose(finger, points) {
    let parentQ = new THREE.Quaternion();
    for (let i = 0; i < finger.joints.length; i++) {
      const joint = finger.joints[i];
      const rest = parentQ.clone().multiply(joint.restQ);
      const direction = points[i + 1].clone().sub(points[i]).normalize();
      const desired = new THREE.Quaternion()
        .setFromUnitVectors(up.clone().applyQuaternion(rest), direction)
        .multiply(rest);
      joint.closedQ = parentQ.clone().invert().multiply(desired);
      parentQ.copy(desired);
    }
    finger.closedQ = finger.joints[0].closedQ;
  }
  solveFinger(finger, target, palmNormal, outward = new THREE.Vector3()) {
    const origin = finger.bone.position.clone();
    const axis = target.clone().sub(origin).normalize();
    // Seed the knuckles on the back of the finger, so the tips curl toward
    // the palm without choosing an inverted elbow solution.
    const bend = palmNormal.clone().negate().addScaledVector(outward, 2);
    bend.addScaledVector(axis, -bend.dot(axis)).normalize();
    const points = [origin.clone()];
    let distance = 0;
    for (const joint of finger.joints) {
      distance += joint.length;
      const t = distance / finger.length;
      points.push(
        origin
          .clone()
          .lerp(target, t)
          .addScaledVector(bend, Math.sin(Math.PI * t) * finger.length * 0.45),
      );
    }
    for (let iteration = 0; iteration < 80; iteration++) {
      points.at(-1).copy(target);
      for (let i = finger.joints.length - 1; i >= 0; i--)
        points[i]
          .sub(points[i + 1])
          .normalize()
          .multiplyScalar(finger.joints[i].length)
          .add(points[i + 1]);
      points[0].copy(origin);
      for (let i = 0; i < finger.joints.length; i++)
        points[i + 1]
          .sub(points[i])
          .normalize()
          .multiplyScalar(finger.joints[i].length)
          .add(points[i]);
      if (points.at(-1).distanceTo(target) < 1e-8) break;
    }
    this.applyFingerPose(finger, points);
  }

  prepareGrip(piece) {
    const geometry = piece.geometry;
    geometry.computeBoundingBox();
    const maxY = geometry.boundingBox.max.y,
      positions = geometry.attributes.position;
    let minX = Infinity,
      maxX = -Infinity;
    for (let i = 0; i < positions.count; i++)
      if (positions.getY(i) > maxY - 0.012) {
        minX = Math.min(minX, positions.getX(i));
        maxX = Math.max(maxX, positions.getX(i));
      }
    const gap = Math.max(0.008, Math.min(0.025, maxX - minX));
    for (const arm of this.arms) {
      this.configurePinch(arm, gap);
      arm.gripQ.copy(
        this.root
          .getWorldQuaternion(new THREE.Quaternion())
          .invert()
          .multiply(arm.hand.getWorldQuaternion(new THREE.Quaternion())),
      );
      arm.gripOffset.copy(arm.pinchCenter).applyQuaternion(arm.gripQ);
      const wrist = this.localPosition(arm.hand);
      arm.attachment.position.copy(wrist).add(arm.gripOffset);
    }
  }
  setPinch(amount) {
    const arm = this.arms[this.activeArm];
    arm.pinch = Math.max(0, Math.min(1, amount));
    for (const finger of arm.fingers)
      for (const joint of finger.joints)
        joint.bone.quaternion.slerpQuaternions(
          joint.restQ,
          joint.closedQ,
          arm.pinch,
        );
    arm.hand.updateWorldMatrix(true, true);
  }
  localPosition(object) {
    return this.root.worldToLocal(object.getWorldPosition(new THREE.Vector3()));
  }
  orient(bone, desired) {
    const parentQ = bone.parent.getWorldQuaternion(new THREE.Quaternion());
    const worldQ = this.root
      .getWorldQuaternion(new THREE.Quaternion())
      .multiply(desired);
    bone.quaternion.copy(parentQ.invert().multiply(worldQ));
    bone.updateWorldMatrix(true, true);
  }
  handOrientation(arm, forearm) {
    const handQ = new THREE.Quaternion()
      .setFromUnitVectors(arm.lowerDirection, forearm)
      .multiply(arm.handQ);
    const handDirection = up.clone().applyQuaternion(handQ);
    const down = new THREE.Vector3(0, -1, 0),
      bendAxis = handDirection.clone().cross(down);
    if (bendAxis.lengthSq() > 1e-10)
      handQ.premultiply(
        new THREE.Quaternion().setFromAxisAngle(
          bendAxis.normalize(),
          Math.min(0.18, handDirection.angleTo(down)),
        ),
      );
    // Roll the palm downward about its long axis without bending the wrist:
    // the finger contact stays below and ahead of the knuckles.
    const forward = up.clone().applyQuaternion(handQ);
    const palm = arm.palmNormal.clone().applyQuaternion(handQ);
    const lateral = palm.clone().addScaledVector(forward, -palm.dot(forward));
    const under = down.clone().addScaledVector(forward, -down.dot(forward));
    if (lateral.lengthSq() > 1e-10 && under.lengthSq() > 1e-10) {
      lateral.normalize();
      under.normalize();
      let angle = Math.atan2(
        forward.dot(lateral.clone().cross(under)),
        lateral.dot(under),
      );
      while (angle - arm.palmRoll > Math.PI) angle -= 2 * Math.PI;
      while (angle - arm.palmRoll < -Math.PI) angle += 2 * Math.PI;
      arm.palmRoll = angle;
      handQ.premultiply(
        new THREE.Quaternion().setFromAxisAngle(forward, angle),
      );
    }
    return handQ;
  }
  poseArm(arm, target) {
    const shoulder = this.localPosition(arm.upper);
    let pose;
    // Solve the wrist and grip offset together: hand orientation follows the
    // forearm, with only a small downward flexion instead of a fixed world pose.
    for (let i = 0; i < 40; i++) {
      const wristTarget = target.clone().sub(arm.gripOffset);
      pose = solveArm(shoulder, wristTarget, {
        upper: arm.upperLength,
        lower: arm.lowerLength,
        pole: new THREE.Vector3(arm.side * 0.45, -0.45, -0.35),
      });
      const forearm = pose.hand.clone().sub(pose.elbow).normalize();
      const handQ = this.handOrientation(arm, forearm);
      arm.gripQ.copy(handQ);
      const offset = arm.pinchCenter.clone().applyQuaternion(handQ);
      const error = offset.distanceTo(arm.gripOffset);
      arm.gripOffset.lerp(offset, 0.55);
      if (error < 1e-8) {
        arm.gripOffset.copy(offset);
        break;
      }
    }
    pose = solveArm(shoulder, target.clone().sub(arm.gripOffset), {
      upper: arm.upperLength,
      lower: arm.lowerLength,
      pole: new THREE.Vector3(arm.side * 0.45, -0.45, -0.35),
    });
    const upperDirection = pose.elbow.clone().sub(pose.shoulder).normalize();
    const lowerDirection = pose.hand.clone().sub(pose.elbow).normalize();
    this.orient(
      arm.upper,
      new THREE.Quaternion()
        .setFromUnitVectors(arm.upperDirection, upperDirection)
        .multiply(arm.upperQ),
    );
    this.orient(
      arm.lower,
      new THREE.Quaternion()
        .setFromAxisAngle(lowerDirection, arm.palmRoll * 0.8)
        .multiply(
          new THREE.Quaternion()
            .setFromUnitVectors(arm.lowerDirection, lowerDirection)
            .multiply(arm.lowerQ),
        ),
    );
    this.orient(arm.hand, arm.gripQ);
    arm.attachment.position
      .copy(this.localPosition(arm.hand))
      .add(arm.gripOffset);
    arm.pose = pose;
  }
  setPosture(lean) {
    this.lean = lean;
    this.model.position.z = -0.52 + lean * 0.14;
    this.spine.quaternion
      .copy(this.spineRest)
      .multiply(
        new THREE.Quaternion().setFromAxisAngle(
          new THREE.Vector3(1, 0, 0),
          lean * 0.75,
        ),
      );
    this.root.updateWorldMatrix(true, true);
  }
  setHandTarget(worldPosition) {
    this.root.updateWorldMatrix(true, true);
    const target = this.root.worldToLocal(worldPosition.clone());
    let lean = Math.max(0, Math.min(1, (target.z + 0.15) / 0.36));
    this.setPosture(lean);
    // Add only the lean needed for this mesh's natural, fixed bone lengths.
    const active = this.arms[this.activeArm];
    const reach = (active.upperLength + active.lowerLength) * 0.989;
    const wristTarget = target.clone().sub(active.gripOffset);
    if (
      this.localPosition(active.upper).distanceTo(wristTarget) > reach &&
      lean < 1
    ) {
      let lo = lean,
        hi = 1;
      for (let i = 0; i < 14; i++) {
        const mid = (lo + hi) / 2;
        this.setPosture(mid);
        if (this.localPosition(active.upper).distanceTo(wristTarget) > reach)
          lo = mid;
        else hi = mid;
      }
      lean = hi;
    }
    this.setPosture(lean);
    // An overhead grip puts the wrist higher than the contact point. For high,
    // far targets, shift the torso forward a little more instead of stretching.
    const shoulder = this.localPosition(active.upper);
    const vertical = wristTarget.y - shoulder.y,
      lateral = wristTarget.x - shoulder.x;
    const forwardReach = Math.sqrt(
      Math.max(0, reach * reach - vertical * vertical - lateral * lateral),
    );
    const advance = Math.max(
      0,
      Math.min(0.08, wristTarget.z - shoulder.z - forwardReach),
    );
    if (advance > 0) {
      this.model.position.z += advance;
      this.root.updateWorldMatrix(true, true);
    }
    for (let i = 0; i < 2; i++)
      this.poseArm(
        this.arms[i],
        i === this.activeArm ? target : this.arms[i].rest,
      );
    this.root.updateWorldMatrix(true, true);
    return this.getHandPosition().distanceTo(worldPosition);
  }
  setLookTarget(worldPosition) {
    this.lookTarget = worldPosition ? worldPosition.clone() : null;
  }
  update(dt) {
    this.blink.update(dt);
    const desired = this.headRest.clone();
    if (this.lookTarget) {
      this.root.updateWorldMatrix(true, true);
      const modelQ = this.model.getWorldQuaternion(new THREE.Quaternion());
      const direction = this.lookTarget
        .clone()
        .sub(this.head.getWorldPosition(new THREE.Vector3()))
        .applyQuaternion(modelQ.clone().invert());
      const yaw = THREE.MathUtils.clamp(
        Math.atan2(direction.x, direction.z),
        -0.8,
        0.8,
      );
      const pitch = THREE.MathUtils.clamp(
        Math.atan2(-direction.y, Math.hypot(direction.x, direction.z)),
        -0.2,
        1.05,
      );
      const worldQ = modelQ
        .multiply(
          new THREE.Quaternion().setFromEuler(
            new THREE.Euler(pitch, yaw, 0, "YXZ"),
          ),
        )
        .multiply(this.headModelRest);
      desired
        .copy(
          this.head.parent.getWorldQuaternion(new THREE.Quaternion()).invert(),
        )
        .multiply(worldQ);
    }
    this.head.quaternion.slerp(desired, 1 - Math.exp(-10 * Math.max(0, dt)));
    this.head.updateWorldMatrix(true, true);
  }
  closestArm(worldPosition) {
    const p = this.root.worldToLocal(worldPosition.clone());
    return this.arms[0].rest.distanceToSquared(p) <
      this.arms[1].rest.distanceToSquared(p)
      ? 0
      : 1;
  }
  selectArm(index) {
    this.activeArm = index;
  }
  get attachment() {
    return this.arms[this.activeArm].attachment;
  }
  get restTarget() {
    this.root.updateWorldMatrix(true, false);
    return this.root.localToWorld(this.arms[this.activeArm].rest.clone());
  }
  getHandPosition() {
    this.root.updateWorldMatrix(true, true);
    return this.attachment.getWorldPosition(new THREE.Vector3());
  }
  reset() {
    this.blink.reset();
    this.lookTarget = null;
    this.head.quaternion.copy(this.headRest);
    this.setPosture(0);
    for (const arm of this.arms) {
      arm.pinch = 0;
      arm.palmRoll = 0;
      for (const finger of arm.fingers)
        for (const joint of finger.joints)
          joint.bone.quaternion.copy(joint.restQ);
      this.poseArm(arm, arm.rest);
    }
    this.root.updateWorldMatrix(true, true);
  }
}
