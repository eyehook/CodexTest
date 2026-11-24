import * as THREE from '../../shared/vendor/three-r180/three.module.js';

const LENGTH = 1.7;
const HALF_WIDTH = 0.055;
const SEPARATION = 0.28;
const THICKNESS = 0.035;
const SURFACE_CLEARANCE = 0.005;
const POSE_TIME_CONSTANT = 0.06;

export function createSkiShadowUniforms() {
  return {
    skiShadowsEnabled: {value: false},
    skiShadowCenters: {value: [new THREE.Vector3(), new THREE.Vector3()]},
    skiShadowNormals: {value: [new THREE.Vector3(), new THREE.Vector3()]},
    skiShadowRight: {value: new THREE.Vector3()},
    skiShadowSize: {value: new THREE.Vector2(HALF_WIDTH, LENGTH / 2)},
  };
}

export function createSkis(rig, height, shadows = createSkiShadowUniforms()) {
  const pair = new THREE.Group();
  pair.name = 'Player skis';
  pair.visible = false;
  rig.add(pair);
  const shape = new THREE.Shape();
  shape.moveTo(-HALF_WIDTH, -LENGTH / 2);
  shape.lineTo(HALF_WIDTH, -LENGTH / 2);
  shape.lineTo(0.049, 0.43);
  shape.quadraticCurveTo(0.08, LENGTH / 2, 0, LENGTH / 2);
  shape.quadraticCurveTo(-0.08, LENGTH / 2, -0.049, 0.43);
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, {depth: THICKNESS, bevelEnabled: false, curveSegments: 4});
  geometry.rotateX(-Math.PI / 2);
  const top = new THREE.MeshBasicMaterial({color: 0xd85831});
  const side = new THREE.MeshBasicMaterial({color: 0x202a32});
  const stripe = new THREE.MeshBasicMaterial({color: 0xf9e5c2});
  const markerGeometry = new THREE.BoxGeometry(0.072, 0.004, 0.18);
  const skis = [-1, 1].map(sign => {
    const ski = new THREE.Mesh(geometry, [top, side]);
    ski.position.x = sign * SEPARATION / 2;
    const band = new THREE.Mesh(markerGeometry, stripe);
    band.position.set(0, THICKNESS + 0.002, -0.4);
    ski.add(band);
    pair.add(ski);
    return ski;
  });
  const point = new THREE.Vector3();
  const orientation = new THREE.Quaternion();

  return {
    update(view, motion, visible, castShadows = false, dt = 0) {
      const wasVisible = pair.visible;
      pair.visible = visible && motion.active;
      shadows.skiShadowsEnabled.value = pair.visible && castShadows;
      if (!pair.visible) return;
      const blend = wasVisible ? -Math.expm1(-dt / POSE_TIME_CONSTANT) : 1;
      pair.position.set(view.position.x, 0, view.position.z);
      pair.rotation.y = motion.angle ?? 0;
      const yaw = rig.rotation.y + pair.rotation.y;
      const fx = -Math.sin(yaw) * LENGTH / 2;
      const fz = -Math.cos(yaw) * LENGTH / 2;
      if (castShadows) shadows.skiShadowRight.value.set(Math.cos(yaw), 0, -Math.sin(yaw));
      for (const [i, ski] of skis.entries()) {
        let targetOffset = SURFACE_CLEARANCE;
        let targetPitch = 0;
        if (!motion.airborne) {
          point.set(ski.position.x, 0, 0);
          pair.localToWorld(point);
          const nose = height(point.x + fx, point.z + fz);
          const tail = height(point.x - fx, point.z - fz);
          targetOffset += Math.max(height(point.x, point.z), (nose + tail) / 2) - rig.position.y;
          targetPitch = Math.atan2(nose - tail, LENGTH);
        }
        ski.position.y = THREE.MathUtils.lerp(ski.position.y, targetOffset, blend);
        ski.rotation.x = THREE.MathUtils.lerp(ski.rotation.x, targetPitch, blend);
        if (castShadows) {
          ski.getWorldPosition(shadows.skiShadowCenters.value[i]);
          ski.getWorldQuaternion(orientation);
          shadows.skiShadowNormals.value[i].set(0, 1, 0).applyQuaternion(orientation);
        }
      }
    },
    pair,
  };
}
