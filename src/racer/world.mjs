import * as THREE from '../../shared/vendor/three-r180/three.module.js';
import {CONFIG} from './config.mjs';
import {segmentZ} from './simulation.mjs';
export function createWorld(config=CONFIG){
 const anchor=new THREE.Group(),environment=new THREE.Group();anchor.add(environment);
 const material=color=>new THREE.MeshLambertMaterial({color,flatShading:true});
 const materials={ground:material(0xc9a879),road:material(0x3c4b55),shoulder:material(0xb66a4a),dash:material(0xf6e9cb),trunk:material(0x625246),crown:material(0x4c866b),sign:material(0x215e62)};
 materials.edge=materials.dash;materials.post=materials.trunk;
 const geometries={ground:new THREE.PlaneGeometry(config.fogFar*2+100,config.segmentLength),road:new THREE.PlaneGeometry(config.roadWidth,config.segmentLength),shoulder:new THREE.PlaneGeometry(config.shoulderWidth,config.segmentLength),dash:new THREE.PlaneGeometry(.15,5),edge:new THREE.PlaneGeometry(.12,config.segmentLength),trunk:new THREE.CylinderGeometry(.17,.24,2.4,5),crown:new THREE.ConeGeometry(1.35,3.8,5),sign:new THREE.BoxGeometry(1.25,.65,.12),post:new THREE.BoxGeometry(.10,1.9,.10)};
 for(const key of ['ground','road','shoulder','dash','edge'])geometries[key].rotateX(-Math.PI/2);
 const entries=Object.fromEntries(Object.keys(geometries).map(key=>[key,[]]));
 const segments=Array.from({length:config.segmentCount},()=>({z:0}));
 const add=(kind,segment,x,y,z)=>entries[kind].push({segment,x,y,z});
 for(let i=0;i<segments.length;i++){
  add('ground',i,0,-.015,0);add('road',i,0,0,0);
  for(const side of [-1,1]){
   add('shoulder',i,side*(config.roadWidth+config.shoulderWidth)/2,.003,0);
   add('edge',i,side*(config.roadWidth/2-.2),.008,0);
   const x=side*(8+(i*7%6)),z=(i%3-1)*4;
   add('trunk',i,x,1.2,z);add('crown',i,x,3.5,z);
   if(i%3===0){add('post',i,side*6.5,.95,-6);add('sign',i,side*6.5,1.9,-6);}
  }
  for(const z of [-7.5,2.5])add('dash',i,0,.009,z);
 }
 const batches=Object.entries(entries).map(([kind,items])=>{
  const mesh=new THREE.InstancedMesh(geometries[kind],materials[kind],items.length);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.frustumCulled=false;environment.add(mesh);
  return {mesh,items};
 });
 const transform=new THREE.Object3D();
 function update(state){
  environment.position.x=-state.lateral;
  for(let i=0;i<segments.length;i++)segments[i].z=segmentZ(i,state.distance,config);
  for(const {mesh,items} of batches){
   for(let i=0;i<items.length;i++){const p=items[i];transform.position.set(p.x,p.y,p.z+segments[p.segment].z);transform.updateMatrix();mesh.setMatrixAt(i,transform.matrix);}
   mesh.instanceMatrix.needsUpdate=true;
  }
 }
 update({distance:0,lateral:0});return {anchor,environment,segments,update};
}
