import {createHash, randomUUID} from 'node:crypto';
import {readFile, writeFile, mkdir, open, rename, rm, stat} from 'node:fs/promises';
import {dirname, relative, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {serialize, deserialize} from 'node:v8';
import {setTimeout as delay} from 'node:timers/promises';

const digest = bytes => createHash('sha256').update(bytes).digest('hex');

// Follow literal local imports/re-exports, including vendored dependencies.
// Renderer files are deliberately absent from the generation entry's graph.
export async function fingerprintModules(entry) {
  const files = new Map();
  async function visit(url) {
    url = new URL(url);
    url.search = ''; url.hash = '';
    const path = fileURLToPath(url);
    if (files.has(path)) return;
    files.set(path, null);
    const source = await readFile(path, 'utf8');
    files.set(path, source);
    const imports = /\b(?:from\s*|import\s*(?:\(\s*)?)['"](\.[^'"]+)['"]/g;
    for (const match of source.matchAll(imports)) await visit(new URL(match[1], url));
  }
  await visit(entry);
  const base = dirname(fileURLToPath(entry)), hash = createHash('sha256');
  for (const path of [...files.keys()].sort()) {
    hash.update(relative(base, path)); hash.update('\0');
    hash.update(files.get(path)); hash.update('\0');
  }
  return hash.digest('hex');
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  }
  return value;
}

export function fixtureKey(configuration) {
  return digest(serialize(canonical(configuration)));
}

async function readEntry(file, version, key) {
  try {
    const entry = deserialize(await readFile(file));
    if (entry.version !== version || entry.key !== key || !Buffer.isBuffer(entry.payload)) return null;
    if (digest(entry.payload) !== entry.checksum) return null;
    return {value: deserialize(entry.payload), hit: true, file};
  } catch (error) {
    // Missing/truncated/unreadable serialized entries are rebuilt. Filesystem
    // permission failures are not evidence that the generator should run.
    if (error.code && error.code !== 'ENOENT') throw error;
    return null;
  }
}

async function removeAbandonedLock(lock) {
  try {
    const info = await stat(lock), owner = JSON.parse(await readFile(lock, 'utf8'));
    if (Number.isInteger(owner.pid) && owner.pid > 0) {
      try { process.kill(owner.pid, 0); }
      catch (error) { if (error.code === 'ESRCH') await rm(lock, {force: true}); }
    } else if (Date.now() - info.mtimeMs > 120000) await rm(lock, {force: true});
  } catch (error) {
    if (error.code === 'ENOENT') return;
    // A process may still be writing its owner record. Recover an empty record
    // left by a crashed writer only after the normal lock timeout.
    if (error instanceof SyntaxError) {
      const info = await stat(lock).catch(() => null);
      if (info && Date.now() - info.mtimeMs > 120000) await rm(lock, {force: true});
    } else throw error;
  }
}

export async function loadDiskFixture({directory, version, configuration, build}) {
  const key = fixtureKey(configuration), file = join(directory, key + '.bin');
  let entry = await readEntry(file, version, key);
  if (entry) return entry;
  await mkdir(directory, {recursive: true});
  const lock = file + '.lock', deadline = Date.now() + 120000;
  let handle;
  while (!handle) {
    try { handle = await open(lock, 'wx'); }
    catch (error) {
      if (error.code !== 'EEXIST') throw error;
      entry = await readEntry(file, version, key);
      if (entry) return entry;
      await removeAbandonedLock(lock);
      if (Date.now() > deadline) throw new Error('Timed out waiting for Hike test fixture: ' + lock);
      await delay(40);
    }
  }
  let temporary;
  try {
    await handle.writeFile(JSON.stringify({pid: process.pid}));
    // A different test process may have filled the cache while we waited.
    entry = await readEntry(file, version, key);
    if (entry) return entry;
    const value = await build(), payload = serialize(value);
    const bytes = serialize({version, key, checksum: digest(payload), payload});
    temporary = file + '.' + process.pid + '.' + randomUUID() + '.tmp';
    await writeFile(temporary, bytes, {flag: 'wx'});
    await rename(temporary, file);
    return {value, hit: false, file};
  } finally {
    if (temporary) await rm(temporary, {force: true});
    await handle.close();
    await rm(lock, {force: true});
  }
}
