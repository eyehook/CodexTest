import {ButtonEdges} from '../../shared/xr/input.mjs?v=shared-xr-1';
import {XRFrameState} from '../../shared/xr/session.mjs?v=shared-xr-1';
import {DEFAULTS} from './settings.mjs?v=shared-r180-1';
import {createDesktopTuning} from './tuning.js?v=shared-r180-1';
import {VRPanel} from './VRPanel.js?v=shared-xr-1';
import {Locomotion} from '../../shared/xr/locomotion.mjs?v=shared-motion-1';
import * as THREE from '../../shared/vendor/three-r180/three.module.js';
import {createSurface, GRID_SIZE} from './simulation.mjs?v=shared-r180-1';

const panel = document.querySelector('#panel');
const enter = document.querySelector('#enter');
const status = document.querySelector('#status');
const rain = document.querySelector('#rain');
const settings = {...DEFAULTS};
const simulation = createSurface({settings});
const scene = new THREE.Scene();
scene.background = new THREE.Color('#080e17');
const renderer = new THREE.WebGLRenderer({antialias: true});
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.xr.enabled = true;
renderer.xr.setReferenceSpaceType('local-floor');
// Avoid peripheral resolution boundaries becoming visible against the triangle grid.
renderer.xr.setFoveation(0);
document.body.prepend(renderer.domElement);
renderer.domElement.style.touchAction = 'none';
const camera = new THREE.PerspectiveCamera(65, innerWidth / innerHeight, 0.05, 220);
const rig = new THREE.Group();
rig.add(camera); scene.add(rig);
const locomotion = new Locomotion(rig);
const geometry = new THREE.PlaneGeometry(1, 1);
geometry.rotateX(-Math.PI / 2);
const surface = new THREE.InstancedMesh(geometry, new THREE.MeshBasicMaterial({side: THREE.DoubleSide}), GRID_SIZE * GRID_SIZE);
surface.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
const transform = new THREE.Object3D();
const tint = new THREE.Color();
function updateQuads() {
  for (let i = 0; i < simulation.heights.length; i++) {
    const h = simulation.heights[i];
    transform.position.set(
      (i % GRID_SIZE - (GRID_SIZE - 1) / 2) * settings.spacing,
      h,
      (Math.floor(i / GRID_SIZE) - (GRID_SIZE - 1) / 2) * settings.spacing
    );
    transform.scale.setScalar(settings.spacing * settings.quadFill);
    transform.updateMatrix();
    surface.setMatrixAt(i, transform.matrix);
    // Fixed blue hue: height changes lightness, centered on the resting level.
    // The color range is independently adjustable from physical height.
    const heightTone = THREE.MathUtils.clamp(h / settings.colorRange, -1, 1);
    tint.setHSL(0.55, 0.65, 0.48 + heightTone * 0.38);
    surface.setColorAt(i, tint);
  }
  surface.instanceMatrix.needsUpdate = true;
  surface.instanceColor.needsUpdate = true;
}
updateQuads();
surface.instanceColor.setUsage(THREE.DynamicDrawUsage);
scene.add(new THREE.HemisphereLight(0xc5e8ff, 0x172331, 0.4));
const light = new THREE.DirectionalLight(0xffffff, 4);
light.position.set(-30, 8, 10);
scene.add(light);
surface.frustumCulled = false;
scene.add(surface);

