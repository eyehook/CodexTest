import * as THREE from '../../forest/vendor/three.module.js';
import { WeatherEffect } from './effects.js?v=13';
import { RainSimulation } from './rain-simulation.js?v=13';
import { GroundEffects } from './ground-effects.js?v=10';
export const rainParameters = [
  { id: 'count', label: 'Rain density', min: 0, max: 50000, step: 1, default: 2000, format: v => Math.round(v).toLocaleString('en-US') },
  { id: 'wind', label: 'Wind speed', min: -6, max: 6, step: 0.1, default: 0, format: v => `${v.toFixed(1)} m/s` },
  { id: 'turbulence', label: 'Turbulence', min: 0, max: 100, step: 1, default: 0, format: v => `${Math.round(v)}%` },
  { id: 'fallSpeed', label: 'Fall speed multiplier', min: 0.25, max: 3, step: 0.05, default: 1, format: v => `${v.toFixed(2)}×` },
  { id: 'trailDuration', label: 'Trail duration', min: 5, max: 50, step: 1, default: 15, format: v => `${Math.round(v)} ms` },
  { id: 'groundEffects', label: 'Ground effects', kind: 'toggle', section: 'Ground Effects', min: 0, max: 1, step: 1, default: 1, format: v => v ? 'Enabled' : 'Disabled' },
  { id: 'splashes', label: 'Splash effects', kind: 'toggle', section: 'Ground Effects', min: 0, max: 1, step: 1, default: 1, format: v => v ? 'Enabled' : 'Disabled' },
  { id: 'ripples', label: 'Ripple effects', kind: 'toggle', section: 'Ground Effects', min: 0, max: 1, step: 1, default: 1, format: v => v ? 'Enabled' : 'Disabled' },
  { id: 'splashProbability', label: 'Splash probability', section: 'Ground Effects', min: 0, max: 100, step: 1, default: 15, format: v => `${Math.round(v)}%` },
  { id: 'rippleProbability', label: 'Ripple probability', section: 'Ground Effects', min: 0, max: 100, step: 1, default: 10, format: v => `${Math.round(v)}%` },
];
export class RainEffect extends WeatherEffect {
  initialize(scene, parameters, context = {}) {
    super.initialize(scene, parameters); parameters.register(rainParameters);
    this.groundEffects = new GroundEffects(scene, context.ground);
    this.simulation = new RainSimulation(50000, Math.random, this.groundEffects.groundY);
    this.simulation.onImpact = (x, y, z, vx, age, vy, vz) => this.groundEffects.impact(x, y, z, vx, age, vy, vz);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(this.simulation.segments, 3).setUsage(THREE.DynamicDrawUsage));
    this.object = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color: 0xd9dde0, transparent: false, depthWrite: true, blending: THREE.NoBlending }));
    this.object.frustumCulled = false; scene.add(this.object);
    this.uploadRange = { start: 0, count: 0 };
    this.unsubscribe = parameters.subscribe(() => this.setParameters()); this.setParameters();
  }
  activate(position) { super.activate(); this.groundEffects.group.visible = true; if (position) { this.simulation.groundY = this.groundEffects.groundY; this.simulation.resetVolume(position); } }
  deactivate() { super.deactivate(); this.groundEffects.group.visible = false; this.groundEffects.splashes.clear(); this.groundEffects.ripples.clear(); this.groundEffects.upload(); }
  setParameters() { this.object.geometry.setDrawRange(0, this.parameters.values.count * 2); this.groundEffects.configure(this.parameters.values); }
  update(dt, position) {
    this.groundEffects.update(dt);
    this.simulation.groundY = this.groundEffects.groundY;
    this.simulation.update(dt, this.parameters.values, position);
    const attribute = this.object.geometry.attributes.position, count = this.parameters.values.count;
    attribute.clearUpdateRanges(); this.uploadRange.count = count * 6; if (count) attribute.updateRanges.push(this.uploadRange); attribute.needsUpdate = count > 0; this.groundEffects.upload();
  }
  dispose() { this.unsubscribe(); this.groundEffects.dispose(); super.dispose(); }
}
