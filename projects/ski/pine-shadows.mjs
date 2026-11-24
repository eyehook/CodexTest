import * as THREE from '../../shared/vendor/three-r180/three.module.js';

export const PINE_SHADOW_LAYER = 1;
const MAP_SIZE = 1536;
const REFRESH_DISTANCE = 8;
const HALF_RANGE = 200 + REFRESH_DISTANCE + 5;

export function createPineShadows(scene, renderer, terrainMaterial, elevation) {
  const uniforms = terrainMaterial.uniforms;
  const camera = new THREE.OrthographicCamera();
  camera.layers.set(PINE_SHADOW_LAYER);
  const sun = uniforms.sun.value;
  const centerY = (elevation.minimumElevationMeters + elevation.maximumElevationMeters) / 2;
  const elevationSpan = elevation.maximumElevationMeters - elevation.minimumElevationMeters;
  const horizontalSun = Math.hypot(sun.x, sun.z);
  const halfHeight = HALF_RANGE * sun.y + (elevationSpan / 2 + 60) * horizontalSun;
  const lightDistance = 1400;
  camera.left = -HALF_RANGE;
  camera.right = HALF_RANGE;
  camera.top = halfHeight;
  camera.bottom = -halfHeight;
  camera.near = 0.1;
  camera.far = lightDistance * 2;
  camera.updateProjectionMatrix();

  const depthMaterial = new THREE.MeshDepthMaterial({colorWrite: false, side: THREE.DoubleSide});
  const center = new THREE.Vector3();
  const right = new THREE.Vector3().crossVectors(THREE.Object3D.DEFAULT_UP, sun).normalize();
  const up = new THREE.Vector3().crossVectors(sun, right);
  let target;
  let lastX = Infinity;
  let lastZ = Infinity;

  function update(enabled, x, z) {
    uniforms.pineShadowsEnabled.value = enabled;
    if (!enabled) {
      lastX = Infinity;
      lastZ = Infinity;
      return;
    }
    if ((x - lastX) ** 2 + (z - lastZ) ** 2 < REFRESH_DISTANCE ** 2) return;
    if (!target) {
      const depthTexture = new THREE.DepthTexture(MAP_SIZE, MAP_SIZE, THREE.UnsignedIntType);
      depthTexture.minFilter = THREE.NearestFilter;
      depthTexture.magFilter = THREE.NearestFilter;
      target = new THREE.WebGLRenderTarget(MAP_SIZE, MAP_SIZE, {depthTexture});
      uniforms.pineDepth.value = depthTexture;
      uniforms.pineTexel.value = 1 / MAP_SIZE;
    }

    center.set(x, centerY, z);
    const texelX = 2 * HALF_RANGE / MAP_SIZE;
    const texelY = 2 * halfHeight / MAP_SIZE;
    const u = Math.round(center.dot(right) / texelX) * texelX;
    const v = Math.round(center.dot(up) / texelY) * texelY;
    const d = center.dot(sun);
    center.copy(right).multiplyScalar(u).addScaledVector(up, v).addScaledVector(sun, d);
    camera.position.copy(center).addScaledVector(sun, lightDistance);
    camera.lookAt(center);
    camera.updateMatrixWorld();
    uniforms.pineProjection.value.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);

    const previousTarget = renderer.getRenderTarget();
    const xrEnabled = renderer.xr.enabled;
    const background = scene.background;
    const override = scene.overrideMaterial;
    try {
      renderer.xr.enabled = false;
      scene.background = null;
      scene.overrideMaterial = depthMaterial;
      renderer.setRenderTarget(target);
      // Only tree batches are on the shadow camera's layer. Terrain's baked
      // ridge shadows are applied separately by its own material.
      renderer.render(scene, camera);
    } finally {
      renderer.setRenderTarget(previousTarget);
      scene.overrideMaterial = override;
      scene.background = background;
      renderer.xr.enabled = xrEnabled;
    }
    lastX = x;
    lastZ = z;
  }

  function dispose() {
    target?.dispose();
    depthMaterial.dispose();
  }

  return {update, dispose};
}