let session = null, lastTime = null, dragging = null;
let azimuth = 0, elevation = 0.48, distance = GRID_SIZE * settings.spacing * 0.5;
function desktopCamera() {
  rig.position.set(0, 0, 0); rig.rotation.set(0, 0, 0);
  camera.position.set(Math.sin(azimuth) * Math.cos(elevation) * distance,
    Math.sin(elevation) * distance, Math.cos(azimuth) * Math.cos(elevation) * distance);
  camera.lookAt(0, 0, 0);
}
desktopCamera();
renderer.domElement.addEventListener('pointerdown', e => {
  if (session) return;
  dragging = {x: e.clientX, y: e.clientY}; renderer.domElement.setPointerCapture(e.pointerId);
});
renderer.domElement.addEventListener('pointermove', e => {
  if (!dragging || session) return;
  azimuth -= (e.clientX - dragging.x) * 0.005;
  elevation = THREE.MathUtils.clamp(elevation + (e.clientY - dragging.y) * 0.005, 0.06, 1.45);
  dragging = {x: e.clientX, y: e.clientY}; desktopCamera();
});
for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) renderer.domElement.addEventListener(event, () => {dragging = null;});
renderer.domElement.addEventListener('wheel', e => {
  e.preventDefault(); if (session) return;
  distance = THREE.MathUtils.clamp(distance * Math.exp(e.deltaY * 0.001), GRID_SIZE * settings.spacing / 16, GRID_SIZE * settings.spacing * 2); desktopCamera();
}, {passive: false});
let syncDesktop = () => {};
const vrPanel = new VRPanel(scene, rig, renderer, settings, changeSetting);
function changeSetting(key) {
  if (key === 'pause') settings.paused = !settings.paused;
  if (key === 'reset' || key === 'defaults') {
    if (key === 'defaults') Object.assign(settings, DEFAULTS);
    simulation.reset(); lastTime = null; rain.textContent = 'Waiting for first raindrop.';
  }
  if (!session && (key === 'spacing' || key === 'defaults')) {
    distance = GRID_SIZE * settings.spacing * 0.5; desktopCamera();
  }
  syncDesktop(); vrPanel.draw();
}
syncDesktop = createDesktopTuning(settings, changeSetting);
syncDesktop();
const panelButtons = new ButtonEdges();
const xrFrame = new XRFrameState();
const panelPosition = new THREE.Vector3();
function updateVRPanel(pose) {
  let toggle = false;
  panelButtons.retain(session.inputSources);
  for (const source of session.inputSources) {
    if (source.gamepad?.mapping === 'xr-standard' && panelButtons.sample(source, 4).pressed) toggle = true;
  }
  if (toggle) vrPanel.toggle();
  rig.updateMatrixWorld(true);
  panelPosition.set(0, pose.transform.position.y, 0).applyMatrix4(rig.matrixWorld);
  vrPanel.follow(panelPosition, rig.quaternion);
  vrPanel.update();
}
enter.addEventListener('click', async () => {
  enter.disabled = true;
  try {
    session = await navigator.xr.requestSession('immersive-vr', {requiredFeatures: ['local-floor']});
    session.addEventListener('end', () => {
      session = null; lastTime = null; panel.hidden = false; enter.disabled = false;
      vrPanel.mesh.visible = false; vrPanel.enabled = false; vrPanel.update(); panelButtons.reset();
      desktopCamera();
    });
    rig.position.set(0, 0, GRID_SIZE * settings.spacing * 14 / 64);
    camera.position.set(0, 0, 0); camera.quaternion.identity();
    await renderer.xr.setSession(session);
    simulation.reset(); lastTime = null; dragging = null; panel.hidden = true;
    panelButtons.reset(); vrPanel.mesh.visible = true;
  } catch (error) {
    if (session) await session.end().catch(() => {});
    session = null; desktopCamera(); panel.hidden = false; enter.disabled = false;
    status.textContent = 'Could not enter VR: ' + error.message;
  }
});
(async () => {
  try {
    const supported = !!navigator.xr && await navigator.xr.isSessionSupported('immersive-vr');
    enter.disabled = !supported; enter.textContent = supported ? 'Enter VR' : 'VR unavailable';
    status.textContent = supported ? 'Ready for Quest VR.' : 'Desktop preview. Use HTTPS or localhost in Quest Browser for VR.';
  } catch (error) {status.textContent = 'VR check failed: ' + error.message;}
})();
renderer.setAnimationLoop((time, frame) => {
  const dt = lastTime === null ? 0 : (time - lastTime) / 1000; lastTime = time;
  xrFrame.update(session, frame, session ? renderer.xr.getReferenceSpace() : null, document.hidden);
  const {pose, active} = xrFrame;
  if (!active) lastTime = null;
  vrPanel.enabled = !!(active && session);
  if (active && session) {
    locomotion.update(dt, session.inputSources, pose.transform);
    updateVRPanel(pose);
  } else {
    panelButtons.reset(); vrPanel.update();
  }
  if (active) simulation.advance(dt);
  updateQuads();
  if (!session && simulation.drops) rain.textContent = `Raindrops: ${simulation.drops} · one every ${settings.rainInterval} seconds${settings.paused ? " · paused" : ""}`;
  renderer.render(scene, camera);
});
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight);
});
