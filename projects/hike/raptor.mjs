import * as T from '../../shared/vendor/three-r180/three.module.js';
import {randomSource} from './geology.mjs?v=bench-1';
import {AveragedHeightmap} from './averaged-heightmap.mjs';
import {TREE_STRIDE} from './flora-placement.mjs?v=noise32-2';
import {createPineVariants} from './pine-geometry.mjs';

// Metres, seconds and radians. Local forward is -Z, wings extend along X.
export const RAPTOR=Object.freeze({placementAttempts:32,clearance:10,bodyRadius:1,terrainStep:1,terrainPadding:4,trailEndMargin:200,fadeNear:225,fadeFar:275,altitude:45,radius:25,period:30,radiusVariation:.07,bob:1.5,
 color:0x494139,glideAngle:.035,flapAngle:.48,beatPeriod:1.25,flapCycle:92,
 sequences:Object.freeze([Object.freeze({start:18,beats:2}),Object.freeze({start:42,beats:3}),Object.freeze({start:69,beats:2})])});

// Analytic derivatives keep heading/pitch/bank aligned with the varying orbit.
export function sampleRaptorFlight(time,out,settings=RAPTOR){
 const w=2*Math.PI/settings.period,a=time*w,s=Math.sin(a),c=Math.cos(a);
 const r=settings.radius*(1+settings.radiusVariation*Math.sin(2*a));
 const dr=settings.radius*settings.radiusVariation*2*w*Math.cos(2*a);
 const ddr=-settings.radius*settings.radiusVariation*4*w*w*Math.sin(2*a);
 out.x=r*c;out.z=r*s;out.y=settings.bob*Math.sin(a+.6);
 out.vx=dr*c-r*w*s;out.vz=dr*s+r*w*c;out.vy=settings.bob*w*Math.cos(a+.6);
 const ax=(ddr-r*w*w)*c-2*dr*w*s,az=(ddr-r*w*w)*s+2*dr*w*c;
 const speed=Math.hypot(out.vx,out.vz);
 out.yaw=Math.atan2(-out.vx,-out.vz);out.pitch=Math.atan2(out.vy,speed);
 out.bank=-Math.atan2((out.vx*az-out.vz*ax)/speed,9.81);
 let flap=0;const phase=time%settings.flapCycle;
 for(let i=0;i<settings.sequences.length;i++){
  const sequence=settings.sequences[i],u=(phase-sequence.start)/(sequence.beats*settings.beatPeriod);
  if(u>0&&u<1){flap=settings.flapAngle*Math.sin(Math.PI*u)**2*Math.sin(2*Math.PI*sequence.beats*u);break;}
 }
 out.wing=settings.glideAngle+flap;return out;
}

