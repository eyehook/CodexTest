import * as THREE from '../../shared/vendor/three-r180/three.module.js';

const WRAP=52;
// A single faceted cloud geometry shared by five moving instances.
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
  constructor(scene) {
    this.scene=scene;this.elapsed=0;this.dummy=new THREE.Object3D();
    this.clouds=[
      {x:-26,y:13,z:-12,speed:.28,scale:1.05,yaw:.15},
      {x:-13,y:15,z:8,speed:.22,scale:.85,yaw:-.3},
      {x:0,y:12,z:-3,speed:.32,scale:1.2,yaw:.2},
      {x:13,y:14,z:16,speed:.25,scale:.95,yaw:-.15},
      {x:26,y:15,z:-16,speed:.3,scale:1.1,yaw:.4},
    ];
    const material=new THREE.MeshBasicMaterial({color:0xffffff,vertexColors:true,toneMapped:false});
    this.mesh=new THREE.InstancedMesh(cloudGeometry(),material,this.clouds.length);
    this.mesh.name='drifting-clouds';this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    // Decorative sky geometry is outside interaction targets and casts no shadows.
    this.mesh.castShadow=false;this.mesh.receiveShadow=false;scene.add(this.mesh);this.update(0);
  }
  update(dt) {
    if(!Number.isFinite(dt)||dt<0)return;
    this.elapsed+=dt;
    this.clouds.forEach((cloud,i)=>{
      const x=((cloud.x+this.elapsed*cloud.speed+WRAP)%(WRAP*2))-WRAP;
      this.dummy.position.set(x,cloud.y,cloud.z);this.dummy.rotation.set(0,cloud.yaw,0);this.dummy.scale.setScalar(cloud.scale);this.dummy.updateMatrix();this.mesh.setMatrixAt(i,this.dummy.matrix);
    });
    this.mesh.instanceMatrix.needsUpdate=true;this.mesh.computeBoundingSphere();
  }
  dispose(){this.scene.remove(this.mesh);this.mesh.dispose();this.mesh.geometry.dispose();this.mesh.material.dispose();}
}
