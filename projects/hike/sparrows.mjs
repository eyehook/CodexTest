import * as T from '../../shared/vendor/three-r180/three.module.js';
import {randomSource} from './geology.mjs?v=bench-1';
export const SPARROWS=Object.freeze({flocks:12,birdsPerFlock:7,trigger:15,treeTrigger:30,groundRange:65,fadeStart:150,far:200,steeringStep:1/15});
// Solid octahedra/tetrahedra: 38 triangles/bird, including both hinged wings.
function geometry(wing=false){
 const positions=[],colors=[];
 function solid(vertices,faces,color){for(const face of faces)for(const i of face){positions.push(...vertices[i]);colors.push(...color);}}
 function oval(x,y,z,rx,ry,rz,c){solid([[x+rx,y,z],[x-rx,y,z],[x,y+ry,z],[x,y-ry,z],[x,y,z+rz],[x,y,z-rz]],[[0,2,4],[4,2,1],[1,2,5],[5,2,0],[4,3,0],[1,3,4],[5,3,1],[0,3,5]],c);}
 const tetra=[[0,1,2],[0,3,1],[1,3,2],[2,3,0]];
 if(wing)solid([[0,0,0],[.14,-.008,.055],[.075,0,-.055],[.045,.018,0]],tetra,[.24,.14,.075]);
 else {
  oval(0,.065,0,.044,.052,.079,[.34,.22,.12]);
  oval(0,.043,-.018,.037,.026,.059,[.61,.48,.32]);
  oval(0,.105,-.053,.034,.033,.034,[.38,.25,.14]);
  solid([[-.013,.1,-.077],[.013,.1,-.077],[0,.115,-.077],[0,.103,-.109]],tetra,[.37,.29,.16]);
  solid([[-.023,.067,.053],[.023,.067,.053],[-.029,.07,.121],[.029,.07,.121]],[[0,2,1],[1,2,3]],[.22,.14,.08]);
 }
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('color',new T.Float32BufferAttribute(colors,3));g.computeVertexNormals();return g;
}
function fade(shader,viewer){
 shader.uniforms.sparrowViewer=viewer;
 shader.vertexShader='uniform vec3 sparrowViewer; varying float vBirdDistance; varying vec3 vBirdPattern;\n'+shader.vertexShader;
 shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
 vBirdDistance=length((modelMatrix*instanceMatrix[3]).xyz-sparrowViewer);
 vBirdPattern=position;`);
 shader.fragmentShader='varying float vBirdDistance; varying vec3 vBirdPattern;\n'+shader.fragmentShader;
 shader.fragmentShader=shader.fragmentShader.replace('#include <alphatest_fragment>',`float coverage=1.0-smoothstep(150.0,200.0,vBirdDistance);
 float threshold=fract(sin(dot(floor(vBirdPattern*900.0),vec3(12.9898,78.233,37.719)))*43758.5453);
 if(coverage<=threshold)discard;
 #include <alphatest_fragment>`);
}
export class Sparrows {
 constructor(scene,world){
  this.world=world;this.consumed=new Set();this.buckets=new Map();this.time=0;this.scanTime=0;this.steerTime=0;
  for(const record of world.sparrowEncounters??[]){const key=`${Math.floor(record.x/32)}:${Math.floor(record.z/32)}`;let bucket=this.buckets.get(key);if(!bucket)this.buckets.set(key,bucket=[]);bucket.push(record);}
  this.flocks=Array.from({length:SPARROWS.flocks},()=>({record:null,flying:false,age:0,dx:0,dz:0,birds:Array.from({length:7},()=>({x:0,y:0,z:0,vx:0,vy:0,vz:0,tx:0,ty:0,tz:0,phase:0,delay:0,tint:1}))}));
  this.root=new T.Group();this.root.name='Sparrow flocks';scene.add(this.root);
  this.viewer={value:new T.Vector3()};this.material=new T.MeshLambertMaterial({vertexColors:true,side:T.DoubleSide});this.material.onBeforeCompile=s=>fade(s,this.viewer);this.material.customProgramCacheKey=()=> 'sparrows-1';
  this.geometries=[geometry(),geometry(true)];this.meshes=[0,1,1].map(i=>{const mesh=new T.InstancedMesh(this.geometries[i],this.material,84);mesh.count=0;mesh.frustumCulled=false;mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);mesh.userData.uploadRange={start:0,count:0};mesh.instanceColor=new T.InstancedBufferAttribute(new Float32Array(84*3),3);this.root.add(mesh);return mesh;});
  this.pose=new T.Object3D();this.pose.rotation.order='YXZ';this.wing=new T.Object3D();this.matrix=new T.Matrix4();this.color=new T.Color();
 }
 activate(record){
  let flock=null;for(const f of this.flocks){if(f.record===record)return f;if(!f.record&&!flock)flock=f;}
  if(!flock)return null;
  flock.record=record;flock.flying=false;flock.age=0;const random=randomSource(record.seed);
  for(let i=0;i<record.count;i++){const b=flock.birds[i],angle=i*2.399+random()*.3,r=.45+random()*.6;
   b.x=record.x+Math.cos(angle)*r;b.z=record.z+Math.sin(angle)*r;b.y=record.kind==='tree'?record.y+record.canopy+random()*.6:this.world.height(b.x,b.z);
   b.homeX=b.x;b.homeZ=b.z;b.vx=b.vy=b.vz=b.tx=b.ty=b.tz=0;b.phase=random()*Math.PI*2;b.delay=random()*.32;b.tint=.82+random()*.35;b.yaw=random()*Math.PI*2;
  }return flock;
 }
 trigger(record,viewer){
  if(this.consumed.has(record.id))return;
  // Consumption precedes pool allocation; overload never resurrects encounters.
  this.consumed.add(record.id);const f=this.activate(record);if(!f)return;
  f.flying=true;f.age=0;let dx=record.x-viewer.x,dz=record.z-viewer.z;const len=Math.hypot(dx,dz);
  if(len<.01){dx=Math.sin(record.seed);dz=Math.cos(record.seed);}else{dx/=len;dz/=len;}
  if(record.kind==='tree'){
   // Leave beside the canopy as seen from the disturbance position. Keep the
   // flock together, choosing a stable left/right side for each encounter.
   const side=(record.seed&1)?1:-1,awayX=dx;
   dx=-dz*side;dz=awayX*side;
  }
  f.dx=dx;f.dz=dz;this.onTakeoff?.(record,f);
 }
 scan(viewer){
  for(const f of this.flocks)if(f.record&&!f.flying&&Math.hypot(f.record.x-viewer.x,f.record.z-viewer.z)>75)f.record=null;
  const cx=Math.floor(viewer.x/32),cz=Math.floor(viewer.z/32);
  for(let z=cz-3;z<=cz+3;z++)for(let x=cx-3;x<=cx+3;x++){
   const bucket=this.buckets.get(`${x}:${z}`);if(!bucket)continue;
   for(const r of bucket){if(this.consumed.has(r.id))continue;const d=Math.hypot(r.x-viewer.x,r.z-viewer.z);
    const nearby=r.kind==='tree'?Math.hypot(d,viewer.y-r.y)<=SPARROWS.treeTrigger:d<SPARROWS.trigger&&Math.abs(viewer.y-r.y)<8;
    if(nearby)this.trigger(r,viewer);
    else if(r.kind==='ground'&&d<SPARROWS.groundRange)this.activate(r);
   }
  }
 }
 steer(f){
  const n=f.record.count;let cx=0,cy=0,cz=0,avx=0,avz=0;
  for(let i=0;i<n;i++){const b=f.birds[i];cx+=b.x;cy+=b.y;cz+=b.z;avx+=b.vx;avz+=b.vz;}cx/=n;cy/=n;cz/=n;avx/=n;avz/=n;
  // Shared predictive probes, biased away from the higher side of the slope.
  const aheadX=cx+f.dx*10,aheadZ=cz+f.dz*10;
  const h=this.world.height(aheadX,aheadZ),left=this.world.height(aheadX-f.dz*4,aheadZ+f.dx*4),right=this.world.height(aheadX+f.dz*4,aheadZ-f.dx*4),side=T.MathUtils.clamp((right-left)*.15,-2,2);
  for(let i=0;i<n;i++){
   const b=f.birds[i];let sx=0,sy=0,sz=0;
   for(let j=0;j<n;j++){if(i===j)continue;const o=f.birds[j],dx=b.x-o.x,dy=b.y-o.y,dz=b.z-o.z,d2=dx*dx+dy*dy+dz*dz;if(d2<1.44){const strength=2/Math.max(.08,d2);sx+=dx*strength;sy+=dy*strength;sz+=dz*strength;}}
   b.tx=f.dx*8-f.dz*side+(cx-b.x)*.45+(avx-b.vx)*.15+sx+Math.sin(this.time*.8+b.phase)*.55;
   b.tz=f.dz*8+f.dx*side+(cz-b.z)*.45+(avz-b.vz)*.15+sz+Math.cos(this.time*.7+b.phase)*.55;
   b.ty=Math.max(f.age<2?3:1.1,(h+5-b.y)*1.7,(cy-b.y)*.5+sy);b.ty=Math.min(24,b.ty);
  }
 }
 update(dt,viewer){
  dt=Math.max(0,Math.min(.05,dt));this.time+=dt;this.viewer.value.copy(viewer);this.scanTime-=dt;this.steerTime-=dt;
  if(this.scanTime<=0){this.scan(viewer);this.scanTime=.1;}
  const steering=this.steerTime<=0;if(steering)this.steerTime=SPARROWS.steeringStep;
  let slot=0;
  for(const f of this.flocks){if(!f.record)continue;f.age+=dt;if(f.flying&&steering)this.steer(f);let remaining=false;
   for(let i=0;i<f.record.count;i++){
    const b=f.birds[i],air=f.flying&&f.age>=b.delay;let peck=0,hop=0;
    if(air){const blend=1-Math.exp(-dt*3);b.vx+=(b.tx-b.vx)*blend;b.vy+=(b.ty-b.vy)*blend;b.vz+=(b.tz-b.vz)*blend;b.x+=b.vx*dt;b.z+=b.vz*dt;b.y+=b.vy*dt;
     // Last-resort clearance at the actual location protects steep unsampled banks.
     b.y=Math.max(b.y,this.world.height(b.x,b.z)+Math.min(1.2,(f.age-b.delay)*3));b.yaw=Math.atan2(-b.vx,-b.vz);
    }else if(f.record.kind==='ground'){
     const cycle=(this.time+b.phase)*.55,part=cycle%1,step=Math.floor(cycle),angle=b.phase+Math.sin(step*1.7)*1.7;
     // A smooth, short hop between two bounded points, with long grounded pauses.
     const u=Math.min(1,part/.16),smooth=u*u*(3-2*u),previous=b.phase+Math.sin((step-1)*1.7)*1.7;
     b.x=b.homeX+.22*(Math.sin(previous)*(1-smooth)+Math.sin(angle)*smooth);b.z=b.homeZ+.22*(Math.cos(previous)*(1-smooth)+Math.cos(angle)*smooth);
     hop=part<.16?Math.sin(u*Math.PI)*.12:0;b.y=this.world.height(b.x,b.z)+hop;b.yaw=previous+(angle-previous)*smooth;
     peck=part>.35&&part<.75?Math.sin((part-.35)/.4*Math.PI*2)**2*.65:0;
    }
    const distance=Math.hypot(b.x-viewer.x,b.y-viewer.y,b.z-viewer.z);if(distance<200)remaining=true;
    if(distance>=200||(f.record.kind==='tree'&&!air))continue;
    this.pose.position.set(b.x,b.y,b.z);this.pose.rotation.set(air?Math.atan2(b.vy,Math.hypot(b.vx,b.vz)):-peck,b.yaw,0);this.pose.updateMatrix();
    this.meshes[0].setMatrixAt(slot,this.pose.matrix);this.color.setRGB(b.tint,b.tint,b.tint);
    const flap=air?Math.sin(this.time*(36+b.phase)+b.phase)*.9:-1.25;
    for(let side=0;side<2;side++){const sign=side?1:-1;this.wing.position.set(sign*.027,.085,0);this.wing.rotation.z=sign*flap;this.wing.scale.set(sign*(air?1:.30),1,1);this.wing.updateMatrix();this.matrix.multiplyMatrices(this.pose.matrix,this.wing.matrix);this.meshes[side+1].setMatrixAt(slot,this.matrix);}
    for(const mesh of this.meshes)mesh.setColorAt(slot,this.color);slot++;
   }
   if(f.flying&&(!remaining||f.age>45))f.record=null;
  }
  for(const mesh of this.meshes){mesh.count=slot;if(slot){mesh.instanceMatrix.clearUpdateRanges();mesh.userData.uploadRange.count=slot*16;mesh.instanceMatrix.updateRanges.push(mesh.userData.uploadRange);mesh.instanceMatrix.needsUpdate=true;mesh.instanceColor.needsUpdate=true;}}
  this.instanceCount=slot;
 }
 dispose(){this.root.removeFromParent();for(const m of this.meshes)m.dispose();for(const g of this.geometries)g.dispose();this.material.dispose();this.buckets.clear();this.consumed.clear();}
}
