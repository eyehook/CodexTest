import * as THREE from '../../shared/vendor/three-r180/three.module.js';
import {ButtonEdges, buttonValue, deadzone, readMovementAxes} from '../../shared/xr/input.mjs';
import {Locomotion} from '../../shared/xr/locomotion.mjs';
import {XRFrameState} from '../../shared/xr/session.mjs';
import {loadHeightmap} from './heightmap.mjs';
import {createTerrain, createTerrainMaterial} from './terrain.mjs?v=0.1.2';
import {LiftMenu} from './lift-menu.mjs?v=0.1.5';
import {createLiftModels} from './lift-models.mjs?v=0.1.6';
import {SkiMotion} from './ski-motion.mjs?v=0.1.8';
import {APP_VERSION} from './version.mjs?v=0.1.8';

document.getElementById('version').textContent = `v${APP_VERSION}`;
document.title = `Mount Snow v${APP_VERSION} · WebXR`;

const status = document.getElementById('status');
const controls = document.getElementById('controls');
const enter = document.getElementById('enter');
const TURN_SPEED = Math.PI / 2;
const EYE_HEIGHT = 1.7;

async function start() {
  const pistesUrl = new URL('./data/mount-snow-pistes.json?v=1', import.meta.url);
  const liftUrl = new URL('./data/mount-snow-lifts.json?v=0.1.6', import.meta.url);
  const [map, response, lifts] = await Promise.all([loadHeightmap(), fetch(pistesUrl), fetch(liftUrl)]);
  if (!response.ok) throw new Error(`Could not load trail metadata (HTTP ${response.status})`);
  if (!lifts.ok) throw new Error(`Could not load lift destinations (HTTP ${lifts.status})`);
  const [pistes, liftGroups] = await Promise.all([response.json(), lifts.json()]);
  const material = await createTerrainMaterial(map.metadata, pistes, pistesUrl);
  const renderer = new THREE.WebGLRenderer({antialias: true});
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.xr.enabled = true;
  renderer.xr.setReferenceSpaceType('local-floor');
  document.getElementById('view').appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(65, 1, 0.18, 8000);
  const rig = new THREE.Group();
  rig.add(camera);
  scene.add(rig);
  const liftMenu = new LiftMenu(rig, liftGroups);
  const terrain = createTerrain(scene, map, material);
  createLiftModels(scene, map, liftGroups);
  const movement = new Locomotion(rig, {moveSpeed: 10, turnSpeed: TURN_SPEED});
  const ski = new SkiMotion(map.height, terrain.width, terrain.depth);
  const skiForward = new THREE.Vector3();
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
    rig.position.set(x - headOffset.x, map.height(x, z), z - headOffset.z);
    terrain.update(x, z);
  }

  function placeHead(view, x, z) {
    headOffset.copy(view.position).applyQuaternion(rig.quaternion);
    rig.position.x = x - headOffset.x;
    rig.position.z = z - headOffset.z;
  }

  function navigate(dt, view, x, z, turn, steer, push, brake) {
    if (push) {
      skiForward.set(0, 0, -1).applyQuaternion(view.orientation);
      skiForward.y = 0;
      if (skiForward.lengthSq() < 1e-8) skiForward.set(0, 0, -1);
      skiForward.normalize().applyQuaternion(rig.quaternion);
      ski.push(skiForward.x, skiForward.z);
    }
    if (!ski.active) {
      movement.move(dt, x, z, turn, view);
      return;
    }
    headOffset.copy(view.position).applyQuaternion(rig.quaternion);
    ski.advance(dt, rig.position.x + headOffset.x, rig.position.z + headOffset.z,
      deadzone(steer, 0.15), brake);
    rig.rotation.y = ski.followYaw(rig.rotation.y, dt);
    placeHead(view, ski.x, ski.z);
  }

  function resetSki() {
    ski.stop();
    trigger.reset();
    rightController = null;
    desktopPushDown = false;
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
    resetSki();
    resetDesktopCamera();
  });

  renderer.setAnimationLoop((time, frame) => {
    const dt = Math.min((time - (previousTime ?? time)) / 1000, 0.05);
    previousTime = time;
    const session = renderer.xr.getSession();
    xr.update(session, frame, renderer.xr.getReferenceSpace(), document.hidden);
    if (!xr.active) {
      liftMenu.hide();
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
      const lift = liftMenu.update(frame, xr.referenceSpace, session.inputSources, trackedView);
      let left, right;
      for (const source of session.inputSources) {
        if (source.handedness === 'left' && source.gamepad && xr.isTracked(source.targetRaySpace)) left = source;
        if (source.handedness === 'right' && source.gamepad && xr.isTracked(source.targetRaySpace)) right = source;
      }
      const blocked = xr.resumed || liftMenu.visible || !!lift;
      if (right !== rightController) trigger.reset();
      const push = right && trigger.sample(right, 0, blocked || right !== rightController).pressed;
      rightController = right;
      if (lift) {
        ski.stop();
        placeHead(trackedView, lift.x, lift.z);
      } else if (blocked) {
        ski.stop();
      } else {
        readMovementAxes(session.inputSources, axes);
        navigate(dt, trackedView, axes.x, axes.z, axes.turn, left ? axes.x : 0, push, buttonValue(left));
      }
      ground(trackedView);
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
        push, Number(keys.has('ShiftLeft') || keys.has('ShiftRight')));
      ground(desktopView);
    }
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
