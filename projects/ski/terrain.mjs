import * as THREE from '../../shared/vendor/three-r180/three.module.js';

const TILE_SIZE = 256;
const SPACING = [2, 4, 8, 16, 32];
const SNAP = 16;
const SHADOW_SPACING = 4;
const SUN = new THREE.Vector3(-1, Math.SQRT2 * Math.tan(15 * Math.PI / 180), -1).normalize();
const SKY = 0xaac6db;

// Collapse intermediate edge vertices onto the adjacent coarse grid. The two
// tiles then use exactly the same edge segments, including at LOD corners.
export function makeTileIndices(step, edges) {
  const cells = TILE_SIZE / step;
  const stride = cells + 1;
  const snap = (value, ratio) => value - value % ratio;
  const [left, right, top, bottom] = edges.map(edge => edge / step);
  function vertex(x, z) {
    if (x === 0) z = snap(z, left);
    if (x === cells) z = snap(z, right);
    if (z === 0) x = snap(x, top);
    if (z === cells) x = snap(x, bottom);
    return z * stride + x;
  }

  const indices = [];
  function triangle(a, b, c) {
    if (a !== b && b !== c && c !== a) indices.push(a, b, c);
  }
  for (let z = 0; z < cells; z++) {
    for (let x = 0; x < cells; x++) {
      const a = vertex(x, z);
      const b = vertex(x + 1, z);
      const c = vertex(x, z + 1);
      const d = vertex(x + 1, z + 1);
      if (x === cells - 1 && z === cells - 1) {
        // At this corner both snapped edge vertices can move past the
        // interior vertex. Connect that vertex directly to the corner.
        triangle(a, c, d);
        triangle(a, d, b);
      } else {
        triangle(a, c, b);
        triangle(b, c, d);
      }
    }
  }
  return new Uint16Array(indices);
}

