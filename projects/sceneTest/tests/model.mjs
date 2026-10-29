import { test } from "node:test";
import assert from "node:assert/strict";
import {
  defaults,
  lightDefaults,
  TYPES,
  InteractionState,
  saveScene,
  loadScene,
  STORAGE_KEY,
  validateScene,
} from "../model.js";
const storage = () => {
  const data = new Map();
  return {
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => data.set(k, v),
  };
};
test("four types use specified defaults and unique stable identities", () => {
  const lights = TYPES.map((t) => lightDefaults(t));
  assert.deepEqual(
    lights.map((l) => l.intensity),
    [20, 100, 2, 5],
  );
  assert.equal(new Set(lights.map((l) => l.id)).size, 4);
  lights.forEach((l) => {
    assert.equal(l.enabled, true);
    assert.equal(l.shadows, false);
    assert.equal(l.range, 0);
  });
});
test("grabbing selects immediately and enforces two-hand ownership", () => {
  const state = new InteractionState();
  state.select("a");
  assert.equal(state.beginGrab("right", "a"), true);
  assert.equal(state.selected, "a");
  assert.equal(state.beginGrab("left", "a"), false);
  state.endGrab("right");
  state.beginGrab("left", "b");
  assert.equal(state.selected, "b");
  state.select("a");
  state.remove("b");
  assert.equal(state.owners.size, 0);
  assert.equal(state.selected, "a");
  state.clear();
  assert.equal(state.selected, null);
});
test("save/load round-trips all light types, world transforms and scene settings", () => {
  const s = storage(),
    settings = defaults(),
    lights = TYPES.map((t) => lightDefaults(t));
  settings.shadows = false;
  settings.toneMapping = "ACES Filmic";
  lights[1].shadows = true;
  lights[2].position = [1, 2, 3];
  lights[3].width = 4;
  saveScene(s, settings, lights);
  const restored = loadScene(s);
  assert.deepEqual(restored, { version: 1, settings, lights });
  assert.equal(restored.lights[1].shadows, true);
  assert.equal(restored.settings.shadows, false);
});
test("resetting live state never changes explicit save", () => {
  const s = storage(),
    settings = defaults(),
    lights = [lightDefaults("spot")];
  saveScene(s, settings, lights);
  settings.exposure = 2;
  lights.length = 0;
  Object.assign(settings, defaults());
  assert.equal(loadScene(s).lights.length, 1);
  assert.equal(loadScene(s).settings.exposure, 1);
});
test("startup without saved data returns null; malformed/versioned data rejected", () => {
  const s = storage();
  assert.equal(loadScene(s), null);
  s.setItem(STORAGE_KEY, "broken");
  assert.throws(() => loadScene(s));
  assert.throws(() =>
    validateScene({ version: 99, settings: defaults(), lights: [] }),
  );
});
test("invalid or duplicate transforms are rejected before restoration", () => {
  const light = lightDefaults("point");
  const raw = { version: 1, settings: defaults(), lights: [light] };
  light.rotation = [0, 0, 0, 0];
  assert.throws(() => validateScene(raw));
  light.rotation = [0, 0, 0, 1];
  raw.lights.push({ ...light });
  assert.throws(() => validateScene(raw));
  raw.lights.pop();
  light.intensity = NaN;
  assert.throws(() => validateScene(raw));
});
