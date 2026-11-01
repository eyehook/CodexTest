import * as THREE from '../../shared/vendor/three-r180/three.module.js';

// A 14 cm pill aligned with the controller grip's finger direction (-Z).
export class HandPill {
 constructor(grip){
  this.grip=grip;
  this.geometry=new THREE.CapsuleGeometry(.03,.08,4,8).rotateX(Math.PI/2);
  this.material=new THREE.MeshLambertMaterial({color:0x69895b,toneMapped:false});
  this.mesh=new THREE.Mesh(this.geometry,this.material);this.mesh.name='hand-pill';this.mesh.visible=false;this.mesh.castShadow=false;this.mesh.receiveShadow=false;this.mesh.matrixAutoUpdate=false;grip.add(this.mesh);
 }
 update(source,tracked){const hand=source?.handedness;this.mesh.visible=!!tracked&&(hand==='left'||hand==='right')&&source?.gamepad?.mapping==='xr-standard'&&!source.hand;}
 dispose(){this.grip.remove(this.mesh);this.geometry.dispose();this.material.dispose();}
}
