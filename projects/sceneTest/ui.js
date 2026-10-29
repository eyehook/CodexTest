import * as T from "three";
import { NAMES, INTENSITY_MAX, TYPES } from "./model.js";
import { makeHelper } from "./lights.js";
const W = 640,
  H = 1536,
  ROW = 54,
  TOP = 106;
export class LaboratoryUI {
  constructor(app) {
    this.app = app;
    this.open = true;
    this.group = new T.Group();
    this.group.visible = app.renderer.xr.isPresenting;
    app.scene.add(this.group);
    this.panels = [];
    this.openMenu = null;
    this.prototypes = [];
    ["Scene Settings", "Light Palette", "Selected Light"].forEach(
      (title, i) => {
        const canvas = document.createElement("canvas");
        canvas.width = W;
        canvas.height = H;
        const texture = new T.CanvasTexture(canvas);
        texture.colorSpace = T.SRGBColorSpace;
        texture.minFilter = T.LinearFilter;
        const mesh = new T.Mesh(
          new T.PlaneGeometry(0.7, 1.68),
          new T.MeshBasicMaterial({ map: texture, toneMapped: false }),
        );
        mesh.position.x = (i - 1) * 0.74;
        mesh.userData.panel = i;
        this.group.add(mesh);
        this.panels.push({ title, canvas, texture, mesh, rows: [] });
      },
    );
    TYPES.forEach((type, i) => {
      const helper = makeHelper(type, true);
      helper.position.set(0, 0.53 - i * 0.29, 0.08);
      helper.rotation.y = -0.35;
      helper.userData.prototype = type;
      helper.userData.handle.userData.prototype = type;
      this.group.add(helper);
      this.prototypes.push(helper);
      if (type === "spot") helper.userData.lines.scale.set(0.12, 0.12, 0.23);
      if (type === "area") helper.userData.lines.scale.set(0.25, 0.18, 0.25);
    });
    this.desktop = document.querySelector("#controls");
    this.performanceOutput = document.querySelector("#performance");
    this.refresh();
    this.place();
  }
  place() {
    const camera = this.app.viewCamera();
    const p = new T.Vector3(),
      f = new T.Vector3();
    camera.getWorldPosition(p);
    camera.getWorldDirection(f);
    f.y = 0;
    if (f.lengthSq() < 0.01) f.set(0, 0, -1);
    f.normalize().applyAxisAngle(new T.Vector3(0, 1, 0), -Math.PI / 4);
    this.group.position.copy(p).addScaledVector(f, 1.85);
    this.group.position.y = Math.max(0.95, p.y - 0.12);
    this.group.lookAt(p.x, this.group.position.y, p.z);
    this.group.updateMatrixWorld(true);
  }
  toggle() {
    this.open = !this.open;
    this.group.visible = this.open && this.app.renderer.xr.isPresenting;
    if (this.open) this.place();
  }
  definitions() {
    const a = this.app,
      s = a.settings,
      r = a.lights.records.get(a.interaction.selected),
      d = r?.data;
    const change = () => a.applySettings();
    const slider = (
      label,
      obj,
      key,
      min,
      max,
      step = 0.01,
      onchange = change,
    ) => ({
      kind: "slider",
      label,
      min,
      max,
      step,
      get: () => obj[key],
      set: (v) => {
        obj[key] = v;
        onchange();
      },
    });
    const toggle = (label, obj, key, onchange = change) => ({
      kind: "toggle",
      label,
      get: () => obj[key],
      set: (v) => {
        obj[key] = v;
        onchange();
      },
    });
    const select = (label, key, options) => ({
      kind: "select",
      label,
      options,
      get: () => s[key],
      set: (v) => {
        s[key] = v;
        change();
      },
    });
    const colors = (label, obj, key, onchange = change) =>
      ["R", "G", "B"].map((ch, i) => ({
        kind: "slider",
        label: `${label} ${ch}`,
        min: 0,
        max: 255,
        step: 1,
        get: () => obj[key][i],
        set: (v) => {
          obj[key][i] = v;
          onchange();
        },
      }));
    const scene = [
      ...colors("Background", s, "background"),
      toggle("Ambient enabled", s, "ambientEnabled"),
      ...colors("Ambient", s, "ambientColor"),
      slider("Ambient intensity", s, "ambientIntensity", 0, 3),
      toggle("Hemisphere enabled", s, "hemisphereEnabled"),
      ...colors("Sky", s, "skyColor"),
      ...colors("Ground", s, "groundColor"),
      slider("Hemisphere intensity", s, "hemisphereIntensity", 0, 3),
      toggle("Global shadows", s, "shadows"),
      select("Shadow resolution", "shadowResolution", [256, 512, 1024, 2048]),
      select("Tone mapping", "toneMapping", ["None", "ACES Filmic", "Neutral"]),
      slider("Exposure", s, "exposure", 0.1, 3),
      { kind: "button", label: "Save Scene", action: () => a.save() },
      { kind: "button", label: "Reset Scene", action: () => a.reset() },
    ];
    let selected = [
      { kind: "label", label: "No light selected" },
      { kind: "label", label: "Aim at a light and press trigger." },
    ];
    if (d) {
      const update = () => a.lights.apply(r);
      selected = [
        { kind: "label", label: NAMES[d.type] },
        toggle("Enabled", d, "enabled", update),
        ...colors("Color", d, "color", update),
        { kind: "swatch", label: "Live color", get: () => d.color },
        ...Object.entries({
          White: [255, 255, 255],
          "Warm white": [255, 214, 170],
          Red: [255, 0, 0],
          Green: [0, 255, 0],
          Blue: [0, 0, 255],
        }).map(([label, color]) => ({
          kind: "button",
          label,
          action: () => {
            d.color = [...color];
            update();
          },
        })),
        slider(
          "Intensity",
          d,
          "intensity",
          0,
          INTENSITY_MAX[d.type],
          0.01,
          update,
        ),
      ];
      if (d.type !== "area")
        selected.push(toggle("Cast shadows", d, "shadows", update));
      if (d.type === "point" || d.type === "spot")
        selected.push(
          slider("Range (0 = unlimited)", d, "range", 0, 30, 0.1, update),
        );
      if (d.type === "spot")
        selected.push(
          slider("Cone angle °", d, "angle", 5, 90, 1, update),
          slider("Penumbra", d, "penumbra", 0, 1, 0.01, update),
        );
      if (d.type === "area")
        selected.push(
          slider("Width (m)", d, "width", 0.1, 6, 0.1, update),
          slider("Height (m)", d, "height", 0.1, 6, 0.1, update),
        );
      selected.push({
        kind: "button",
        label: "Delete light",
        action: () => {
          a.lights.remove(d.id);
          a.cancelMissingGrabs();
        },
      });
    }
    const palette = [
      { kind: "label", label: "Grip a symbol to create a light." },
      { kind: "label", label: "Trigger selects. Grip selects + moves." },
      { kind: "label", label: "Grabbing a new light selects it." },
      { kind: "label", label: "Helpers always remain visible." },
    ];
    return [scene, palette, selected];
  }
  refresh(rebuild = true) {
    const definitions = this.definitions();
    this.panels.forEach((p, i) => {
      p.rows = definitions[i];
      if (this.openMenu?.panel === i) {
        const { row } = this.openMenu;
        const entry = p.rows[row];
        if (entry?.kind === "select")
          p.rows.splice(
            row + 1,
            0,
            ...entry.options.map((v) => ({
              kind: "button",
              label: `  ${v}`,
              action: () => {
                entry.set(v);
                this.openMenu = null;
              },
            })),
          );
      }
      this.draw(p, i);
    });
    if (rebuild) this.renderDesktop();
  }
  draw(p, index) {
    const g = p.canvas.getContext("2d");
    g.fillStyle = "#13212b";
    g.fillRect(0, 0, W, H);
    g.strokeStyle = "#48677a";
    g.lineWidth = 4;
    g.strokeRect(2, 2, W - 4, H - 4);
    g.fillStyle = "#79d9f5";
    g.font = "bold 32px sans-serif";
    g.fillText(p.title, 24, 51);
    g.font = "20px sans-serif";
    g.fillStyle = "#b3c6d0";
    g.fillText("SCENE TEST / LIGHTING LAB", 24, 82);
    if (index === 1) {
      TYPES.forEach((type, i) => {
        const y = TOP + i * 265;
        g.fillStyle = "#213947";
        g.fillRect(18, y, W - 36, 240);
        g.fillStyle = "#effaff";
        g.font = "bold 26px sans-serif";
        g.fillText(NAMES[type], 24, y + 40);
        g.font = "22px sans-serif";
        g.fillStyle = "#a9c4d3";
        g.fillText("Grip the floating symbol", 24, y + 207);
      });
      g.font = "22px sans-serif";
      g.fillStyle = "white";
      [
        "Right trigger: select / edit",
        "Either grip: create / move / rotate",
        "B: deselect    Y: panels",
        "Left stick: move   Right: turn",
      ].forEach((t, i) => g.fillText(t, 24, TOP + 1090 + i * 48));
    } else
      p.rows.forEach((r, i) => {
        const y = TOP + i * ROW;
        g.fillStyle = i % 2 ? "#1a303e" : "#172a36";
        g.fillRect(16, y, W - 32, ROW - 3);
        g.font = "23px sans-serif";
        g.fillStyle = "#edf7ff";
        g.fillText(r.label, 26, y + 24);
        if (r.kind === "slider") {
          const v = r.get();
          g.font = "21px monospace";
          g.textAlign = "right";
          g.fillText(
            r.step === 1 ? Math.round(v) : Number(v).toFixed(2),
            610,
            y + 24,
          );
          g.textAlign = "left";
          g.fillStyle = "#405564";
          g.fillRect(28, y + 35, 580, 9);
          g.fillStyle = "#72d5ef";
          g.fillRect(28, y + 35, (580 * (v - r.min)) / (r.max - r.min), 9);
        }
        if (r.kind === "toggle" || r.kind === "select") {
          g.fillStyle = "#79d9f5";
          g.textAlign = "right";
          g.fillText(
            r.kind === "toggle" ? (r.get() ? "ON" : "OFF") : `${r.get()} ▾`,
            610,
            y + 46,
          );
          g.textAlign = "left";
        }
        if (r.kind === "button") {
          g.fillStyle = "#79d9f5";
          g.textAlign = "right";
          g.fillText("→", 608, y + 31);
          g.textAlign = "left";
        }
        if (r.kind === "swatch") {
          g.fillStyle = `rgb(${r.get().join(",")})`;
          g.fillRect(370, y + 8, 230, 34);
        }
      });
    if (index === 0 && this.openMenu?.panel !== 0) {
      const stats = this.app.lastStats;
      g.fillStyle = "#79d9f5";
      g.font = "bold 23px sans-serif";
      g.fillText("Performance", 26, H - 194);
      g.fillStyle = "#d5f3ff";
      g.font = "23px monospace";
      if (stats) {
        g.fillText(
          `${stats.fps} FPS · ${stats.lights} lights · ${stats.shadows} shadows`,
          26,
          H - 150,
        );
        g.fillText(
          `${stats.calls} calls · ${stats.triangles.toLocaleString()} triangles`,
          26,
          H - 106,
        );
      } else {
        g.fillText("Starting renderer…", 26, H - 150);
      }
    }
    g.fillStyle = "#a7c5d4";
    g.font = "21px sans-serif";
    g.fillText(this.app.message || "Ready", 24, H - 24);
    p.texture.needsUpdate = true;
  }
  hit(intersection) {
    const index = intersection.object.userData.panel;
    if (index === undefined || index === 1) return null;
    const x = intersection.uv.x * W,
      y = (1 - intersection.uv.y) * H;
    const row = Math.floor((y - TOP) / ROW);
    const control = this.panels[index].rows[row];
    return control ? { index, row, control, x } : null;
  }
  activate(hit, continuous = false) {
    if (!hit) return;
    const r = hit.control;
    if (r.kind === "slider") {
      const f = T.MathUtils.clamp((hit.x - 28) / 580, 0, 1);
      r.set(
        T.MathUtils.clamp(
          Math.round((r.min + f * (r.max - r.min)) / r.step) * r.step,
          r.min,
          r.max,
        ),
      );
    } else if (!continuous) {
      if (r.kind === "toggle") r.set(!r.get());
      if (r.kind === "button") r.action();
      if (r.kind === "select")
        this.openMenu =
          this.openMenu?.panel === hit.index && this.openMenu.row === hit.row
            ? null
            : { panel: hit.index, row: hit.row };
    }
    this.refresh(false);
  }
  updatePerformance() {
    const stats = this.app.lastStats;
    if (stats)
      this.performanceOutput.textContent = `${stats.fps} FPS · ${stats.lights} lights · ${stats.shadows} shadows · ${stats.calls} draw calls · ${stats.triangles.toLocaleString()} triangles`;
    this.draw(this.panels[0], 0);
  }
  renderDesktop() {
    this.desktop.replaceChildren();
    this.panels.forEach((p, i) => {
      const section = document.createElement("section");
      const title = document.createElement("h2");
      title.textContent = p.title;
      section.append(title);
      if (i === 1) {
        TYPES.forEach((type) => {
          const b = document.createElement("button");
          b.textContent = `+ ${NAMES[type]}`;
          b.onclick = () => {
            this.app.createDesktop(type);
            this.refresh();
          };
          section.append(b);
        });
        const help = document.createElement("p");
        help.textContent =
          "Click a helper to select. Drag it to move; Shift-drag rotates. WASD walks, arrow keys turn. Y toggles VR panels; B/Escape deselects.";
        section.append(help);
      } else
        p.rows.forEach((r) => {
          const label = document.createElement("label");
          const text = document.createElement("span");
          text.textContent = r.label;
          label.append(text);
          if (r.kind === "slider") {
            const output = document.createElement("output");
            output.textContent = r.get();
            const input = document.createElement("input");
            input.type = "range";
            input.min = r.min;
            input.max = r.max;
            input.step = r.step;
            input.value = r.get();
            input.setAttribute("aria-label", r.label);
            input.oninput = () => {
              r.set(Number(input.value));
              output.textContent = Number(input.value).toFixed(
                r.step === 1 ? 0 : 2,
              );
              this.refresh(false);
              this.desktop.querySelectorAll("[data-swatch]").forEach((el) => {
                const rec = this.app.lights.records.get(
                  this.app.interaction.selected,
                );
                if (rec)
                  el.style.background = `rgb(${rec.data.color.join(",")})`;
              });
            };
            label.append(output, input);
          }
          if (r.kind === "toggle") {
            const input = document.createElement("input");
            input.type = "checkbox";
            input.checked = r.get();
            input.onchange = () => {
              r.set(input.checked);
              this.refresh(false);
            };
            label.append(input);
          }
          if (r.kind === "select") {
            const select = document.createElement("select");
            select.setAttribute("aria-label", r.label);
            r.options.forEach((v) => {
              const o = document.createElement("option");
              o.value = v;
              o.textContent = v;
              select.append(o);
            });
            select.value = r.get();
            select.onchange = () => {
              r.set(
                typeof r.options[0] === "number"
                  ? Number(select.value)
                  : select.value,
              );
              this.refresh(false);
            };
            label.append(select);
          }
          if (r.kind === "button") {
            const b = document.createElement("button");
            b.textContent = r.label;
            b.onclick = () => {
              r.action();
              this.refresh();
            };
            section.append(b);
            return;
          }
          if (r.kind === "swatch") {
            const sw = document.createElement("span");
            sw.dataset.swatch = "true";
            sw.style.cssText = `display:block;height:24px;background:rgb(${r.get().join(",")})`;
            label.append(sw);
          }
          section.append(label);
        });
      if (i === 0) section.append(this.performanceOutput);
      this.desktop.append(section);
    });
  }
}
