import * as THREE from "../../../shared/vendor/three-r180/three.module.js";
const CELL = 0.06,
  SIZE = 0.53;
export function coordinateLabels(color) {
  return Array.from({ length: 8 }, (_, i) => [
    {
      text: String.fromCharCode(97 + (color === "b" ? 7 - i : i)),
      x: (i - 3.5) * CELL,
      z: 0.2525,
    },
    {
      text: String(color === "b" ? 8 - i : i + 1),
      x: -0.2525,
      z: (3.5 - i) * CELL,
    },
  ]).flat();
}
export class BoardCoordinates {
  constructor(parent) {
    this.root = new THREE.Group();
    parent.add(this.root);
    if (typeof document !== "undefined") {
      this.canvas = document.createElement("canvas");
      this.canvas.width = this.canvas.height = 1024;
      this.texture = new THREE.CanvasTexture(this.canvas);
      this.texture.colorSpace = THREE.SRGBColorSpace;
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(SIZE, SIZE),
        new THREE.MeshBasicMaterial({
          map: this.texture,
          transparent: true,
          depthWrite: false,
        }),
      );
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.y = -0.007;
      this.root.add(mesh);
    }
    this.setPlayerColor("w");
  }
  setPlayerColor(color) {
    if (this.color === color) return;
    this.color = color;
    this.labels = coordinateLabels(color);
    if (!this.canvas) return;
    const ctx = this.canvas.getContext("2d");
    ctx.clearRect(0, 0, 1024, 1024);
    ctx.fillStyle = "#f4e4bb";
    ctx.font = "bold 28px system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const { text, x, z } of this.labels)
      ctx.fillText(text, (x / SIZE + 0.5) * 1024, (z / SIZE + 0.5) * 1024);
    this.texture.needsUpdate = true;
  }
}
