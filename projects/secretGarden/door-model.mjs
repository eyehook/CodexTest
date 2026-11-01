import * as THREE from '../../shared/vendor/three-r180/three.module.js';
import {doorModel} from '../../assets/secretGarden/door/door-model.mjs?v=115';
import {HALL_WIDTH,DOOR_Z} from './garden-layout.mjs?v=46';

// Geometry, materials and hierarchy are exported from the editable Blender source.
export function createDoorModel(scene){
 const materials=doorModel.materials.map(m=>new THREE.MeshStandardMaterial({name:m.name,color:new THREE.Color().fromArray(m.color),roughness:m.roughness,metalness:m.metalness,opacity:m.opacity,transparent:m.opacity<1,emissive:new THREE.Color().fromArray(m.emissive??[0,0,0]),emissiveIntensity:m.emissiveIntensity??1}));
 const root=new THREE.Group();root.name='Blender door assembly';root.position.z=DOOR_Z;scene.add(root);
 const targets=[],handles=[],roles={};
 const nodes=doorModel.nodes.map(node=>{
  let object;
  if(node.positions){
   const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(node.positions,3));geometry.setAttribute('normal',new THREE.Float32BufferAttribute(node.normals,3));
   for(const group of node.groups)geometry.addGroup(...group);
   geometry.computeBoundingBox();geometry.computeBoundingSphere();
   object=new THREE.Mesh(geometry,node.materials.map(i=>materials[i]));object.castShadow=object.receiveShadow=true;object.userData.surface='environment';object.userData.teleportDoor=true;targets.push(object);
  }else object=new THREE.Group();
  object.name=node.name;object.userData.doorRole=node.role;object.matrix.fromArray(node.matrix);object.matrix.decompose(object.position,object.quaternion,object.scale);
  if(node.role==='handle')handles.push(object);else roles[node.role]=object;
  return object;
 });
 doorModel.nodes.forEach((node,i)=>(node.parent===null?root:nodes[node.parent]).add(nodes[i]));
 // Keep the simulation's jamb axis exact, independent of Blender float precision.
 roles.hinge.position.set(-HALL_WIDTH/2,0,0);roles.hingeStile.position.x=-HALL_WIDTH/2;roles.hingeStile.position.z=0;
 handles.sort((a,b)=>a.position.z-b.position.z);
 return {...roles,root,handles,targets};
}
