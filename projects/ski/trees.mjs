import * as THREE from '../../shared/vendor/three-r180/three.module.js';
import {PINE_SHADOW_LAYER} from './pine-shadows.mjs?v=0.1.39';

const GRID = 6;
const CELLS_PER_CHUNK = 16;
const CHUNK = GRID * CELLS_PER_CHUNK;
const MIN_COVERAGE = 64;
const SPAWN_CHANCE = 0.5;
const HEIGHT_SCALE = 1.5;
export const FADE_START = 380;
export const FAR = 400;
const UPDATE_STEP = 12;
const PREFETCH = FAR + Math.SQRT2 * UPDATE_STEP;

function random(column, row, stream) {
  let hash = Math.imul(column + 1, 0x9e3779b1) ^ Math.imul(row + 1, 0x85ebca77) ^
    Math.imul(stream + 1, 0x632be59b);
  hash = Math.imul(hash ^ (hash >>> 16), 0x7feb352d);
  hash = Math.imul(hash ^ (hash >>> 15), 0x846ca68b);
  return ((hash ^ (hash >>> 16)) >>> 0) / 4294967296;
}

function overlapsPiste(x, z, radius, pistes) {
  const {spacingMeters: spacing, columns, rows, mask} = pistes;
  const half = spacing / 2;
  const minColumn = Math.max(0, Math.ceil((x - radius - half) / spacing));
  const maxColumn = Math.min(columns - 1, Math.floor((x + radius + half) / spacing));
  const minRow = Math.max(0, Math.ceil((z - radius - half) / spacing));
  const maxRow = Math.min(rows - 1, Math.floor((z + radius + half) / spacing));
  for (let row = minRow; row <= maxRow; row++) {
    for (let col = minColumn; col <= maxColumn; col++) {
      if (!mask[row * columns + col]) continue;
      const dx = Math.max(0, Math.abs(x - col * spacing) - half);
      const dz = Math.max(0, Math.abs(z - row * spacing) - half);
      if (dx * dx + dz * dz <= radius * radius) return true;
    }
  }
  return false;
}

export function treeAt(column, row, canopy, width, depth) {
  if (random(column, row, 0) >= SPAWN_CHANCE) return null;
  const x = (column + 0.15 + 0.7 * random(column, row, 1)) * GRID;
  const z = (row + 0.15 + 0.7 * random(column, row, 2)) * GRID;
  if (x < 0 || z < 0 || x > width || z > depth) return null;
  const {spacingMeters, columns, rows} = canopy.metadata;
  const i = Math.min(columns - 1, Math.round(x / spacingMeters));
  const j = Math.min(rows - 1, Math.round(z / spacingMeters));
  const index = j * columns + i;
  if (canopy.coverage[index] < MIN_COVERAGE) return null;
  const measured = canopy.heights.getUint16(2 * index, true) * canopy.metadata.heightScaleMeters;
  const baseHeight = measured * (0.85 + 0.3 * random(column, row, 3));
  const height = baseHeight * HEIGHT_SCALE;
  const radius = baseHeight * (0.15 + 0.21 * random(column, row, 4));
  if (overlapsPiste(x, z, radius, canopy.pistes)) return null;
  return {x, z, height, radius, tint: random(column, row, 5), yaw: random(column, row, 6) * Math.PI * 2};
}

function overlapsBuilding(tree, building) {
  const dx = tree.x - building.x;
  const dz = tree.z - building.z;
  const localX = dx * building.cos - dz * building.sin;
  const localZ = dx * building.sin + dz * building.cos;
  const edgeX = Math.max(0, Math.abs(localX) - building.width / 2);
  const edgeZ = Math.max(0, Math.abs(localZ) - building.depth / 2);
  return edgeX * edgeX + edgeZ * edgeZ <= tree.radius * tree.radius;
}

