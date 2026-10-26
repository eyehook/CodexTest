import { EvaluationGauge } from "./EvaluationGauge.mjs?v=gauge-deadzone-1";
import * as THREE from "../../forest/vendor/three.module.js";
export function moveRows(history, limit = 8) {
  const rows = [];
  let fallback = 1;
  for (const move of history) {
    const parsed = Number(move.before?.split(" ")[5]);
    const number = Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
    let row = rows[rows.length - 1];
    if (!row || row.number !== number) {
      row = { number, white: "", black: "" };
      rows.push(row);
    }
    row[move.color === "w" ? "white" : "black"] = move.san;
    if (move.color === "b") fallback = number + 1;
  }
  return rows.slice(-limit);
}
export class TableControls {
  constructor(parent) {
    this.root = new THREE.Group();
    parent.add(this.root);
    this.root.position.set(0.52, 0.66, -0.7);
    this.targets = [];
    this.gauge = new EvaluationGauge(this.root);
    this.moves = this.label("", 0.44, 0.36);
    this.moves.rotation.x = 0;
    this.moves.position.y = -0.245;
    this.root.add(this.moves);
    for (const panel of [this.moves]) {
      const { width, height } = panel.geometry.parameters;
      const backing = new THREE.Mesh(
        new THREE.BoxGeometry(width + 0.012, height + 0.012, 0.012),
        new THREE.MeshStandardMaterial({ color: 0x344e52, roughness: 0.8 }),
      );
      backing.position.copy(panel.position);
      backing.position.z = -0.008;
      this.root.add(backing);
    }
    this.viewerPosition = new THREE.Vector3();
    this.buttons = new Map();
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
    const lines = [];
    for (const paragraph of text.split("\n")) {
      let line = "";
      for (const word of paragraph.split(" ")) {
        const next = line ? `${line} ${word}` : word;
        if (line && ctx.measureText(next).width > c.width - 40) {
          lines.push(line);
          line = word;
        } else line = next;
      }
      lines.push(line);
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
  paintMoves(history) {
    const rows = moveRows(history),
      key = JSON.stringify(rows);
    if (key === this.movesKey) return;
    this.movesKey = key;
    const canvas = this.moves.userData.canvas,
      ctx = canvas.getContext("2d");
    ctx.fillStyle = "#182a2c";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.font = "bold 36px system-ui";
    ctx.fillStyle = "#e9c978";
    ctx.fillText("White", 155, 46);
    ctx.fillText("Black", 450, 46);
    ctx.fillStyle = "#607571";
    ctx.fillRect(24, 83, canvas.width - 48, 2);
    ctx.font = "36px monospace";
    rows.forEach((row, i) => {
      const y = 122 + i * 62;
      ctx.fillStyle = "#9aada8";
      ctx.fillText(`${row.number}.`, 30, y);
      ctx.fillStyle = "#e9e4d4";
      ctx.fillText(row.white, 155, y);
      ctx.fillText(row.black, 450, y);
    });
    this.moves.material.map.needsUpdate = true;
  }
  setEvaluation(visible, score, playerColor) {
    this.gauge.update(visible, score, playerColor);
  }
  animate(dt) {
    this.gauge.tick(dt);
  }
  faceCamera(camera) {
    if (!this.root.visible) return;
    camera.getWorldPosition(this.viewerPosition);
    this.root.lookAt(this.viewerPosition);
  }
  update(message, history = []) {
    this.paintMoves(history);
    this.message = message;
    this.targets = [];
    for (const mesh of this.buttons.values()) {
      mesh.visible = true;
      if (mesh.visible) this.targets.push(mesh);
    }
  }
}
