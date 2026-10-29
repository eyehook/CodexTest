import * as T from "three";
import { NAMES, INTENSITY_MAX, TYPES } from "./model.js?v=m2-1";
import { makeHelper } from "./lights.js?v=m2-1";
import { OBJECT_TYPES, OBJECT_NAMES, setUniformScale } from "./model.js?v=m2-1";
import { primitiveGeometry } from "./objects.js?v=m2-1";
import { ChoiceBar } from "../../shared/ui/choice-bar.mjs";
import { sliderValue } from "../../shared/ui/slider.mjs";
import { ControlModel } from "../../shared/ui/controls.mjs";
const W = 640,
  H = 1536,
  ROW = 54,
  TOP = 106;
export class LaboratoryUI {
  constructor(app) {
    this.app = app;
    this.open = true;
    this.tab = "lights";
    this.controlKey = null;
    this.group = new T.Group();
    this.group.visible = app.renderer.xr.isPresenting;
    app.scene.add(this.group);
    this.panels = [];
    this.openMenu = null;
    this.prototypes = [];
    ["Scene Settings", "Creation Palette", "Settings"].forEach((title, i) => {
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
    });
    this.allPrototypes = [];
    for (const [kind, types] of [
      ["light", TYPES],
      ["object", OBJECT_TYPES],
    ])
      types.forEach((type, i) => {
        const helper =
          kind === "light"
            ? makeHelper(type, true)
            : new T.Mesh(
                primitiveGeometry(type, true),
                new T.MeshBasicMaterial({ color: 0xd9e8f1, toneMapped: false }),
              );
        if (kind === "object") {
          helper.scale.setScalar(0.28);
          helper.userData.handle = helper;
          helper.rotation.x = 0.18;
          if (type !== "sphere") {
            const edges = new T.LineSegments(
              new T.EdgesGeometry(helper.geometry, 30),
              new T.LineBasicMaterial({ color: 0x547386, toneMapped: false }),
            );
            helper.add(edges);
          }
        }
        const y =
          0.84 - ((190 + i * 245 + (kind === "object" ? 80 : 100)) / H) * 1.68;
        helper.position.set(0, y, 0.09);
        helper.rotation.y = -0.35;
        helper.userData.prototype = type;
        helper.userData.prototypeKind = kind;
        helper.userData.handle.userData.prototype = type;
        helper.userData.handle.userData.prototypeKind = kind;
        if (type === "spot") helper.userData.lines.scale.set(0.12, 0.12, 0.23);
        if (type === "area") helper.userData.lines.scale.set(0.25, 0.18, 0.25);
        this.group.add(helper);
        this.allPrototypes.push(helper);
      });
    this.tabBar = new ChoiceBar({
      options: [
        { id: "lights", label: "Lights" },
        { id: "objects", label: "Objects" },
      ],
      getValue: () => this.tab,
      onSelect: (tab) => this.setTab(tab),
      x: 18,
      y: TOP,
      width: W - 36,
      height: 64,
      font: "bold 26px sans-serif",
    });
    this.updatePrototypes();
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
  updatePrototypes() {
    this.prototypes = [];
    for (const p of this.allPrototypes) {
      p.visible =
        p.userData.prototypeKind ===
        (this.tab === "lights" ? "light" : "object");
      if (p.visible) this.prototypes.push(p);
    }
  }
  cancelUIDrags() {
    for (const hand of this.app.input?.hands || []) hand.dragUI = null;
  }
  setTab(tab) {
    if (this.tab === tab) return;
    this.tab = tab;
    this.openMenu = null;
    this.cancelUIDrags();
    this.updatePrototypes();
    this.refresh();
  }
  selectionChanged(record) {
    this.tab = record.kind === "light" ? "lights" : "objects";
    this.updatePrototypes();
    this.openMenu = null;
    this.cancelUIDrags();
    if (!this.open) {
      this.open = true;
      this.place();
    }
    this.group.visible = this.open && this.app.renderer.xr.isPresenting;
    document.body.classList.remove("controls-hidden");
    this.refresh();
  }
  definitions() {
    const a = this.app,
      s = a.settings,
      r = a.entities.get(a.interaction.selected),
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
      { kind: "label", label: "Nothing selected" },
      { kind: "label", label: "Aim at a light or object and trigger." },
    ];
    if (d && r.kind === "light") {
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
          a.deleteEntity(d.id);
        },
      });
    }
    if (d && r.kind === "object") {
      const update = () => a.objects.apply(r);
      selected = [
        { kind: "label", label: OBJECT_NAMES[d.type] },
        ...colors("Color", d.material, "color", update),
        { kind: "swatch", label: "Live color", get: () => d.material.color },
        slider("Metalness", d.material, "metalness", 0, 1, 0.01, update),
        slider("Roughness", d.material, "roughness", 0, 1, 0.01, update),
        {
          kind: "slider",
          label: "All",
          min: 0.1,
          max: 10,
          step: 0.1,
          get: () => d.allScale,
          set: (v) => {
            setUniformScale(d, v);
            update();
          },
          force: true,
        },
        ...["X", "Y", "Z"].map((label, i) => ({
          kind: "slider",
          label,
          min: 0.1,
          max: 10,
          step: 0.1,
          get: () => d.scale[i],
          set: (v) => {
            d.scale[i] = v;
            update();
          },
        })),
        toggle("Cast shadows", d, "castShadow", update),
        toggle("Receive shadows", d, "receiveShadow", update),
        {
          kind: "button",
          label: "Delete object",
          action: () => a.deleteEntity(d.id),
        },
      ];
    }
    this.panels[2].title = !r
      ? "Settings"
      : r.kind === "object"
        ? "Object Settings"
        : {
            point: "Point Light Settings",
            spot: "Spot Light Settings",
            directional: "Directional Light Settings",
            area: "Area Light Settings",
          }[d.type];
    const palette = [];
    return [scene, palette, selected];
  }
  refresh(rebuild = true) {
    const definitions = this.definitions();
    this.bindControls(definitions);
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
    else this.syncDesktop();
  }
  bindControls(definitions) {
    const key = this.app.interaction.selected || "empty";
    const numeric = [];
    definitions.forEach((rows, panel) =>
      rows.forEach((row) => {
        if (row.kind === "slider" || row.kind === "toggle") {
          row.id = `${panel}:${row.label}`;
          numeric.push(row);
        }
      }),
    );
    if (this.controlKey !== key) {
      this.controlModel?.dispose();
      this.controlModel = new ControlModel(
        numeric.map((r) => ({
          id: r.id,
          label: r.label,
          kind: r.kind === "slider" ? "number" : "toggle",
          get: r.get,
          set: r.set,
          min: r.min,
          max: r.max,
          step: r.step,
          stepBase: 0,
        })),
      );
      this.controlKey = key;
    }
    numeric.forEach((row) => {
      const rawSet = row.set;
      row.set = (value) => {
        if (row.force) {
          const def = this.controlModel.definition(row.id),
            next = this.controlModel.normalize(def, value);
          if (next !== undefined && next === row.get()) {
            rawSet(next);
            return;
          }
        }
        this.controlModel.set(row.id, value);
      };
    });
  }
  syncDesktop() {
    if (!this.desktopBindings) return;
    for (const { row, input, output, swatch } of this.desktopBindings) {
      if (input) {
        if (input.type === "checkbox") input.checked = row.get();
        else input.value = row.get();
      }
      if (output)
        output.textContent =
          row.step === 1 ? Math.round(row.get()) : Number(row.get()).toFixed(2);
      if (swatch) swatch.style.background = `rgb(${row.get().join(",")})`;
    }
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
    g.fillText("SCENE TEST / SCENE LAB", 24, 82);
    if (index === 1) {
      this.tabBar.draw(g);
      const types = this.tab === "lights" ? TYPES : OBJECT_TYPES;
      const names = this.tab === "lights" ? NAMES : OBJECT_NAMES;
      types.forEach((type, i) => {
        const y = 190 + i * 245;
        g.fillStyle = "#213947";
        g.fillRect(18, y, W - 36, 220);
        g.fillStyle = "#effaff";
        g.font = "bold 26px sans-serif";
        g.fillText(names[type], 24, y + 40);
        g.font = "22px sans-serif";
        g.fillStyle = "#a9c4d3";
        g.fillText("Grip to create and select", 24, y + 194);
      });
      g.font = "22px sans-serif";
      g.fillStyle = "white";
      [
        "Right trigger: select / edit",
        "Either grip: create / move / rotate",
        "A: hold to duplicate pointed item",
        "B: deselect    Y: panels",
        "Left stick: move   Right: turn",
      ].forEach((t, i) => g.fillText(t, 24, 1220 + i * 48));
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
    if (index === undefined) return null;
    const x = intersection.uv.x * W,
      y = (1 - intersection.uv.y) * H;
    if (index === 1) {
      const option = this.tabBar.optionAt(x, y);
      return option
        ? {
            index,
            row: -1,
            control: {
              kind: "button",
              label: option.label,
              action: () => this.setTab(option.id),
            },
            x,
          }
        : null;
    }
    const row = Math.floor((y - TOP) / ROW);
    const control = this.panels[index].rows[row];
    return control ? { index, row, control, x } : null;
  }
  activate(hit, continuous = false) {
    if (!hit) return;
    const r = hit.control;
    if (r.kind === "slider") {
      r.set(sliderValue(r, hit.x, 28, 580));
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
    this.desktopBindings = [];
    this.panels.forEach((p, i) => {
      const section = document.createElement("section");
      const title = document.createElement("h2");
      title.textContent = p.title;
      section.append(title);
      if (i === 1) {
        const tabs = document.createElement("div");
        tabs.className = "tabs";
        tabs.setAttribute("role", "tablist");
        tabs.setAttribute("aria-label", "Creation tools");
        for (const [tab, label] of [
          ["lights", "Lights"],
          ["objects", "Objects"],
        ]) {
          const button = document.createElement("button");
          button.textContent = label;
          button.setAttribute("role", "tab");
          button.setAttribute("aria-selected", String(this.tab === tab));
          button.onclick = () => this.setTab(tab);
          tabs.append(button);
        }
        section.append(tabs);
        const types = this.tab === "lights" ? TYPES : OBJECT_TYPES,
          names = this.tab === "lights" ? NAMES : OBJECT_NAMES;
        types.forEach((type) => {
          const b = document.createElement("button");
          b.textContent = `+ ${names[type]}`;
          b.onclick = () => {
            this.app.createDesktop(
              type,
              this.tab === "lights" ? "light" : "object",
            );
            this.refresh();
          };
          section.append(b);
        });
        const help = document.createElement("p");
        help.textContent =
          "Click a light or object to select. Drag to move; Shift-drag rotates. WASD walks, arrow keys turn. Y toggles VR panels; B/Escape deselects. VR A: hold to duplicate a pointed item.";
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
              this.syncDesktop();
            };
            label.append(output, input);
            this.desktopBindings.push({ row: r, input, output });
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
            this.desktopBindings.push({ row: r, input });
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
            this.desktopBindings.push({ row: r, swatch: sw });
          }
          section.append(label);
        });
      if (i === 0) section.append(this.performanceOutput);
      this.desktop.append(section);
    });
  }
}
