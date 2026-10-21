import * as THREE from '../../../projects/forest/vendor/three.module.js';
import {LinePhysics,LINE_SEGMENTS,MIN_LINE_LENGTH} from './LinePhysics.mjs';
export const ROD_LENGTH=2.1,ROD_SEGMENTS=32,BOBBER_RADIUS=0.045,LINE_LENGTH=MIN_LINE_LENGTH;
export class FishingRod {
 constructor(scene,{surface=null,water=null}={}){
  this.root=new THREE.Group();this.root.rotation.x=-Math.PI/2+0.35;this.root.position.set(0,-0.03,-0.03);this.root.visible=false;
  const geometry=new THREE.CylinderGeometry(0.003,0.014,ROD_LENGTH,8,ROD_SEGMENTS).translate(0,ROD_LENGTH/2,0);
  this.restPositions=geometry.attributes.position.array.slice();this.restNormals=geometry.attributes.normal.array.slice();
  geometry.attributes.position.setUsage(THREE.DynamicDrawUsage);geometry.attributes.normal.setUsage(THREE.DynamicDrawUsage);
  this.curve=new Float64Array((ROD_SEGMENTS+1)*3);this.localTip=new THREE.Vector3();
  this.mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color:0x383838,roughness:0.6}));
  this.mesh.frustumCulled=false;this.root.add(this.mesh);
  const grip=new THREE.Mesh(new THREE.CylinderGeometry(.024,.026,.25,10),new THREE.MeshStandardMaterial({color:0x997047,roughness:1}));grip.position.y=-.065;this.root.add(grip);
  const sphere=new THREE.SphereGeometry(BOBBER_RADIUS,12,8).toNonIndexed(),p=sphere.attributes.position,color=new Float32Array(p.count*3);
  for(let i=0;i<p.count;i+=3){const red=p.getY(i)+p.getY(i+1)+p.getY(i+2)>0;for(let j=0;j<3;j++){color[(i+j)*3]=red?0.8:0.95;color[(i+j)*3+1]=red?0.035:0.95;color[(i+j)*3+2]=red?0.025:0.9;}}
  sphere.setAttribute('color',new THREE.BufferAttribute(color,3));this.bobber=new THREE.Mesh(sphere,new THREE.MeshStandardMaterial({vertexColors:true,roughness:0.5}));this.bobber.visible=false;scene.add(this.bobber);
  const lineGeometry=new THREE.BufferGeometry();lineGeometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array((LINE_SEGMENTS+1)*3),3).setUsage(THREE.DynamicDrawUsage));
  this.line=new THREE.Line(lineGeometry,new THREE.LineBasicMaterial({color:0xffffff}));this.line.frustumCulled=false;this.line.visible=false;scene.add(this.line);
  this.physics=new LinePhysics(LINE_LENGTH,{surface,water,radius:BOBBER_RADIUS});this.tip=new THREE.Vector3();this.bend=-1;this.setBend(0);
 }
 setBend(tension){
  const bend=THREE.MathUtils.clamp(Number.isFinite(tension)?tension:0,0,1);
  if(Math.abs(bend-this.bend)<1e-6)return;
  this.bend=bend;
  // Arc-length centreline: tangent angle grows quadratically toward the tip.
  // Integrating its unit tangent keeps length fixed and curvature continuous.
  const curve=this.curve,ds=ROD_LENGTH/ROD_SEGMENTS;curve.fill(0);
  for(let i=1;i<=ROD_SEGMENTS;i++){
   const a=(i-1)/ROD_SEGMENTS,b=i/ROD_SEGMENTS,m=(a+b)/2;
   const ta=-.85*bend*a*a,tm=-.85*bend*m*m,tb=-.85*bend*b*b,j=i*3;
   curve[j+1]=curve[j-2]+ds/6*(Math.cos(ta)+4*Math.cos(tm)+Math.cos(tb));
   curve[j+2]=curve[j-1]+ds/6*(Math.sin(ta)+4*Math.sin(tm)+Math.sin(tb));
  }
  const p=this.mesh.geometry.attributes.position,n=this.mesh.geometry.attributes.normal;
  for(let i=0;i<p.count;i++){
   const j=i*3,t=THREE.MathUtils.clamp(this.restPositions[j+1]/ROD_LENGTH,0,1),ring=Math.round(t*ROD_SEGMENTS)*3;
   const angle=-.85*bend*t*t,c=Math.cos(angle),s=Math.sin(angle),z=this.restPositions[j+2];
   p.setXYZ(i,this.restPositions[j],curve[ring+1]-s*z,curve[ring+2]+c*z);
   const ny=this.restNormals[j+1],nz=this.restNormals[j+2];
   n.setXYZ(i,this.restNormals[j],c*ny-s*nz,s*ny+c*nz);
  }
  p.needsUpdate=n.needsUpdate=true;
  this.localTip.set(0,curve[ROD_SEGMENTS*3+1],curve[ROD_SEGMENTS*3+2]);
 }
 update(visible,dt=0,worldX=0,worldZ=0,ground=0,trigger=false){
  this.root.visible=this.line.visible=this.bobber.visible=visible;
  if(!visible){this.physics.initialized=false;return;}
  if(this.physics.initialized)this.setBend(this.bend+(this.physics.tension-this.bend)*(1-Math.exp(-8*Math.max(0,dt))));
  this.root.updateWorldMatrix(true,true);this.tip.copy(this.localTip);this.root.localToWorld(this.tip);
  const initialized=this.physics.initialized;
  if(initialized)this.physics.setTrigger(trigger);
  this.physics.update(this.tip.x+worldX,this.tip.y+ground,this.tip.z+worldZ,dt);
  if(!initialized)this.physics.synchronizeTrigger(trigger);
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
  this.root.traverse(o=>{if(o.isMesh){o.geometry.dispose();o.material.dispose();}});this.bobber.geometry.dispose();this.bobber.material.dispose();this.line.geometry.dispose();this.line.material.dispose();
 }
}
