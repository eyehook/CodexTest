import * as THREE from "../../../shared/vendor/three-r180/three.module.js";

// Neutral is white; non-neutral tints start at visible pastel red/green.
export function evaluationColor(delta) {
  if (typeof delta !== "number" || Number.isNaN(delta)) return null;
  if (Math.abs(delta) <= 0.1) return new THREE.Color(0xffffff);
  const amount = Math.min((Math.abs(delta) - 0.1) / 2.9, 1);
  return new THREE.Color(delta < 0 ? 0xffcccc : 0xccffcc).lerp(
    new THREE.Color(delta < 0 ? 0xe44d45 : 0x28b463), amount,
  );
}
export function squareEvaluations(entries) {
  const squares = new Map();
  for (const { square, delta } of entries) {
    if (typeof delta !== "number" || Number.isNaN(delta)) continue;
    // A promotion square represents the best available promotion choice.
    if (!squares.has(square) || delta > squares.get(square)) squares.set(square, delta);
  }
  return squares;
}
// One transparent atlas lies on the board; ordinary piece depth hides its text.
export class MoveEvaluationOverlay {
  constructor(board, { createCanvas = () => document.createElement("canvas") } = {}) {
    this.board = board;
    this.createCanvas = createCanvas;
  }
  clear() {
    this.board.setMoveEvaluations(null);
    if (this.surface) this.surface.visible = false;
    this.textKey = null;
  }
  set(entries) {
    this.board.setMoveEvaluations(entries);
    const best = new Map();
    for (const entry of entries) {
      if (typeof entry.delta !== "number" || Number.isNaN(entry.delta)) continue;
      if (!best.has(entry.square) || entry.delta > best.get(entry.square).delta)
        best.set(entry.square, entry);
    }
    if (!best.size) {
      if (this.surface) this.surface.visible = false;
      this.textKey = null;
      return;
    }
    if (!this.surface) {
      const canvas = this.canvas = this.createCanvas();
      canvas.width = canvas.height = 1024;
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      const size = this.board.squares.geometry.parameters.width * 8;
      this.surface = new THREE.Mesh(
        new THREE.PlaneGeometry(size, size),
        new THREE.MeshBasicMaterial({
          map: texture, transparent: true, depthTest: true, depthWrite: false,
          polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
        }),
      );
      this.surface.rotation.x = -Math.PI / 2;
      this.surface.position.y = 0.0008;
      this.board.root.add(this.surface);
    }
    this.surface.visible = true;
    const flipped = Math.abs(this.board.root.rotation.y) > 1;
    const labels = [...best.values()].map(({ square, delta, text }) => ({ square,
      text: text ?? (Number.isFinite(delta) ? `${delta > 0 ? "+" : ""}${(delta || 0).toFixed(1)}` : delta < 0 ? "-M" : "M"),
    }));
    const key = JSON.stringify([flipped, labels]);
    if (key === this.textKey) return;
    this.textKey = key;
    const ctx = this.canvas.getContext("2d");
    ctx.clearRect(0, 0, 1024, 1024);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#102024";
    ctx.strokeStyle = "rgba(255,255,255,0.8)";
    ctx.lineWidth = 3;
    ctx.lineJoin = "round";
    for (const { square, text } of labels) {
      const x = (square.charCodeAt(0) - 97 + 0.5) * 128;
      const y = (8 - Number(square[1]) + 0.5) * 128;
      ctx.save();
      ctx.translate(x, y);
      // Rotate the glyph, not its square location, for the Black-facing board.
      if (flipped) ctx.rotate(Math.PI);
      ctx.font = `bold ${Math.min(40, 112 / (text.length * 0.65))}px system-ui`;
      ctx.strokeText(text, 0, 0);
      ctx.fillText(text, 0, 0);
      ctx.restore();
    }
    this.surface.material.map.needsUpdate = true;
  }
}
