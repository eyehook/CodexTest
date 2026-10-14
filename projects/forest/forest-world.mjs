export const SIZE = 30.48; // Exactly 100 feet, in WebXR meters.
export function wrap(value) { return ((value + SIZE / 2) % SIZE + SIZE) % SIZE - SIZE / 2; }
export function dead(value) { return Math.abs(value) < .18 ? 0 : Math.sign(value) * (Math.abs(value) - .18) / .82; }
export function generateForest(seed = 84173) {
  let state = seed >>> 0;
  const random = () => ((state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 4294967296);
  const plants = [];
  for (let i = 0; i < 150; i++) {
    const x = (random() - .5) * SIZE, z = (random() - .5) * SIZE;
    if (Math.hypot(x, z) < 2.6) continue;
    const tree = i < 65;
    plants.push({x, z, kind: tree ? Math.floor(random() * 3) : 3 + Math.floor(random() * 2),
      size: tree ? .7 + random() * .65 : .5 + random() * .8, rotation: random() * Math.PI * 2, tint: random()});
  }
  return plants;
}
