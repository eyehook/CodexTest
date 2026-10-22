import * as THREE from "../../forest/vendor/three.module.js";
export class TableControls {
  constructor(parent) {
    this.root = new THREE.Group();
    parent.add(this.root);
    this.root.position.set(0, -0.034, 0);
    this.targets = [];
    this.status = this.label("Loading…", 0.46, 0.065);
    this.status.position.set(0, 0, 0.345);
    this.root.add(this.status);
    this.buttons = new Map();
    const entries = [["restart", "Restart game"]];
    entries.forEach(([action, text]) => {
      const mesh = this.label(text, 0.16, 0.065);
      mesh.position.set(0.34, 0.001, 0.345);
      mesh.userData.action = action;
      this.root.add(mesh);
      this.buttons.set(action, mesh);
    });
    this.update("Loading…");
  }
  label(text, width, height) {
    const canvas = document.createElement("canvas");
    canvas.width = 768;
    canvas.height = Math.round((768 * height) / width);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(width, height),
      new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide }),
    );
    mesh.rotation.x = -Math.PI / 2;
    mesh.userData.canvas = canvas;
    this.paint(mesh, text);
    return mesh;
  }
  paint(mesh, text) {
    const c = mesh.userData.canvas,
      ctx = c.getContext("2d");
    ctx.fillStyle = "#182a2c";
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.fillStyle = "#e9e4d4";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const fontSize = Math.min(42, c.height * 0.22);
    ctx.font = `${fontSize}px system-ui`;
    const words = text.split(" "),
      lines = [""];
    for (const word of words) {
      const i = lines.length - 1;
      if (ctx.measureText(lines[i] + " " + word).width > c.width - 40)
        lines.push(word);
      else lines[i] += (lines[i] ? " " : "") + word;
    }
    lines.forEach((line, i) =>
      ctx.fillText(
        line,
        c.width / 2,
        c.height / 2 + (i - (lines.length - 1) / 2) * fontSize * 1.25,
      ),
    );
    mesh.material.map.needsUpdate = true;
  }
  touchTarget(worldPoint) {
    if (!this.root.visible) return null;
    for (const target of this.targets) {
      target.updateWorldMatrix(true, false);
      const p = target.worldToLocal(worldPoint.clone());
      const { width, height } = target.geometry.parameters;
      const dx = Math.max(Math.abs(p.x) - width / 2, 0);
      const dy = Math.max(Math.abs(p.y) - height / 2, 0);
      const dz = Math.max(-p.z, p.z - 0.02, 0);
      if (dx * dx + dy * dy + dz * dz <= 0.0254 ** 2) return target;
    }
    return null;
  }
  highlight(targets) {
    for (const target of this.targets)
      target.material.color.setHex(
        targets.includes(target) ? 0xffd57c : 0xffffff,
      );
  }
  update(message) {
    if (message !== this.message) {
      this.paint(this.status, message);
      this.message = message;
    }
    this.targets = [];
    for (const mesh of this.buttons.values()) {
      mesh.visible = true;
      if (mesh.visible) this.targets.push(mesh);
    }
  }
}
