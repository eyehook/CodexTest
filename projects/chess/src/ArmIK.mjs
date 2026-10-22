import { Vector3 } from "../../forest/vendor/three.module.js";
// Analytic, geometry-independent two-bone solver. A fixed pole stabilizes elbow bend.
export function solveArm(
  shoulder,
  target,
  {
    upper = 0.42,
    lower = 0.4,
    pole = new Vector3(0.35, -0.25, -0.5),
    minBend = 15,
    maxBend = 155,
  } = {},
) {
  const direction = target.clone().sub(shoulder);
  const raw = direction.length();
  if (raw < 1e-8) direction.set(0, -1, 0);
  else direction.divideScalar(raw);
  const lengthAt = (bend) =>
    Math.sqrt(
      upper * upper +
        lower * lower +
        2 * upper * lower * Math.cos((bend * Math.PI) / 180),
    );
  const distance = Math.max(
    lengthAt(maxBend),
    Math.min(lengthAt(minBend), raw),
  );
  const hand = shoulder.clone().addScaledVector(direction, distance);
  const along =
    (upper * upper - lower * lower + distance * distance) / (2 * distance);
  const perpendicular = pole
    .clone()
    .addScaledVector(direction, -pole.dot(direction));
  if (perpendicular.lengthSq() < 1e-8) {
    perpendicular.set(0, 1, 0).addScaledVector(direction, -direction.y);
    if (perpendicular.lengthSq() < 1e-8) perpendicular.set(1, 0, 0);
  }
  perpendicular.normalize();
  const elbow = shoulder
    .clone()
    .addScaledVector(direction, along)
    .addScaledVector(
      perpendicular,
      Math.sqrt(Math.max(0, upper * upper - along * along)),
    );
  return {
    shoulder: shoulder.clone(),
    elbow,
    hand,
    clamped: Math.abs(raw - distance) > 0.0001,
  };
}
