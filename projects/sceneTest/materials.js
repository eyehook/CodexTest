import * as T from "../../shared/vendor/three-r180/three.module.js";
// Material model identifiers belong in scene data; factories can grow in later milestones.
export function applyMaterial(material, data) {
  if (data.type !== "standard") throw new Error("Unsupported material model");
  material.color.setRGB(...data.color.map((v) => v / 255), T.SRGBColorSpace);
  material.metalness = data.metalness;
  material.roughness = data.roughness;
  material.opacity = 1;
}
export function createMaterial(data) {
  const material = new T.MeshStandardMaterial();
  applyMaterial(material, data);
  return material;
}
