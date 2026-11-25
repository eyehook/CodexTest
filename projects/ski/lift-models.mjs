import * as THREE from '../../shared/vendor/three-r180/three.module.js';

import {CHAIR_SPEED, chairCircuit, chairGeometry, movingChairs} from './chairlift.mjs?v=0.1.90';

const BOOSTED_CHAIR_SPEED = 30;

const PROFILES = {
  Chairlift: {spacing: 45, height: 9, routeWidth: 0.28, support: 0.65, terminal: 4, color: 0x334155},
  Carpet: {spacing: 4, height: 0.5, routeWidth: 1.4, support: 0, terminal: 2, color: 0x246b73},
  'Rope tow': {height: 1.5, routeWidth: 0.16, support: 0.24, terminal: 2, color: 0x85512b},
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
  const chair = chairGeometry();
  const wheel = new THREE.CylinderGeometry(2.1, 2.1, 0.42, 32);
  let previousTime;
  const marker = new THREE.Object3D();
  const direction = new THREE.Vector3();
  const center = new THREE.Vector3();
  const right = new THREE.Vector3();
  const up = new THREE.Vector3();
  const orientation = new THREE.Matrix4();
  const matrices = [];
  const colors = [];
  const terminals = new THREE.Color(0xda8542);
  const highlightedTerminal = new THREE.Color(0xfff45c);
  const bases = [];
  const chairlifts = new Map();
  let highlighted = null;
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
    const samples = profile.support
      ? [0, ...lift.pylonIndices, lift.route.length - 1].map(index => {
        const [x, z] = lift.route[index];
        return new THREE.Vector3(x, map.height(x, z), z);
      })
      : sampleRoute(lift.route, map, profile.spacing);
    matrices.length = 0;
    colors.length = 0;

    const circuit = lift.type === 'Chairlift' ? chairCircuit(samples) : null;
    const wheels = circuit && new THREE.InstancedMesh(wheel, material, 2);
    const cable = {height: 0, support: true, routeWidth: 0.085};
    for (let i = 0; i < samples.length; i++) {
      const point = samples[i];
      const isTerminal = i === 0 || i === samples.length - 1;
      if (circuit) {
        const rail = circuit.outbound[i];
        const postHeight = rail.y - point.y;
        center.copy(point);
        center.y += (postHeight - 1) / 2;
        box(center, profile.support, postHeight + 1, profile.support, steel);
        if (isTerminal) {
          const end = i === 0 ? 0 : 1;
          wheels.setMatrixAt(end, new THREE.Matrix4().makeTranslation(point.x, rail.y, point.z));
          wheels.setColorAt(end, terminals);
        } else {
          span(rail, circuit.inbound[i], {height: -0.18, support: true, routeWidth: 0.38}, steel);
        }
        if (i > 0) {
          span(circuit.outbound[i - 1], rail, cable, routeColor);
          span(circuit.inbound[i - 1], circuit.inbound[i], cable, routeColor);
        }
        continue;
      }
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

    }

    const mesh = new THREE.InstancedMesh(geometry, material, matrices.length);
    mesh.name = lift.name;
    for (let i = 0; i < matrices.length; i++) {
      mesh.setMatrixAt(i, matrices[i]);
      mesh.setColorAt(i, colors[i]);
    }
    mesh.computeBoundingSphere();
    if (circuit) {
      const clock = {value: 0};
      const chairs = movingChairs(chair, circuit, clock);
      mesh.add(wheels, chairs.mesh);
      chairlifts.set(lift, {board: chairs.board, clock, timeOffset: 0});
    }
    model.add(mesh);
    const [x, z] = lift.route[0];
    bases.push({x, z, mesh: wheels || mesh, lift});
  }
  scene.add(model);
  function highlightNearestBase(x, z) {
    let nearest = null;
    let nearestDistanceSquared = 15 ** 2;
    for (const base of bases) {
      const distanceSquared = (base.x - x) ** 2 + (base.z - z) ** 2;
      if (distanceSquared <= nearestDistanceSquared && (!nearest || distanceSquared < nearestDistanceSquared)) {
        nearest = base;
        nearestDistanceSquared = distanceSquared;
      }
    }
    if (nearest !== highlighted) {
      if (highlighted) {
        highlighted.mesh.setColorAt(0, terminals);
        highlighted.mesh.instanceColor.needsUpdate = true;
      }
      if (nearest) {
        nearest.mesh.setColorAt(0, highlightedTerminal);
        nearest.mesh.instanceColor.needsUpdate = true;
      }
      highlighted = nearest;
    }
    return nearest?.lift ?? null;
  }

  return {
    model, highlightNearestBase,
    boardChair(lift, x, y, z) { return chairlifts.get(lift)?.board(x, y, z) ?? null; },
    updateChairs(timeSeconds, acceleratedLift = null) {
      const elapsed = timeSeconds - (previousTime ?? timeSeconds);
      previousTime = timeSeconds;
      for (const [lift, chairs] of chairlifts) {
        if (lift === acceleratedLift) chairs.timeOffset += (BOOSTED_CHAIR_SPEED / CHAIR_SPEED - 1) * elapsed;
        chairs.clock.value = timeSeconds + chairs.timeOffset;
      }
    },
  };
}
