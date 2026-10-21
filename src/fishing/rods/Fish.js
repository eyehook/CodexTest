import * as THREE from '../../../projects/forest/vendor/three.module.js';
// Simple low-poly catch, mouth at the attachment origin and tail below it.
export class Fish extends THREE.Group {
 constructor(){
  super();this.visible=false;this.materials=[];
  const skin=new THREE.MeshStandardMaterial({color:0x83a598,roughness:.65,transparent:true});
  const fins=new THREE.MeshStandardMaterial({color:0x526f67,roughness:.8,transparent:true});
  const eyes=new THREE.MeshStandardMaterial({color:0x101719,roughness:.4,transparent:true});this.materials.push(skin,fins,eyes);
  const body=new THREE.Mesh(new THREE.SphereGeometry(1,12,8),skin);body.scale.set(.035,.095,.025);body.position.y=-.095;this.add(body);
  const tail=new THREE.Mesh(new THREE.ConeGeometry(.04,.055,3),fins);tail.position.y=-.197;tail.scale.z=.25;this.add(tail);
  for(const side of [-1,1]){const eye=new THREE.Mesh(new THREE.SphereGeometry(.004,6,4),eyes);eye.position.set(.018,-.04,side*.016);this.add(eye);}
 }
 setHue(hue){
  if(this.hue===hue)return;this.hue=hue;
  this.materials[0].color.setHSL(hue,.55,.5);this.materials[1].color.setHSL(hue,.45,.3);
 }
 setOpacity(opacity){for(const material of this.materials){material.opacity=opacity;material.depthWrite=opacity>=1;}}
}
