import * as THREE from '../../shared/vendor/three-r180/three.module.js';
import {ButtonEdges, buttonValue, readMovementAxes} from '../../shared/xr/input.mjs';
import {Locomotion} from '../../shared/xr/locomotion.mjs';
import {XRFrameState} from '../../shared/xr/session.mjs';
import {loadHeightmap} from './heightmap.mjs?v=0.1.13';
import {createTerrain, createTerrainMaterial} from './terrain.mjs?v=0.1.16';
import {LiftMenu} from './lift-menu.mjs?v=0.1.5';
import {createLiftModels} from './lift-models.mjs?v=0.1.6';
import {SkiMotion, SkiSteering} from './ski-motion.mjs?v=0.1.23';
import {createSkis} from './skis.mjs?v=0.1.22';
import {createTrees, loadTreeHeights} from './trees.mjs?v=0.1.12';
import {loadSettings, SkiSettings} from './settings.mjs?v=0.1.18';
import {APP_VERSION} from './version.mjs?v=0.1.23';

document.getElementById('version').textContent = `v${APP_VERSION}`;
document.title = `Mount Snow v${APP_VERSION} · WebXR`;

const status = document.getElementById('status');
const controls = document.getElementById('controls');
const enter = document.getElementById('enter');
const TURN_SPEED = Math.PI / 2;
const EYE_HEIGHT = 1.7;

