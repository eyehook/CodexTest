import {Vector3, Matrix4, Raycaster, Line, BufferGeometry, LineBasicMaterial} from '../vendor/three-r180/three.module.js';

// Caller owns interaction rules and the line's geometry/material disposal.
export function createPointerLine({color = 0xb5bfcc, length = 6, depthTest = false, renderOrder = 1000} = {}) {
  const line = new Line(
    new BufferGeometry().setFromPoints([new Vector3(), new Vector3(0, 0, -1)]),
    new LineBasicMaterial({color, toneMapped: false, depthTest}),
  );
  line.scale.z = length;
  line.renderOrder = renderOrder;
  return line;
}

// One instance can serve multiple controllers sequentially. Hits are reused.
export class ControllerPointer {
  constructor({near = 0, far = Infinity} = {}) {
    this.raycaster = new Raycaster();
    this.raycaster.near = near; this.raycaster.far = far;
    this.rotation = new Matrix4();
    this.hits = [];
  }
  setFromController(controller) {
    controller.updateWorldMatrix(true, false);
    this.rotation.extractRotation(controller.matrixWorld);
    this.raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
    this.raycaster.ray.direction.set(0, 0, -1).applyMatrix4(this.rotation).normalize();
    return this.raycaster;
  }
  cast(controller, objects, recursive = false) {
    this.setFromController(controller);
    this.hits.length = 0;
    if (Array.isArray(objects)) this.raycaster.intersectObjects(objects, recursive, this.hits);
    else this.raycaster.intersectObject(objects, recursive, this.hits);
    return this.hits[0] ?? null;
  }
}
