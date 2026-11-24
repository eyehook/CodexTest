import * as THREE from '../../shared/vendor/three-r180/three.module.js';
import {ButtonEdges, buttonValue, readMovementAxes} from '../../shared/xr/input.mjs';
import {createPineShadows} from './pine-shadows.mjs?v=0.1.70';
import {ForestAmbience, bindForestAudio} from '../hike/forest-audio.mjs?v=2';
import {Atmosphere, ATMOSPHERE} from '../hike/atmosphere.mjs?v=1';
import {Locomotion} from '../../shared/xr/locomotion.mjs';
import {XRFrameState} from '../../shared/xr/session.mjs';
import {loadHeightmap} from './heightmap.mjs?v=0.1.73';
import {createTerrain, createTerrainMaterial} from './terrain.mjs?v=0.1.76';
import {createBuildings} from './buildings.mjs?v=0.1.47';
import {LiftMenu} from './lift-menu.mjs?v=0.1.5';
import {createLiftModels} from './lift-models.mjs?v=0.1.46';
import {SkiMotion, SkiSteering} from './ski-motion.mjs?v=0.1.61';
import {SkiProfiler, CPU, RENDER, SHADOW, TREES, TERRAIN, CALLS, TRIANGLES,
  TREE_BUILDS, TILE_BUILDS} from './profiling.mjs?v=0.1.72';
