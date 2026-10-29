import * as T from '../vendor/three-r180/three.module.js';
import {ControllerPointer, createPointerLine} from '../xr/pointer.mjs';
import {createTheme} from './theme.mjs?v=shared-ui-slider-1';

// One canvas texture, one plane, and reusable controller rays. Projects own placement calls.
export class VRControlPanel {
  constructor(scene, rig, renderer, model, {title = 'CONTROLS', subtitle = 'Point either controller · Trigger − / +', footer = '', theme = {}, distance = 3, angle = Math.PI / 4, enabled = true, controllers = null, controllerEvents = true, width = 1.45, pointer = {}} = {}) {
    this.model = model; this.title = title; this.subtitle = subtitle; this.footer = footer;
    this.width = width; this.rayLength = pointer.length ?? 4;
    this.theme = createTheme(theme); this.distance = distance; this.angle = angle; this.enabled = enabled;
    this.rows = model.definitions.filter(d => d.vr !== false && d.kind !== 'action').sort((a,b) => (a.vrOrder ?? 0) - (b.vrOrder ?? 0));
    this.actions = model.definitions.filter(d => d.vr !== false && d.kind === 'action');
    this.playerPosition = new T.Vector3(); this.panelOffset = new T.Vector3();
    this.canvas = document.createElement('canvas'); this.canvas.width = 1024;
    this.canvas.height = Math.max(1280, this.theme.rowTop + (this.rows.length + this.actions.length) * this.theme.rowHeight + 80);
    this.ctx = this.canvas.getContext('2d'); this.texture = new T.CanvasTexture(this.canvas); this.texture.colorSpace = T.SRGBColorSpace;
    this.mesh = new T.Mesh(new T.PlaneGeometry(this.width, this.width * this.canvas.height / 1024), new T.MeshBasicMaterial({map: this.texture}));
    scene.add(this.mesh); this.mesh.visible = false;
    this.pointer = new ControllerPointer(); this.hover = -1; this.controllers = []; this.controllerStates = new Map(); this.handlers = [];
    for (const controller of controllers ?? [renderer.xr.getController(0), renderer.xr.getController(1)]) {
      if (!controllers) rig.add(controller);
      const line = createPointerLine({color: this.theme.accent, length: this.rayLength, depthTest: true, renderOrder: 0, ...pointer});
      line.visible = false; controller.add(line);
      const state = {line, connected: false}; this.controllerStates.set(controller, state);
      const connected = () => { state.connected = true; };
      const disconnected = () => { state.connected = false; line.visible = false; };
      const select = () => { if (this.enabled && this.mesh.visible && state.connected) this.activate(this.hit(controller)); };
      for (const [event, handler] of [['connected', connected], ['disconnected', disconnected], ['selectstart', select]]) {
        if (controllerEvents) { controller.addEventListener(event, handler); this.handlers.push([controller, event, handler]); }
      }
      this.controllers.push(controller);
    }
    this.unsubscribe = model.subscribe(id => this.onModelChange(id)); this.draw();
  }
  onModelChange() { this.draw(); }
  setModel(model) {
    this.unsubscribe(); this.model = model;
    this.rows = model.definitions.filter(d => d.vr !== false && d.kind !== 'action').sort((a,b) => (a.vrOrder ?? 0) - (b.vrOrder ?? 0));
    this.actions = model.definitions.filter(d => d.vr !== false && d.kind === 'action');
    this.unsubscribe = model.subscribe(id => this.onModelChange(id)); this.resizeLayout(); this.draw();
  }
  resizeLayout() { this.resizeCanvas(Math.max(1280, this.theme.rowTop + (this.rows.length + this.actions.length) * this.theme.rowHeight + 80)); }
  resizeCanvas(height) {
    if (height === this.canvas.height) return;
    this.canvas.height = height; this.texture.dispose();
    this.texture = new T.CanvasTexture(this.canvas); this.texture.colorSpace = T.SRGBColorSpace;
    this.mesh.material.map = this.texture; this.mesh.material.needsUpdate = true;
    this.mesh.geometry.dispose(); this.mesh.geometry = new T.PlaneGeometry(this.width, this.width * height / 1024);
  }
  follow(position, heading) {
    this.panelOffset.set(this.distance * Math.sin(this.angle), 0, -this.distance * Math.cos(this.angle)).applyQuaternion(heading);
    this.mesh.position.copy(position).add(this.panelOffset); this.mesh.lookAt(position); this.mesh.updateMatrixWorld(true);
  }
  place(distance) { this.playerPosition.set(0, 1.6, distance); this.follow(this.playerPosition, new T.Quaternion()); this.mesh.visible = true; }
  toggle() {
    this.mesh.visible = !this.mesh.visible; this.hover = -1;
    if (this.mesh.visible) this.draw(); else this.hideRays();
  }
  hideRays() { for (const {line} of this.controllerStates.values()) line.visible = false; }
  hit(controller) {
    const hit = this.pointer.cast(controller, this.mesh);
    if (!hit) return null;
    const x = hit.uv.x * 1024, y = (1 - hit.uv.y) * this.canvas.height;
    const row = Math.floor((y - this.theme.rowTop) / this.theme.rowHeight);
    if (row < 0 || row >= this.rows.length + this.actions.length || y > this.theme.rowTop + row * this.theme.rowHeight + this.theme.rowHeight - 14) return null;
    if (row >= this.rows.length) {
      const action = row - this.rows.length;
      return x >= 30 && x <= 994 && !this.model.disabled(this.actions[action]) ? {action, distance: hit.distance, row, sign: 1} : null;
    }
    const d = this.rows[row];
    if (d.kind === 'readout' || this.model.disabled(d)) return null;
    if (d.kind === 'toggle') return x >= 30 && x <= 994 ? {row, sign: 1, distance: hit.distance} : null;
    const sign = x >= 758 && x <= 842 ? -1 : x >= 878 && x <= 962 ? 1 : 0;
    return sign ? {row, sign, distance: hit.distance} : null;
  }
  activate(hit) {
    if (!hit) return;
    const d = hit.action !== undefined ? this.actions[hit.action] : this.rows[hit.row];
    if (!d) return;
    if (d.kind === 'number') this.model.adjust(d.id, hit.sign);
    else this.model.activate(d.id, {source: 'vr'});
  }
  update() {
    if (!this.enabled || !this.mesh.visible) { this.hideRays(); return; }
    let hover = -1;
    for (const controller of this.controllers) {
      const {line, connected} = this.controllerStates.get(controller); line.visible = connected;
      if (!line.visible) continue;
      const hit = this.hit(controller); line.scale.z = hit ? hit.distance : this.rayLength;
      if (hit) hover = hit.row * 2 + (hit.sign > 0 ? 1 : 0);
    }
    if (hover !== this.hover) { this.hover = hover; this.draw(); }
  }
  draw() {
    const ctx = this.ctx, c = this.theme;
    ctx.fillStyle = c.background; ctx.fillRect(0, 0, 1024, this.canvas.height);
    ctx.fillStyle = c.text; ctx.font = c.titleFont; ctx.fillText(this.title, 52, 70);
    ctx.font = c.subtitleFont; ctx.fillStyle = c.subtitle; ctx.fillText(this.subtitle, 52, 116);
    this.rows.forEach((d, i) => {
      const y = c.rowTop + i * c.rowHeight, disabled = this.model.disabled(d);
      ctx.fillStyle = i % 2 ? c.alternateRow : c.row; ctx.fillRect(30, y, 964, c.rowHeight - 10);
      ctx.fillStyle = disabled ? c.muted : c.text; ctx.font = c.labelFont; ctx.fillText(this.model.label(d, 'vr'), 52, y + 40);
      ctx.fillStyle = disabled ? c.muted : c.accent;
      ctx.fillText(d.kind === 'toggle' ? (d.get() ? 'On' : 'Off') : this.model.format(d), 590, y + 40);
      if (d.kind !== 'number') return;
      for (let side = 0; side < 2; side++) {
        const x = 758 + side * 120;
        ctx.fillStyle = !disabled && this.hover === i * 2 + side ? c.hover : c.button; ctx.fillRect(x, y + 2, 84, c.rowHeight - 16);
        ctx.fillStyle = disabled ? c.muted : c.text; ctx.font = c.buttonFont; ctx.fillText(side ? '+' : '−', x + 27, y + 40);
      }
    });
    this.actions.forEach((d, i) => {
      const row = this.rows.length + i, y = c.rowTop + row * c.rowHeight, disabled = this.model.disabled(d);
      ctx.fillStyle = !disabled && this.hover === row * 2 + 1 ? c.hover : c.button; ctx.fillRect(30, y, 964, c.rowHeight - 10);
      ctx.fillStyle = disabled ? c.muted : c.text; ctx.font = c.labelFont; ctx.fillText(this.model.label(d, 'vr'), 52, y + 40);
    });
    ctx.fillStyle = c.muted; ctx.font = c.footerFont;
    ctx.fillText(typeof this.footer === 'function' ? this.footer() : this.footer, 35, this.canvas.height - 30);
    this.texture.needsUpdate = true;
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.unsubscribe(); this.hideRays();
    for (const [controller, event, handler] of this.handlers) controller.removeEventListener(event, handler);
    for (const {line} of this.controllerStates.values()) {
      line.removeFromParent(); line.geometry.dispose(); line.material.dispose();
    }
    this.controllerStates.clear();
    this.handlers.length = 0; this.mesh.removeFromParent(); this.mesh.geometry.dispose(); this.mesh.material.dispose(); this.texture.dispose();
  }
}
