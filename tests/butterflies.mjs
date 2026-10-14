import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from '../projects/forest/vendor/three.module.js';
import {GLTFLoader} from '../projects/forest/vendor/GLTFLoader.js';
import {createButterflies} from '../projects/forest/forest-butterflies.js';
const bytes=await readFile(new URL('../projects/forest/butterflies/butterfly.glb',import.meta.url));
const load=()=>new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
const gltf=await load(),clip=gltf.animations[0];assert.equal(clip.name,'Wing_Flap');
assert.ok(Math.abs(clip.duration-clip.tracks[0].times[0]-.8)<1e-5);
for(const track of clip.tracks){const n=track.getValueSize();for(let j=0;j<n;j++)assert.ok(Math.abs(track.values[j]-track.values[track.values.length-n+j])<1e-5);}
const bones=[];gltf.scene.traverse(o=>{if(o.isBone)bones.push(o.name);});assert.equal(bones.length,5);
const b=await createButterflies(load);assert.equal(b.group.children.length,4);
const initial=Array.from(b.group.children[0].geometry.attributes.position.array);
b.update(.08);assert.ok(b.group.children[0].geometry.attributes.position.array.some((x,i)=>Math.abs(x-initial[i])>1e-5));
for(let i=0;i<120;i++)b.update(1/60);
for(const m of b.group.children){assert.equal(m.count,144);assert.ok(m.geometry.attributes.position.array.every(Number.isFinite));assert.ok(m.instanceMatrix.array.every(Number.isFinite));}
console.log('Butterfly: five bones, closed 0.8-second flap, changing skinned vertices, finite flight transforms, and 16 × 9 wrapped copies pass.');

b.update(0,0);assert.equal(b.group.visible,false);
b.update(0,.5);assert.equal(b.group.visible,true);for(const m of b.group.children)assert.equal(m.material.opacity,.5);
b.update(0,1);for(const m of b.group.children)assert.equal(m.material.opacity,1);
console.log('Butterflies hide at night and fade back with daylight.');
