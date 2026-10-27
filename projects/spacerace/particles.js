import * as THREE from '../forest/vendor/three.module.js';
export function createParticles(sim) {
  const c=sim.config, geometry=new THREE.InstancedBufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([-1,-1,0,1,-1,0,1,1,0,-1,1,0],3));
  geometry.setIndex([0,1,2,0,2,3]);
  const centers=new THREE.InstancedBufferAttribute(sim.positions,3).setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('center',centers);
  geometry.setAttribute('rank',new THREE.InstancedBufferAttribute(Float32Array.from({length:c.maxParticles},(_,i)=>i+0.5),1));
  geometry.instanceCount=c.maxParticles;
  const material=new THREE.ShaderMaterial({
    uniforms:{speedRatio:{value:0},density:{value:200},size:{value:c.minSize},streak:{value:c.maxStreak},exponent:{value:c.stretchExponent},farLimit:{value:c.drawDistance},rear:{value:c.rearBoundary}},
    vertexShader:`attribute vec3 center; attribute float rank;
      uniform float speedRatio,density,size,streak,exponent,farLimit,rear;
      varying vec2 uvQuad; varying float opacity;
      void main(){
        vec4 viewCenter=modelViewMatrix*vec4(center,1.0);
        vec3 travel=normalize(mat3(modelViewMatrix)*vec3(0.0,0.0,1.0));
        // Width perpendicular to the flight axis for each eye; fallback on-axis.
        vec3 viewDirection=normalize(-viewCenter.xyz);
        vec3 side=cross(travel,viewDirection);
        side=length(side)>0.001?normalize(side):vec3(1.0,0.0,0.0);
        vec3 offset=side*position.x*size*0.5;
        offset+=travel*position.y*streak*pow(speedRatio,exponent)*0.5;
        offset+=normalize(cross(viewDirection,side))*position.y*size*0.5;
        gl_Position=projectionMatrix*(viewCenter+vec4(offset,0.0));
        uvQuad=position.xy;
        opacity=(1.0-smoothstep(density-24.0,density+24.0,rank))
          *smoothstep(-farLimit,-farLimit+15.0,center.z)
          *(1.0-smoothstep(rear-5.0,rear,center.z));
      }`,
    fragmentShader:`varying vec2 uvQuad; varying float opacity; uniform float speedRatio;
      void main(){float edge=1.0-smoothstep(0.55,1.0,abs(uvQuad.x));
        float tip=1.0-smoothstep(0.65,1.0,abs(uvQuad.y));
        gl_FragColor=vec4(vec3(0.82+0.18*speedRatio),opacity*edge*tip);}`,
    transparent:true,depthWrite:false,depthTest:true,side:THREE.DoubleSide,
  });
  const mesh=new THREE.Mesh(geometry,material);mesh.frustumCulled=false;
  return {mesh,update(density){centers.needsUpdate=true;material.uniforms.speedRatio.value=sim.speed/c.maxSpeed;material.uniforms.density.value=density;}};
}
