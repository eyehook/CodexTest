import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from '../../../shared/vendor/three-r180/three.module.js';
import {createPineShadows, PINE_SHADOW_LAYER} from '../pine-shadows.mjs';

test('pine shadows refresh on movement and preserve the XR scene and render target', () => {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xaac6db);
  const background = scene.background;
  const sharedTarget = {};
  let activeTarget = sharedTarget;
  let renders = 0;
  const uniforms = {
    sun: {value: new THREE.Vector3(-1, 0.38, -1).normalize()},
    pineShadowsEnabled: {value: false}, pineDepth: {value: null},
    pineProjection: {value: new THREE.Matrix4()}, pineTexel: {value: 0},
  };
  const renderer = {
    xr: {enabled: true},
    getRenderTarget: () => activeTarget,
    setRenderTarget: target => { activeTarget = target; },
    render: (passScene, camera) => {
      renders++;
      assert.equal(passScene, scene);
      assert.equal(scene.background, null);
      assert.ok(scene.overrideMaterial.isMeshDepthMaterial);
      assert.equal(renderer.xr.enabled, false);
      assert.equal(camera.layers.mask, 1 << PINE_SHADOW_LAYER);
      assert.equal(activeTarget.depthTexture, uniforms.pineDepth.value);
      assert.equal(activeTarget.depthTexture.minFilter, THREE.NearestFilter);
      assert.equal(activeTarget.depthTexture.magFilter, THREE.NearestFilter);
    },
  };
  const shadows = createPineShadows(scene, renderer, {uniforms},
    {minimumElevationMeters: 500, maximumElevationMeters: 1100});
  shadows.update(false, 1400, 2400);
  assert.equal(renders, 0);
  assert.equal(uniforms.pineDepth.value, null);
  shadows.update(true, 1400, 2400);
  shadows.update(true, 1407, 2400);
  assert.equal(renders, 1);
  shadows.update(true, 1408, 2400);
  assert.equal(renders, 2);
  shadows.update(false, 1408, 2400);
  assert.equal(uniforms.pineShadowsEnabled.value, false);
  shadows.update(true, 1408, 2400);
  assert.equal(renders, 3);
  assert.equal(activeTarget, sharedTarget);
  assert.equal(renderer.xr.enabled, true);
  assert.equal(scene.background, background);
  assert.equal(scene.overrideMaterial, null);
  shadows.dispose();
});
