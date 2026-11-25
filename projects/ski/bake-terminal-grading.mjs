// Run from any directory with Node. Audit the fine terrain mesh and bake sparse DEM edits.
import {readFileSync, writeFileSync} from 'node:fs';
import {gunzipSync, gzipSync} from 'node:zlib';
import * as THREE from '../../shared/vendor/three-r180/three.module.js';
import {chairCircuit} from './chairlift.mjs';
import {applyPisteAdjustments, createHeightmap} from './heightmap.mjs';

const asset = name => new URL('./data/' + name, import.meta.url);
const json = name => JSON.parse(readFileSync(asset(name)));
function unpack(name) {
  return Uint8Array.from(gunzipSync(readFileSync(asset(name)))).buffer;
}
const meta = json('mount-snow-1m.json');
const data = unpack(meta.asset);
applyPisteAdjustments(data, unpack(meta.pisteAdjustmentAsset));
const map = createHeightmap(meta, data);
const grid = new DataView(data);
const edits = new Map();
function sampleStations() {
  const stations = [];
  for (const lift of Object.values(json('mount-snow-lifts.json')).flat()) {
    if (lift.type !== 'Chairlift') continue;
    const points = [0, ...lift.pylonIndices, lift.route.length - 1].map(index => {
      const [x, z] = lift.route[index];
      return new THREE.Vector3(x, map.height(x, z), z);
    });
    const {path} = chairCircuit(points);
    for (const [end, index] of [['base', 0], ['top', points.length - 1]]) {
      const hub = points[index];
      const neighbor = points[index === 0 ? 1 : index - 1];
      const length = Math.hypot(neighbor.x - hub.x, neighbor.z - hub.z);
      const axis = {x: (neighbor.x - hub.x) / length, z: (neighbor.z - hub.z) / length};
      const reach = Math.min(20, length / 2);
      const seats = [];
      for (let i = 0; i < path.length; i++) {
        const a = path[i], b = path[(i + 1) % path.length];
        const span = a.distanceTo(b);
        const steps = Math.ceil(span / 0.25);
        for (let j = 0; j < steps; j++) {
          const p = a.clone().lerp(b, j / steps);
          if (Math.hypot(p.x - hub.x, p.z - hub.z) > reach) continue;
          const yaw = Math.atan2(b.x - a.x, b.z - a.z);
          for (const side of [-0.76, 0, 0.76]) for (const front of [-0.285, 0.04, 0.365]) {
            seats.push([p.x + side * Math.cos(yaw) + front * Math.sin(yaw),
              p.z - side * Math.sin(yaw) + front * Math.cos(yaw), p.y - 2.47]);
          }
        }
      }
      stations.push({name: lift.name + ' ' + end, hub, axis, reach, seats,
        grade: (neighbor.y - hub.y) / length});
    }
  }
  return stations;
}

function clearance({seats}) {
  let min = Infinity;
  for (const [x, z, y] of seats) {
    // Both triangle diagonals bound the surface of the 2 m near-field mesh.
    const u = x % 2 / 2, v = z % 2 / 2;
    const left = x - 2 * u, top = z - 2 * v;
    const a = map.height(left, top), b = map.height(left + 2, top);
    const c = map.height(left, top + 2), d = map.height(left + 2, top + 2);
    const twist = d + a - b - c;
    const ground = a + u * (b - a) + v * (c - a)
      + Math.max(twist * Math.min(u, v), twist * Math.max(0, u + v - 1));
    min = Math.min(min, y - Math.max(ground, map.height(x, z)));
  }
  return min;
}
const stations = sampleStations();
const before = stations.map(clearance);
for (const [i, {hub, axis, reach, grade}] of stations.entries()) {
  if (before[i] >= 0.10) continue;
  const extent = Math.ceil(reach + 17);
  for (let z = Math.floor(hub.z) - extent; z <= hub.z + extent; z++) {
    for (let x = Math.floor(hub.x) - extent; x <= hub.x + extent; x++) {
      const dx = x - hub.x, dz = z - hub.z;
      const along = dx * axis.x + dz * axis.z;
      const t = Math.max(0, Math.min(reach, along));
      const distance = Math.hypot(dx - axis.x * t, dz - axis.z * t);
      const blend = THREE.MathUtils.smootherstep(distance, 5.5, 16);
      if (blend === 1) continue;
      // Level wheel apron, easing into the cable grade on the approach.
      const run = Math.max(0, along);
      const ramp = run < 2 ? run * run / 4 : run - 1;
      const target = hub.y + grade * ramp;
      const original = map.height(x, z);
      const pad = THREE.MathUtils.smootherstep(run, 4, 9);
      const graded = target - Math.max(0, target - original) * pad;
      const value = Math.round((graded + (original - graded) * blend - meta.elevationOffsetMeters)
        / meta.elevationScaleMeters);
      const index = z * meta.columns + x;
      if (grid.getUint16(index * 2, true) !== value) edits.set(index, value);
    }
  }
}
for (const [index, value] of edits) grid.setUint16(index * 2, value, true);
for (const [i, station] of sampleStations().entries()) {
  const delta = station.hub.y - stations[i].hub.y;
  if (Math.abs(delta) > 0.03) throw Error('Station anchor moved: ' + station.name);
  const after = clearance(station);
  console.log(station.name, before[i].toFixed(2), after.toFixed(2));
  if (after < 0.09) throw Error('Insufficient seat clearance at ' + station.name);
}
const records = Buffer.alloc(edits.size * 6);
let cursor = 0;
for (const [index, value] of [...edits].sort(([a], [b]) => a - b)) {
  records.writeUInt32LE(index, cursor);
  records.writeUInt16LE(value, cursor + 4);
  cursor += 6;
}
console.log(edits.size, 'adjusted grid samples');
meta.terminalGradingAsset = 'mount-snow-terminal-grading.bin.gz';
writeFileSync(asset(meta.terminalGradingAsset), gzipSync(records, {level: 9}));
writeFileSync(asset('mount-snow-1m.json'), JSON.stringify(meta, null, 2) + '\n');
