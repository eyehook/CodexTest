import * as THREE from "../../forest/vendor/three.module.js";
import { TableControls } from "./TableControls.mjs?v=game-over-1";
export function gameOverResult(state) {
  if (state.phase !== "over") return null;
  return state.game.isCheckmate()
    ? state.game.turn() === state.playerColor
      ? "You Lost!"
      : "You Won!"
    : "Draw!";
}
export class GameOverPanel {
  constructor(
    parent,
    { loadTexture = (url) => new THREE.TextureLoader().load(url) } = {},
  ) {
    this.root = new THREE.Group();
    this.root.position.set(0, 0.42, 0.02);
    parent.add(this.root);
    this.art = Object.fromEntries(
      [
        ["You Won!", "win"],
        ["You Lost!", "loss"],
        ["Draw!", "draw"],
      ].map(([result, file]) => {
        const texture = loadTexture(
          new URL(`../assets/game-over/${file}.png`, import.meta.url).href,
        );
        texture.colorSpace = THREE.SRGBColorSpace;
        return [result, texture];
      }),
    );
    this.title = new THREE.Mesh(
      new THREE.PlaneGeometry(0.48, 0.32),
      new THREE.MeshBasicMaterial({
        map: this.art["You Won!"],
        side: THREE.DoubleSide,
      }),
    );
    this.title.position.y = 0.055;
    this.root.add(this.title);
    this.button = this.label("New Game", 0.22, 0.065);
    this.button.rotation.x = 0;
    this.button.position.y = -0.18;
    this.button.userData.action = "restart";
    this.root.add(this.button);
    this.buttonHighlight = new THREE.Mesh(
      new THREE.PlaneGeometry(0.234, 0.079),
      new THREE.MeshBasicMaterial({ color: 0xffd57c, side: THREE.DoubleSide }),
    );
    this.buttonHighlight.position.set(0, -0.18, -0.001);
    this.buttonHighlight.visible = false;
    this.root.add(this.buttonHighlight);
    this.targets = [];
    this.root.visible = false;
    this.viewerPosition = new THREE.Vector3();
  }
  label(...args) {
    return TableControls.prototype.label.call(this, ...args);
  }
  paint(...args) {
    return TableControls.prototype.paint.call(this, ...args);
  }
  touchTarget(point) {
    return TableControls.prototype.touchTarget.call(this, point);
  }
  highlight(targets) {
    TableControls.prototype.highlight.call(this, targets);
    this.buttonHighlight.visible =
      this.root.visible && targets.includes(this.button);
  }
  update(state) {
    const result = gameOverResult(state);
    this.root.visible = result !== null;
    this.targets = result ? [this.button] : [];
    if (!result) this.buttonHighlight.visible = false;
    if (result && result !== this.result) {
      this.title.material.map = this.art[result];
      this.title.material.needsUpdate = true;
    }
    this.result = result;
  }
  faceCamera(camera) {
    if (!this.root.visible) return;
    camera.getWorldPosition(this.viewerPosition);
    this.root.lookAt(this.viewerPosition);
  }
}
