import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  RATINGS,
  Settings,
  effectiveElo,
} from "../../projects/chess/src/Settings.mjs";
test("launcher and settings offer exactly 1350–2000 by 50, with 1500 default", () => {
  const expected = [
    1350, 1400, 1450, 1500, 1550, 1600, 1650, 1700, 1750, 1800, 1850, 1900,
    1950, 2000,
  ];
  assert.deepEqual(RATINGS, expected);
  const html = readFileSync(
    new URL("../../projects/chess/index.html", import.meta.url),
    "utf8",
  );
  const options = html.match(/<select id="elo">([\s\S]*?)<\/select>/)[1];
  assert.deepEqual(
    [...options.matchAll(/<option(?: selected)?>(\d+)<\/option>/g)].map((m) =>
      Number(m[1]),
    ),
    expected,
  );
  assert.match(options, /<option selected>1500<\/option>/);
  assert.equal(new Settings({ getItem: () => null }).elo, 1500);
  for (const elo of expected) {
    const settings = new Settings({ getItem: () => JSON.stringify({ elo }) });
    assert.equal(settings.elo, elo);
    assert.equal(effectiveElo(elo, { min: 1320, max: 3190 }), elo);
  }
  for (const elo of [800, 1000, 1200, 1300, 1375, 2050, 2200])
    assert.equal(
      new Settings({ getItem: () => JSON.stringify({ elo }) }).elo,
      1500,
    );
});
