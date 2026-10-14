import * as THREE from './vendor/three.module.js';
import {GLTFLoader} from './vendor/GLTFLoader.js';
import {SIZE,wrap} from './forest-world.mjs';

export async function createButterflies(load=url=>new GLTFLoader().loadAsync(url)) {
 const gltf=await load('./butterflies/butterfly.glb');
 const root=gltf.scene, group=new THREE.Group(), mixer=new THREE.AnimationMixer(root);
 const clip=gltf.animations.find(a=>a.name==='Wing_Flap');
 if(!clip)throw new Error('Butterfly Wing_Flap animation is missing');
 // Blender exports frame 1 at 1/fps; shift to zero to avoid a pause at the seam.
 const start=Math.min(...clip.tracks.map(t=>t.times[0]));
 for(const track of clip.tracks)track.shift(-start);clip.resetDuration();
 mixer.clipAction(clip).play();
 const meshes=[];root.traverse(m=>{if(m.isMesh)meshes.push(m);});
 const entries=meshes.map(mesh=>{
  const geometry=mesh.geometry.clone();geometry.deleteAttribute('skinIndex');geometry.deleteAttribute('skinWeight');
  geometry.attributes.position.setUsage(THREE.DynamicDrawUsage);
  const instances=new THREE.InstancedMesh(geometry,mesh.material,16*9);
  instances.instanceMatrix.setUsage(THREE.DynamicDrawUsage);instances.frustumCulled=false;group.add(instances);
  return {mesh,geometry,instances};
 });
 const v=new THREE.Vector3(),object=new THREE.Object3D();let time=0;
 function update(dt){
  time+=dt;mixer.update(dt*2.5);root.updateMatrixWorld(true);
  for(const {mesh,geometry} of entries){
   if(mesh.isSkinnedMesh)mesh.skeleton.update();
   const pos=geometry.attributes.position;
   for(let i=0;i<pos.count;i++){
    v.fromBufferAttribute(mesh.geometry.attributes.position,i);
    if(mesh.isSkinnedMesh)mesh.applyBoneTransform(i,v);
    v.applyMatrix4(mesh.matrixWorld);pos.setXYZ(i,v.x,v.y,v.z);
   }
   pos.needsUpdate=true;geometry.computeVertexNormals();
  }
  let index=0;
  for(let tx=-1;tx<=1;tx++)for(let tz=-1;tz<=1;tz++)for(let i=0;i<16;i++){
   const phase=i*2.399, angle=time*(.18+(i%3)*.025)+phase;
   const cx=i===0?0:((i*7.13)%SIZE)-SIZE/2,cz=i===0?-3:((i*11.31)%SIZE)-SIZE/2;
   const radius=1.1+(i%4)*.3;
   object.position.set(wrap(cx+Math.cos(angle)*radius)+tx*SIZE,1.35+.45*Math.sin(angle*2+phase),wrap(cz+Math.sin(angle)*radius)+tz*SIZE);
   // Face the flight tangent (-sin(angle), 0, cos(angle)); the model faces -Z.
   object.rotation.set(.08*Math.sin(angle*3),Math.PI-angle, .14*Math.sin(angle*2));
   object.scale.setScalar(.65+(i%4)*.12);object.updateMatrix();
   for(const {instances} of entries)instances.setMatrixAt(index,object.matrix);
   index++;
  }
  for(const {instances} of entries)instances.instanceMatrix.needsUpdate=true;
 }
 update(0);return {group,update};
}
