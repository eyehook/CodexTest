import * as THREE from "../../forest/vendor/three.module.js";
export class VRPanel {
  constructor(parent) {
    this.root = new THREE.Group();
    parent.add(this.root);
    this.root.position.set(-0.5, 0.1, -0.13);
    this.root.rotation.y = 0.3;
    this.targets = [];
    this.status = this.label("Loading…", 0.4, 0.15);
    this.status.position.y = 0.25;
    this.root.add(this.status);
    this.buttons = new Map();
    const entries = [
      ["restart", "Restart game"],
      ["height+", "Board higher"],
      ["height-", "Board lower"],
      ["near", "Board closer"],
      ["far", "Board farther"],
      ["q", "Queen"],
      ["r", "Rook"],
      ["b", "Bishop"],
      ["n", "Knight"],
    ];
    entries.forEach(([action, text], i) => {
      const mesh = this.label(text, 0.28, 0.044);
      mesh.position.set(0, 0.13 - i * 0.052, 0);
      mesh.userData.action = action;
      this.root.add(mesh);
      this.buttons.set(action, mesh);
    });
    this.update("Loading…", false);
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
    ctx.font = `${Math.min(42, c.height * 0.4)}px system-ui`;
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
        c.height / 2 + (i - (lines.length - 1) / 2) * 46,
      ),
    );
    mesh.material.map.needsUpdate = true;
  }
  update(message, promotion) {
    if (message !== this.message) {
      this.paint(this.status, message);
      this.message = message;
    }
    this.targets = [];
    for (const [action, mesh] of this.buttons) {
      mesh.visible = action.length !== 1 || promotion;
      if (mesh.visible) this.targets.push(mesh);
    }
  }
}
