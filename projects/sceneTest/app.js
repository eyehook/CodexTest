import * as T from "three";
import { RectAreaLightUniformsLib } from "../../shared/vendor/three-r180/addons/RectAreaLightUniformsLib.js";
import { VRButton } from "../../shared/vendor/three-r180/addons/VRButton.js";
import {
  defaults,
  InteractionState,
  saveScene,
  loadScene,
} from "./model.js?v=shared-r180-1";
import { createEnvironment } from "./environment.js?v=shared-r180-1";
import { LightManager } from "./lights.js?v=shared-r180-1";
import { LaboratoryUI } from "./ui.js?v=shared-r180-1";
import { Input } from "./input.js?v=shared-r180-1";
class Laboratory {
  constructor() {
    this.settings = defaults();
    this.message = "Ready · Grip a palette light to begin";
    this.scene = new T.Scene();
    this.renderer = new T.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.xr.enabled = true;
    this.renderer.xr.setReferenceSpaceType("local-floor");
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = T.PCFSoftShadowMap;
    document.querySelector("#viewport").append(this.renderer.domElement);
    this.camera = new T.PerspectiveCamera(
      65,
      innerWidth / innerHeight,
      0.05,
      80,
    );
    this.camera.position.set(0, 1.65, 0);
    this.camera.rotation.x = -0.25;
    this.rig = new T.Group();
    this.rig.add(this.camera);
    // Navigation uses the center-eye pose in reference-space coordinates.
    // The renderer's internal XR ArrayCamera has no rig parent: calling its
    // world-transform getters can overwrite the world matrix with its local pose.
    this.viewer = new T.PerspectiveCamera();
    this.rig.add(this.viewer);
    this.viewerPose = null;
    this.scene.add(this.rig);
    RectAreaLightUniformsLib.init();
    this.environment = createEnvironment(this.scene, this.renderer);
    this.ambient = new T.AmbientLight();
    this.hemisphere = new T.HemisphereLight();
    this.scene.add(this.ambient, this.hemisphere);
    this.interaction = new InteractionState();
    this.lights = new LightManager(this.scene, this.settings, this.interaction);
    try {
      const saved = loadScene(localStorage);
      if (saved) {
        Object.assign(this.settings, saved.settings);
        saved.lights.forEach((d) => this.lights.create(d.type, d));
        this.message = "Saved scene restored";
      }
    } catch (e) {
      this.message = `Saved scene unavailable: ${e.message}`;
    }
    this.applySettings();
    this.ui = new LaboratoryUI(this);
    this.input = new Input(this);
    document.body.append(VRButton.createButton(this.renderer));
    this.renderer.xr.addEventListener("sessionstart", () => {
      this.input.releaseAll();
      this.camera.position.set(0, 0, 0);
      this.camera.rotation.set(0, 0, 0);
      this.rig.position.set(0, 0, 0);
      this.rig.rotation.set(0, 0, 0);
      document.body.classList.add("immersive");
      this.ui.group.visible = this.ui.open;
      this.placeOnFrame = true;
      const session = this.renderer.xr.getSession();
      session.addEventListener("visibilitychange", () => {
        if (session.visibilityState !== "visible") this.input.releaseAll();
      });
    });
    this.renderer.xr.addEventListener("sessionend", () => {
      this.input.releaseAll();
      this.camera.position.set(0, 1.65, 0);
      this.camera.rotation.set(-0.25, 0, 0);
      document.body.classList.remove("immersive");
      this.ui.group.visible = false;
      this.ui.place();
    });
    addEventListener("resize", () => {
      this.camera.aspect = innerWidth / innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(innerWidth, innerHeight);
    });
    document.querySelector("#panel-toggle").onclick = () =>
      document.body.classList.toggle("controls-hidden");
    this.last = 0;
    this.frames = 0;
    this.elapsed = 0;
    this.lastStats = null;
    this.renderer.setAnimationLoop((time, frame) => this.frame(time, frame));
    // Read-only diagnostics for desktop/headset validation.
    window.sceneTest = {
      snapshot: () => ({
        settings: structuredClone(this.settings),
        lights: this.lights.serialize(),
        selected: this.interaction.selected,
        stats: this.lastStats,
      }),
      app: this,
    };
  }
  viewCamera() {
    return this.renderer.xr.isPresenting ? this.viewer : this.camera;
  }
  updateViewerPose(frame) {
    this.viewerPose =
      this.renderer.xr.isPresenting && frame
        ? frame.getViewerPose(this.renderer.xr.getReferenceSpace())
        : null;
    if (this.viewerPose) {
      const { position, orientation } = this.viewerPose.transform;
      this.viewer.position.copy(position);
      this.viewer.quaternion.copy(orientation);
      this.viewer.updateWorldMatrix(true, false);
    }
  }
  applySettings() {
    const s = this.settings;
    this.scene.background = new T.Color().setRGB(
      ...s.background.map((v) => v / 255),
      T.SRGBColorSpace,
    );
    this.ambient.color.setRGB(
      ...s.ambientColor.map((v) => v / 255),
      T.SRGBColorSpace,
    );
    this.ambient.intensity = s.ambientEnabled ? s.ambientIntensity : 0;
    this.hemisphere.color.setRGB(
      ...s.skyColor.map((v) => v / 255),
      T.SRGBColorSpace,
    );
    this.hemisphere.groundColor.setRGB(
      ...s.groundColor.map((v) => v / 255),
      T.SRGBColorSpace,
    );
    this.hemisphere.intensity = s.hemisphereEnabled ? s.hemisphereIntensity : 0;
    this.renderer.toneMapping = {
      None: T.NoToneMapping,
      "ACES Filmic": T.ACESFilmicToneMapping,
      Neutral: T.NeutralToneMapping,
    }[s.toneMapping];
    this.renderer.toneMappingExposure = s.exposure;
    for (const r of this.lights.records.values()) this.lights.apply(r);
  }
  notify(message) {
    this.message = message;
    document.querySelector("#status").textContent = message;
    this.ui?.refresh(false);
    clearTimeout(this.messageTimer);
    this.messageTimer = setTimeout(() => {
      this.message = "Ready";
      document.querySelector("#status").textContent = "Ready";
      this.ui?.refresh(false);
    }, 4000);
  }
  save() {
    try {
      saveScene(localStorage, this.settings, this.lights.serialize());
      this.notify("Scene saved");
    } catch (e) {
      this.notify(`Save failed: ${e.message}`);
    }
  }
  reset() {
    this.input?.releaseAll();
    this.lights.clear();
    this.interaction.clear();
    Object.assign(this.settings, defaults());
    this.applySettings();
    this.notify("Scene reset · Saved scene kept");
    this.ui?.refresh();
  }
  cancelMissingGrabs() {
    if (!this.input) return;
    for (const [hand, r] of this.input.grabs)
      if (!this.lights.records.has(r.data.id)) this.input.grabs.delete(hand);
    if (
      this.input.desktopDrag &&
      !this.lights.records.has(this.input.desktopDrag.record.data.id)
    )
      this.input.desktopDrag = null;
  }
  createDesktop(type) {
    const r = this.lights.create(type),
      camera = this.viewCamera(),
      p = new T.Vector3(),
      f = new T.Vector3();
    camera.getWorldPosition(p);
    camera.getWorldDirection(f);
    r.root.position.copy(p).addScaledVector(f, 1.5);
    r.root.lookAt(0, 0.5, -3);
    this.notify("Light created · Click its helper to select");
    return r;
  }
  frame(time, frame) {
    const raw = this.last ? (time - this.last) / 1000 : 0;
    const dt = Math.min(raw, 0.05);
    this.last = time;
    // Refresh before locomotion and UI input, rather than reading last render's pose.
    this.updateViewerPose(frame);
    this.input.update(dt, frame);
    this.lights.update();
    if (this.placeOnFrame && this.viewerPose) {
      this.ui.place();
      this.placeOnFrame = false;
    }
    this.renderer.render(this.scene, this.camera);
    this.frames++;
    this.elapsed += raw;
    if (this.elapsed >= 0.5) {
      const records = [...this.lights.records.values()];
      this.lastStats = {
        fps: Math.round(this.frames / this.elapsed),
        lights: records.filter((r) => r.data.enabled).length,
        shadows: records.filter((r) => r.light.castShadow && r.data.enabled)
          .length,
        calls: this.renderer.info.render.calls,
        triangles: this.renderer.info.render.triangles,
      };
      this.ui.updatePerformance();
      this.frames = 0;
      this.elapsed = 0;
    }
  }
}
try {
  new Laboratory();
} catch (e) {
  document.querySelector("#status").textContent =
    `Unable to start Scene Test: ${e.message}`;
  console.error(e);
}
