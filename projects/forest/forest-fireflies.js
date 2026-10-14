import * as THREE from './vendor/three.module.js';
import {SIZE,wrap} from './forest-world.mjs';

export function createFireflies() {
 const group=new THREE.Group(),count=16*9;
 // Unlit materials stay yellow at night without expensive per-insect lights.
 const core=new THREE.InstancedMesh(new THREE.SphereGeometry(.025,8,6),new THREE.MeshBasicMaterial({color:0xffed68,toneMapped:false,transparent:true}),count);
 const halo=new THREE.InstancedMesh(new THREE.SphereGeometry(.085,8,6),new THREE.MeshBasicMaterial({color:0xffdf40,toneMapped:false,transparent:true,opacity:.5,depthWrite:false}),count);
 for(const mesh of [core,halo]){mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.frustumCulled=false;group.add(mesh);}
 const object=new THREE.Object3D();let time=0;
 function update(dt,daylight=1) {
  time+=dt;
  const night=1-THREE.MathUtils.clamp(daylight,0,1);
  group.visible=night>0;core.material.opacity=night;halo.material.opacity=.5*night;
  if(!group.visible)return;
  let index=0;
  for(let tx=-1;tx<=1;tx++)for(let tz=-1;tz<=1;tz++)for(let i=0;i<16;i++){
   const phase=i*2.399,angle=time*(.18+(i%3)*.025)+phase;
   const cx=i===0?0:((i*7.13)%SIZE)-SIZE/2,cz=i===0?-3:((i*11.31)%SIZE)-SIZE/2,radius=1.1+(i%4)*.3;
   object.position.set(wrap(cx+Math.cos(angle)*radius)+tx*SIZE,1.35+.45*Math.sin(angle*2+phase),wrap(cz+Math.sin(angle)*radius)+tz*SIZE);
   object.scale.setScalar(.65+(i%4)*.12);object.updateMatrix();
   core.setMatrixAt(index,object.matrix);halo.setMatrixAt(index++,object.matrix);
  }
  core.instanceMatrix.needsUpdate=true;halo.instanceMatrix.needsUpdate=true;
 }
 update(0);return {group,core,halo,update};
}
