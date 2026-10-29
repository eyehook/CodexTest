import * as T from "../../shared/vendor/three-r180/three.module.js";
const local = new T.Vector3(),
  closest = new T.Vector3();
// Interaction code sees entities; managers retain type-specific rendering and data.
export class SceneEntities {
  constructor(lights, objects) {
    this.managers = { light: lights, object: objects };
  }
  get(id) {
    return (
      this.managers.light.records.get(id) ||
      this.managers.object.records.get(id)
    );
  }
  *values() {
    yield* this.managers.light.records.values();
    yield* this.managers.object.records.values();
  }
  create(kind, type) {
    return this.managers[kind].create(type);
  }
  duplicate(id) {
    const source = this.get(id);
    if (!source) return null;
    const data = structuredClone(source.data);
    data.id = globalThis.crypto.randomUUID();
    data.position = source.root.getWorldPosition(new T.Vector3()).toArray();
    data.rotation = source.root
      .getWorldQuaternion(new T.Quaternion())
      .normalize()
      .toArray();
    return this.managers[source.kind].create(data.type, data);
  }
  remove(id) {
    const r = this.get(id);
    if (r) this.managers[r.kind].remove(id);
  }
  fillTargets(targets) {
    for (const r of this.values())
      targets.push(r.kind === "light" ? r.root.userData.handle : r.root);
    return targets;
  }
  nearDistance(r, point) {
    if (r.kind === "light")
      return r.root.getWorldPosition(closest).distanceTo(point);
    local.copy(point);
    r.root.worldToLocal(local);
    closest
      .copy(local)
      .clamp(r.root.geometry.boundingBox.min, r.root.geometry.boundingBox.max);
    r.root.localToWorld(closest);
    return closest.distanceTo(point);
  }
}
