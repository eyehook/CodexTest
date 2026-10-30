import * as THREE from '../../shared/vendor/three-r180/three.module.js';
import {componentPose,GROWTH_SECONDS} from './generator.mjs?v=51';
const up=new THREE.Vector3(0,1,0),forward=new THREE.Vector3(0,0,1);
// Called only after maturity. Positions and normals include clone scale and yaw.
export function flowerLandings(plant) {
  if(plant.state!=='mature')return [];
  const poses=componentPose(plant.structure,GROWTH_SECONDS),yaw=new THREE.Quaternion().setFromAxisAngle(up,plant.rotationY??0),scale=plant.scale??1;
  return plant.structure.parts.filter(p=>p.kind==='flower').map(p=>{
    const normal=new THREE.Vector3().fromArray(p.normal).normalize();
    const position=new THREE.Vector3().fromArray(poses[p.id].anchor).addScaledVector(normal,p.size*(p.volume?1.65:.19));
    position.multiplyScalar(scale).applyQuaternion(yaw).add(plant.position);normal.applyQuaternion(yaw);
    return {plantId:plant.id,partId:p.id,position,normal};
  });
}
export class Bees {
  constructor(scene,random=Math.random) {
    this.scene=scene;this.random=random;this.density=2;this.landings=[];this.cache=new Map();this.bees=[];this.revision=-1;this.growing=-1;this.capacity=0;
    this.dummy=new THREE.Object3D();this.wing=new THREE.Object3D();this.direction=new THREE.Vector3();this.next=new THREE.Vector3();this.side=new THREE.Vector3();
    this.bodyGeometry=new THREE.BoxGeometry(.065,.043,.105);
    // Yellow/dark vertex coloring needs no texture or extra draw calls.
    const colors=[],positions=this.bodyGeometry.attributes.position;
    for(let i=0;i<positions.count;i++){const c=new THREE.Color(positions.getZ(i)>0?0xe5ad25:0x30291e);colors.push(c.r,c.g,c.b);}
    this.bodyGeometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
    this.wingGeometry=new THREE.BufferGeometry();this.wingGeometry.setAttribute('position',new THREE.Float32BufferAttribute([0,0,0,.043,0,-.025,.085,0,0,.043,0,.025],3));this.wingGeometry.setIndex([0,1,2,0,2,3]);this.wingGeometry.computeVertexNormals();
    this.bodyMaterial=new THREE.MeshLambertMaterial({vertexColors:true});
    this.wingMaterial=new THREE.MeshBasicMaterial({color:0xd5e9ee,side:THREE.DoubleSide});
  }
  get enabled(){return this.density>0;}
  setDensity(level) {
    if(!Number.isInteger(level)||level<0||level>3)return;
    this.density=level;
    for(const mesh of [this.bodies,this.wings])if(mesh)mesh.visible=this.enabled;
    if(!this.enabled){this.bees.length=0;this.resize(0);}
    this.revision=-1;
  }
  resize(count) {
    if(count>this.capacity){
      for(const mesh of [this.bodies,this.wings])if(mesh){this.scene.remove(mesh);mesh.dispose();}
      this.capacity=Math.max(count,this.capacity*2,4);
      this.bodies=new THREE.InstancedMesh(this.bodyGeometry,this.bodyMaterial,this.capacity);
      this.wings=new THREE.InstancedMesh(this.wingGeometry,this.wingMaterial,this.capacity*2);
      for(const mesh of [this.bodies,this.wings]){mesh.visible=this.enabled;mesh.castShadow=false;mesh.receiveShadow=false;mesh.frustumCulled=false;mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.scene.add(mesh);}
    }
    if(this.bodies){this.bodies.count=count;this.wings.count=count*2;}
  }
  sync(plants,now) {
    if(this.revision===plants.revision&&this.growing===plants.growing.size)return;
    this.revision=plants.revision;this.growing=plants.growing.size;
    for(const [id,entry] of this.cache)if(plants.instances.get(id)!==entry.plant)this.cache.delete(id);
    for(const plant of plants.instances.values())if(plant.state==='mature'&&!this.cache.has(plant.id))this.cache.set(plant.id,{plant,points:flowerLandings(plant)});
    this.landings=[];for(const entry of this.cache.values())this.landings.push(...entry.points);
    const count=Math.floor(this.landings.length/[Infinity,150,100,50][this.density]);this.resize(count);this.bees.length=Math.min(count,this.bees.length);
    const valid=new Set(this.landings);
    for(const bee of this.bees)if(!valid.has(bee.target)){this.depart(bee,now);}
    while(this.bees.length<count){const target=this.pick();const bee={position:target.position.clone().addScaledVector(target.normal,.025),quaternion:new THREE.Quaternion(),target,until:now+2+this.random()*3,phase:this.random()*Math.PI*2,flying:false};this.bees.push(bee);}
  }
  pick(previous) {
    let index=Math.floor(this.random()*this.landings.length);
    if(this.landings[index]===previous&&this.landings.length>1)index=(index+1)%this.landings.length;
    return this.landings[index];
  }
  depart(bee,now) {
    bee.target=this.pick(bee.target);bee.start=bee.position.clone();bee.end=bee.target.position.clone().addScaledVector(bee.target.normal,.025);
    const distance=bee.start.distanceTo(bee.end);bee.duration=Math.max(1.2,distance/(.7+this.random()*.5));bee.began=now;bee.flying=true;
    bee.control1=bee.start.clone().addScaledVector(up,.25+Math.min(distance*.25,.8));
    bee.control2=bee.end.clone().addScaledVector(bee.target.normal,.2+Math.min(distance*.2,.6));bee.control2.y+=.15;
  }
  flight(bee,t,out) {
    const s=1-t;out.copy(bee.start).multiplyScalar(s*s*s).addScaledVector(bee.control1,3*s*s*t).addScaledVector(bee.control2,3*s*t*t).addScaledVector(bee.end,t*t*t);
    this.side.subVectors(bee.end,bee.start).cross(up).normalize();
    // Smooth endpoint envelope gives small darts in transit and a gentle landing.
    const envelope=Math.sin(Math.PI*t)**2;
    out.addScaledVector(this.side,Math.sin(t*19+bee.phase)*.12*envelope);out.y+=Math.sin(t*27+bee.phase)*.055*envelope;
    return out;
  }
  update(plants,now) {
    if(!this.enabled)return;
    this.sync(plants,now);if(!this.bees.length)return;
    for(let i=0;i<this.bees.length;i++){
      const bee=this.bees[i];if(!bee.flying&&now>=bee.until)this.depart(bee,now);
      if(bee.flying){
        const t=Math.min(1,Math.max(0,(now-bee.began)/bee.duration));this.flight(bee,t,bee.position);
        this.flight(bee,Math.min(1,t+.002),this.next);this.direction.subVectors(this.next,bee.position);
        if(this.direction.lengthSq()>1e-12)bee.quaternion.setFromUnitVectors(forward,this.direction.normalize());
        if(t===1){bee.flying=false;bee.until=now+2+this.random()*3;}
      }
      if(!bee.flying)bee.quaternion.setFromUnitVectors(up,bee.target.normal);
      const d=this.dummy;d.position.copy(bee.position);d.quaternion.copy(bee.quaternion);d.scale.setScalar(1);d.updateMatrix();this.bodies.setMatrixAt(i,d.matrix);
      for(let side=0;side<2;side++){
        const w=this.wing;w.position.set(side===0?.02:-.02,.02,0);w.rotation.set(0,0,side===0?0:Math.PI);
        w.rotation.z+=(side===0?1:-1)*(bee.flying?Math.sin(now*145+bee.phase)*.7:.12);w.updateMatrix();w.matrix.premultiply(d.matrix);this.wings.setMatrixAt(i*2+side,w.matrix);
      }
    }
    this.bodies.instanceMatrix.needsUpdate=true;this.wings.instanceMatrix.needsUpdate=true;
  }
  dispose() {
    for(const mesh of [this.bodies,this.wings])if(mesh){this.scene.remove(mesh);mesh.dispose();}
    this.bodyGeometry.dispose();this.wingGeometry.dispose();this.bodyMaterial.dispose();this.wingMaterial.dispose();this.cache.clear();this.landings=[];this.bees=[];
  }
}
