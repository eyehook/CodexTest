export const RATINGS = [800, 1000, 1200, 1500, 1800, 2000, 2200];
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
export class Settings {
  constructor(storage) {
    try {
      this.storage = storage ?? globalThis.localStorage;
    } catch {
      this.storage = null;
    }
    let saved = {};
    try {
      saved =
        JSON.parse(this.storage?.getItem("codextest.chess.v1") || "{}") || {};
    } catch {}
    this.elo = RATINGS.includes(Number(saved.elo)) ? Number(saved.elo) : 1500;
    for (const [k, value, min, max] of [
      ["height", -0.35, -0.65, -0.1],
      ["distance", 0.65, 0.45, 1],
      ["offset", 0, -0.25, 0.25],
    ]) {
      this[k] = Number.isFinite(saved[k]) ? clamp(saved[k], min, max) : value;
    }
  }
  save() {
    try {
      this.storage.setItem(
        "codextest.chess.v1",
        JSON.stringify({
          elo: this.elo,
          height: this.height,
          distance: this.distance,
          offset: this.offset,
        }),
      );
    } catch {}
  }
}
export function effectiveElo(requested, range) {
  if (!RATINGS.includes(Number(requested)))
    throw new Error("Unsupported rating selection");
  if (
    !range ||
    !Number.isFinite(range.min) ||
    !Number.isFinite(range.max) ||
    range.min > range.max
  )
    throw new Error("Engine did not advertise a valid UCI_Elo range");
  return clamp(Number(requested), range.min, range.max);
}