export async function loadTreeHeights(canopy) {
  const url = new URL(canopy.metadata.heightAsset, canopy.url);
  url.search = canopy.url.search;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Could not load canopy heights (HTTP ${response.status})`);
  const stream = response.body.pipeThrough(new DecompressionStream('gzip'));
  const data = await new Response(stream).arrayBuffer();
  if (data.byteLength !== canopy.metadata.rows * canopy.metadata.columns * 2) {
    throw new Error('Invalid canopy height grid dimensions');
  }
  canopy.heights = new DataView(data);
}

function treeGeometry() {
  const positions = [];
  const colors = [];
  function append(part, center, color) {
    const faces = part.toNonIndexed();
    faces.translate(0, center, 0);
    const vertex = faces.getAttribute('position');
    const normal = faces.getAttribute('normal');
    for (let i = 0; i < vertex.count; i++) {
      positions.push(vertex.getX(i), vertex.getY(i), vertex.getZ(i));
      const light = 0.8 + 0.2 * Math.max(0, normal.getY(i) - normal.getX(i) * 0.5);
      colors.push(color.r * light, color.g * light, color.b * light);
    }
    faces.dispose();
    part.dispose();
  }
  append(new THREE.CylinderGeometry(0.045, 0.075, 0.32, 5, 1, true), 0.155, new THREE.Color(0x997654));
  append(new THREE.ConeGeometry(1, 0.52, 6), 0.38, new THREE.Color(0xb4c3a6));
  append(new THREE.ConeGeometry(0.76, 0.47, 6), 0.575, new THREE.Color(0xc6d2b5));
  append(new THREE.ConeGeometry(0.49, 0.42, 6), 0.79, new THREE.Color(0xd4dfc2));
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  return geometry;
}

export function createTrees(scene, map, canopy, viewer = {value: new THREE.Vector2()}, footprints = []) {
  const width = map.metadata.columns - 1;
  const depth = map.metadata.rows - 1;
  const buildings = footprints.map(building => ({
    ...building,
    cos: Math.cos(building.yaw),
    sin: Math.sin(building.yaw),
    bound: Math.hypot(building.width, building.depth) / 2,
  }));
  const geometry = treeGeometry();
  const material = new THREE.MeshBasicMaterial({vertexColors: true});
  material.onBeforeCompile = shader => {
    shader.uniforms.skiTreeViewer = viewer;
    shader.vertexShader = 'uniform vec2 skiTreeViewer; varying float treeDistance; varying vec3 treePattern;\n' +
      shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        vec3 root = (modelMatrix * instanceMatrix[3]).xyz;
        treeDistance = length(skiTreeViewer - root.xz);
        treePattern = position * vec3(3.0, 12.0, 3.0) + root;`);
    shader.fragmentShader = 'varying float treeDistance; varying vec3 treePattern;\n' +
      shader.fragmentShader.replace('#include <alphatest_fragment>', `
        if (treeDistance >= ${FAR.toFixed(1)}) discard;
        if (treeDistance > ${FADE_START.toFixed(1)}) {
          float fade = 1.0 - smoothstep(${FADE_START.toFixed(1)}, ${FAR.toFixed(1)}, treeDistance);
          float noise = fract(sin(dot(floor(treePattern * 8.0), vec3(12.9898, 78.233, 37.719))) * 43758.5453);
          if (fade < noise) discard;
        }
        #include <alphatest_fragment>`);
  };

  const group = new THREE.Group();
  group.name = 'Canopy trees';
  scene.add(group);
  const chunks = new Map();
  const matrix = new THREE.Object3D();
  const color = new THREE.Color();
  const dark = new THREE.Color(0x294b34);
  const light = new THREE.Color(0x627a4b);
  let previousX = Infinity;
  let previousZ = Infinity;

  function addChunk(cx, cz) {
    let records = [];
    let maxRadius = 0;
    for (let iz = cz * CELLS_PER_CHUNK; iz < (cz + 1) * CELLS_PER_CHUNK; iz++) {
      for (let ix = cx * CELLS_PER_CHUNK; ix < (cx + 1) * CELLS_PER_CHUNK; ix++) {
        const tree = treeAt(ix, iz, canopy, width, depth);
        if (tree) {
          records.push(tree);
          maxRadius = Math.max(maxRadius, tree.radius);
        }
      }
    }
    if (!records.length) return null;
    const nearby = buildings.filter(building => {
      const dx = Math.max(cx * CHUNK - building.x, building.x - (cx + 1) * CHUNK, 0);
      const dz = Math.max(cz * CHUNK - building.z, building.z - (cz + 1) * CHUNK, 0);
      return dx * dx + dz * dz <= (building.bound + maxRadius) ** 2;
    });
    if (nearby.length) records = records.filter(tree => !nearby.some(building => overlapsBuilding(tree, building)));
    if (!records.length) return null;
    const mesh = new THREE.InstancedMesh(geometry, material, records.length);
    for (const [i, tree] of records.entries()) {
      matrix.position.set(tree.x, map.height(tree.x, tree.z) - 0.15, tree.z);
      matrix.rotation.y = tree.yaw;
      matrix.scale.set(tree.radius, tree.height, tree.radius);
      matrix.updateMatrix();
      mesh.setMatrixAt(i, matrix.matrix);
      mesh.setColorAt(i, color.copy(dark).lerp(light, tree.tint));
    }
    mesh.layers.enable(PINE_SHADOW_LAYER);
    mesh.computeBoundingSphere();
    group.add(mesh);
    return mesh;
  }

  function update(x, z) {
    viewer.value.set(x, z);
    const sx = Math.floor(x / UPDATE_STEP) * UPDATE_STEP;
    const sz = Math.floor(z / UPDATE_STEP) * UPDATE_STEP;
    if (sx === previousX && sz === previousZ) return;
    previousX = sx;
    previousZ = sz;
    const needed = new Set();
    for (let cz = Math.max(0, Math.floor((sz - PREFETCH) / CHUNK));
      cz <= Math.min(Math.floor(depth / CHUNK), Math.floor((sz + PREFETCH) / CHUNK)); cz++) {
      for (let cx = Math.max(0, Math.floor((sx - PREFETCH) / CHUNK));
        cx <= Math.min(Math.floor(width / CHUNK), Math.floor((sx + PREFETCH) / CHUNK)); cx++) {
        const dx = Math.max(cx * CHUNK - sx, sx - (cx + 1) * CHUNK, 0);
        const dz = Math.max(cz * CHUNK - sz, sz - (cz + 1) * CHUNK, 0);
        if (dx * dx + dz * dz > PREFETCH * PREFETCH) continue;
        const key = cz * (Math.floor(width / CHUNK) + 1) + cx;
        needed.add(key);
        if (!chunks.has(key)) chunks.set(key, addChunk(cx, cz));
      }
    }
    for (const [key, mesh] of chunks) {
      if (needed.has(key)) continue;
      if (mesh) {
        group.remove(mesh);
        mesh.dispose();
      }
      chunks.delete(key);
    }
  }
  return {update, group, material};
}
