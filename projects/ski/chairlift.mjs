import * as THREE from '../../shared/vendor/three-r180/three.module.js';
import {mergeGeometries} from '../../shared/vendor/three-r180/addons/BufferGeometryUtils.js';

const RADIUS = 2.1;
const SEAT_DROP = 2.4;
const STATION_HEIGHT = SEAT_DROP + 0.55;

export function chairGeometry() {
  const pieces = [];
  function part(x, y, z, w, h, d, hex) {
    const geometry = new THREE.BoxGeometry(w, h, d).translate(x, y, z);
    const color = new THREE.Color(hex);
    const rgb = [];
    for (let i = 0; i < geometry.attributes.position.count; i++) rgb.push(color.r, color.g, color.b);
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(rgb, 3));
    pieces.push(geometry);
  }
  const steel = 0x657480;
  part(0, -0.65, -0.23, 0.09, 1.3, 0.09, steel);
  part(0, -0.05, -0.11, 0.12, 0.1, 0.36, steel);
  part(0, -SEAT_DROP, 0.04, 1.52, 0.14, 0.65, 0x29455a);
  part(0, -1.3, -0.23, 1.52, 0.09, 0.09, steel);
  for (const side of [-1, 1]) {
    part(side * 0.72, -1.85, -0.23, 0.08, 1.1, 0.08, steel);
    part(side * 0.365, -2.08, -0.25, 0.70, 0.51, 0.12, 0x385b71);
  }
  return mergeGeometries(pieces);
}

// The same closed polyline drives the cable spans and the chair pose lookup.
export function chairCircuit(samples) {
  const outbound = [], inbound = [], turns = [];
  for (let i = 0; i < samples.length; i++) {
    const point = samples[i];
    const axis = samples[Math.min(i + 1, samples.length - 1)].clone()
      .sub(samples[Math.max(0, i - 1)]);
    axis.y = 0;
    axis.normalize();
    const side = new THREE.Vector3(axis.z, 0, -axis.x);
    const terminal = i === 0 || i === samples.length - 1;
    const hub = point.clone();
    hub.y += terminal ? STATION_HEIGHT : 9;
    outbound.push(hub.clone().addScaledVector(side, RADIUS));
    inbound.push(hub.clone().addScaledVector(side, -RADIUS));
    if (terminal) {
      const sign = i === 0 ? -1 : 1;
      const arc = [];
      for (let step = 1; step < 24; step++) {
        const angle = Math.PI * step / 24;
        arc.push(hub.clone().addScaledVector(side, sign * RADIUS * Math.cos(angle))
          .addScaledVector(axis, sign * RADIUS * Math.sin(angle)));
      }
      turns.push(arc);
    }
  }
  return {outbound, inbound, path: [...outbound, ...turns[1], ...inbound.slice().reverse(), ...turns[0]]};
}

export function movingChairs(geometry, path, clock) {
  const lengths = path.map((p, i) => p.distanceTo(path[(i + 1) % path.length]));
  const length = lengths.reduce((a, b) => a + b, 0);
  const count = Math.ceil(length / 0.25);
  const rows = Math.ceil(count / 256);
  const data = new Float32Array(256 * rows * 4);
  let segment = 0, start = 0;
  const point = new THREE.Vector3();
  for (let i = 0; i < count; i++) {
    const distance = length * i / count;
    while (segment < lengths.length - 1 && distance >= start + lengths[segment]) {
      start += lengths[segment++];
    }
    const a = path[segment], b = path[(segment + 1) % path.length];
    point.lerpVectors(a, b, (distance - start) / lengths[segment]).toArray(data, i * 4);
    data[i * 4 + 3] = Math.atan2(b.x - a.x, b.z - a.z);
  }
  const poses = new THREE.DataTexture(data, 256, rows, THREE.RGBAFormat, THREE.FloatType);
  poses.needsUpdate = true;
  const chairs = Math.max(2, Math.round(length / 45));
  const material = new THREE.MeshBasicMaterial({vertexColors: true});
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, {liftTime: clock, liftPoses: {value: poses},
      liftLayout: {value: new THREE.Vector3(count, 3 / length, 1 / chairs)}});
    shader.vertexShader = `
      uniform float liftTime;
      uniform sampler2D liftPoses;
      uniform vec3 liftLayout;
      vec4 liftPose(int i) { return texelFetch(liftPoses, ivec2(i % 256, i / 256), 0); }
    ` + shader.vertexShader.replace('#include <begin_vertex>', `
      float t = fract(liftTime * liftLayout.y + float(gl_InstanceID) * liftLayout.z) * liftLayout.x;
      int i = int(floor(t)) % int(liftLayout.x);
      vec4 a = liftPose(i), b = liftPose((i + 1) % int(liftLayout.x));
      float yaw = a.w + fract(t) * (mod(b.w - a.w + 3.141593, 6.283185) - 3.141593);
      float c = cos(yaw), s = sin(yaw);
      vec3 transformed = mix(a.xyz, b.xyz, fract(t)) +
        vec3(c * position.x + s * position.z, position.y, c * position.z - s * position.x);
    `);
  };
  const mesh = new THREE.InstancedMesh(geometry, material, chairs);
  mesh.name = 'Moving double chairs';
  mesh.boundingSphere = new THREE.Box3().setFromPoints(path).expandByScalar(3)
    .getBoundingSphere(new THREE.Sphere());
  return mesh;
}
