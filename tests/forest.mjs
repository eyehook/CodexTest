import assert from 'node:assert/strict';
import {SIZE,wrap,generateForest,dead} from '../projects/forest/forest-world.mjs';
assert.equal(SIZE,100*.3048);
for(const x of [-1000,-30.48,-15.24,-.1,0,14.99,15.24,1000]){
 assert.ok(wrap(x)>=-SIZE/2&&wrap(x)<SIZE/2);
 for(const n of [-10,-1,1,10])assert.ok(Math.abs(wrap(wrap(x+n*SIZE)-wrap(x)))<1e-10);
}
assert.deepEqual(generateForest(),generateForest());
assert.equal(new Set(generateForest().map(p=>p.kind)).size,5);
assert.ok(generateForest().every(p=>Math.hypot(p.x,p.z)>=2.6&&p.size>0));
assert.equal(dead(.1),0);assert.ok(Math.abs(dead(1)-1)<1e-12);
console.log('Forest: exact dimensions, bidirectional wrapping, reproducible planting, five species, clear spawn, and input deadzone pass.');
