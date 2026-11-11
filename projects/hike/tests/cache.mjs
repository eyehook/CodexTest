import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, rm, writeFile, readFile, stat, utimes} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {setTimeout as delay} from 'node:timers/promises';
import {serialize, deserialize} from 'node:v8';
import {fingerprintModules, fixtureKey, loadDiskFixture} from './helpers/disk-cache.mjs';

async function temporary(t) {
  const directory = await mkdtemp(join(tmpdir(), 'hike-test-cache-'));
  t.after(() => rm(directory, {recursive: true, force: true}));
  return directory;
}

test('generation fingerprints include transitive sources but ignore renderer edits and timestamps', async t => {
  const directory = await temporary(t), entry = pathToFileURL(join(directory, 'world.mjs'));
  await writeFile(entry, "import './generation.mjs?v=1';\n");
  await writeFile(join(directory, 'generation.mjs'), "export {value} from './vendor.mjs';\n");
  await writeFile(join(directory, 'vendor.mjs'), 'export const value=1;\n');
  await writeFile(join(directory, 'renderer.mjs'), 'const triangles=200000;\n');
  const before = await fingerprintModules(entry);
  await writeFile(join(directory, 'renderer.mjs'), 'const triangles=300000;\n');
  await utimes(entry, new Date(0), new Date(0));
  assert.equal(await fingerprintModules(entry), before);
  await writeFile(join(directory, 'vendor.mjs'), 'export const value=2;\n');
  const vendorChange = await fingerprintModules(entry);
  assert.notEqual(vendorChange, before);
  await writeFile(join(directory, 'generation.mjs'), "export {value} from './vendor.mjs';\n// new generation\n");
  assert.notEqual(await fingerprintModules(entry), vendorChange);
});

test('fixtures reuse typed data and references; settings and generation changes rebuild them', async t => {
  const directory = await temporary(t); let builds = 0;
  const build = () => {
    builds++;
    const triangle = [0, 1, 2];
    return {heights: new Float32Array([1, 2, 3]), triangle, cells: new Map([['a', [triangle]]])};
  };
  const args = {directory, version: 'v1', configuration: {seed: 1, end: {x: 3, z: 4}}, build};
  const first = await loadDiskFixture(args);
  assert.equal(first.hit, false);
  first.value.heights[0] = 99;
  const second = await loadDiskFixture({...args, configuration: {end: {z: 4, x: 3}, seed: 1}});
  assert.equal(second.hit, true); assert.equal(builds, 1);
  assert.equal(second.value.heights[0], 1);
  assert.equal(second.value.cells.get('a')[0], second.value.triangle);
  await loadDiskFixture({...args, configuration: {...args.configuration, seed: 2}});
  assert.equal(builds, 2);
  const updated = await loadDiskFixture({...args, version: 'v2'});
  assert.equal(updated.file, first.file, 'replace stale generation rather than accumulate copies');
  assert.equal(updated.hit, false); assert.equal(builds, 3);
});

test('concurrent fixture requests share one build and never read partial output', async t => {
  const directory = await temporary(t); let builds = 0;
  const args = {directory, version: 'v1', configuration: {seed: 3}, build: async () => {
    builds++; await delay(80); return {complete: true};
  }};
  const results = await Promise.all([loadDiskFixture(args), loadDiskFixture(args), loadDiskFixture(args)]);
  assert.equal(builds, 1);
  assert.equal(results.filter(r => !r.hit).length, 1);
  for (const result of results) assert.equal(result.value.complete, true);
});

test('corrupt entries and abandoned locks recover; failed builds release their lock', async t => {
  const directory = await temporary(t); let builds = 0;
  const args = {directory, version: 'v1', configuration: {seed: 9}, build: () => ({build: ++builds})};
  const first = await loadDiskFixture(args);
  await writeFile(first.file, 'truncated');
  assert.equal((await loadDiskFixture(args)).value.build, 2);
  const entry = deserialize(await readFile(first.file)); entry.payload[0] ^= 255;
  await writeFile(first.file, serialize(entry));
  assert.equal((await loadDiskFixture(args)).value.build, 3);
  await rm(first.file);
  const lock = join(directory, fixtureKey(args.configuration) + '.bin.lock');
  await writeFile(lock, ''); await utimes(lock, new Date(0), new Date(0));
  assert.equal((await loadDiskFixture(args)).value.build, 4);
  await rm(first.file);
  await assert.rejects(loadDiskFixture({...args, build: () => { throw new Error('generation failed'); }}), /generation failed/);
  await assert.rejects(stat(lock), {code: 'ENOENT'});
  assert.equal((await loadDiskFixture(args)).value.build, 5);
});
