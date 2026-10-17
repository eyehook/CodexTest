import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {GLTFLoader} from '../../projects/forest/vendor/GLTFLoader.js';
import {Box3,Vector3} from '../../projects/forest/vendor/three.module.js';
import {defaults,terrainHeight} from '../../src/fishing/height.mjs';
import {lighthouseSite,foundationBounds} from '../../src/fishing/lighthouse-placement.mjs';
test('lighthouse is deterministic, elevated, near spawn and real water',()=>{
 const site=lighthouseSite(defaults);assert.deepEqual(site,lighthouseSite(defaults));
 assert.ok(site.distance<240);assert.ok(site.y>defaults.amplitude*0.1+5);assert.ok(site.shoreDistance<=108);
 assert.ok(Array.from({length:16},(_,i)=>terrainHeight(site.x+Math.cos(i*Math.PI/8)*site.shoreDistance,site.z+Math.sin(i*Math.PI/8)*site.shoreDistance,defaults)).some(h=>h<=defaults.amplitude*0.1));
});
test('doubled model loads and foundation bridges its entire footprint',async()=>{
 const bytes=readFileSync(new URL('../../src/fishing/assets/Lighthouse.glb',import.meta.url));
 const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
 gltf.scene.scale.setScalar(2);
 const size=new Box3().setFromObject(gltf.scene).getSize(new Vector3());assert.ok(size.y>16&&size.y<17);
 const site=lighthouseSite(defaults),width=Math.max(size.x,size.z)+1.5,b=foundationBounds(site,width,defaults);assert.ok(b.needed);
 for(let i=0;i<=30;i++)for(let j=0;j<=30;j++){
  const h=terrainHeight(site.x+width*(i/30-0.5),site.z+width*(j/30-0.5),defaults);assert.ok(b.top>=h);assert.ok(b.bottom<h);
 }
});
test('flat terrain remains finite without a needless foundation',()=>{
 const config={...defaults,amplitude:0},site=lighthouseSite(config),b=foundationBounds(site,6,config);assert.ok(Number.isFinite(site.y));assert.equal(b.needed,false);
});
