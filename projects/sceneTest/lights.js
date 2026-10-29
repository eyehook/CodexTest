import * as T from "three";
import { lightDefaults } from "./model.js";
const direction = new T.Vector3(0, 0, -1),
  world = new T.Vector3(),
  q = new T.Quaternion();
export function makeHelper(type, prototype = false) {
  const root = new T.Group();
  const material = new T.MeshBasicMaterial({
    color: 0xe5f4ff,
    toneMapped: false,
  });
  const handle = new T.Mesh(
    new T.SphereGeometry(prototype ? 0.07 : 0.09, 16, 12),
    material,
  );
  root.add(handle);
  root.userData.handle = handle;
  const lineMat = new T.LineBasicMaterial({
    color: 0xbdd6e7,
    toneMapped: false,
  });
  const vertices = [];
  const segment = (a, b) => vertices.push(...a, ...b);
  if (type === "spot") {
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2,
        b = ((i + 1) / 24) * Math.PI * 2;
      segment([Math.cos(a), Math.sin(a), -1], [Math.cos(b), Math.sin(b), -1]);
      if (i % 6 === 0) segment([0, 0, 0], [Math.cos(a), Math.sin(a), -1]);
    }
  }
  if (type === "directional" || type === "area") {
    segment([0, 0, 0], [0, 0, -0.45]);
    segment([0, 0, -0.45], [0.08, 0, -0.32]);
    segment([0, 0, -0.45], [-0.08, 0, -0.32]);
  }
  if (type === "area") {
    segment([-0.5, -0.5, 0], [0.5, -0.5, 0]);
    segment([0.5, -0.5, 0], [0.5, 0.5, 0]);
    segment([0.5, 0.5, 0], [-0.5, 0.5, 0]);
    segment([-0.5, 0.5, 0], [-0.5, -0.5, 0]);
  }
  if (type === "point") {
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3;
      segment(
        [Math.cos(a) * 0.12, Math.sin(a) * 0.12, 0],
        [Math.cos(a) * 0.2, Math.sin(a) * 0.2, 0],
      );
    }
  }
  const lines = new T.LineSegments(
    new T.BufferGeometry().setAttribute(
      "position",
      new T.Float32BufferAttribute(vertices, 3),
    ),
    lineMat,
  );
  root.add(lines);
  root.userData.lines = lines;
  return root;
}
export class LightManager {
  constructor(scene, settings, interaction) {
    this.scene = scene;
    this.settings = settings;
    this.interaction = interaction;
    this.records = new Map();
  }
  create(type, data = lightDefaults(type)) {
    const root = makeHelper(type),
      light =
        type === "point"
          ? new T.PointLight()
          : type === "spot"
            ? new T.SpotLight()
            : type === "directional"
              ? new T.DirectionalLight()
              : new T.RectAreaLight();
    root.position.fromArray(data.position);
    root.quaternion.fromArray(data.rotation).normalize();
    const record = { data, root, light, target: null, hovered: false };
    root.userData.record = record;
    root.userData.handle.userData.record = record;
    // Targets are world-space siblings; local -Z is the emitting direction for every oriented type.
    if (light.target) {
      record.target = light.target;
      this.scene.add(record.target);
    }
    this.scene.add(root, light);
    this.records.set(data.id, record);
    this.apply(record);
    return record;
  }
  apply(r) {
    const d = r.data,
      l = r.light;
    l.color.setRGB(...d.color.map((v) => v / 255), T.SRGBColorSpace);
    l.intensity = d.enabled ? d.intensity : 0;
    if ("distance" in l) {
      l.distance = d.range;
      l.decay = 2;
    }
    if (d.type === "spot") {
      l.angle = T.MathUtils.degToRad(d.angle);
      l.penumbra = d.penumbra;
      const radius = Math.sin(l.angle) * 0.6;
      r.root.userData.lines.scale.set(radius, radius, Math.cos(l.angle) * 0.6);
    }
    if (d.type === "area") {
      l.width = d.width;
      l.height = d.height;
      r.root.userData.lines.scale.set(d.width, d.height, 1);
    }
    if (l.shadow) {
      l.castShadow = this.settings.shadows && d.shadows && d.enabled;
      const res = this.settings.shadowResolution;
      if (l.shadow.mapSize.x !== res) {
        l.shadow.map?.dispose();
        l.shadow.map = null;
        l.shadow.mapSize.set(res, res);
      }
      l.shadow.bias = -0.0003;
      l.shadow.normalBias = 0.025;
      l.shadow.camera.near = 0.05;
      l.shadow.camera.far = d.type === "directional" ? 20 : 40;
      if (d.type === "directional")
        Object.assign(l.shadow.camera, {
          left: -5,
          right: 5,
          top: 5,
          bottom: -5,
        });
      l.shadow.camera.updateProjectionMatrix();
      l.shadow.needsUpdate = true;
    }
    this.sync(r);
  }
  sync(r) {
    r.root.getWorldPosition(world);
    r.light.position.copy(world);
    r.root.getWorldQuaternion(q);
    r.light.quaternion.copy(q);
    if (r.target)
      r.target.position.copy(direction).applyQuaternion(q).add(world);
  }
  update() {
    for (const r of this.records.values()) {
      this.sync(r);
      let grabbed = false;
      for (const id of this.interaction.owners.values())
        if (id === r.data.id) {
          grabbed = true;
          break;
        }
      r.root.userData.handle.material.color.set(
        grabbed
          ? 0xff944d
          : this.interaction.selected === r.data.id
            ? 0x6effa4
            : r.hovered
              ? 0x59cfff
              : 0xe5f4ff,
      );
      r.root.userData.lines.material.color.copy(
        r.root.userData.handle.material.color,
      );
    }
  }
  serialize() {
    return [...this.records.values()].map((r) => ({
      ...r.data,
      position: r.root.getWorldPosition(new T.Vector3()).toArray(),
      rotation: r.root.getWorldQuaternion(new T.Quaternion()).toArray(),
    }));
  }
  remove(id) {
    const r = this.records.get(id);
    if (!r) return;
    this.scene.remove(r.light);
    if (r.target) this.scene.remove(r.target);
    r.root.removeFromParent();
    r.root.traverse((o) => {
      o.geometry?.dispose();
      o.material?.dispose();
    });
    r.light.dispose?.();
    this.records.delete(id);
    this.interaction.remove(id);
  }
  clear() {
    for (const id of [...this.records.keys()]) this.remove(id);
  }
  handles() {
    return [...this.records.values()].map((r) => r.root.userData.handle);
  }
}
