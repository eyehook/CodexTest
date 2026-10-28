import * as THREE from '../../forest/vendor/three.module.js';
import { SnowSimulation } from './simulation.js?v=13';
import { snowParameters } from './parameters.js?v=5';
export class WeatherEffect {
  initialize(scene, parameters) { this.scene = scene; this.parameters = parameters; }
  activate() { if (this.object) this.object.visible = true; }
  deactivate() { if (this.object) this.object.visible = false; }
  setParameters() {}
  update() {}
  dispose() { this.object?.removeFromParent(); this.object?.geometry.dispose(); this.object?.material.dispose(); }
}
export class SnowEffect extends WeatherEffect {
  initialize(scene, parameters) {
    super.initialize(scene, parameters); parameters.register(snowParameters);
    this.simulation = new SnowSimulation();
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(this.simulation.positions, 3).setUsage(THREE.DynamicDrawUsage));
    geometry.setAttribute('flakeSize', new THREE.BufferAttribute(this.simulation.sizes, 1));
    const material = new THREE.ShaderMaterial({
      uniforms: { viewportHeight: { value: 1 }, sizeScale: { value: 1 } }, transparent: true, depthWrite: false,
      vertexShader: `attribute float flakeSize; uniform float viewportHeight; uniform float sizeScale;
      void main(){vec4 p=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*p;
      gl_PointSize=clamp(flakeSize*sizeScale*viewportHeight*projectionMatrix[1][1]/(2.*max(.05,-p.z)),1.,32.);}`,
      fragmentShader: `void main(){float r=length(gl_PointCoord-vec2(.5))*2.;float a=1.-smoothstep(.55,1.,r);if(a<.01)discard;gl_FragColor=vec4(.98,.99,1.,a*.85);}`,
    });
    this.object = new THREE.Points(geometry, material); this.object.frustumCulled = false;
    // The actual eye viewport is supplied separately for every XR eye.
    this.object.onBeforeRender = (renderer, scene, camera) => {
      material.uniforms.viewportHeight.value = camera.viewport?.w ?? renderer.getDrawingBufferSize(this.bufferSize).y;
    };
    this.bufferSize = new THREE.Vector2(); scene.add(this.object);
    this.unsubscribe = parameters.subscribe(() => this.setParameters()); this.setParameters();
  }
  activate(position) { super.activate(); if (position) this.simulation.resetVolume(position); }
  setParameters() {
    this.object.geometry.setDrawRange(0, this.parameters.values.count);
    this.object.material.uniforms.sizeScale.value = this.parameters.values.size;
  }
  update(dt, position) {
    const {count, wind, turbulence} = this.parameters.values;
    this.simulation.update(dt, count, wind, turbulence, position.x, position.z);
    const attribute = this.object.geometry.attributes.position;
    attribute.clearUpdateRanges(); if (count) attribute.addUpdateRange(0, count * 3); attribute.needsUpdate = count > 0;
  }
  dispose() { this.unsubscribe(); super.dispose(); }
}
