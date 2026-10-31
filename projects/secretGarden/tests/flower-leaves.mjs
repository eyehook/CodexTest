import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../../shared/vendor/three-r180/three.module.js';
import {generatePlant,componentPose} from '../generator.mjs';
import {PlantRenderer} from '../renderer.mjs';
test('flower leaves branch 0–60 degrees from their supporting stems with seed variation',()=>{
 let leaves=0,min=Infinity,max=0;
 for(let seed=0;seed<1200;seed++){const p=generatePlant(seed);if(p.parameters.form!=='flower')continue;
 for(const leaf of p.parts.filter(p=>p.kind==='leaf')){const stem=p.parts[leaf.parent],axis=new THREE.Vector3().fromArray(stem.end).sub(new THREE.Vector3().fromArray(stem.start)).normalize(),direction=new THREE.Vector3().fromArray(leaf.direction),angle=axis.angleTo(direction);assert.ok(Math.abs(direction.length()-1)<1e-9);assert.ok(angle>=0&&angle<=Math.PI/3+1e-9);min=Math.min(min,angle);max=Math.max(max,angle);leaves++;}}
 assert.ok(leaves>1000&&min<.02&&max>1);
});
test('rendered diamond bases stay attached throughout growth and tips follow stored direction',()=>{
 const r=new PlantRenderer(new THREE.Scene());let checked=0;
 for(let seed=0;seed<100&&checked<8;seed++){const p=generatePlant(seed);if(p.parameters.form!=='flower')continue;checked++;const instance={structure:p,visual:r.create(p,new THREE.Vector3(),seed)};
 for(const age of [2,4,7,10]){r.update(instance,age);const poses=componentPose(p,age);for(const batch of instance.visual.batches.filter(b=>b.key.startsWith('leaf')))batch.entries.forEach(({part},i)=>{if(poses[part.id].growth<1e-6)return;const m=new THREE.Matrix4();batch.mesh.getMatrixAt(i,m);const base=new THREE.Vector3().applyMatrix4(m),tip=new THREE.Vector3(0,1,0).applyMatrix4(m);assert.ok(base.distanceTo(new THREE.Vector3().fromArray(poses[part.id].anchor))<1e-6);assert.ok(tip.sub(base).normalize().distanceTo(new THREE.Vector3().fromArray(part.direction))<1e-5);});}
 r.remove(instance.visual);}assert.equal(checked,8);r.dispose();
});

test('the attached flower-leaf base is the smallest-angle diamond corner in all three shapes',()=>{
 const r=new PlantRenderer(new THREE.Scene());for(let shape=0;shape<3;shape++){const positions=r.geometries['leafFlower'+shape].attributes.position,outline=[0,1,3,4].map(i=>new THREE.Vector3().fromBufferAttribute(positions,i));const angles=outline.map((point,i)=>outline[(i+3)%4].clone().sub(point).angleTo(outline[(i+1)%4].clone().sub(point)));assert.deepEqual(outline[0].toArray(),[0,0,0]);assert.ok(angles[0]<Math.PI/2);for(const angle of angles.slice(1))assert.ok(angles[0]<angle,'stem attachment must use the sharpest corner');}r.dispose();
});
