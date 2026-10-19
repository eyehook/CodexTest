import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {GLTFLoader} from '../../projects/forest/vendor/GLTFLoader.js';
import {Box3,Vector3,Group,Object3D} from '../../projects/forest/vendor/three.module.js';
import {defaults,terrainHeight} from '../../src/fishing/height.mjs';
import {lighthouseSite} from '../../src/fishing/lighthouse-placement.mjs';
test('lighthouse is deterministic, elevated, near spawn and real water',()=>{
 const site=lighthouseSite(defaults);assert.deepEqual(site,lighthouseSite(defaults));
 assert.ok(site.distance<240);assert.ok(site.y>defaults.amplitude*0.1+5);assert.ok(site.shoreDistance<=108);
 assert.ok(Array.from({length:16},(_,i)=>terrainHeight(site.x+Math.cos(i*Math.PI/8)*site.shoreDistance,site.z+Math.sin(i*Math.PI/8)*site.shoreDistance,defaults)).some(h=>h<=defaults.amplitude*0.1));
});
test('updated model anchors its Base to terrain while retaining geometry below it',async()=>{
 const bytes=readFileSync(new URL('../../src/fishing/assets/Lighthouse.glb',import.meta.url));
 const {scene:model}=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
 const {anchorLighthouse,Lighthouse}=await import('../../src/fishing/Lighthouse.js');
 const offset=anchorLighthouse(model),group=new Group();group.add(model);
 const landmark=Object.assign(Object.create(Lighthouse.prototype),{model,group,anchorOffset:offset,config:{...defaults}});
 for(const [x,z,ground] of [[0,0,0],[100,-30,12],[1e9,-1e9,25]]){
  landmark.relocate();landmark.update(x,z,ground);group.updateMatrixWorld(true);
  const base=model.getObjectByName('Base').getWorldPosition(new Vector3());
  assert.ok(Math.abs(base.x-(landmark.site.x-x))<1e-6);
  assert.ok(Math.abs(base.z-(landmark.site.z-z))<1e-6);
  assert.ok(Math.abs(base.y-(terrainHeight(landmark.site.x,landmark.site.z,defaults)-ground))<1e-8);
  assert.ok(new Box3().setFromObject(model).min.y<base.y-0.1);
 }
 assert.equal(model.scale.y,2);assert.equal(group.children.length,1);
});
test('Base anchoring respects transformed parent nodes and rejects a missing marker',async()=>{
 const {anchorLighthouse}=await import('../../src/fishing/Lighthouse.js');
 const model=new Group(),parent=new Group(),base=new Object3D();base.name='Base';
 parent.position.set(3,4,5);parent.rotation.y=0.7;parent.scale.setScalar(1.5);base.position.set(1,2,3);parent.add(base);model.add(parent);
 anchorLighthouse(model);assert.ok(base.getWorldPosition(new Vector3()).length()<1e-10);
 assert.throws(()=>anchorLighthouse(new Group()),/missing its Base/);
});
test('flat terrain retains a finite fallback site',()=>{
 const site=lighthouseSite({...defaults,amplitude:0});assert.ok(Number.isFinite(site.y));
});
