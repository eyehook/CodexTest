import * as THREE from '../../shared/vendor/three-r180/three.module.js';
import {Locomotion} from '../../shared/xr/locomotion.mjs';
import {XRFrameState} from '../../shared/xr/session.mjs';
import {loadHeightmap} from './heightmap.mjs';
import {createTerrain, createTerrainMaterial} from './terrain.mjs?v=0.1.2';
import {APP_VERSION} from './version.mjs?v=0.1.2';

document.getElementById('version').textContent = `v${APP_VERSION}`;
document.title = `Mount Snow v${APP_VERSION} · WebXR`;

const status = document.getElementById('status');
const controls = document.getElementById('controls');
const enter = document.getElementById('enter');
const TURN_SPEED = Math.PI / 2;
const EYE_HEIGHT = 1.7;

async function start() {
  const pistesUrl = new URL('./data/mount-snow-pistes.json?v=1', import.meta.url);
  const [map, response] = await Promise.all([loadHeightmap(), fetch(pistesUrl)]);
  if (!response.ok) throw new Error(`Could not load trail metadata (HTTP ${response.status})`);
  const pistes = await response.json();
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
  const terrain = createTerrain(scene, map, material);
  const movement = new Locomotion(rig, {moveSpeed: 10, turnSpeed: TURN_SPEED});
  const xr = new XRFrameState();
  const trackedView = {position: new THREE.Vector3(), orientation: new THREE.Quaternion()};
  const desktopView = {position: camera.position, orientation: camera.quaternion};
  const headOffset = new THREE.Vector3();
  const keys = new Set();
  const movementKeys = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']);
  const {x: startX, z: startZ, towardX, towardZ} = pistes.spawn;
  const startYaw = Math.atan2(startX - towardX, startZ - towardZ);
  const axis = (negative, positive) => Number(keys.has(positive)) - Number(keys.has(negative));
  let previousTime;
  let desktopPitch = -0.13;

  function ground(view) {
    headOffset.copy(view.position).applyQuaternion(rig.quaternion);
    const x = THREE.MathUtils.clamp(rig.position.x + headOffset.x, 0, terrain.width);
    const z = THREE.MathUtils.clamp(rig.position.z + headOffset.z, 0, terrain.depth);
    rig.position.set(x - headOffset.x, map.height(x, z), z - headOffset.z);
    terrain.update(x, z);
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
  renderer.xr.addEventListener('sessionend', resetDesktopCamera);

  renderer.setAnimationLoop((time, frame) => {
    const dt = Math.min((time - (previousTime ?? time)) / 1000, 0.05);
    previousTime = time;
    const session = renderer.xr.getSession();
    xr.update(session, frame, renderer.xr.getReferenceSpace(), document.hidden);
    if (!xr.active) return;

    if (session) {
      const {position, orientation} = xr.pose.transform;
      trackedView.position.set(position.x, position.y, position.z);
      trackedView.orientation.set(orientation.x, orientation.y, orientation.z, orientation.w);
      if (xr.firstTracked) {
        headOffset.set(0, 0, -1).applyQuaternion(trackedView.orientation);
        const heading = Math.atan2(-headOffset.x, -headOffset.z);
        rig.rotation.y = startYaw - heading;
        headOffset.copy(trackedView.position).applyQuaternion(rig.quaternion);
        rig.position.set(startX - headOffset.x, 0, startZ - headOffset.z);
      } else if (!xr.resumed) {
        movement.update(dt, session.inputSources, trackedView);
      }
      ground(trackedView);
    } else {
      desktopPitch = THREE.MathUtils.clamp(
        desktopPitch + dt * TURN_SPEED * axis('ArrowDown', 'ArrowUp'), -1.45, 1.45);
      camera.rotation.x = desktopPitch;
      movement.move(dt, axis('KeyA', 'KeyD'), axis('KeyW', 'KeyS'),
        axis('ArrowLeft', 'ArrowRight'), desktopView);
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
        session = await navigator.xr.requestSession('immersive-vr', {requiredFeatures: ['local-floor']});
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
