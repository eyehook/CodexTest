import * as THREE from '../../shared/vendor/three-r180/three.module.js';

const CLOUD_SCALE=8;
// A single faceted cloud geometry shared by ten moving instances.
function cloudGeometry() {
  const lobe=new THREE.IcosahedronGeometry(1,0),source=lobe.attributes.position;
  const positions=[];
  const lobes=[[-2,0,0,1.5,.65,1.05],[-.8,.2,0,1.6,.95,1.2],[.4,.65,0,1.5,1.15,1.15],[1.6,.15,.1,1.5,.8,1.05],[.4,0,-.8,1.6,.6,1.1]];
  for(const [x,y,z,sx,sy,sz] of lobes)for(let i=0;i<source.count;i++)positions.push(x+source.getX(i)*sx,y+source.getY(i)*sy,z+source.getZ(i)*sz);
  lobe.dispose();
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.computeVertexNormals();
  // Baked facet shading keeps cloud undersides cool and light without ground tint.
  const normals=geometry.attributes.normal,colors=[];
  for(let i=0;i<normals.count;i++) {
    const shade=.8+.18*(-.4*normals.getX(i)+.75*normals.getY(i)+.5*normals.getZ(i));
    colors.push(shade*.97,shade*.99,shade);
  }
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));return geometry;
}
export class CloudSky {
  constructor(scene,{halfWidth=0,halfDepth=0,wallHeight=3.048,viewDistance=250,random=Math.random}={}) {
    this.scene=scene;this.elapsed=0;this.dummy=new THREE.Object3D();this.cycleSeconds=1800;this.wallHeight=wallHeight;
    this.clouds=Array.from({length:10},(_,i)=>({
      phase:((i/10+(random()-.5)*.06)%1+1)%1,
      y:i===0?28+random()*4:i===1?48+random()*10:i<9?28+random()*30:48+random()*16,
      z:[-100,0,100][i%3]+(random()-.5)*(i%3===1?10:24),bend:(random()-.5)*8,
      scale:(i===0?.4+random()*.2:i===1?1.3+random()*.4:i===9?1.3+random()*.3:.45+random()*1.2)*CLOUD_SCALE,yaw:random()*Math.PI*2
    }));
    const geometry=cloudGeometry();geometry.computeBoundingSphere();geometry.computeBoundingBox();
    this.cloudReach=(geometry.boundingSphere.radius+geometry.boundingSphere.center.length())*Math.max(...this.clouds.map(c=>c.scale));
    this.wrapDistance=Math.max(viewDistance*.8,Math.hypot(halfWidth,halfDepth)+this.cloudReach+20);
    for(const cloud of this.clouds){cloud.speed=this.wrapDistance*2/this.cycleSeconds;cloud.hiddenY=wallHeight-.2-geometry.boundingBox.max.y*cloud.scale;}
    const material=new THREE.MeshBasicMaterial({color:0xffffff,vertexColors:true,toneMapped:false});
    this.mesh=new THREE.InstancedMesh(geometry,material,10);this.mesh.name='drifting-clouds';this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.castShadow=false;this.mesh.receiveShadow=false;scene.add(this.mesh);this.update(0);
  }
  update(dt) {
    if(!Number.isFinite(dt)||dt<0)return;this.elapsed+=dt;
    this.clouds.forEach((cloud,i)=>{
      const phase=((cloud.phase+this.elapsed/this.cycleSeconds)%1+1)%1;
      const x=(phase*2-1)*this.wrapDistance,u=x/this.wrapDistance,arc=1-u*u;
      // The final 10% at each end is fully below the wall top before any wrap.
      const t=Math.max(0,Math.min(1,(Math.abs(u)-.65)/.25)),sink=t*t*(3-2*t);
      const y=(cloud.y+3*arc)*(1-sink)+cloud.hiddenY*sink;
      this.dummy.position.set(x,y,cloud.z+cloud.bend*arc);this.dummy.rotation.set(0,cloud.yaw,0);this.dummy.scale.setScalar(cloud.scale);this.dummy.updateMatrix();this.mesh.setMatrixAt(i,this.dummy.matrix);
    });this.mesh.instanceMatrix.needsUpdate=true;this.mesh.computeBoundingSphere();
  }
  dispose(){this.scene.remove(this.mesh);this.mesh.dispose();this.mesh.geometry.dispose();this.mesh.material.dispose();}
}
