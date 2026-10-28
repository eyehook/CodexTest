import * as THREE from '../../forest/vendor/three.module.js';
import { WeatherParameters } from './parameters.js?v=5';
import { FrameRateCounter } from './fps.js?v=3';
import { Environment } from './environment.js';
import { PlayerController } from './player.js?v=2';
import { SnowEffect } from './effects.js?v=5';
import { DesktopControls, VRControlPanel } from './controls.js?v=3';
export class WeatherSimulator {
  constructor() {
    this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.xr.enabled = true; this.renderer.xr.setReferenceSpaceType('local-floor');
    document.body.prepend(this.renderer.domElement);
    this.scene = new THREE.Scene(); this.environment = new Environment(this.scene);
    this.player = new PlayerController(this.scene, this.renderer);
    this.effects = new Map([['snow', new SnowEffect()]]); this.selectEffect('snow');
    this.clock = new THREE.Clock(); this.fpsCounter = new FrameRateCounter();
    this.resize = () => { this.player.camera.aspect = innerWidth / innerHeight; this.player.camera.updateProjectionMatrix(); this.renderer.setSize(innerWidth, innerHeight); };
    window.addEventListener('resize', this.resize);
    this.renderer.xr.addEventListener('sessionstart', () => { document.body.classList.add('xr'); this.clock.getDelta(); this.fpsCounter.reset(); this.panel.setFPS(null); });
    this.renderer.xr.addEventListener('sessionend', () => { document.body.classList.remove('xr'); this.panel.update(null); this.fpsCounter.reset(); this.panel.setFPS(null); });
    this.setupXR(); this.renderer.setAnimationLoop((time, frame) => this.update(frame));
  }
  selectEffect(id) {
    const effect = this.effects.get(id); if (!effect) throw new Error(`Unknown weather: ${id}`);
    this.desktop?.dispose(); this.panel?.dispose();
    if (this.activeEffect) { this.activeEffect.deactivate(); this.activeEffect.dispose(); }
    this.parameters = new WeatherParameters(); effect.initialize(this.scene, this.parameters); effect.activate(); this.activeEffect = effect;
    this.desktop = new DesktopControls(document.querySelector('#parameters'), this.parameters);
    this.panel = new VRControlPanel(this.scene, this.player, this.parameters);
  }
  async setupXR() {
    const button = document.querySelector('#vr'), status = document.querySelector('#status');
    try {
      if (!await navigator.xr?.isSessionSupported('immersive-vr')) { button.textContent = 'VR unavailable'; status.textContent = 'Desktop mode ready. For VR, open in Quest Browser over HTTPS or localhost.'; return; }
      button.disabled = false; button.textContent = 'Enter VR'; status.textContent = 'Quest ready · B / Y opens weather controls';
      button.onclick = async () => {
        button.disabled = true;
        try {
          const session = await navigator.xr.requestSession('immersive-vr', { requiredFeatures: ['local-floor'] });
          await this.renderer.xr.setSession(session);
          if (session.supportedFrameRates?.includes(90)) await session.updateTargetFrameRate(90).catch(() => {});
          session.addEventListener('end', () => { button.disabled = false; }, { once: true });
        } catch (error) { status.textContent = `Could not enter VR: ${error.message}`; button.disabled = false; }
      };
    } catch (error) { button.textContent = 'VR unavailable'; status.textContent = error.message; }
  }
  update(frame) {
    const rawDt = this.clock.getDelta(), dt = Math.min(rawDt, 0.05), session = this.renderer.xr.getSession();
    if (document.hidden || (session && session.visibilityState !== 'visible')) { this.fpsCounter.reset(); this.panel.setFPS(null); return; }
    const position = this.player.update(dt, frame); if (!position) { this.fpsCounter.reset(); this.panel.setFPS(null); return; }
    this.environment.update(position); this.activeEffect.update(dt, position); this.panel.update(session);
    this.renderer.render(this.scene, this.player.camera);
    const fps = this.fpsCounter.sample(rawDt);
    if (fps !== null) {
      this.panel.setFPS(fps);
      document.querySelector('#stats').textContent = `${this.parameters.values.count.toLocaleString()} flakes · ${Math.round(fps)} FPS`;
    }
  }
  dispose() {
    this.renderer.setAnimationLoop(null); window.removeEventListener('resize', this.resize);
    this.desktop.dispose(); this.panel.dispose(); this.activeEffect.dispose(); this.environment.dispose(); this.player.dispose(); this.renderer.dispose(); this.renderer.domElement.remove();
  }
}
try { window.weatherSimulator = new WeatherSimulator(); } catch (error) { document.querySelector('#status').textContent = `Unable to start: ${error.message}`; console.error(error); }