import {SkiAudio} from './ski-audio.mjs?v=0.1.69';
import {createSkis} from './skis.mjs?v=0.1.58';
import {createTrees, loadTreeHeights} from './trees.mjs?v=0.1.70';
import {loadSettings, SkiSettings} from './settings.mjs?v=0.1.72';
import {APP_VERSION} from './version.mjs?v=0.1.76';

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
  const liftUrl = new URL('./data/mount-snow-lifts.json?v=0.1.46', import.meta.url);
  const buildingsUrl = new URL('./data/mount-snow-buildings.json?v=0.1.47', import.meta.url);
  const [map, response, lifts, buildings] = await Promise.all([
    loadHeightmap(), fetch(pistesUrl), fetch(liftUrl), fetch(buildingsUrl),
  ]);
  if (!response.ok) throw new Error(`Could not load trail metadata (HTTP ${response.status})`);
  if (!lifts.ok) throw new Error(`Could not load lift destinations (HTTP ${lifts.status})`);
  if (!buildings.ok) throw new Error(`Could not load building footprints (HTTP ${buildings.status})`);
  const [pistes, liftGroups, footprints] = await Promise.all([response.json(), lifts.json(), buildings.json()]);
  const {material, canopy} = await createTerrainMaterial(map.metadata, pistes, pistesUrl);
  await loadTreeHeights(canopy);
  const renderer = new THREE.WebGLRenderer({antialias: true});
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.xr.enabled = true;
  renderer.xr.setReferenceSpaceType('local-floor');
  document.getElementById('view').appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(ATMOSPHERE.horizon, 1000, 3000);
  const atmosphere = new Atmosphere(scene, {
    ...ATMOSPHERE,
    heightScale: map.metadata.minimumElevationMeters + ATMOSPHERE.heightScale,
  });
  const camera = new THREE.PerspectiveCamera(65, 1, 0.18, 8000);
  const rig = new THREE.Group();
  const heightRig = new THREE.Group();
  const landscape = new THREE.Group();
  heightRig.add(camera);
  rig.add(heightRig);
  scene.add(landscape, rig);
  landscape.add(atmosphere.mesh);
  const liftMenu = new LiftMenu(heightRig, liftGroups);
  const terrain = createTerrain(landscape, map, material);
  const {model: liftsModel, highlightNearestBase} = createLiftModels(landscape, map, liftGroups);
  const buildingsModel = createBuildings(landscape, map, footprints);
  const trees = createTrees(landscape, map, canopy, material.uniforms.canopyViewer, footprints);
  atmosphere.apply(material);
  for (const lift of liftsModel.children) atmosphere.apply(lift.material);
  atmosphere.apply(buildingsModel.material);
  atmosphere.apply(trees.material);
  const shadows = createPineShadows(scene, renderer, material, map.metadata);
  addEventListener('pagehide', event => {
    if (event.persisted) return;
    atmosphere.dispose();
    shadows.dispose();
  });
  const profiler = new SkiProfiler();
  const settings = new SkiSettings(heightRig, preferences, profiler);
  const black = new THREE.Color(0x000000);
  const movement = new Locomotion(rig, {moveSpeed: 10, turnSpeed: TURN_SPEED});
  const audio = new SkiAudio();
  const ambience = new ForestAmbience({volume: preferences.ambientVolume});
  let audioRequested = false;

  function unlockAudio() {
    audioRequested = true;
    audio.unlock();
    void ambience.unlock();
  }
  const ski = new SkiMotion(map.height, terrain.width, terrain.depth, (airborne, strength) => {
    if (airborne) audio.event('launch', 0.55);
    else audio.event('landing', 0.25 + 0.75 * Math.min(1, Math.max(0, strength) / 7));
  });
  const steering = new SkiSteering();
  const skis = createSkis(rig, map.height, material.uniforms);
  const axes = {x: 0, z: 0, turn: 0};
  const skiButtons = new ButtonEdges();
  const xr = new XRFrameState();
  const trackedView = {position: new THREE.Vector3(), orientation: new THREE.Quaternion()};
  const desktopView = {position: camera.position, orientation: camera.quaternion};
  const headOffset = new THREE.Vector3();
  const keys = new Set();
  const movementKeys = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space', 'KeyE', 'ShiftLeft', 'ShiftRight']);
  const {x: startX, z: startZ, towardX, towardZ} = pistes.spawn;
  const startYaw = Math.atan2(startX - towardX, startZ - towardZ);
  const axis = (negative, positive) => Number(keys.has(positive)) - Number(keys.has(negative));
  let previousTime;
  let desktopPitch = -0.13;
  let desktopPushDown = false;
  let desktopPoleDown = false;
  let rightController = null;

  function ground(view, measure = false) {
    headOffset.copy(view.position).applyQuaternion(rig.quaternion);
    const x = THREE.MathUtils.clamp(rig.position.x + headOffset.x, 0, terrain.width);
    const z = THREE.MathUtils.clamp(rig.position.z + headOffset.z, 0, terrain.depth);
    const floor = map.height(x, z);
    rig.position.set(x - headOffset.x, ski.airborne ? Math.max(floor, ski.y) : floor, z - headOffset.z);
    const terrainStart = measure ? performance.now() : 0;
    const tiles = terrain.update(x, z);
    if (measure && tiles > 0) {
      profiler.values[TERRAIN] = performance.now() - terrainStart;
      profiler.values[TILE_BUILDS] = tiles;
    }
    if (preferences.trees) {
      const treeStart = measure ? performance.now() : 0;
      const chunks = trees.update(x, z);
      if (measure && chunks !== undefined) {
        profiler.values[TREES] = performance.now() - treeStart;
        profiler.values[TREE_BUILDS] = chunks;
      }
    }
  }

  function highlightLiftAtHead(view) {
    headOffset.copy(view.position).applyQuaternion(rig.quaternion);
    return highlightNearestBase(rig.position.x + headOffset.x, rig.position.z + headOffset.z);
  }

  function placeHead(view, x, z) {
    headOffset.copy(view.position).applyQuaternion(rig.quaternion);
    rig.position.x = x - headOffset.x;
    rig.position.z = z - headOffset.z;
  }

  function navigate(dt, view, x, z, turn, steer, push, pole, brake, tuck) {
    if (pole || (push && !ski.active)) {
      const heading = rig.rotation.y + ski.angle;
      const forwardX = -Math.sin(heading);
      const forwardZ = -Math.cos(heading);
      if (pole) {
        if (!ski.airborne) {
          ski.polePush(forwardX, forwardZ);
          audio.event('pole-push', 1.125);
        }
      } else {
        ski.push(forwardX, forwardZ);
      }
    }
    ski.updateTuck(dt, tuck);
    audio.brake(ski, brake);
    if (!ski.active) {
      headOffset.copy(view.position).applyQuaternion(rig.quaternion);
      const startX = THREE.MathUtils.clamp(rig.position.x + headOffset.x, 0, terrain.width);
      const startZ = THREE.MathUtils.clamp(rig.position.z + headOffset.z, 0, terrain.depth);
      movement.move(dt, x, z, turn, view);
      headOffset.copy(view.position).applyQuaternion(rig.quaternion);
      const endX = THREE.MathUtils.clamp(rig.position.x + headOffset.x, 0, terrain.width);
      const endZ = THREE.MathUtils.clamp(rig.position.z + headOffset.z, 0, terrain.depth);
      const walkingSpeed = dt > 0 ? Math.hypot(endX - startX, endZ - startZ) / dt : 0;
      audio.update(ski, 0, walkingSpeed);
      return;
    }
    headOffset.copy(view.position).applyQuaternion(rig.quaternion);
    ski.advance(dt, rig.position.x + headOffset.x, rig.position.z + headOffset.z,
      steer, brake, rig.rotation.y);
    audio.update(ski, steer);
    rig.rotation.y = ski.rigYaw;
    placeHead(view, ski.x, ski.z);
  }

  function stopSki() {
    ski.stop();
    audio.reset();
    steering.reset();
  }

  function resetSki() {
    stopSki();
    ski.tuck = 0;
    skiButtons.reset();
    rightController = null;
    desktopPushDown = false;
    desktopPoleDown = false;
  }

  function applySettings() {
    audio.setVolume(preferences.skiVolume);
    audio.setWindVolume(preferences.windVolume);
    ambience.setVolume(preferences.ambientVolume);
    trees.group.visible = preferences.trees;
    material.uniforms.showTreeModels.value = preferences.trees;
    material.uniforms.showTrails.value = preferences.trails;
    landscape.visible = !settings.visible;
    scene.background = settings.visible ? black : atmosphere.horizon;
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
  document.addEventListener('visibilitychange', () => {
    keys.clear();
    if (document.hidden) {
      ambience.stop();
      profiler.pause();
    }
  });
  addEventListener('keydown', event => {
    if (event.altKey || event.ctrlKey || event.metaKey || !movementKeys.has(event.code)) return;
    event.preventDefault();
    keys.add(event.code);
    if (!event.repeat) unlockAudio();
  });
  addEventListener('pagehide', event => {
    audio.reset();
    if (event.persisted) ambience.stop();
    else ambience.dispose();
  });
  addEventListener('keyup', event => keys.delete(event.code));
  renderer.xr.addEventListener('sessionend', () => {
    audioRequested = false;
    ambience.stop();
    highlightNearestBase(Infinity, Infinity);
    liftMenu.hide();
    settings.close();
    settings.suspend();
    resetSki();
    resetDesktopCamera();
    heightRig.position.y = 0;
    applySettings();
  });

  renderer.setAnimationLoop((time, frame) => {
    let gameplay = !settings.visible && !liftMenu.visible;
    const frameStart = gameplay && profiler.ready ? performance.now() : 0;
    const dt = Math.min((time - (previousTime ?? time)) / 1000, 0.05);
    previousTime = time;
    const session = renderer.xr.getSession();
    xr.update(session, frame, renderer.xr.getReferenceSpace(), document.hidden);
    if (xr.changed) profiler.reset();
    ambience.setActive(audioRequested && xr.active);
    if (!xr.active) {
      profiler.pause();
      highlightNearestBase(Infinity, Infinity);
      liftMenu.hide();
      settings.suspend();
      resetSki();
      return;
    }

    const ready = profiler.ready;
    if (gameplay && ready) profiler.beginFrame();
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
      if (right !== rightController) skiButtons.reset();
      const seed = blocked || right !== rightController;
      const push = right && skiButtons.sample(right, 0, seed).pressed;
      const aPressed = right && skiButtons.sample(right, 4, seed).pressed;
      const destination = lift ?? (aPressed && !blocked ? highlightLiftAtHead(trackedView) : null);
      rightController = right;
      if (destination) {
        stopSki();
        ski.updateTuck(dt, 0);
        placeHead(trackedView, destination.x, destination.z);
      } else if (blocked) {
        stopSki();
        ski.updateTuck(dt, 0);
      } else {
        const pole = aPressed;
        readMovementAxes(session.inputSources, axes);
        const steer = ski.active || push || pole ? steering.read(left ? axes.x : 0, right ? axes.turn : 0) : 0;
        navigate(dt, trackedView, axes.x, axes.z, axes.turn, steer, push, pole, buttonValue(left), buttonValue(right));
        if (!ski.active) steering.reset();
      }
      gameplay = gameplay && !settingsConsumedFrame && !liftMenu.visible && !lift;
      if (!settings.visible) ground(trackedView, gameplay && ready);
      if (settingsConsumedFrame || liftMenu.visible) highlightNearestBase(Infinity, Infinity);
      else highlightLiftAtHead(trackedView);
    } else {
      desktopPitch = THREE.MathUtils.clamp(
        desktopPitch + dt * TURN_SPEED * axis('ArrowDown', 'ArrowUp'), -1.45, 1.45);
      camera.rotation.x = desktopPitch;
      const pushDown = keys.has('Space');
      const push = pushDown && !desktopPushDown && !xr.resumed;
      desktopPushDown = pushDown;
      const poleDown = keys.has('KeyE');
      const pole = poleDown && !desktopPoleDown && !xr.resumed;
      desktopPoleDown = poleDown;
      const side = axis('KeyA', 'KeyD');
      const turn = axis('ArrowLeft', 'ArrowRight');
      navigate(dt, desktopView, side, axis('KeyW', 'KeyS'), turn, side || turn,
        push, pole, Number(keys.has('ShiftLeft') || keys.has('ShiftRight')), Number(pushDown));
      ground(desktopView, gameplay && ready);
      highlightLiftAtHead(desktopView);
    }
    const viewer = session ? trackedView : desktopView;
    heightRig.position.y = ski.viewOffset(session ? preferences.heightOffset : 0, viewer.position.y);
    skis.update(viewer, ski, !settings.visible, preferences.shadows, dt);
    const shadowViewer = material.uniforms.canopyViewer.value;
    const measure = gameplay && ready;
    const shadowStart = measure ? performance.now() : 0;
    const shadowRefreshed = shadows.update(preferences.shadows && preferences.trees && !settings.visible,
      shadowViewer.x, shadowViewer.y);
    const renderStart = measure ? performance.now() : 0;
    renderer.render(scene, camera);
    if (measure) {
      const end = performance.now();
      if (shadowRefreshed) profiler.values[SHADOW] = renderStart - shadowStart;
      profiler.values[CPU] = end - frameStart;
      profiler.values[RENDER] = end - renderStart;
      profiler.values[CALLS] = renderer.info.render.calls;
      profiler.values[TRIANGLES] = renderer.info.render.triangles;
    }
    if (gameplay) profiler.finishFrame(time);
    else profiler.pause();
  });

  status.hidden = true;
  controls.hidden = false;
  if (await navigator.xr?.isSessionSupported('immersive-vr').catch(() => false)) {
    enter.hidden = false;
    enter.addEventListener('click', async () => {
      unlockAudio();
      let session;
      enter.disabled = true;
      try {
        session = await navigator.xr.requestSession('immersive-vr', {requiredFeatures: ['local-floor'], optionalFeatures: ['hand-tracking']});
        await renderer.xr.setSession(session);
        bindForestAudio(session, ambience);
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
