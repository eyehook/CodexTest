import * as THREE from "../../../shared/vendor/three-r180/three.module.js";
import { OptionsMenu } from "./OptionsMenu.mjs?v=shared-r180-1";

export class UndoDialog extends OptionsMenu {
  constructor({ scene, world, input, game, label }) {
    super({ scene, world, input, game, label, menuButton: false, panelHeight: 0.36,
      buildContent: ({ addLabel, root, targets }) => {
        addLabel("Do you want to undo your last move?", 0.76, 0.10, 0, 0.075);
        for (const [text, action, x] of [["Yes", "yes", -0.16], ["No", "no", 0.16]]) {
          const button = addLabel(text, 0.22, 0.085, x, -0.075);
          button.userData.action = action; targets.push(button);
        }
        // Modal contents use fixed layers independent of scene visibility.
        root.traverse((mesh) => {
          if (!mesh.isMesh) return;
          mesh.material.depthTest = mesh.material.depthWrite = false;
          mesh.material.transparent = true;
          // Transparent meshes otherwise sort by distance to their centers.
          // Head movement can put a label behind the backdrop in that ordering.
          mesh.renderOrder = mesh === root.children[0] ? 100 : 101;
        });
      },
    });
    this.game = game;
    this.sticks = new WeakMap();
    for (const pointer of this.pointers) { pointer.material.depthTest = false; pointer.material.transparent = true; pointer.renderOrder = 102; }
  }
  show(camera) {
    if (this.open || !this.game.canUndo()) return;
    this.input.reset();
    this.epoch = this.game.epoch;
    this.fen = this.game.game.fen();
    this.worldWasVisible = this.world.visible;
    this.world.visible = false;
    this.open = this.root.visible = true;
    const position = camera.getWorldPosition(new THREE.Vector3());
    const direction = camera.getWorldDirection(new THREE.Vector3());
    if (direction.lengthSq() < 0.001) direction.set(0, 0, -1);
    this.root.position.copy(position).addScaledVector(direction.normalize(), 1.2);
    this.root.lookAt(position);
  }
  close() {
    if (!this.open) return;
    this.world.visible = this.worldWasVisible;
    this.open = this.root.visible = false;
    this.pointers.forEach((pointer) => { pointer.visible = false; });
    this.input.reset();
  }
  activate(target) {
    if (!this.open) return;
    const yes = target.userData.action === "yes";
    const valid = this.game.epoch === this.epoch && this.game.game.fen() === this.fen;
    this.close();
    if (yes && valid) this.game.undoLastPlayerMove();
  }
  update(frame, reference, tracked, camera, blocked = false) {
    const wasOpen = this.open;
    let requested = false;
    for (const hand of this.input.hands) {
      const source = hand.source;
      if (!source) continue;
      const pose = tracked && source.targetRaySpace && frame.getPose(source.targetRaySpace, reference);
      if (!pose || source.gamepad?.mapping !== "xr-standard") { this.sticks.delete(source); continue; }
      const axes = source.gamepad.axes ?? [];
      const x = axes.length >= 4 ? axes[2] : axes[0];
      if (!Number.isFinite(x)) { this.sticks.delete(source); continue; }
      let state = this.sticks.get(source);
      if (!state) { this.sticks.set(source, { armed: x > -0.25 }); continue; }
      if (x > -0.25) state.armed = true;
      if (x < -0.65 && state.armed) { state.armed = false; requested = true; }
    }
    if (this.open && (this.game.epoch !== this.epoch || this.game.game.fen() !== this.fen ||
      !["player", "grabbing"].includes(this.game.phase))) this.close();
    const consumed = super.update(frame, reference, tracked, camera);
    if (requested && !this.open && !wasOpen && !blocked) {
      this.show(camera);
      // Consume any trigger already held when entering the dialog.
      for (const hand of this.input.hands) {
        const state = hand.source && this.states.get(hand.source);
        if (state) state.selecting = false;
      }
    }
    return consumed || wasOpen || this.open;
  }
}
