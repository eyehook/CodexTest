import assert from 'node:assert/strict';
import {createFireflies} from '../projects/forest/forest-fireflies.js';
import {SIZE} from '../projects/forest/forest-world.mjs';
const f=createFireflies();assert.equal(f.group.visible,false);
f.update(.1,0);assert.equal(f.group.visible,true);assert.equal(f.core.material.opacity,1);assert.equal(f.halo.material.opacity,.5);
assert.ok(f.halo.geometry.parameters.radius>f.core.geometry.parameters.radius);
assert.equal(f.halo.material.depthWrite,false);assert.equal(f.core.material.toneMapped,false);
for(const m of [f.core,f.halo]){assert.equal(m.count,144);assert.ok(m.instanceMatrix.array.every(Number.isFinite));}
assert.deepEqual(f.core.instanceMatrix.array,f.halo.instanceMatrix.array);
const before=Array.from(f.core.instanceMatrix.array);f.update(.5,0);assert.notDeepEqual(Array.from(f.core.instanceMatrix.array),before);
const matrices=f.core.instanceMatrix.array;assert.ok(Math.abs(matrices[16*16+14]-matrices[14]-SIZE)<1e-5);
f.update(0,.5);assert.equal(f.core.material.opacity,.5);assert.equal(f.halo.material.opacity,.25);
f.update(0,1);assert.equal(f.group.visible,false);
console.log('Fireflies: nested spheres, 50% nighttime halo, aligned animated wrapped instances, and daylight fade pass.');
