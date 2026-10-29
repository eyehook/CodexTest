import * as THREE from '../../../shared/vendor/three-r180/three.module.js';
export class Environment {
  constructor(scene) {
    scene.background = new THREE.Color(0x85888c);
    this.ground = new THREE.Mesh(new THREE.PlaneGeometry(2000, 2000), new THREE.ShaderMaterial({
      vertexShader: `varying vec2 worldXZ;void main(){vec4 p=modelMatrix*vec4(position,1.);worldXZ=p.xz;gl_Position=projectionMatrix*viewMatrix*p;}`,
      fragmentShader: `varying vec2 worldXZ;void main(){vec2 w=fwidth(worldXZ);vec2 a=abs(fract((worldXZ-.5)*.5)-.5);vec2 b=clamp((a-.25)/max(w*.5,vec2(.0001)),-.5,.5);float c=.5-2.*b.x*b.y;c=mix(c,.5,smoothstep(.25,1.,max(w.x,w.y)));gl_FragColor=vec4(vec3(mix(.26,.39,c)),1.);}`,
    }));
    this.ground.rotation.x = -Math.PI / 2; scene.add(this.ground);
  }
  update(position) { this.ground.position.set(Math.floor(position.x), 0, Math.floor(position.z)); }
  dispose() { this.ground.removeFromParent(); this.ground.geometry.dispose(); this.ground.material.dispose(); }
}
