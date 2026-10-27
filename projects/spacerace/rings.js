import * as THREE from '../forest/vendor/three.module.js';
import {RING_WAKE_SEGMENTS,RING_WAKE_FRAME_COUNT,RING_WAKE_REFERENCE_HZ,RING_WAKE_ENABLED} from './config.mjs?v=17';

export function wakeLength(speed,frames=RING_WAKE_FRAME_COUNT,hz=RING_WAKE_REFERENCE_HZ){
  return Math.max(0,speed)*frames/hz;
}
export function createWakeGeometry(radius,segments=RING_WAKE_SEGMENTS,radialSegments=128){
  const positions=[],indices=[];
  // Unit-length, open cylinder along -Z. Shared vertices interpolate opacity continuously.
  for(let row=0;row<=segments;row++)for(let col=0;col<=radialSegments;col++){
    const angle=col/radialSegments*Math.PI*2;
    positions.push(radius*Math.cos(angle),radius*Math.sin(angle),-row/segments);
  }
  const stride=radialSegments+1;
  for(let row=0;row<segments;row++)for(let col=0;col<radialSegments;col++){
    const a=row*stride+col,b=a+stride;
    indices.push(a,b,a+1,b,b+1,a+1);
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setIndex(indices);return geometry;
}
export function createRings(c,count){
  const group=new THREE.Group();
  const rings=new THREE.InstancedMesh(new THREE.RingGeometry(c.ringRadius-c.ringThickness/2,c.ringRadius+c.ringThickness/2,128),new THREE.MeshBasicMaterial({color:c.ringColor,side:THREE.DoubleSide}),count);
  rings.instanceMatrix.setUsage(THREE.DynamicDrawUsage);rings.frustumCulled=false;group.add(rings);
  const material=new THREE.ShaderMaterial({
    uniforms:{length:{value:0},color:{value:new THREE.Color(c.ringColor)}},
    vertexShader:`uniform float length; varying float opacity;
      void main(){
        opacity=1.0+position.z;
        vec3 stretched=vec3(position.xy,position.z*length);
        gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(stretched,1.0);
      }`,
    fragmentShader:`uniform vec3 color; varying float opacity;
      void main(){gl_FragColor=vec4(color,opacity);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,depthTest:true,side:THREE.DoubleSide,
    // Draw the double-sided surface in one pass; no stacked transparent shells.
    forceSinglePass:true,
  });
  const wakes=new THREE.InstancedMesh(createWakeGeometry(c.ringRadius),material,count);
  // Both batches use the exact same transforms and recycling boundary.
  wakes.instanceMatrix=rings.instanceMatrix;wakes.frustumCulled=false;wakes.visible=false;group.add(wakes);
  const matrix=new THREE.Matrix4();
  return {group,rings,wakes,update(positions,speed){
    for(let i=0;i<positions.length;i++){matrix.makeTranslation(0,0,positions[i]);rings.setMatrixAt(i,matrix);}
    rings.instanceMatrix.needsUpdate=true;
    const length=wakeLength(speed);material.uniforms.length.value=length;
    wakes.visible=RING_WAKE_ENABLED&&length>0;
  }};
}
