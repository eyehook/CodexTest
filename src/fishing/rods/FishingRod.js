import * as THREE from '../../../projects/forest/vendor/three.module.js';
import {LinePhysics,LINE_SEGMENTS} from './LinePhysics.mjs';
export const ROD_LENGTH=2.1,ROD_SEGMENTS=8,BOBBER_RADIUS=0.045,LINE_LENGTH=0.8;
export class FishingRod {
 constructor(scene){
  this.root=new THREE.Group();this.root.rotation.x=-Math.PI/2+0.35;this.root.position.set(0,-0.03,-0.03);this.root.visible=false;
  const geometry=new THREE.CylinderGeometry(0.003,0.014,ROD_LENGTH,8,32).translate(0,ROD_LENGTH/2,0);
  const positions=geometry.attributes.position,indices=[],weights=[],colors=[];
  for(let i=0;i<positions.count;i++){
   const y=THREE.MathUtils.clamp(positions.getY(i),0,ROD_LENGTH),part=y/ROD_LENGTH*ROD_SEGMENTS,bone=Math.min(ROD_SEGMENTS-1,Math.floor(part)),blend=part-bone;
   indices.push(bone,bone+1,0,0);weights.push(1-blend,blend,0,0);
   const band=Math.abs(part-Math.round(part))<0.01&&part>0.1;
   colors.push(...(band?[0.48,0.43,0.25]:[0.045,0.085,0.075]));
  }
  geometry.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(indices,4));geometry.setAttribute('skinWeight',new THREE.Float32BufferAttribute(weights,4));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  this.bones=[];
  for(let i=0;i<=ROD_SEGMENTS;i++){const bone=new THREE.Bone();bone.name=`Rod_${i}`;bone.position.y=i?ROD_LENGTH/ROD_SEGMENTS:0;if(i)this.bones[i-1].add(bone);this.bones.push(bone);}
  this.mesh=new THREE.SkinnedMesh(geometry,new THREE.MeshStandardMaterial({vertexColors:true,roughness:0.6}));
  this.mesh.add(this.bones[0]);this.mesh.bind(new THREE.Skeleton(this.bones));this.mesh.frustumCulled=false;this.root.add(this.mesh);
  const grip=new THREE.Mesh(new THREE.CylinderGeometry(.024,.026,.25,10),new THREE.MeshStandardMaterial({color:0x997047,roughness:1}));grip.position.y=-.065;this.root.add(grip);
  const sphere=new THREE.SphereGeometry(BOBBER_RADIUS,12,8).toNonIndexed(),p=sphere.attributes.position,color=new Float32Array(p.count*3);
  for(let i=0;i<p.count;i+=3){const red=p.getY(i)+p.getY(i+1)+p.getY(i+2)>0;for(let j=0;j<3;j++){color[(i+j)*3]=red?0.8:0.95;color[(i+j)*3+1]=red?0.035:0.95;color[(i+j)*3+2]=red?0.025:0.9;}}
  sphere.setAttribute('color',new THREE.BufferAttribute(color,3));this.bobber=new THREE.Mesh(sphere,new THREE.MeshStandardMaterial({vertexColors:true,roughness:0.5}));this.bobber.visible=false;scene.add(this.bobber);
  const lineGeometry=new THREE.BufferGeometry();lineGeometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array((LINE_SEGMENTS+1)*3),3).setUsage(THREE.DynamicDrawUsage));
  this.line=new THREE.Line(lineGeometry,new THREE.LineBasicMaterial({color:0x43524b}));this.line.frustumCulled=false;this.line.visible=false;scene.add(this.line);
  this.physics=new LinePhysics(LINE_LENGTH);this.tip=new THREE.Vector3();this.bend=0;this.setBend(0);
 }
 setBend(tension){
  this.bend=THREE.MathUtils.clamp(Number.isFinite(tension)?tension:0,0,1);
  for(let i=1;i<this.bones.length;i++){const t=i/ROD_SEGMENTS;this.bones[i].rotation.x=-this.bend*(.025+.12*t*t);}
 }
 update(visible,dt=0,worldX=0,worldZ=0,ground=0){
  this.root.visible=this.line.visible=this.bobber.visible=visible;
  if(!visible){this.physics.initialized=false;return;}
  this.root.updateWorldMatrix(true,true);this.mesh.skeleton.update();this.bones[ROD_SEGMENTS].getWorldPosition(this.tip);
  this.physics.update(this.tip.x+worldX,this.tip.y+ground,this.tip.z+worldZ,dt);
  const nodes=this.physics.position,j=LINE_SEGMENTS*3;
  this.bobber.position.set(nodes[j]-worldX,nodes[j+1]-ground,nodes[j+2]-worldZ);
  const p=this.line.geometry.attributes.position;
  p.setXYZ(0,this.tip.x,this.tip.y,this.tip.z);
  for(let i=1;i<=LINE_SEGMENTS;i++){const k=i*3;p.setXYZ(i,nodes[k]-worldX,nodes[k+1]-ground,nodes[k+2]-worldZ);}
  // End the visible line at the sphere surface instead of its centre.
  const dx=nodes[j-3]-nodes[j],dy=nodes[j-2]-nodes[j+1],dz=nodes[j-1]-nodes[j+2],length=Math.hypot(dx,dy,dz)||1;
  p.setXYZ(LINE_SEGMENTS,this.bobber.position.x+dx/length*BOBBER_RADIUS,this.bobber.position.y+dy/length*BOBBER_RADIUS,this.bobber.position.z+dz/length*BOBBER_RADIUS);p.needsUpdate=true;
 }
 dispose(){
  this.root.removeFromParent();this.bobber.removeFromParent();this.line.removeFromParent();
  this.root.traverse(o=>{if(o.isMesh){o.geometry.dispose();o.material.dispose();}});this.mesh.skeleton.dispose();this.bobber.geometry.dispose();this.bobber.material.dispose();this.line.geometry.dispose();this.line.material.dispose();
 }
}