async function loadMask(url, width, height) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Could not load ${url.pathname} (HTTP ${response.status})`);
  const stream = response.body.pipeThrough(new DecompressionStream('gzip'));
  const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
  if (bytes.length !== width * height) throw new Error(`Invalid mask dimensions for ${url.pathname}`);
  const texture = new THREE.DataTexture(bytes, width, height, THREE.RedFormat);
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

export async function createTerrainMaterial(
  {columns, rows, minimumElevationMeters, maximumElevationMeters}, pistes, pistesUrl,
) {
  const width = Math.ceil(columns / SHADOW_SPACING);
  const height = Math.ceil(rows / SHADOW_SPACING);
  const [shadows, trails] = await Promise.all([
    loadMask(new URL('./data/mount-snow-sun.u8.gz', import.meta.url), width, height),
    loadMask(new URL(pistes.asset, pistesUrl), pistes.columns, pistes.rows),
  ]);

  return new THREE.ShaderMaterial({
    uniforms: {
      sun: {value: SUN},
      shadows: {value: shadows},
      trails: {value: trails},
      trailSize: {value: new THREE.Vector2(pistes.columns, pistes.rows)},
      trailSpacing: {value: pistes.spacingMeters},
      trailBlue: {value: new THREE.Color(0xb8ddeb)},
      shadowSize: {value: new THREE.Vector2(width, height)},
      shadowSpacing: {value: SHADOW_SPACING},
      minHeight: {value: minimumElevationMeters},
      maxHeight: {value: maximumElevationMeters},
      low: {value: new THREE.Color(0x7694a6)},
      middle: {value: new THREE.Color(0xb6c7cf)},
      high: {value: new THREE.Color(0xf7fbff)},
      haze: {value: new THREE.Color(SKY)},
    },
    vertexShader: `
      varying vec3 terrainPoint;
      varying vec3 terrainNormal;
      varying float depth;
      void main() {
        terrainPoint = position;
        terrainNormal = normal;
        vec4 view = modelViewMatrix * vec4(position, 1.0);
        depth = length(view.xyz);
        gl_Position = projectionMatrix * view;
      }
    `,
    fragmentShader: `
      uniform vec3 sun, low, middle, high, haze, trailBlue;
      uniform sampler2D shadows, trails;
      uniform vec2 shadowSize, trailSize;
      uniform float shadowSpacing, trailSpacing, minHeight, maxHeight;
      varying vec3 terrainPoint;
      varying vec3 terrainNormal;
      varying float depth;
      void main() {
        float elevation = clamp((terrainPoint.y - minHeight) / (maxHeight - minHeight), 0.0, 1.0);
        vec3 snow = mix(low, middle, smoothstep(0.0, 0.57, elevation));
        snow = mix(snow, high, smoothstep(0.38, 1.0, elevation));
        float trail = texture2D(trails, (terrainPoint.xz / trailSpacing + 0.5) / trailSize).r;
        snow = mix(snow, trailBlue, trail);
        vec3 slope = normalize(terrainNormal);
        float cosine = max(dot(slope, sun), 0.0);
        float visibility = texture2D(shadows, (terrainPoint.xz / shadowSpacing + 0.5) / shadowSize).r;
        vec3 ambient = vec3(0.36, 0.43, 0.53) * (0.69 + 0.31 * slope.y);
        vec3 lit = snow * (ambient + vec3(1.12, 1.00, 0.87) * cosine * visibility);
        gl_FragColor = vec4(mix(lit, haze, smoothstep(250.0, 5000.0, depth) * 0.87), 1.0);
        #include <colorspace_fragment>
      }
    `,
  });
}

export function createTerrain(scene, map, material) {
  scene.background = new THREE.Color(SKY);
  const width = map.metadata.columns - 1;
  const depth = map.metadata.rows - 1;
  const columns = Math.ceil(width / TILE_SIZE);
  const rows = Math.ceil(depth / TILE_SIZE);
  const tiles = [];
  const topologies = new Map();
  const normal = {};
  let lastX = Infinity;
  let lastZ = Infinity;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < columns; col++) {
      const mesh = new THREE.Mesh(undefined, material);
      tiles.push({col, row, mesh, step: 0, key: ''});
      scene.add(mesh);
    }
  }

  function update(x, z) {
    const snapX = Math.floor(x / SNAP) * SNAP;
    const snapZ = Math.floor(z / SNAP) * SNAP;
    if (lastX === snapX && lastZ === snapZ) return;
    lastX = snapX;
    lastZ = snapZ;

    for (const tile of tiles) {
      const dx = Math.max(tile.col * TILE_SIZE - snapX, snapX - (tile.col + 1) * TILE_SIZE, 0);
      const dz = Math.max(tile.row * TILE_SIZE - snapZ, snapZ - (tile.row + 1) * TILE_SIZE, 0);
      const distance = Math.hypot(dx, dz);
      tile.nextStep = SPACING[distance < 120 ? 0 : distance < 300 ? 1 : distance < 680 ? 2 : distance < 1240 ? 3 : 4];
    }

    for (const tile of tiles) {
      const {col, row, mesh, nextStep: step} = tile;
      const i = row * columns + col;
      const edges = [
        col > 0 ? tiles[i - 1].nextStep : step,
        col + 1 < columns ? tiles[i + 1].nextStep : step,
        row > 0 ? tiles[i - columns].nextStep : step,
        row + 1 < rows ? tiles[i + columns].nextStep : step,
      ].map(neighbor => Math.max(step, neighbor));
      const key = [step, ...edges].join('/');
      if (tile.key === key) continue;
      if (!topologies.has(key)) topologies.set(key, makeTileIndices(step, edges));

      const geometry = new THREE.BufferGeometry();
      if (tile.step === step) {
        geometry.setAttribute('position', mesh.geometry.getAttribute('position'));
        geometry.setAttribute('normal', mesh.geometry.getAttribute('normal'));
        geometry.boundingSphere = mesh.geometry.boundingSphere;
      } else {
        const cells = TILE_SIZE / step;
        const size = (cells + 1) ** 2 * 3;
        const points = new Float32Array(size);
        const normals = new Float32Array(size);
        let cursor = 0;
        for (let j = 0; j <= cells; j++) {
          const z = Math.min(depth, row * TILE_SIZE + j * step);
          for (let k = 0; k <= cells; k++) {
            const x = Math.min(width, col * TILE_SIZE + k * step);
            points[cursor] = x;
            points[cursor + 1] = map.height(x, z);
            points[cursor + 2] = z;
            map.normal(x, z, normal);
            normals[cursor++] = normal.x;
            normals[cursor++] = normal.y;
            normals[cursor++] = normal.z;
          }
        }
        geometry.setAttribute('position', new THREE.BufferAttribute(points, 3));
        geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
        geometry.computeBoundingSphere();
      }
      geometry.setIndex(new THREE.BufferAttribute(topologies.get(key), 1));
      mesh.geometry.dispose();
      mesh.geometry = geometry;
      tile.key = key;
      tile.step = step;
    }
  }

  return {width, depth, update};
}