// Closed, shallow polygon with a raised center: visible from below and edge-on.
function panel(points,thickness){
 const positions=[],n=points.length;
 const vertex=(i,y)=>[points[i][0],y,points[i][1]];
 const triangle=(a,b,c)=>positions.push(...a,...b,...c);
 const cx=points.reduce((sum,p)=>sum+p[0],0)/n,cz=points.reduce((sum,p)=>sum+p[1],0)/n;
 for(let i=0;i<n;i++){
  const j=(i+1)%n,a=vertex(i,0),b=vertex(j,0),al=vertex(i,-thickness),bl=vertex(j,-thickness);
  triangle([cx,thickness,cz],b,a);triangle([cx,-thickness,cz],al,bl);
  triangle(a,b,bl);triangle(a,bl,al);
 }
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.computeVertexNormals();return g;
}
function bodyGeometry(){
 const parts=[];
 const ellipsoid=(radius,width,height,length,x,y,z)=>{
  const g=new T.SphereGeometry(radius,6,4);g.scale(width,height,length);g.translate(x,y,z);parts.push(g.toNonIndexed());g.dispose();
 };
 ellipsoid(1,.085,.075,.29,0,0,0);ellipsoid(1,.055,.055,.075,0,.025,-.28);
 const tail=panel([[-.04,.18],[.04,.18],[.13,.43],[0,.40],[-.13,.43]],.012);parts.push(tail);
 const positions=[];for(const g of parts){for(const v of g.attributes.position.array)positions.push(v);g.dispose();}
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.computeVertexNormals();return geometry;
}
// Reject a conservative full disk, including all radius/bob/wing variations.
// Startup only: no runtime collision detection or terrain following.
export function selectRaptorFlightArea(world,settings=RAPTOR){
 const route=world.route,length=route.at(-1).distance-route[0].distance,margin=settings.trailEndMargin;
 if(length<2*margin)return null;
 const random=randomSource((world.config?.seed??0)^0x72617074);
 const averaged=new AveragedHeightmap((x,z)=>world.height(x,z));
 const envelope=settings.radius*(1+settings.radiusVariation)+settings.bodyRadius;
 const terrainRadius=envelope+settings.terrainPadding,step=settings.terrainStep;
 // Read bounds from the actual pine geometry rather than duplicating its sizes.
 const variants=world.flora?.count?createPineVariants():[];
 const bounds=variants.map(({geometry})=>{
  geometry.computeBoundingBox();const box=geometry.boundingBox;
  const bound={top:box.max.y,radius:Math.hypot(Math.max(Math.abs(box.min.x),Math.abs(box.max.x)),Math.max(Math.abs(box.min.z),Math.abs(box.max.z)))};
  geometry.dispose();return bound;
 });
 for(let attempt=0;attempt<settings.placementAttempts;attempt++){
  const along=route[0].distance+margin+random()*(length-2*margin);
  let i=1;while(i<route.length-1&&route[i].distance<along)i++;
  const a=route[i-1],b=route[i],u=(along-a.distance)/(b.distance-a.distance||1);
  const x=a.x+(b.x-a.x)*u,z=a.z+(b.z-a.z)*u,y=world.height(x,z)+settings.altitude;
  const ceiling=y-settings.bob-settings.bodyRadius-settings.clearance;
  let safe=Number.isFinite(ceiling);
  if(world.extent!==undefined&&(Math.abs(x)+terrainRadius>world.extent||Math.abs(z)+terrainRadius>world.extent))safe=false;
  // Include the averaged render surface: at fade distances the rendered terrain
  // can be higher than collision terrain beside a steep cut or cliff.
  for(let dz=-terrainRadius;safe&&dz<=terrainRadius;dz+=step)for(let dx=-terrainRadius;dx<=terrainRadius;dx+=step){
   if(dx*dx+dz*dz>terrainRadius*terrainRadius)continue;
   const height=Math.max(world.height(x+dx,z+dz),averaged.sample(x+dx,z+dz));
   if(!Number.isFinite(height)||height>ceiling){safe=false;break;}
  }
  const flora=world.flora,trees=flora?.trees;
  for(let id=0;safe&&id<(flora?.count??0);id++){
   const k=id*TREE_STRIDE,bound=bounds[trees[k+7]],radius=bound.radius*trees[k+3];
   if(Math.hypot(trees[k]-x,trees[k+2]-z)<=envelope+radius&&trees[k+1]+bound.top*trees[k+4]>ceiling)safe=false;
  }
  // Summit pole/pennant can be nearby even when route-distance margins hold.
  if(safe&&world.summit&&Math.hypot(world.summit.x-x,world.summit.z-z)<=envelope+4&&world.summit.y+10>ceiling)safe=false;
  // Ten metres of ground clearance also covers the small rocks and grass.
  if(safe)return {along,center:new T.Vector3(x,y,z),attempts:attempt+1};
 }
 return null;
}

export class Raptor {
 constructor(scene,world,settings=RAPTOR){
  this.settings=settings;
  const placement=selectRaptorFlightArea(world,settings);
  this.hasFlightArea=!!placement;this.along=placement?.along??null;
  this.center=placement?.center??new T.Vector3(world.route[0].x,0,world.route[0].z);
  this.root=new T.Group();this.root.name='Circling raptor';this.root.rotation.order='YXZ';scene.add(this.root);
  this.material=new T.MeshBasicMaterial({color:settings.color,side:T.DoubleSide,transparent:true,depthWrite:false,forceSinglePass:true});
  this.bodyGeometry=bodyGeometry();
  this.wingGeometry=panel([[0,-.13],[.29,-.16],[.56,-.08],[.69,.01],[.64,.14],[.46,.18],[.19,.12],[0,.12]],.012);
  this.body=new T.Mesh(this.bodyGeometry,this.material);this.root.add(this.body);
  this.left=new T.Group();this.right=new T.Group();this.left.position.x=-.06;this.right.position.x=.06;
  const leftMesh=new T.Mesh(this.wingGeometry,this.material);leftMesh.scale.x=-1;
  this.left.add(leftMesh);this.right.add(new T.Mesh(this.wingGeometry,this.material));this.root.add(this.left,this.right);
  this.sample={};this.root.visible=this.hasFlightArea;this.update(0);
 }
 update(time,viewer){
  const p=sampleRaptorFlight(time,this.sample,this.settings);
  this.root.position.set(this.center.x+p.x,this.center.y+p.y,this.center.z+p.z);
  this.root.rotation.set(p.pitch,p.yaw,p.bank,'YXZ');
  this.left.rotation.z=-p.wing;this.right.rotation.z=p.wing;
  if(viewer){
   // One world-space head position drives both eyes, including physical offset
   // and rig transforms already composed by FlightView after locomotion.
   const distance=this.root.position.distanceTo(viewer);
   this.material.opacity=1-T.MathUtils.smoothstep(distance,this.settings.fadeNear,this.settings.fadeFar);
   this.root.visible=this.hasFlightArea&&this.material.opacity>0;
  }
 }
 dispose(){this.root.removeFromParent();this.bodyGeometry.dispose();this.wingGeometry.dispose();this.material.dispose();}
}
