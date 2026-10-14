import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {GLTFLoader} from '../projects/forest/vendor/GLTFLoader.js';
import {createAnimatedTrees} from '../projects/forest/forest-trees.js';
import {generateForest} from '../projects/forest/forest-world.mjs';
const trees=await createAnimatedTrees(generateForest(),async url=>{
 const bytes=await readFile(new URL('../projects/forest/'+url,import.meta.url));
 return new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
});
assert.equal(trees.group.children.length,9);
const initial=trees.group.children.map(m=>Array.from(m.geometry.attributes.position.array));
trees.update(.5);
assert.ok(trees.group.children.some((m,i)=>m.geometry.attributes.position.array.some((x,j)=>Math.abs(x-initial[i][j])>1e-5)));
for(let frame=0;frame<60;frame++)trees.update(1/30);
for(const mesh of trees.group.children){
 assert.ok(mesh.geometry.attributes.position.array.every(Number.isFinite));
 assert.ok(mesh.geometry.attributes.normal.array.every(Number.isFinite));
 assert.ok(mesh.count>0&&mesh.count%9===0);
}
console.log('All three GLBs load; nine material batches animate with finite vertices/normals and repeated instances.');
