import {fileURLToPath} from 'node:url';
import {createWorld, DEFAULTS} from '../../world.mjs';
import {snapshotWorld,restoreWorld} from '../../world-snapshot.mjs';
export {snapshotWorld,restoreWorld} from '../../world-snapshot.mjs';
import {fingerprintModules, loadDiskFixture} from './disk-cache.mjs';

const directory = process.env.HIKE_TEST_CACHE_DIR || fileURLToPath(new URL('../../.test-cache/', import.meta.url));
const generatorVersion = fingerprintModules(new URL('../../world.mjs', import.meta.url));
const schema = 'hike-world-fixture-v1';
export async function cachedWorld(options = {}) {
  if (process.env.HIKE_TEST_CACHE === 'off') return createWorld(options);
  const version = [schema, await generatorVersion, process.versions.v8, process.platform, process.arch].join(':');
  const entry = await loadDiskFixture({directory, version, configuration: {...DEFAULTS, ...options},
    build: () => snapshotWorld(createWorld(options))});
  return restoreWorld(entry.value);
}
