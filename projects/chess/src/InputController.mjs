import * as THREE from "../../forest/vendor/three.module.js";
import { squareName } from "./ChessBoard.mjs";
export class InputController {
  constructor({ renderer, scene, camera, board, ui, onSquare, onAction }) {
    Object.assign(this, {
      renderer,
      scene,
      camera,
      board,
      ui,
      onSquare,
      onAction,
    });
    this.ray = new THREE.Raycaster();
    this.sources = [];
    for (let i = 0; i < 2; i++) {
      const controller = renderer.xr.getController(i);
      scene.add(controller);
      const line = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(),
          new THREE.Vector3(0, 0, -2),
        ]),
        new THREE.LineBasicMaterial({ color: 0x83e3c4 }),
      );
      controller.add(line);
      controller.addEventListener("connected", (e) => {
        this.sources[i] = e.data;
      });
      controller.addEventListener("disconnected", () => {
        this.sources[i] = null;
        if (this.tracked) this.tracked[i] = false;
        line.visible = false;
      });
      controller.addEventListener("selectstart", () => {
        if (
          renderer.xr.getSession()?.visibilityState !== "visible" ||
          !this.tracked?.[i]
        )
          return;
        this.controllerRay(controller);
        this.activate();
      });
      this.controllers ??= [];
      this.controllers.push(controller);
    }
    renderer.domElement.addEventListener("pointerdown", (e) => {
      if (renderer.xr.isPresenting) return;
      const r = renderer.domElement.getBoundingClientRect();
      this.ray.setFromCamera(
        new THREE.Vector2(
          ((e.clientX - r.left) / r.width) * 2 - 1,
          (-(e.clientY - r.top) / r.height) * 2 + 1,
        ),
        camera,
      );
      this.activate();
    });
  }
  controllerRay(controller) {
    const matrix = new THREE.Matrix4().extractRotation(controller.matrixWorld);
    this.ray.ray.origin.setFromMatrixPosition(controller.matrixWorld);
    this.ray.ray.direction.set(0, 0, -1).applyMatrix4(matrix);
  }
  hit() {
    const objects = [
      ...(this.ui.root.visible ? this.ui.targets : []),
      ...this.board.pieces.values(),
      this.board.squares,
    ];
    return this.ray.intersectObjects(objects, false)[0];
  }
  activate() {
    const hit = this.hit();
    if (!hit) return;
    if (hit.object.userData.action) this.onAction(hit.object.userData.action);
    else if (hit.object.userData.square)
      this.onSquare(hit.object.userData.square);
    else if (hit.instanceId !== undefined)
      this.onSquare(squareName(hit.instanceId));
  }
  update(frame, referenceSpace, viewerTracked = true) {
    this.tracked = this.controllers.map((controller, i) => {
      const source = this.sources[i];
      const valid = !!(
        viewerTracked &&
        frame &&
        source &&
        frame.getPose(source.targetRaySpace, referenceSpace)
      );
      controller.children[0].visible =
        valid && this.renderer.xr.getSession()?.visibilityState === "visible";
      if (valid) {
        this.controllerRay(controller);
        const hit = this.hit();
        controller.children[0].scale.z = hit ? hit.distance / 2 : 1;
      }
      return valid;
    });
  }
}
