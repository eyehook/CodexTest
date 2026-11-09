import * as THREE from '../../shared/vendor/three-r180/three.module.js';
// A broad, pointed blade with a raised midrib and shallow ribs, shared by all leaves.
export function rosetteLeafGeometry(){
 const positions=[],indices=[],sections=12;
 for(let i=0;i<=sections;i++){
  const t=i/sections,width=.34*Math.sin(Math.PI*t)**.8,arch=.24*Math.sin(Math.PI*t)-.18*t*t;
  for(const side of [-1,0,1])positions.push(side*width,t,arch+(side===0?.055*Math.sin(Math.PI*t):.012*Math.sin(i*Math.PI/2)));
 }
 for(let i=0;i<sections;i++)for(let side=0;side<2;side++){const a=i*3+side,b=a+1,c=a+3,d=a+4;indices.push(a,c,b,b,c,d);}
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setIndex(indices);geometry.computeVertexNormals();return geometry;
}
