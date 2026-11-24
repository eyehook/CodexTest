import * as THREE from '../../shared/vendor/three-r180/three.module.js';
import {ButtonEdges} from '../../shared/xr/input.mjs';
import {ControlModel} from '../../shared/ui/controls.mjs';
import {VRSliderPanel} from '../../shared/ui/vr-slider-panel.mjs?v=shared-ui-slider-2';

const STORAGE_KEY = 'mount-snow-settings';
const B_BUTTON = 5;
const HEIGHT_MAX = 2;
const HEIGHT_STEP = 0.05;
const DEFAULT_SKI_VOLUME = 0.35;
const DEFAULT_WIND_VOLUME = 0.5;
const DEFAULT_AMBIENT_VOLUME = 0.35;
const readVolume = (value, fallback) =>
  Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : fallback;

export function loadSettings(storage) {
  try {
    const value = JSON.parse((storage ?? globalThis.localStorage)?.getItem(STORAGE_KEY) ?? 'null');
    return {
      skiVolume: readVolume(value?.skiVolume, DEFAULT_SKI_VOLUME),
      windVolume: readVolume(value?.windVolume, DEFAULT_WIND_VOLUME),
      ambientVolume: readVolume(value?.ambientVolume, DEFAULT_AMBIENT_VOLUME),
      trees: typeof value?.trees === 'boolean' ? value.trees : true,
      shadows: value?.shadows === true,
      trails: value?.trails !== false,
      heightOffset: Number.isFinite(value?.heightOffset)
        ? Math.max(0, Math.min(HEIGHT_MAX, value.heightOffset)) : 0,
    };
  } catch {
    return {trees: true, shadows: false, trails: true, heightOffset: 0,
      skiVolume: DEFAULT_SKI_VOLUME, windVolume: DEFAULT_WIND_VOLUME, ambientVolume: DEFAULT_AMBIENT_VOLUME};
  }
}

export function saveSettings(settings, storage) {
  try {
    (storage ?? globalThis.localStorage)?.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (error) {
    console.warn('Mount Snow settings could not be saved', error);
  }
}

class SettingsPanel extends VRSliderPanel {
  draw() {
    super.draw();
    if (!this.ready || this.section !== 'Graphics') return;
    // Use the shared slider panel's toggle hit row with a square checkbox.
    const {ctx, theme, controlOffset, contentLeft} = this;
    ctx.save();
    ctx.textBaseline = 'middle';
    ctx.font = theme.labelFont;
    ctx.strokeStyle = theme.accent;
    ctx.lineWidth = 3;
    const box = contentLeft + 150;
    for (const [row, definition] of this.visibleDefinitions.entries()) {
      const top = 205 + controlOffset + row * 138;
      ctx.fillStyle = theme.background;
      ctx.fillRect(contentLeft - 5, top - 62, 975 - contentLeft, 108);
      ctx.fillStyle = theme.text;
      ctx.fillText(this.model.label(definition, 'vr'), contentLeft, top + 20);
      ctx.strokeRect(box, top, 40, 40);
      if (definition.get()) {
        ctx.beginPath();
        ctx.moveTo(box + 8, top + 20);
        ctx.lineTo(box + 17, top + 29);
        ctx.lineTo(box + 33, top + 10);
        ctx.stroke();
      }
    }
    ctx.restore();
    this.texture.needsUpdate = true;
  }
}

export class SkiSettings {
  constructor(parent, saved) {
    this.saved = saved;
    this.draft = {...saved};
    this.buttons = new ButtonEdges();
    this.right = null;
    this.controllers = [new THREE.Object3D(), new THREE.Object3D()];
    parent.add(...this.controllers);
    this.model = new ControlModel([
      {id: 'trees', kind: 'toggle', label: 'Trees', group: 'Graphics',
        get: () => this.draft.trees, set: value => { this.draft.trees = value; }, format: () => ''},
      {id: 'shadows', kind: 'toggle', label: 'Shadows', group: 'Graphics',
        get: () => this.draft.shadows, set: value => { this.draft.shadows = value; }, format: () => ''},
      {id: 'trails', kind: 'toggle', label: 'Trails', group: 'Graphics',
        get: () => this.draft.trails, set: value => { this.draft.trails = value; }, format: () => ''},
      {id: 'heightOffset', kind: 'number', label: 'Height Offset', group: 'VR',
        min: 0, max: HEIGHT_MAX, step: HEIGHT_STEP, stepBase: 0,
        get: () => this.draft.heightOffset, set: value => { this.draft.heightOffset = value; },
        format: value => `${value.toFixed(2)} m`},
      ...[['skiVolume', 'Ski Volume'], ['windVolume', 'Wind Volume'], ['ambientVolume', 'Ambient Volume']].map(([id, label]) => ({
        id, label, kind: 'number', group: 'Audio', min: 0, max: 1, step: 0.05, stepBase: 0,
        get: () => this.draft[id], set: value => { this.draft[id] = value; },
        format: value => `${Math.round(value * 100)}%`,
      })),
    ]);
    this.forward = new THREE.Vector3();
    this.panel = new SettingsPanel(parent, this.controllers, this.model, {
      title: 'Settings', subtitle: 'B saves and closes · Point and pull trigger',
      width: 0.9, toggleButton: -1, sectionPlacement: 'left',
    });
  }

  get visible() { return this.panel.mesh.visible; }

  open(viewer) {
    Object.assign(this.draft, this.saved);
    this.panel.section = 'Graphics';
    this.panel.resizeControls();
    this.forward.set(0, 0, -1).applyQuaternion(viewer.orientation);
    this.forward.y = 0;
    if (this.forward.lengthSq() < 1e-6) this.forward.set(0, 0, -1);
    this.forward.normalize();
    this.panel.mesh.position.copy(viewer.position).addScaledVector(this.forward, 1.15);
    this.panel.mesh.rotation.set(0, Math.atan2(-this.forward.x, -this.forward.z), 0);
    this.panel.toggle();
    this.panel.suspend();
  }

  close() {
    if (!this.visible) return;
    Object.assign(this.saved, this.draft);
    saveSettings(this.saved);
    this.panel.toggle();
  }

  suspend() {
    this.panel.suspend();
    this.buttons.reset();
    this.right = null;
  }

  update(xr, viewer, left, right) {
    if (right !== this.right) this.buttons.reset();
    const toggle = right && this.buttons.sample(right, B_BUTTON, xr.resumed || right !== this.right).pressed;
    this.right = right;
    if (toggle && this.visible) {
      this.close();
      return;
    }
    if (toggle) this.open(viewer);
    if (!this.visible) return;
    for (let i = 0; i < this.controllers.length; i++) {
      const source = i === 0 ? left : right;
      const target = this.controllers[i];
      const pose = source && xr.frame.getPose(source.targetRaySpace, xr.referenceSpace)?.transform;
      target.userData.inputSource = source;
      target.visible = !!pose;
      if (pose) {
        target.position.copy(pose.position);
        target.quaternion.copy(pose.orientation);
      }
    }
    this.panel.mesh.updateWorldMatrix(true, false);
    this.panel.update(xr.session);
  }
}
