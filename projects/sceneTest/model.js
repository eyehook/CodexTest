export const VERSION = 2;
export const STORAGE_KEY = "codex.sceneTest.v1";
export const TYPES = ["point", "spot", "directional", "area"];
export const NAMES = {
  point: "Point Light",
  spot: "Spot Light",
  directional: "Directional Light",
  area: "Rectangular Area Light",
};
export const INTENSITY_MAX = {
  point: 200,
  spot: 1000,
  directional: 10,
  area: 30,
};
export const defaults = () => ({
  background: [128, 128, 128],
  ambientEnabled: true,
  ambientColor: [255, 255, 255],
  ambientIntensity: 0.3,
  hemisphereEnabled: false,
  skyColor: [180, 210, 255],
  groundColor: [145, 130, 115],
  hemisphereIntensity: 0.5,
  shadows: true,
  shadowResolution: 512,
  toneMapping: "Neutral",
  exposure: 1,
});
export function lightDefaults(type, id = globalThis.crypto.randomUUID()) {
  if (!TYPES.includes(type)) throw new Error("Unknown light type");
  return {
    id,
    type,
    position: [0, 1.4, -1.5],
    rotation: [0, 0, 0, 1],
    enabled: true,
    color: [255, 255, 255],
    intensity: { point: 20, spot: 100, directional: 2, area: 5 }[type],
    range: 0,
    angle: 30,
    penumbra: 0.2,
    width: 2,
    height: 2,
    shadows: false,
  };
}
export const OBJECT_TYPES = ["sphere", "cube", "cylinder", "pyramid"];
export const OBJECT_NAMES = {
  sphere: "Sphere",
  cube: "Cube",
  cylinder: "Cylinder",
  pyramid: "Pyramid",
};
export function objectDefaults(type, id = globalThis.crypto.randomUUID()) {
  if (!OBJECT_TYPES.includes(type)) throw new Error("Unknown primitive type");
  return {
    id,
    type,
    position: [0, 1.4, -1.5],
    rotation: [0, 0, 0, 1],
    scale: [1, 1, 1],
    allScale: 1,
    material: {
      type: "standard",
      color: [255, 255, 255],
      metalness: 0,
      roughness: 0.5,
    },
    castShadow: true,
    receiveShadow: true,
  };
}
export function setUniformScale(data, value) {
  if (!Number.isFinite(value) || value < 0.1 || value > 10)
    throw new RangeError("Invalid scale");
  data.allScale = value;
  data.scale = [value, value, value];
}
const finite = (v, min, max) =>
  typeof v === "number" && Number.isFinite(v) && v >= min && v <= max;
const vector = (v, n, min, max) =>
  Array.isArray(v) && v.length === n && v.every((x) => finite(x, min, max));
export function validateScene(raw) {
  if (!raw || ![1, VERSION].includes(raw.version) || !Array.isArray(raw.lights))
    throw new Error("Unsupported or invalid saved scene");
  const settings = raw.settings,
    base = defaults();
  if (!settings) throw new Error("Missing settings");
  for (const key of Object.keys(base)) {
    const v = settings[key];
    if (
      Array.isArray(base[key])
        ? !vector(v, 3, 0, 255)
        : typeof base[key] === "boolean"
          ? typeof v !== "boolean"
          : typeof base[key] === "number"
            ? !finite(v, 0, 2048)
            : typeof v !== "string"
    )
      throw new Error(`Invalid ${key}`);
  }
  if (
    ![256, 512, 1024, 2048].includes(settings.shadowResolution) ||
    !["None", "ACES Filmic", "Neutral"].includes(settings.toneMapping) ||
    !finite(settings.exposure, 0.1, 3) ||
    !finite(settings.ambientIntensity, 0, 3) ||
    !finite(settings.hemisphereIntensity, 0, 3)
  )
    throw new Error("Invalid render settings");
  const ids = new Set();
  const lights = raw.lights.map((v) => {
    if (
      !TYPES.includes(v.type) ||
      typeof v.id !== "string" ||
      !v.id ||
      ids.has(v.id)
    )
      throw new Error("Invalid light identity");
    ids.add(v.id);
    if (
      !vector(v.position, 3, -10000, 10000) ||
      !vector(v.rotation, 4, -1, 1) ||
      Math.abs(Math.hypot(...v.rotation) - 1) > 0.01 ||
      !vector(v.color, 3, 0, 255) ||
      typeof v.enabled !== "boolean" ||
      typeof v.shadows !== "boolean"
    )
      throw new Error("Invalid light transform or state");
    for (const [key, min, max] of [
      ["intensity", 0, INTENSITY_MAX[v.type]],
      ["range", 0, 30],
      ["angle", 5, 90],
      ["penumbra", 0, 1],
      ["width", 0.1, 6],
      ["height", 0.1, 6],
    ])
      if (!finite(v[key], min, max)) throw new Error(`Invalid light ${key}`);
    return {
      ...lightDefaults(v.type, v.id),
      ...v,
      shadows: v.type === "area" ? false : v.shadows,
    };
  });
  const objectData = raw.version === 1 ? (raw.objects ?? []) : raw.objects;
  if (!Array.isArray(objectData)) throw new Error("Invalid object collection");
  const objects = objectData.map((v) => {
    if (
      !v ||
      !OBJECT_TYPES.includes(v.type) ||
      typeof v.id !== "string" ||
      !v.id ||
      ids.has(v.id)
    )
      throw new Error("Invalid object identity");
    ids.add(v.id);
    if (
      !vector(v.position, 3, -10000, 10000) ||
      !vector(v.rotation, 4, -1, 1) ||
      Math.abs(Math.hypot(...v.rotation) - 1) > 0.01 ||
      !vector(v.scale, 3, 0.1, 10)
    )
      throw new Error("Invalid object transform");
    const m = v.material;
    if (
      !m ||
      m.type !== "standard" ||
      !vector(m.color, 3, 0, 255) ||
      !finite(m.metalness, 0, 1) ||
      !finite(m.roughness, 0, 1)
    )
      throw new Error("Invalid Standard material");
    if (
      typeof v.castShadow !== "boolean" ||
      typeof v.receiveShadow !== "boolean" ||
      !finite(v.allScale ?? 1, 0.1, 10)
    )
      throw new Error("Invalid object settings");
    return { ...objectDefaults(v.type, v.id), ...v, allScale: v.allScale ?? 1 };
  });
  return structuredClone({ version: VERSION, settings, lights, objects });
}
export function saveScene(storage, settings, lights, objects = []) {
  const snapshot = validateScene({
    version: VERSION,
    settings,
    lights,
    objects,
  });
  storage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  return snapshot;
}
export function loadScene(storage) {
  const saved = storage.getItem(STORAGE_KEY);
  return saved === null ? null : validateScene(JSON.parse(saved));
}
// New palette entities select; existing grabs preserve or clear selection.
export class InteractionState {
  selected = null;
  owners = new Map();
  select(id) {
    this.selected = id;
  }
  beginGrab(hand, id, created = false) {
    if (this.owners.has(hand) || [...this.owners.values()].includes(id))
      return false;
    if (created) this.selected = id;
    else if (this.selected !== id) this.selected = null;
    this.owners.set(hand, id);
    return true;
  }
  endGrab(hand) {
    const id = this.owners.get(hand);
    this.owners.delete(hand);
    return id;
  }
  remove(id) {
    if (this.selected === id) this.selected = null;
    for (const [hand, value] of this.owners)
      if (value === id) this.owners.delete(hand);
  }
  clear() {
    this.selected = null;
    this.owners.clear();
  }
}
