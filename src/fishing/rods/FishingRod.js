import {BiteLabel} from './BiteLabel.js';
import {FishEncounter} from './FishEncounter.mjs';
import {Fish} from './Fish.js';
import * as THREE from '../../../projects/forest/vendor/three.module.js';
import {LeaderPhysics,LEADER_LENGTH,HOOK_OFFSET_X,HOOK_OFFSET_Y} from './LeaderPhysics.mjs';
export {LEADER_LENGTH} from './LeaderPhysics.mjs';
import {LinePhysics,LINE_SEGMENTS,MIN_LINE_LENGTH,AUTO_REEL_LENGTH} from './LinePhysics.mjs';
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
  this.biteLabel=new BiteLabel();this.bobber.add(this.biteLabel);
  this.leaderPhysics=new LeaderPhysics(water);
  this.hookDirection=new THREE.Vector3();this.hookRestDirection=new THREE.Vector3(HOOK_OFFSET_X,HOOK_OFFSET_Y,0).normalize();
  const leaderGeometry=new THREE.BufferGeometry();leaderGeometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(9),3).setUsage(THREE.DynamicDrawUsage));
  this.leader=new THREE.Line(leaderGeometry,new THREE.LineBasicMaterial({color:0xffffff}));this.bobber.add(this.leader);
  const hookCurve=new THREE.CatmullRomCurve3([
   new THREE.Vector3(0,0,0),new THREE.Vector3(0,-.025,0),new THREE.Vector3(0,-.035,0),
   new THREE.Vector3(.012,-.047,0),new THREE.Vector3(.024,-.035,0),new THREE.Vector3(.024,-.022,0)
  ]);
  this.hook=new THREE.Mesh(new THREE.TubeGeometry(hookCurve,20,.0018,6,false),new THREE.MeshStandardMaterial({color:0xb9bec4,metalness:.7,roughness:.35}));
  this.hook.position.y=-BOBBER_RADIUS-LEADER_LENGTH;this.bobber.add(this.hook);
  this.hookAnchor=new THREE.Object3D();this.hookAnchor.name='FishAttachment';this.hookAnchor.position.set(HOOK_OFFSET_X,HOOK_OFFSET_Y,0);this.hook.add(this.hookAnchor);
  this.hookWorldPosition=new THREE.Vector3();
  this.encounter=new FishEncounter();this.fish=new Fish();this.bobber.add(this.fish);this.fishingEvent=null;
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
  this.fishingEvent=null;
  if(!visible){this.physics.initialized=false;this.leaderPhysics.initialized=false;this.encounter.reset();this.fish.visible=false;this.biteLabel.reset();return;}
  if(this.physics.initialized){
   const loaded=this.encounter.phase==='hooked'||this.encounter.phase==='caught';
   // Geometric size determines weight once at hooking. A saturating load
   // response keeps heavy fish distinguishable without overfolding the rod.
   const weight=this.encounter.weightKg;
   const fishLoad=.75*weight/(weight+.75);
   const target=loaded?Math.min(1,fishLoad*this.encounter.opacity+.35*this.physics.tension):this.physics.tension;
   this.setBend(this.bend+(target-this.bend)*(1-Math.exp(-8*Math.max(0,dt))));
  }
  this.root.updateWorldMatrix(true,true);this.tip.copy(this.localTip);this.root.localToWorld(this.tip);
  const initialized=this.physics.initialized,resetCount=this.physics.resetCount;
  if(initialized){
   const landedFish=this.encounter.phase==='caught'||(this.encounter.phase==='hooked'&&this.physics.length<=this.physics.homeLength+1e-9);
   const finishingRetrieval=this.physics.triggerHeld&&this.physics.triggerAction==='reel';
   // A held retrieval can finish winding, but no new cast may arm during
   // the landed-fish display/fade. Synchronize the latch without launching.
   if(landedFish&&!finishingRetrieval)this.physics.synchronizeTrigger(trigger);
   else this.physics.setTrigger(trigger);
  }
  this.physics.update(this.tip.x+worldX,this.tip.y+ground,this.tip.z+worldZ,dt);
  if(!initialized)this.physics.synchronizeTrigger(trigger);
  if(!initialized||this.physics.resetCount!==resetCount){this.encounter.reset();this.biteLabel.reset();}
  const nodes=this.physics.position,j=LINE_SEGMENTS*3;
  this.bobber.position.set(nodes[j]-worldX,nodes[j+1]-ground,nodes[j+2]-worldZ);
  if(!initialized||this.physics.resetCount!==resetCount)this.leaderPhysics.initialized=false;
  this.leaderPhysics.update(nodes[j],nodes[j+1]-BOBBER_RADIUS,nodes[j+2],dt);
  const tackle=this.leaderPhysics.position,leader=this.leader.geometry.attributes.position;
  leader.setXYZ(0,0,-BOBBER_RADIUS,0);
  for(let i=1;i<3;i++)leader.setXYZ(i,tackle[i*3]-nodes[j],tackle[i*3+1]-nodes[j+1],tackle[i*3+2]-nodes[j+2]);
  leader.needsUpdate=true;
  this.hook.position.set(tackle[6]-nodes[j],tackle[7]-nodes[j+1],tackle[8]-nodes[j+2]);
  this.hookDirection.set(tackle[9]-tackle[6],tackle[10]-tackle[7],tackle[11]-tackle[8]).normalize();
  this.hook.quaternion.setFromUnitVectors(this.hookRestDirection,this.hookDirection);
  this.hookWorldPosition.set(tackle[9],tackle[10],tackle[11]);
  const water=this.physics.water?this.physics.water():-Infinity;
  const resting=this.physics.phase==='cast'&&!trigger&&this.physics.length>=AUTO_REEL_LENGTH&&Math.abs(nodes[j+1]-water)<.08&&(this.physics.dipTime>0||Math.hypot(this.physics.velocity[0],this.physics.velocity[1],this.physics.velocity[2])<.12)&&(this.physics.surface?this.physics.surface(nodes[j],nodes[j+2]):-Infinity)<water-.05&&this.hookWorldPosition.y<water;
  this.fishingEvent=this.encounter.update(dt,resting,this.physics.triggerHeld&&this.physics.triggerAction==='reel',this.physics.length,this.physics.homeLength);
  if(this.fishingEvent==='nibble')this.physics.dip(.0254);
  else if(this.fishingEvent==='bite')this.physics.dip(.1524);
  this.biteLabel.update(this.encounter.phase==='bite',dt,this.fishingEvent==='lost');
  this.fish.visible=this.encounter.phase==='hooked'||this.encounter.phase==='caught';this.hook.visible=!this.fish.visible;
  this.fish.position.copy(this.hook.position);
  this.fish.scale.setScalar(this.encounter.size);
  this.fish.quaternion.copy(this.hook.quaternion);this.fish.setHue(this.encounter.hue);this.fish.setOpacity(this.encounter.opacity);
  const p=this.line.geometry.attributes.position;
  p.setXYZ(0,this.tip.x,this.tip.y,this.tip.z);
  for(let i=1;i<=LINE_SEGMENTS;i++){const k=i*3;p.setXYZ(i,nodes[k]-worldX,nodes[k+1]-ground,nodes[k+2]-worldZ);}
  // End the visible line at the sphere surface instead of its centre.
  const dx=nodes[j-3]-nodes[j],dy=nodes[j-2]-nodes[j+1],dz=nodes[j-1]-nodes[j+2],length=Math.hypot(dx,dy,dz)||1;
  p.setXYZ(LINE_SEGMENTS,this.bobber.position.x+dx/length*BOBBER_RADIUS,this.bobber.position.y+dy/length*BOBBER_RADIUS,this.bobber.position.z+dz/length*BOBBER_RADIUS);p.needsUpdate=true;
 }
 dispose(){
  this.root.removeFromParent();this.bobber.removeFromParent();this.line.removeFromParent();
  this.root.traverse(o=>{if(o.isMesh){o.geometry.dispose();o.material.dispose();}});this.bobber.traverse(o=>{if(o.isSprite){o.dispose();return;}if(o.geometry)o.geometry.dispose();if(o.material){o.material.map?.dispose();o.material.dispose();}});this.line.geometry.dispose();this.line.material.dispose();
 }
}
