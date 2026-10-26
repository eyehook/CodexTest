import * as THREE from "../../forest/vendor/three.module.js";
import { TableControls } from "./TableControls.mjs?v=move-display-1";

// Add future option rows here; draft values are committed only on close.
export const OPTION_ROWS = [
  { key: "evaluateMove", label: "Evaluate Move" },
  { key: "showEvaluation", label: "Show Evaluation" },
];
export class OptionsMenu {
  constructor({ scene, world, settings, input, label, menuButton = true, canOpen = () => true, panelHeight, buildContent }) {
    Object.assign(this, { world, settings, input, menuButton, canOpen });
    this.root = new THREE.Group();
    this.root.visible = false;
    scene.add(this.root);
    this.open = false;
    this.states = new WeakMap();
    this.ray = new THREE.Raycaster();
    this.ray.far = 4;
    this.targets = [];
    const makeLabel = label ?? ((text, width, height) =>
      TableControls.prototype.label.call(this, text, width, height));
    const addLabel = (text, width, height, x, y) => {
      const mesh = makeLabel(text, width, height);
      mesh.rotation.x = 0;
      mesh.position.set(x, y, 0.006);
      this.root.add(mesh);
      return mesh;
    };
    const height = panelHeight ?? 0.40 + OPTION_ROWS.length * 0.14;
    this.root.add(new THREE.Mesh(new THREE.PlaneGeometry(0.86, height),
      new THREE.MeshBasicMaterial({ color: 0x182a2c, side: THREE.DoubleSide })));
    if (buildContent) buildContent({ addLabel, root: this.root, targets: this.targets });
    else {
    addLabel("Options", 0.70, 0.11, 0, height / 2 - 0.08);
    OPTION_ROWS.forEach((row, i) => {
      const y = height / 2 - 0.22 - i * 0.14;
      addLabel(row.label, 0.48, 0.10, -0.12, y);
      const button = addLabel("Off", 0.18, 0.10, 0.27, y);
      button.userData.option = row.key;
      this.targets.push(button);
    });
    const save = addLabel("Save Changes", 0.46, 0.10, 0, -height / 2 + 0.08);
    save.userData.action = "save";
    this.targets.push(save);
    }
    this.pointers = [0, 1].map(() => {
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(), new THREE.Vector3(0, 0, -1),
      ]), new THREE.LineBasicMaterial({ color: 0x83e3c4 }));
      line.visible = false;
      scene.add(line);
      return line;
    });
  }
  paint(mesh, text) {
    const canvas = mesh.userData.canvas, ctx = canvas.getContext("2d");
    const button = ["On", "Off", "Save Changes", "Yes", "No"].includes(text);
    ctx.fillStyle = button ? ["On", "Yes"].includes(text) ? "#286854" : "#344e52" : "#182a2c";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#f1f0e8";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const size = Math.min(canvas.height * 0.42, canvas.width / (text.length * 0.65));
    ctx.font = `600 ${size}px system-ui`;
    ctx.fillText(text, canvas.width / 2, canvas.height / 2);
    mesh.material.map.needsUpdate = true;
  }
  refresh() {
    for (const target of this.targets) {
      const key = target.userData.option;
      if (key) this.paint(target, this.draft[key] ? "On" : "Off");
    }
  }
  show(camera) {
    this.input.reset();
    this.draft = Object.fromEntries(OPTION_ROWS.map(({ key }) => [key, this.settings[key]]));
    this.worldWasVisible = this.world.visible;
    this.world.visible = false;
    this.open = this.root.visible = true;
    const position = camera.getWorldPosition(new THREE.Vector3());
    const forward = camera.getWorldDirection(new THREE.Vector3());
    forward.y = 0;
    if (forward.lengthSq() < 0.001) forward.set(0, 0, -1);
    this.root.position.copy(position).addScaledVector(forward.normalize(), 1.2);
    this.root.lookAt(position);
    this.refresh();
  }
  close() {
    if (!this.open) return;
    Object.assign(this.settings, this.draft);
    this.settings.save();
    this.world.visible = this.worldWasVisible;
    this.open = this.root.visible = false;
    this.pointers.forEach((pointer) => { pointer.visible = false; });
    this.input.reset();
  }
  activate(target) {
    if (!this.open) return;
    if (target.userData.action === "save") this.close();
    else if (target.userData.option) {
      const key = target.userData.option;
      this.draft[key] = !this.draft[key];
      this.refresh();
    }
  }
  update(frame, reference, tracked, camera) {
    const wasOpen = this.open;
    const samples = this.input.hands.map((hand, i) => {
      this.pointers[i].visible = false;
      const source = hand.source;
      const pose = tracked && source?.targetRaySpace && frame.getPose(source.targetRaySpace, reference);
      if (!pose || source.gamepad?.mapping !== "xr-standard") {
        if (source) this.states.delete(source);
        return null;
      }
      const previous = this.states.get(source);
      const down = (index) => !!(source.gamepad.buttons[index]?.pressed || source.gamepad.buttons[index]?.value > 0.5);
      const state = { menu: this.menuButton && down(5), trigger: down(0), selecting: false };
      state.menuEdge = !!previous && state.menu && !previous.menu;
      // Consume trigger until released after opening or tracking recovery.
      state.selecting = (this.open && !!previous && previous.selecting) || !state.trigger;
      state.click = !!previous && previous.selecting && state.trigger && !previous.trigger;
      this.states.set(source, state);
      return { pose, state, i };
    });
    if (samples.some((sample) => sample?.state.menuEdge)) {
      if (this.open) this.close();
      else if (this.canOpen()) this.show(camera);
      for (const sample of samples) if (sample) sample.state.selecting = false;
      return true;
    }
    if (!this.open) return wasOpen;
    const hovered = [];
    this.root.updateWorldMatrix(true, true);
    for (const sample of samples) {
      if (!sample || !this.open) continue;
      const { pose, state, i } = sample;
      const pointer = this.pointers[i];
      const p = pose.transform.position, q = pose.transform.orientation;
      pointer.position.set(p.x, p.y, p.z);
      pointer.quaternion.set(q.x, q.y, q.z, q.w);
      const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(pointer.quaternion);
      this.ray.set(pointer.position, direction);
      const hit = this.ray.intersectObjects(this.targets, false)[0];
      pointer.scale.z = hit ? hit.distance : 2;
      pointer.visible = true;
      pointer.material.color.setHex(hit ? 0xffd57c : 0x83e3c4);
      if (hit) {
        hovered.push(hit.object);
        if (state.click) this.activate(hit.object);
      }
    }
    for (const target of this.targets)
      target.material.color.setHex(hovered.includes(target) ? 0xffd57c : 0xffffff);
    return true;
  }
}
