import * as T from "../../shared/vendor/three-r180/three.module.js";
import { objectDefaults } from "./model.js?v=m2-1";
import { createMaterial, applyMaterial } from "./materials.js?v=m2-1";
export function primitiveGeometry(type, preview = false) {
  switch (type) {
    case "sphere":
      return new T.SphereGeometry(0.25, preview ? 16 : 32, preview ? 12 : 20);
    case "cube":
      return new T.BoxGeometry(0.5, 0.5, 0.5);
    case "cylinder":
      return new T.CylinderGeometry(0.25, 0.25, 0.5, preview ? 16 : 32);
    case "pyramid":
      return new T.ConeGeometry(0.5 / Math.sqrt(2), 0.5, 4).rotateY(
        Math.PI / 4,
      );
    default:
      throw new Error("Unknown primitive");
  }
}
export class ObjectManager {
  constructor(scene, settings, interaction) {
    this.scene = scene;
    this.settings = settings;
    this.interaction = interaction;
    this.records = new Map();
    this.geometries = new Map();
  }
  create(type, data = objectDefaults(type)) {
    if (!this.geometries.has(type)) {
      const g = primitiveGeometry(type);
      g.computeBoundingBox();
      this.geometries.set(type, g);
    }
    const geometry = this.geometries.get(type),
      material = createMaterial(data.material);
    const root = new T.Mesh(geometry, material);
    const outline = new T.Mesh(
      geometry,
      new T.MeshBasicMaterial({
        wireframe: true,
        color: 0x59cfff,
        transparent: true,
        opacity: 0.8,
        depthWrite: false,
        toneMapped: false,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
      }),
    );
    outline.visible = false;
    outline.raycast = () => {};
    root.add(outline);
    const r = { kind: "object", data, root, outline, hovered: false };
    root.userData.record = r;
    root.position.fromArray(data.position);
    root.quaternion.fromArray(data.rotation).normalize();
    this.scene.add(root);
    this.records.set(data.id, r);
    this.apply(r);
    return r;
  }
  apply(r) {
    const d = r.data,
      m = r.root.material;
    applyMaterial(m, d.material);
    r.root.scale.fromArray(d.scale);
    r.root.castShadow = this.settings.shadows && d.castShadow;
    r.root.receiveShadow = d.receiveShadow;
  }
  update() {
    for (const r of this.records.values()) {
      let grabbed = false;
      for (const id of this.interaction.owners.values())
        if (id === r.data.id) {
          grabbed = true;
          break;
        }
      const selected = this.interaction.selected === r.data.id;
      r.outline.visible = grabbed || selected || r.hovered;
      if (r.outline.visible)
        r.outline.material.color.set(
          grabbed ? 0xff944d : selected ? 0x6effa4 : 0x59cfff,
        );
    }
  }
  serialize() {
    return [...this.records.values()].map((r) => ({
      ...r.data,
      position: r.root.getWorldPosition(new T.Vector3()).toArray(),
      rotation: r.root.getWorldQuaternion(new T.Quaternion()).toArray(),
      scale: [...r.data.scale],
    }));
  }
  remove(id) {
    const r = this.records.get(id);
    if (!r) return;
    r.root.removeFromParent();
    r.root.material.dispose();
    r.outline.material.dispose();
    this.records.delete(id);
    this.interaction.remove(id);
  }
  clear() {
    for (const id of [...this.records.keys()]) this.remove(id);
  }
  dispose() {
    this.clear();
    for (const g of this.geometries.values()) g.dispose();
    this.geometries.clear();
  }
}
