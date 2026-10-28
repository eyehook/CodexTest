import * as THREE from '../../forest/vendor/three.module.js';
export class DesktopControls {
  constructor(container, parameters) {
    this.container = container; this.parameters = parameters; this.rows = new Map();
    for (const d of parameters.definitions) {
      const label = document.createElement('label'), title = document.createElement('span');
      title.textContent = d.label; const value = document.createElement('output'), input = document.createElement('input');
      input.type = 'range'; input.min = d.min; input.max = d.max; input.step = d.step; input.value = parameters.values[d.id];
      input.setAttribute('aria-label', d.label); value.textContent = d.format(parameters.values[d.id]);
      input.addEventListener('input', () => parameters.set(d.id, input.value));
      label.append(title, value, input); container.append(label); this.rows.set(d.id, { input, value, d });
    }
    this.unsubscribe = parameters.subscribe((id, next) => { const row = this.rows.get(id); row.input.value = next; row.value.textContent = row.d.format(next); });
  }
  dispose() { this.unsubscribe(); this.container.replaceChildren(); }
}
export class VRControlPanel {
  constructor(scene, player, parameters) {
    this.scene = scene; this.player = player; this.parameters = parameters;
    this.canvas = document.createElement('canvas'); this.canvas.width = 1024; this.canvas.height = 276 + parameters.definitions.length * 138;
    this.fps = null;
    this.ctx = this.canvas.getContext('2d'); this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9 * this.canvas.height / this.canvas.width), new THREE.MeshBasicMaterial({ map: this.texture, side: THREE.FrontSide }));
    this.mesh.visible = false; scene.add(this.mesh);
    this.raycaster = new THREE.Raycaster(); this.hits = []; this.rotation = new THREE.Matrix4();
    this.head = new THREE.Vector3(); this.direction = new THREE.Vector3(); this.target = new THREE.Vector3();
    this.up = new THREE.Vector3(0, 1, 0); this.previousButtons = new Map(); this.dragRows = new Map(); this.previousTriggers = new Map();
    this.rays = player.controllers.map(controller => {
      const ray = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 0, -1)]), new THREE.LineBasicMaterial({ color: 0xa8e8ff, depthTest: false }));
      ray.scale.z = 1.5; ray.visible = false; ray.renderOrder = 10; controller.add(ray); return ray;
    });
    this.unsubscribe = parameters.subscribe(() => this.draw()); this.draw();
  }
  draw() {
    const ctx = this.ctx; ctx.fillStyle = '#131d28'; ctx.fillRect(0, 0, 1024, this.canvas.height);
    ctx.fillStyle = '#f1f6fa'; ctx.font = 'bold 40px sans-serif'; ctx.fillText('SNOW / WEATHER LAB', 55, 70);
    ctx.font = '24px sans-serif'; ctx.fillStyle = '#b1c7d7'; ctx.fillText('Point + hold trigger to adjust · B / Y to close', 55, 116);
    this.parameters.definitions.forEach((d, index) => {
      const y = 180 + index * 138, value = this.parameters.values[d.id];
      ctx.font = '30px sans-serif'; ctx.fillStyle = '#f1f6fa'; ctx.textAlign = 'left'; ctx.fillText(d.label, 60, y);
      ctx.textAlign = 'right'; ctx.fillText(d.format(value), 964, y); ctx.textAlign = 'left';
      ctx.fillStyle = '#435568'; ctx.fillRect(80, y + 37, 864, 12);
      const x = 80 + (value - d.min) / (d.max - d.min) * 864;
      ctx.fillStyle = '#a8e8ff'; ctx.fillRect(80, y + 37, x - 80, 12);
      ctx.beginPath(); ctx.arc(x, y + 43, 17, 0, Math.PI * 2); ctx.fill();
    });
    ctx.font = '26px sans-serif'; ctx.fillStyle = '#a8e8ff';
    ctx.fillText(this.fps === null ? 'FPS  —' : `FPS  ${this.fps}`, 60, this.canvas.height - 30);
    this.texture.needsUpdate = true;
  }
  setFPS(fps) {
    const next = Number.isFinite(fps) ? Math.round(fps) : null;
    if (next === this.fps) return;
    this.fps = next;
    if (this.mesh.visible) this.draw();
  }
  toggle() {
    this.mesh.visible = !this.mesh.visible; this.dragRows.clear();
    if (!this.mesh.visible) return;
    this.draw();
    this.player.getWorldPose(this.head, this.direction);
    this.direction.y = 0; this.direction.normalize().applyAxisAngle(this.up, -Math.PI / 4);
    this.mesh.position.copy(this.head).addScaledVector(this.direction, 1.2); this.mesh.position.y -= 0.15;
    this.target.copy(this.head); this.target.y = this.mesh.position.y; this.mesh.lookAt(this.target);
    this.mesh.updateMatrixWorld(true);
  }
  update(session) {
    if (!session) { this.mesh.visible = false; this.previousButtons.clear(); this.previousTriggers.clear(); this.dragRows.clear(); this.rays.forEach(ray => ray.visible = false); return; }
    let toggle = false;
    for (const source of session.inputSources) {
      const pressed = Boolean(source.gamepad?.buttons[5]?.pressed);
      if (pressed && !this.previousButtons.get(source)) toggle = true;
      this.previousButtons.set(source, pressed);
    }
    if (toggle) this.toggle();
    const sources = session.inputSources;
    for (const source of this.previousButtons.keys()) if (!Array.prototype.includes.call(sources, source)) { this.previousButtons.delete(source); this.previousTriggers.delete(source); this.dragRows.delete(source); }
    this.player.controllers.forEach((controller, index) => {
      const source = controller.userData.inputSource, ray = this.rays[index];
      ray.visible = this.mesh.visible && Boolean(source?.gamepad) && controller.visible;
      if (!source) return;
      const down = Boolean(source.gamepad?.buttons[0]?.pressed), wasDown = this.previousTriggers.get(source);
      this.previousTriggers.set(source, down);
      if (!ray.visible) { this.dragRows.delete(source); return; }
      controller.updateWorldMatrix(true, false); this.rotation.extractRotation(controller.matrixWorld);
      this.raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
      this.raycaster.ray.direction.set(0, 0, -1).applyMatrix4(this.rotation);
      this.hits.length = 0; this.raycaster.intersectObject(this.mesh, false, this.hits);
      const hit = this.hits[0]; ray.scale.z = hit ? hit.distance : 1.5;
      if (!down) { this.dragRows.delete(source); return; }
      if (!hit) return;
      const x = hit.uv.x * 1024, y = (1 - hit.uv.y) * this.canvas.height;
      if (!wasDown) {
        const row = Math.round((y - 223) / 138);
        if (row >= 0 && row < this.parameters.definitions.length && Math.abs(y - (223 + row * 138)) < 36) this.dragRows.set(source, row);
      }
      const row = this.dragRows.get(source);
      if (row !== undefined) {
        const d = this.parameters.definitions[row]; this.parameters.set(d.id, d.min + THREE.MathUtils.clamp((x - 80) / 864, 0, 1) * (d.max - d.min));
      }
    });
  }
  dispose() {
    this.unsubscribe(); this.mesh.removeFromParent(); this.mesh.geometry.dispose(); this.mesh.material.dispose(); this.texture.dispose();
    for (const ray of this.rays) { ray.removeFromParent(); ray.geometry.dispose(); ray.material.dispose(); }
  }
}
