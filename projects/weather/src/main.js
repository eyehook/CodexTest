import * as THREE from '../../../shared/vendor/three-r180/three.module.js';
import { WeatherModes } from './weather-modes.js?v=shared-r180-1';
import { SettingsStore } from './settings.js?v=shared-r180-1';
import { weatherDefinitions } from './weather-catalog.js?v=shared-r180-1';
import { FrameRateCounter } from './fps.js?v=shared-xr-1';
import { Environment } from './environment.js?v=shared-r180-1';
import { PlayerController } from './player.js?v=shared-r180-1';
import { DesktopControls, VRControlPanel } from './controls.js?v=shared-r180-1';
export class WeatherSimulator {
  constructor() {
    this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.xr.enabled = true; this.renderer.xr.setReferenceSpaceType('local-floor');
    document.body.prepend(this.renderer.domElement);
    this.scene = new THREE.Scene(); this.environment = new Environment(this.scene);
    this.player = new PlayerController(this.scene, this.renderer);
    this.modes = new WeatherModes(this.scene, weatherDefinitions, { ground: this.environment.ground });
    this.modeSelect = document.querySelector('#weather-mode');
    for (const definition of this.modes.definitions) {
      const option = document.createElement('option'); option.value = definition.id; option.textContent = definition.label; this.modeSelect.append(option);
    }
    this.onModeChange = () => this.selectEffect(this.modeSelect.value);
    this.modeSelect.addEventListener('change', this.onModeChange);
    this.settingsStore = new SettingsStore(); const saved = this.settingsStore.load();
    this.selectEffect(this.modes.restore(saved));
    this.saveButton = document.querySelector('#save-settings'); this.onSaveSettings = () => this.saveSettings();
    this.saveButton.addEventListener('click', this.onSaveSettings);
    this.renderSaveStatus();
    this.clock = new THREE.Clock(); this.fpsCounter = new FrameRateCounter();
    this.resize = () => { this.player.camera.aspect = innerWidth / innerHeight; this.player.camera.updateProjectionMatrix(); this.renderer.setSize(innerWidth, innerHeight); };
    window.addEventListener('resize', this.resize);
    this.renderer.xr.addEventListener('sessionstart', () => { document.body.classList.add('xr'); this.panel.beginSession(); this.clock.getDelta(); this.fpsCounter.reset(); this.panel.setFPS(null); });
    this.renderer.xr.addEventListener('sessionend', () => { document.body.classList.remove('xr'); this.panel.update(null); this.fpsCounter.reset(); this.panel.setFPS(null); });
    this.setupXR(); this.renderer.setAnimationLoop((time, frame) => this.update(frame));
  }
  selectEffect(id) {
    if (this.modes.current?.definition.id === id) return;
    const state = this.modes.select(id, this.player.position);
    this.activeEffect = state.effect; this.parameters = state.parameters;
    this.activeEffect.update(0, this.player.position);
    this.unsubscribeSaveStatus?.();
    this.desktop?.dispose();
    this.desktop = new DesktopControls(document.querySelector('#parameters'), this.parameters);
    if (this.panel) this.panel.setEffect(this.parameters, id);
    else this.panel = new VRControlPanel(this.scene, this.player, this.parameters, {
      modes: this.modes.definitions, mode: id, onSelect: next => this.selectEffect(next), onSave: () => this.saveSettings(),
    });
    this.unsubscribeSaveStatus = this.parameters.subscribe(() => this.renderSaveStatus());
    this.renderSaveStatus();
    this.modeSelect.value = id;
    document.querySelector('h1').textContent = state.definition.title ?? state.definition.label;
    document.title = `Weather Lab · ${state.definition.title ?? state.definition.label}`;
    this.updateStats();
  }
  saveSettings() {
    const success = this.settingsStore.save(this.modes.snapshot());
    this.modes.current.saveStatus = success ? 'saved' : 'failed';
    this.renderSaveStatus(); return success;
  }
  renderSaveStatus() {
    const status = this.modes.current.saveStatus;
    document.querySelector('#save-settings').textContent = status === 'saved' ? 'Settings saved' : 'Save settings';
    document.querySelector('#save-status').textContent = status === 'saved' ? 'Settings saved for your next visit' : status === 'failed' ? 'Could not save settings. Please try again.' : '';
    this.panel.setSaveResult(status === 'idle' ? null : status === 'saved');
  }
  updateStats(fps = this.panel.fps) {
    const definition = this.modes.current.definition, count = this.parameters.values.count;
    const summary = Number.isFinite(count) && definition.particleLabel ? `${count.toLocaleString()} ${definition.particleLabel}` : definition.label;
    document.querySelector('#stats').textContent = `${summary} · ${fps === null ? '—' : Math.round(fps)} FPS`;
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
      this.updateStats(fps);
    }
  }
  dispose() {
    this.renderer.setAnimationLoop(null); window.removeEventListener('resize', this.resize);
    this.unsubscribeSaveStatus?.(); this.desktop.dispose(); this.panel.dispose(); this.modes.dispose(); this.modeSelect.removeEventListener('change', this.onModeChange); this.saveButton.removeEventListener('click', this.onSaveSettings); this.environment.dispose(); this.player.dispose(); this.renderer.dispose(); this.renderer.domElement.remove();
  }
}
try { window.weatherSimulator = new WeatherSimulator(); } catch (error) { document.querySelector('#status').textContent = `Unable to start: ${error.message}`; console.error(error); }
