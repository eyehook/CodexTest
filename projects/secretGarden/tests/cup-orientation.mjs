import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../../shared/vendor/three-r180/three.module.js';
import {generatePlant,BLOOM_FORMS,componentPose} from '../generator.mjs';
import {PlantRenderer} from '../renderer.mjs';
import {flowerLandings} from '../bees.mjs';
test('all standalone blooms and bee landing normals follow their supporting stems',()=>{
 let flowers=0;const shapes=new Set();
 for(let seed=0;seed<1200;seed++){const p=generatePlant(seed);if(p.parameters.form!=='flower')continue;shapes.add(p.parameters.bloomForm);
 const yaw=.9,rotation=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),yaw),landings=flowerLandings({id:seed,state:'mature',structure:p,position:new THREE.Vector3(1,0,-1),rotationY:yaw,scale:1.2});
 for(const f of p.parts.filter(p=>p.kind==='flower')){flowers++;const stem=p.parts[f.parent],direction=new THREE.Vector3().fromArray(stem.end).sub(new THREE.Vector3().fromArray(stem.start)).normalize();assert.ok(direction.distanceTo(new THREE.Vector3().fromArray(f.normal))<1e-9);const landing=landings.find(l=>l.partId===f.id);assert.ok(direction.applyQuaternion(rotation).distanceTo(landing.normal)<1e-9);}
 }assert.deepEqual([...shapes].sort(),BLOOM_FORMS.map(form=>form.name).sort());assert.ok(flowers>100);
});
test('rendered cup opening axis matches the corrected stem axis for the sideways seed',()=>{
 const p=generatePlant(9),r=new PlantRenderer(new THREE.Scene()),instance={structure:p,visual:r.create(p,new THREE.Vector3(),1)};r.update(instance,10);const flower=p.parts.find(p=>p.kind==='flower'),batch=instance.visual.batches.find(b=>b.key==='petal'+flower.shape),positions=batch.mesh.geometry.attributes.position,tip=new THREE.Vector3().fromBufferAttribute(positions,positions.count-1),mean=new THREE.Vector3();let count=0;
 batch.entries.forEach((entry,i)=>{if(entry.part.id!==flower.id)return;const matrix=new THREE.Matrix4();batch.mesh.getMatrixAt(i,matrix);mean.add(tip.clone().applyMatrix4(matrix));count++;});mean.divideScalar(count).sub(new THREE.Vector3().fromArray(componentPose(p,10)[flower.id].anchor)).normalize();assert.ok(mean.distanceTo(new THREE.Vector3().fromArray(flower.normal))<1e-5);r.remove(instance.visual);r.dispose();
});
