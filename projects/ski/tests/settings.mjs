import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from '../../../shared/vendor/three-r180/three.module.js';
import {SkiProfiler} from '../profiling.mjs';
import {loadSettings, saveSettings, SkiSettings} from '../settings.mjs';

test('settings load defaults, clamp stored heights, and round-trip preferences', () => {
  const entries = new Map();
  const storage = {getItem: key => entries.get(key), setItem: (key, value) => entries.set(key, value)};
  assert.deepEqual(loadSettings(storage), {trees: true, shadows: false, trails: true, heightOffset: 0, skiVolume: 0.35, windVolume: 0.5, ambientVolume: 0.35});
  saveSettings({trees: false, shadows: true, trails: false, heightOffset: 1.25, skiVolume: 0.35, windVolume: 0.8, ambientVolume: 0.6}, storage);
  assert.deepEqual(loadSettings(storage), {trees: false, shadows: true, trails: false, heightOffset: 1.25, skiVolume: 0.35, windVolume: 0.8, ambientVolume: 0.6});
  saveSettings({trees: 'false', heightOffset: 8, skiVolume: -1, windVolume: 9, ambientVolume: 5}, storage);
  assert.deepEqual(loadSettings(storage), {trees: true, shadows: false, trails: true, heightOffset: 2, skiVolume: 0, windVolume: 1, ambientVolume: 1});
});

test('B opens and commits the VR settings, including left tabs, checkbox and slider ray edits', t => {
  const entries = new Map();
  const backup = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', {configurable: true,
    value: {getItem: key => entries.get(key), setItem: (key, value) => entries.set(key, value)}});
  const oldDocument = globalThis.document;
  globalThis.document = {createElement: () => ({getContext: () => new Proxy({}, {get: () => () => {}})})};
  t.after(() => {
    if (backup) Object.defineProperty(globalThis, 'localStorage', backup);
    else delete globalThis.localStorage;
    if (oldDocument === undefined) delete globalThis.document;
    else globalThis.document = oldDocument;
  });

  const parent = new THREE.Group();
  parent.position.set(1400, 1040, 1750);
  parent.rotation.y = 1.37;
  const saved = loadSettings();
  const profiler = new SkiProfiler();
  profiler.finishFrame(0);
  profiler.finishFrame(5000);
  for (let time = 5010; time <= 7000; time += 10) {
    profiler.beginFrame();
    profiler.finishFrame(time);
  }
  const settings = new SkiSettings(parent, saved, profiler);
  const viewer = {position: new THREE.Vector3(0.1, 1.5, -0.15), orientation: new THREE.Quaternion()};
  const aim = {position: new THREE.Vector3(), orientation: new THREE.Quaternion()};
  const buttons = Array.from({length: 6}, () => ({pressed: false}));
  const right = {targetRaySpace: aim, gamepad: {buttons}};
  const xr = {session: {inputSources: [right]}, frame: {getPose: transform => ({transform})}};
  const update = () => settings.update(xr, viewer, null, right);
  const click = (x, y) => {
    const mesh = settings.panel.mesh;
    aim.position.set(x / 1024 - 0.5, 0.5 - y / settings.panel.canvas.height, 0)
      .multiply(new THREE.Vector3(mesh.geometry.parameters.width, mesh.geometry.parameters.height, 1))
      .applyQuaternion(mesh.quaternion).add(mesh.position);
    aim.position.z += 0.35;
    buttons[0].pressed = false;
    update();
    buttons[0].pressed = true;
    update();
  };

  update();
  buttons[5].pressed = true;
  update();
  assert.equal(settings.visible, true);
  assert.equal(settings.panel.section, 'Graphics');
  update();
  assert.equal(settings.visible, true);
  click(250, 223);
  assert.equal(settings.draft.trees, true);
  click(450, 223);
  assert.equal(settings.draft.trees, false);
  click(450, 361);
  assert.equal(settings.draft.shadows, true);
  click(450, 499);
  assert.equal(settings.draft.trails, false);
  click(120, 244);
  assert.equal(settings.panel.section, 'VR');
  click(912, 223);
  assert.equal(settings.draft.heightOffset, 1.9);
  assert.deepEqual(saved, {trees: true, shadows: false, trails: true, heightOffset: 0, skiVolume: 0.35, windVolume: 0.5, ambientVolume: 0.35});
  click(120, 310);
  assert.equal(settings.panel.section, 'Audio');
  assert.equal(settings.panel.activeFooterAction, null);
  click(461, 223);
  click(783, 361);
  click(622, 499);
  assert.equal(settings.draft.skiVolume, 0.25);
  assert.equal(settings.draft.windVolume, 0.75);
  assert.equal(settings.draft.ambientVolume, 0.5);
  click(120, 374);
  assert.equal(settings.panel.section, 'Debug');
  assert.equal(settings.panel.visibleDefinitions[0].kind, 'readout');
  assert.equal(profiler.formatFps(), '100.0 / 100.0');
  click(750, settings.panel.canvas.height - 90);
  assert.equal(profiler.formatFps(), '— / —');
  assert.equal(profiler.ready, true);
  click(622, 499);
  assert.equal(settings.draft.ambientVolume, 0.5);
  assert.equal(entries.size, 0);

  buttons[5].pressed = false;
  update();
  buttons[5].pressed = true;
  update();
  assert.equal(settings.visible, false);
  assert.deepEqual(loadSettings(), {trees: false, shadows: true, trails: false, heightOffset: 1.9, skiVolume: 0.25, windVolume: 0.75, ambientVolume: 0.5});

  viewer.orientation.setFromEuler(new THREE.Euler(-0.55, 0.7, 0.31, 'YXZ'));
  buttons[5].pressed = false;
  update();
  buttons[5].pressed = true;
  update();
  const mesh = settings.panel.mesh;
  assert.equal(settings.visible, true);
  assert.equal(mesh.position.y, viewer.position.y);
  const up = new THREE.Vector3(0, 1, 0).applyQuaternion(mesh.quaternion);
  assert.ok(up.distanceTo(new THREE.Vector3(0, 1, 0)) < 1e-12);
  const offset = mesh.position.clone().sub(viewer.position);
  assert.ok(Math.abs(offset.length() - 1.15) < 1e-12);
  const heading = new THREE.Vector3(0, 0, -1).applyQuaternion(viewer.orientation);
  heading.y = 0;
  assert.ok(offset.normalize().distanceTo(heading.normalize()) < 1e-12);
});