async function start() {
  const preferences = loadSettings();
  const pistesUrl = new URL('./data/mount-snow-pistes.json?v=1', import.meta.url);
  const liftUrl = new URL('./data/mount-snow-lifts.json?v=0.1.6', import.meta.url);
  const [map, response, lifts] = await Promise.all([loadHeightmap(), fetch(pistesUrl), fetch(liftUrl)]);
  if (!response.ok) throw new Error(`Could not load trail metadata (HTTP ${response.status})`);
  if (!lifts.ok) throw new Error(`Could not load lift destinations (HTTP ${lifts.status})`);
  const [pistes, liftGroups] = await Promise.all([response.json(), lifts.json()]);
  const {material, canopy} = await createTerrainMaterial(map.metadata, pistes, pistesUrl);
  await loadTreeHeights(canopy);
  const renderer = new THREE.WebGLRenderer({antialias: true});
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.xr.enabled = true;
  renderer.xr.setReferenceSpaceType('local-floor');
  document.getElementById('view').appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(65, 1, 0.18, 8000);
  const rig = new THREE.Group();
  const heightRig = new THREE.Group();
  const landscape = new THREE.Group();
  heightRig.add(camera);
  rig.add(heightRig);
  scene.add(landscape, rig);
  const liftMenu = new LiftMenu(heightRig, liftGroups);
  const terrain = createTerrain(landscape, map, material);
  createLiftModels(landscape, map, liftGroups);
  const trees = createTrees(landscape, map, canopy, material.uniforms.canopyViewer);
  const settings = new SkiSettings(heightRig, preferences);
  const black = new THREE.Color(0x000000);
  const movement = new Locomotion(rig, {moveSpeed: 10, turnSpeed: TURN_SPEED});
  const ski = new SkiMotion(map.height, terrain.width, terrain.depth);
  const steering = new SkiSteering();
  const skis = createSkis(rig, map.height);
  const axes = {x: 0, z: 0, turn: 0};
  const trigger = new ButtonEdges();
  const xr = new XRFrameState();
  const trackedView = {position: new THREE.Vector3(), orientation: new THREE.Quaternion()};
  const desktopView = {position: camera.position, orientation: camera.quaternion};
  const headOffset = new THREE.Vector3();
  const keys = new Set();
  const movementKeys = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space', 'ShiftLeft', 'ShiftRight']);
  const {x: startX, z: startZ, towardX, towardZ} = pistes.spawn;
  const startYaw = Math.atan2(startX - towardX, startZ - towardZ);
  const axis = (negative, positive) => Number(keys.has(positive)) - Number(keys.has(negative));
  let previousTime;
  let desktopPitch = -0.13;
  let desktopPushDown = false;
  let rightController = null;

  function ground(view) {
    headOffset.copy(view.position).applyQuaternion(rig.quaternion);
    const x = THREE.MathUtils.clamp(rig.position.x + headOffset.x, 0, terrain.width);
    const z = THREE.MathUtils.clamp(rig.position.z + headOffset.z, 0, terrain.depth);
    const floor = map.height(x, z);
    rig.position.set(x - headOffset.x, ski.airborne ? Math.max(floor, ski.y) : floor, z - headOffset.z);
    terrain.update(x, z);
    if (preferences.trees) trees.update(x, z);
  }

  function placeHead(view, x, z) {
    headOffset.copy(view.position).applyQuaternion(rig.quaternion);
    rig.position.x = x - headOffset.x;
    rig.position.z = z - headOffset.z;
  }

  function navigate(dt, view, x, z, turn, steer, push, brake, tuck) {
    if (push && !ski.active) {
      const heading = rig.rotation.y + ski.angle;
      ski.push(-Math.sin(heading), -Math.cos(heading));
    }
    ski.updateTuck(dt, tuck);
    if (!ski.active) {
      movement.move(dt, x, z, turn, view);
      return;
    }
    headOffset.copy(view.position).applyQuaternion(rig.quaternion);
    ski.advance(dt, rig.position.x + headOffset.x, rig.position.z + headOffset.z,
      steer, brake, rig.rotation.y);
    rig.rotation.y = ski.rigYaw;
    placeHead(view, ski.x, ski.z);
  }

  function stopSki() {
    ski.stop();
    steering.reset();
  }

  function resetSki() {
    stopSki();
    ski.tuck = 0;
    trigger.reset();
    rightController = null;
    desktopPushDown = false;
  }

  function applySettings() {
    trees.group.visible = preferences.trees;
    material.uniforms.showTreeModels.value = preferences.trees;
    landscape.visible = !settings.visible;
    scene.background = settings.visible ? black : terrain.sky;
  }

  function resetDesktopCamera() {
    camera.position.set(0, EYE_HEIGHT, 0);
    camera.rotation.set(desktopPitch, 0, 0);
    resize();
  }

  function resize() {
    if (renderer.xr.isPresenting) return;
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  }

  rig.position.set(startX, 0, startZ);
  rig.rotation.y = startYaw;
  resetDesktopCamera();
  applySettings();
  ground(desktopView);
  addEventListener('resize', resize);
  addEventListener('blur', () => keys.clear());
  document.addEventListener('visibilitychange', () => keys.clear());
  addEventListener('keydown', event => {
    if (event.altKey || event.ctrlKey || event.metaKey || !movementKeys.has(event.code)) return;
    event.preventDefault();
    keys.add(event.code);
  });
  addEventListener('keyup', event => keys.delete(event.code));
  renderer.xr.addEventListener('sessionend', () => {
    liftMenu.hide();
    settings.close();
    settings.suspend();
    resetSki();
    resetDesktopCamera();
    heightRig.position.y = 0;
    applySettings();
  });

  renderer.setAnimationLoop((time, frame) => {
    const dt = Math.min((time - (previousTime ?? time)) / 1000, 0.05);
    previousTime = time;
    const session = renderer.xr.getSession();
    xr.update(session, frame, renderer.xr.getReferenceSpace(), document.hidden);
    if (!xr.active) {
      liftMenu.hide();
      settings.suspend();
      resetSki();
      return;
    }

    if (session) {
      const {position, orientation} = xr.pose.transform;
      trackedView.position.set(position.x, position.y, position.z);
      trackedView.orientation.set(orientation.x, orientation.y, orientation.z, orientation.w);
      if (xr.firstTracked) {
        headOffset.set(0, 0, -1).applyQuaternion(trackedView.orientation);
        const heading = Math.atan2(-headOffset.x, -headOffset.z);
        rig.rotation.y = startYaw - heading;
        resetSki();
        placeHead(trackedView, startX, startZ);
      }
      let left, right;
      for (const source of session.inputSources) {
        if (source.handedness === 'left' && source.gamepad && xr.isTracked(source.targetRaySpace)) left = source;
        if (source.handedness === 'right' && source.gamepad && xr.isTracked(source.targetRaySpace)) right = source;
      }
      const wasSettingsOpen = settings.visible;
      settings.update(xr, trackedView, left, right);
      applySettings();
      const settingsConsumedFrame = wasSettingsOpen || settings.visible;
      if (settingsConsumedFrame) liftMenu.hide();
      const lift = settingsConsumedFrame ? null
        : liftMenu.update(frame, xr.referenceSpace, session.inputSources, trackedView);
      const blocked = xr.resumed || settingsConsumedFrame || liftMenu.visible || !!lift;
      if (right !== rightController) trigger.reset();
      const push = right && trigger.sample(right, 0, blocked || right !== rightController).pressed;
      rightController = right;
      if (lift) {
        stopSki();
        ski.updateTuck(dt, 0);
        placeHead(trackedView, lift.x, lift.z);
      } else if (blocked) {
        stopSki();
        ski.updateTuck(dt, 0);
      } else {
        readMovementAxes(session.inputSources, axes);
        const steer = ski.active || push ? steering.read(left ? axes.x : 0, right ? axes.turn : 0) : 0;
        navigate(dt, trackedView, axes.x, axes.z, axes.turn, steer, push, buttonValue(left), buttonValue(right));
        if (!ski.active) steering.reset();
      }
      if (!settings.visible) ground(trackedView);
    } else {
      desktopPitch = THREE.MathUtils.clamp(
        desktopPitch + dt * TURN_SPEED * axis('ArrowDown', 'ArrowUp'), -1.45, 1.45);
      camera.rotation.x = desktopPitch;
      const pushDown = keys.has('Space');
      const push = pushDown && !desktopPushDown && !xr.resumed;
      desktopPushDown = pushDown;
      const side = axis('KeyA', 'KeyD');
      const turn = axis('ArrowLeft', 'ArrowRight');
      navigate(dt, desktopView, side, axis('KeyW', 'KeyS'), turn, side || turn,
        push, Number(keys.has('ShiftLeft') || keys.has('ShiftRight')), Number(pushDown));
      ground(desktopView);
    }
    heightRig.position.y = ski.viewOffset(session ? preferences.heightOffset : 0);
    skis.update(session ? trackedView : desktopView, ski, !settings.visible);
    renderer.render(scene, camera);
  });

  status.hidden = true;
  controls.hidden = false;
  if (await navigator.xr?.isSessionSupported('immersive-vr').catch(() => false)) {
    enter.hidden = false;
    enter.addEventListener('click', async () => {
      let session;
      enter.disabled = true;
      try {
        session = await navigator.xr.requestSession('immersive-vr', {requiredFeatures: ['local-floor'], optionalFeatures: ['hand-tracking']});
        await renderer.xr.setSession(session);
        status.hidden = true;
        session.addEventListener('end', () => { enter.disabled = false; }, {once: true});
      } catch (error) {
        if (session) await session.end().catch(() => {});
        enter.disabled = false;
        status.hidden = false;
        status.textContent = `Could not enter VR. ${error.message}`;
      }
    });
  }
}

start().catch(error => {
  console.error(error);
  status.textContent = `Could not start terrain viewer. ${error.message}`;
});
