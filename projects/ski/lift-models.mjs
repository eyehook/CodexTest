import * as THREE from '../../shared/vendor/three-r180/three.module.js';

const PROFILES = {
  Chairlift: {spacing: 45, height: 9, routeWidth: 0.28, support: 0.65, terminal: 4, color: 0x334155},
  Carpet: {spacing: 4, height: 0.5, routeWidth: 1.4, support: 0, terminal: 2, color: 0x246b73},
  'Rope tow': {spacing: 8, height: 1.5, routeWidth: 0.16, support: 0.24, terminal: 2, color: 0x85512b},
};

function sampleRoute(route, map, spacing) {
  const samples = [];
  for (let i = 1; i < route.length; i++) {
    const [ax, az] = route[i - 1];
    const [bx, bz] = route[i];
    const count = Math.ceil(Math.hypot(bx - ax, bz - az) / spacing);
    for (let j = 0; j < count; j++) {
      const x = ax + (bx - ax) * j / count;
      const z = az + (bz - az) * j / count;
      samples.push(new THREE.Vector3(x, map.height(x, z), z));
    }
  }
  const [x, z] = route.at(-1);
  samples.push(new THREE.Vector3(x, map.height(x, z), z));
  return samples;
}

export function createLiftModels(scene, map, groups) {
  const geometry = new THREE.BoxGeometry();
  const material = new THREE.MeshBasicMaterial();
  const marker = new THREE.Object3D();
  const direction = new THREE.Vector3();
  const center = new THREE.Vector3();
  const right = new THREE.Vector3();
  const up = new THREE.Vector3();
  const orientation = new THREE.Matrix4();
  const matrices = [];
  const colors = [];
  const terminals = new THREE.Color(0xda8542);
  const steel = new THREE.Color(0x626e78);

  function box(position, width, height, depth, color) {
    marker.position.copy(position);
    marker.quaternion.identity();
    marker.scale.set(width, height, depth);
    marker.updateMatrix();
    matrices.push(marker.matrix.clone());
    colors.push(color);
  }

  function span(a, b, profile, color) {
    direction.subVectors(b, a);
    const length = direction.length();
    if (length === 0) return;
    marker.position.copy(a).lerp(b, 0.5);
    marker.position.y += profile.height;
    direction.divideScalar(length);
    right.set(direction.z, 0, -direction.x).normalize();
    up.crossVectors(direction, right);
    orientation.makeBasis(right, up, direction);
    marker.quaternion.setFromRotationMatrix(orientation);
    const thickness = profile.support ? profile.routeWidth : 0.36;
    marker.scale.set(profile.routeWidth, thickness, length + thickness);
    marker.updateMatrix();
    matrices.push(marker.matrix.clone());
    colors.push(color);
  }

  const model = new THREE.Group();
  model.name = 'Mapped lift routes';
  for (const lift of Object.values(groups).flat()) {
    const profile = PROFILES[lift.type];
    const routeColor = new THREE.Color(profile.color);
    const samples = sampleRoute(lift.route, map, profile.spacing);
    matrices.length = 0;
    colors.length = 0;

    for (let i = 0; i < samples.length; i++) {
      const point = samples[i];
      const isTerminal = i === 0 || i === samples.length - 1;
      if (isTerminal) {
        center.copy(point);
        center.y += 0.8;
        box(center, profile.terminal, 2.6, profile.terminal, terminals);
      }
      if (profile.support) {
        center.copy(point);
        center.y += (profile.height - 1) * 0.5;
        box(center, profile.support, profile.height + 1, profile.support, steel);
      }
      if (i === 0) continue;
      span(samples[i - 1], point, profile, routeColor);
      if (lift.type === 'Chairlift') {
        center.copy(samples[i - 1]).lerp(point, 0.5);
        center.y += profile.height - 0.85;
        box(center, 0.16, 1.7, 0.16, steel);
        center.y -= 0.9;
        box(center, 1.3, 0.35, 0.65, routeColor);
      }
    }

    const mesh = new THREE.InstancedMesh(geometry, material, matrices.length);
    mesh.name = lift.name;
    for (let i = 0; i < matrices.length; i++) {
      mesh.setMatrixAt(i, matrices[i]);
      mesh.setColorAt(i, colors[i]);
    }
    mesh.computeBoundingSphere();
    model.add(mesh);
  }
  scene.add(model);
  return model;
}
