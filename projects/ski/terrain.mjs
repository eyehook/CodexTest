import * as THREE from '../../shared/vendor/three-r180/three.module.js';
import {createSkiShadowUniforms} from './skis.mjs?v=0.1.58';
import {FADE_START, FAR} from './trees.mjs?v=0.1.59';

const TILE_SIZE = 256;
const SPACING = [2, 4, 8, 16, 32];
const SNAP = 16;
const LOD_HYSTERESIS = 24;
const VERTEX_CACHE_LIMIT = 12 * 1024 * 1024;
const TILE_UPDATE_BUDGET_MS = 2;
const TILES_PER_FRAME = 2;

function spacingAt(distance) {
  return SPACING[distance < 120 ? 0 : distance < 300 ? 1 : distance < 680 ? 2 : distance < 1240 ? 3 : 4];
}

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

  const indices = new Uint16Array(cells * cells * 6);
  let count = 0;
  function triangle(a, b, c) {
    if (a === b || b === c || c === a) return;
    indices[count++] = a;
    indices[count++] = b;
    indices[count++] = c;
  }
  for (let z = 0; z < cells; z++) {
    for (let x = 0; x < cells; x++) {
      if (x > 0 && x < cells - 1 && z > 0 && z < cells - 1) {
        const a = z * stride + x;
        indices[count++] = a;
        indices[count++] = a + stride;
        indices[count++] = a + 1;
        indices[count++] = a + 1;
        indices[count++] = a + stride;
        indices[count++] = a + stride + 1;
        continue;
      }
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
  return indices.subarray(0, count);
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
  const revision = new URL(import.meta.url).search;
  const canopyUrl = new URL('./data/mount-snow-canopy.json', import.meta.url);
  const sunlightUrl = new URL('./data/mount-snow-sun.json', import.meta.url);
  // The existing canopy files are independent of the new lighting bake.
  canopyUrl.search = '?v=0.1.29';
  sunlightUrl.search = revision;
  const [canopyResponse, sunlightResponse] = await Promise.all([fetch(canopyUrl), fetch(sunlightUrl)]);
  if (!canopyResponse.ok) throw new Error(`Could not load canopy metadata (HTTP ${canopyResponse.status})`);
  if (!sunlightResponse.ok) throw new Error(`Could not load sunlight metadata (HTTP ${sunlightResponse.status})`);
  const [canopy, sunlight] = await Promise.all([canopyResponse.json(), sunlightResponse.json()]);
  const width = Math.ceil(columns / sunlight.spacingMeters);
  const height = Math.ceil(rows / sunlight.spacingMeters);
  const azimuth = THREE.MathUtils.degToRad(sunlight.azimuthDegrees);
  const elevation = THREE.MathUtils.degToRad(sunlight.elevationDegrees);
  const sun = new THREE.Vector3(
    Math.sin(azimuth) * Math.cos(elevation),
    Math.sin(elevation),
    -Math.cos(azimuth) * Math.cos(elevation),
  );
  const coverageUrl = new URL(canopy.asset, canopyUrl);
  coverageUrl.search = canopyUrl.search;
  const shadowUrl = new URL(sunlight.asset, sunlightUrl);
  shadowUrl.search = sunlightUrl.search;
  const [shadows, trails, trees] = await Promise.all([
    loadMask(shadowUrl, width, height),
    loadMask(new URL(pistes.asset, pistesUrl), pistes.columns, pistes.rows),
    loadMask(coverageUrl, canopy.columns, canopy.rows),
  ]);

  const material = new THREE.ShaderMaterial({
    fog: true,
    uniforms: {
      ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
      ...createSkiShadowUniforms(),
      sun: {value: sun},
      shadows: {value: shadows},
      trails: {value: trails},
      trailSize: {value: new THREE.Vector2(pistes.columns, pistes.rows)},
      trailSpacing: {value: pistes.spacingMeters},
      trailBlue: {value: new THREE.Color(0xb8ddeb)},
      trees: {value: trees},
      canopySize: {value: new THREE.Vector2(canopy.columns, canopy.rows)},
      canopySpacing: {value: canopy.spacingMeters},
      canopyGreen: {value: new THREE.Color(0x465743)},
      canopyViewer: {value: new THREE.Vector2()},
      showTrails: {value: true},
      showTreeModels: {value: true},
      pineShadowsEnabled: {value: false},
      pineDepth: {value: null},
      pineProjection: {value: new THREE.Matrix4()},
      pineTexel: {value: 0},
      shadowSize: {value: new THREE.Vector2(width, height)},
      shadowSpacing: {value: sunlight.spacingMeters},
      minHeight: {value: minimumElevationMeters},
      maxHeight: {value: maximumElevationMeters},
      low: {value: new THREE.Color(0x7694a6)},
      middle: {value: new THREE.Color(0xb6c7cf)},
      high: {value: new THREE.Color(0xf7fbff)},
    },
    vertexShader: `
      varying vec3 terrainPoint;
      varying vec3 terrainNormal;
      #include <fog_pars_vertex>
      void main() {
        terrainPoint = position;
        terrainNormal = normal;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }
    `,
    fragmentShader: `
      uniform vec3 sun, low, middle, high, trailBlue, canopyGreen;
      uniform sampler2D shadows, trails, trees;
      uniform bool showTrails, showTreeModels, pineShadowsEnabled, skiShadowsEnabled;
      uniform vec3 skiShadowCenters[2], skiShadowNormals[2], skiShadowRight;
      uniform vec2 skiShadowSize;
      uniform sampler2D pineDepth;
      uniform mat4 pineProjection;
      uniform float pineTexel;
      uniform vec2 shadowSize, trailSize, canopySize, canopyViewer;
      uniform float shadowSpacing, trailSpacing, canopySpacing, minHeight, maxHeight;
      varying vec3 terrainPoint;
      varying vec3 terrainNormal;
      #include <fog_pars_fragment>
      float pineDepthRow(vec2 uv, float depth, vec4 weights) {
        vec2 stepX = vec2(pineTexel, 0.0);
        vec4 depths = vec4(texture2D(pineDepth, uv).r,
          texture2D(pineDepth, uv + stepX).r,
          texture2D(pineDepth, uv + 2.0 * stepX).r,
          texture2D(pineDepth, uv + 3.0 * stepX).r);
        return dot(step(vec4(depth), depths), weights);
      }
      float pineVisibility(vec3 point) {
        if (!pineShadowsEnabled) return 1.0;
        float fade = 1.0 - smoothstep(180.0, 200.0, length(point.xz - canopyViewer));
        if (fade <= 0.0) return 1.0;
        vec3 projected = (pineProjection * vec4(point, 1.0)).xyz * 0.5 + 0.5;
        if (any(lessThan(projected, vec3(0.0))) || any(greaterThan(projected, vec3(1.0)))) return 1.0;
        float depth = projected.z - 0.00018;
        // Three.js r180 PCFSoft weights, expressed separably for a scalar depth texture.
        vec2 fraction = fract(projected.xy / pineTexel + 0.5);
        vec2 origin = projected.xy - (fraction + 1.0) * pineTexel;
        vec4 weights = vec4(1.0 - fraction.x, 1.0, 1.0, fraction.x);
        vec2 stepY = vec2(0.0, pineTexel);
        float lit = (1.0 - fraction.y) * pineDepthRow(origin, depth, weights)
          + pineDepthRow(origin + stepY, depth, weights)
          + pineDepthRow(origin + 2.0 * stepY, depth, weights)
          + fraction.y * pineDepthRow(origin + 3.0 * stepY, depth, weights);
        return mix(1.0, lit / 9.0, fade);
      }
      float skiOcclusion(vec3 point, vec3 center, vec3 normal) {
        float facingSun = dot(normal, sun);
        if (facingSun <= 0.06) return 0.0;
        float distanceToSki = dot(center - point, normal) / facingSun;
        if (distanceToSki < -0.02 || distanceToSki > 5.0) return 0.0;
        vec3 rayHit = point + distanceToSki * sun - center;
        vec2 local = vec2(dot(rayHit, skiShadowRight), dot(rayHit, cross(skiShadowRight, normal)));
        local.y -= clamp(local.y, -skiShadowSize.y + skiShadowSize.x, skiShadowSize.y - skiShadowSize.x);
        float edge = length(local) - skiShadowSize.x;
        float feather = 0.025 + min(0.15, max(0.0, distanceToSki) * 0.085);
        float strength = 0.78 * (1.0 - smoothstep(0.2, 5.0, distanceToSki));
        return strength * (1.0 - smoothstep(-0.015, feather, edge));
      }
      void main() {
        float elevation = clamp((terrainPoint.y - minHeight) / (maxHeight - minHeight), 0.0, 1.0);
        vec3 snow = mix(low, middle, smoothstep(0.0, 0.57, elevation));
        snow = mix(snow, high, smoothstep(0.38, 1.0, elevation));
        if (showTrails) {
          float trail = texture2D(trails, (terrainPoint.xz / trailSpacing + 0.5) / trailSize).r;
          snow = mix(snow, trailBlue, trail);
        }
        float canopy = texture2D(trees, (terrainPoint.xz / canopySpacing + 0.5) / canopySize).r;
        float canopyFade = showTreeModels ? smoothstep(${FADE_START.toFixed(1)}, ${FAR.toFixed(1)},
          length(terrainPoint.xz - canopyViewer)) : 1.0;
        snow = mix(snow, canopyGreen, smoothstep(0.03, 0.68, canopy) * canopyFade);
        vec3 slope = normalize(terrainNormal);
        float cosine = max(dot(slope, sun), 0.0);
        float visibility = texture2D(shadows, (terrainPoint.xz / shadowSpacing + 0.5) / shadowSize).r;
        if (cosine > 0.0 && visibility > 0.0) {
          visibility *= pineVisibility(terrainPoint);
          if (skiShadowsEnabled) {
            vec2 delta = terrainPoint.xz - skiShadowCenters[0].xz;
            if (dot(delta, delta) < 36.0) {
              float leftShadow = skiOcclusion(terrainPoint, skiShadowCenters[0], skiShadowNormals[0]);
              float rightShadow = skiOcclusion(terrainPoint, skiShadowCenters[1], skiShadowNormals[1]);
              visibility *= 1.0 - max(leftShadow, rightShadow);
            }
          }
        }
        vec3 ambient = vec3(0.36, 0.43, 0.53) * (0.69 + 0.31 * slope.y);
        vec3 lit = snow * (ambient + vec3(1.12, 1.00, 0.87) * cosine * visibility);
        gl_FragColor = vec4(lit, 1.0);
        #include <colorspace_fragment>
        #include <fog_fragment>
      }
    `,
  });
  return {
    material,
    canopy: {
      metadata: canopy,
      url: canopyUrl,
      coverage: trees.image.data,
      pistes: {columns: pistes.columns, rows: pistes.rows, spacingMeters: pistes.spacingMeters,
        mask: trails.image.data},
    },
  };
}

export function createTerrain(scene, map, material) {
  const width = map.metadata.columns - 1;
  const depth = map.metadata.rows - 1;
  const columns = Math.ceil(width / TILE_SIZE);
  const rows = Math.ceil(depth / TILE_SIZE);
  const tiles = [];
  const topologies = new Map();
  const vertexCache = new Map();
  let cachedBytes = 0;
  let lastX = Infinity;
  let lastZ = Infinity;
  const pending = [];
  let pendingIndex = 0;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < columns; col++) {
      const mesh = new THREE.Mesh(undefined, material);
      tiles.push({col, row, mesh, step: 0, key: '', vertices: null});
      scene.add(mesh);
    }
  }

  function sampleVertices(col, row, step) {
    const cells = TILE_SIZE / step;
    const size = (cells + 1) ** 2 * 3;
    const points = new Float32Array(size);
    const normals = new Float32Array(size);
    for (let j = 0; j <= cells; j++) {
      const z = Math.min(depth, row * TILE_SIZE + j * step);
      map.writeTerrainRow(points, normals, j * (cells + 1) * 3, col * TILE_SIZE, z, step, cells + 1);
    }
    return {points, normals, bytes: points.byteLength + normals.byteLength, bounds: null};
  }

  function replaceVertices(tile, index, step) {
    const key = index * 32 + step - 1;
    const cached = vertexCache.get(key);
    if (cached) {
      vertexCache.delete(key);
      cachedBytes -= cached.bytes;
    }
    if (tile.vertices) {
      vertexCache.set(index * 32 + tile.step - 1, tile.vertices);
      cachedBytes += tile.vertices.bytes;
      while (cachedBytes > VERTEX_CACHE_LIMIT) {
        const oldest = vertexCache.keys().next().value;
        cachedBytes -= vertexCache.get(oldest).bytes;
        vertexCache.delete(oldest);
      }
    }
    const vertices = cached ?? sampleVertices(tile.col, tile.row, step);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(vertices.points, 3));
    geometry.setAttribute('normal', new THREE.BufferAttribute(vertices.normals, 3));
    if (vertices.bounds) geometry.boundingSphere = vertices.bounds;
    else {
      geometry.computeBoundingSphere();
      vertices.bounds = geometry.boundingSphere;
    }
    const capacity = (TILE_SIZE / step) ** 2 * 6;
    geometry.setIndex(new THREE.BufferAttribute(new Uint16Array(capacity), 1).setUsage(THREE.DynamicDrawUsage));
    tile.mesh.geometry.dispose();
    tile.mesh.geometry = geometry;
    tile.vertices = vertices;
    tile.key = '';
    tile.step = step;
  }

  function stitch(i) {
    const {col, row, mesh, step} = tiles[i];
    const edges = [
      col > 0 ? tiles[i - 1].step : step,
      col + 1 < columns ? tiles[i + 1].step : step,
      row > 0 ? tiles[i - columns].step : step,
      row + 1 < rows ? tiles[i + columns].step : step,
    ].map(neighbor => Math.max(step, neighbor));
    const key = [step, ...edges].join('/');
    if (tiles[i].key === key) return;
    if (!topologies.has(key)) topologies.set(key, makeTileIndices(step, edges));
    const indices = topologies.get(key);
    const index = mesh.geometry.index;
    index.array.set(indices);
    index.clearUpdateRanges();
    index.addUpdateRange(0, indices.length);
    index.needsUpdate = true;
    mesh.geometry.setDrawRange(0, indices.length);
    tiles[i].key = key;
  }

  function update(x, z) {
    const snapX = Math.floor(x / SNAP) * SNAP;
    const snapZ = Math.floor(z / SNAP) * SNAP;
    if (lastX !== snapX || lastZ !== snapZ) {
      const initial = lastX === Infinity;
      lastX = snapX;
      lastZ = snapZ;
      pending.length = 0;
      pendingIndex = 0;
      for (const [i, tile] of tiles.entries()) {
        const dx = Math.max(tile.col * TILE_SIZE - snapX, snapX - (tile.col + 1) * TILE_SIZE, 0);
        const dz = Math.max(tile.row * TILE_SIZE - snapZ, snapZ - (tile.row + 1) * TILE_SIZE, 0);
        const distance = Math.hypot(dx, dz);
        const nominal = spacingAt(distance);
        tile.nextStep = tile.step && nominal > tile.step
          ? Math.max(tile.step, spacingAt(distance - LOD_HYSTERESIS))
          : nominal;
        tile.distance = distance;
        if (initial) replaceVertices(tile, i, tile.nextStep);
        else if (tile.step !== tile.nextStep) pending.push(i);
      }
      if (initial) {
        for (let i = 0; i < tiles.length; i++) stitch(i);
        return tiles.length;
      }
      pending.sort((a, b) => tiles[a].distance - tiles[b].distance);
    }
    if (pendingIndex === pending.length) return;

    // Change one tile and its four borders together. Mixed intermediate LODs
    // remain watertight while the rest of the queue catches up.
    const deadline = performance.now() + TILE_UPDATE_BUDGET_MS;
    let changed = 0;
    for (; pendingIndex < pending.length && changed < TILES_PER_FRAME; changed++) {
      const i = pending[pendingIndex++];
      const tile = tiles[i];
      replaceVertices(tile, i, tile.nextStep);
      stitch(i);
      if (tile.col > 0) stitch(i - 1);
      if (tile.col + 1 < columns) stitch(i + 1);
      if (tile.row > 0) stitch(i - columns);
      if (tile.row + 1 < rows) stitch(i + columns);
      if (performance.now() >= deadline) return changed + 1;
    }
    return changed;
  }

  return {width, depth, update};
}
