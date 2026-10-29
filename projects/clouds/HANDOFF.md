# Clouds — development handoff

Updated 2026-10-28. Repository: `/Users/mm/Documents/GitHub/CodexTest`. Project: `projects/clouds/`. Read root [AGENTS.md](../../AGENTS.md) before editing. Original request: [MILESTONE_1.md](MILESTONE_1.md); user-facing setup: [README.md](README.md).

## Current state

The local Milestone 1 implementation is a standalone, buildless Three.js/WebXR volumetric cloud laboratory targeting Meta Quest 3. It includes the full-resolution reference renderer, configurable cloud-only resolution, simplified cloud shaders, desktop and VR controls, diagnostic modes and measured application cadence. It is **not committed or pushed**. Quest launch, stereo/depth appearance, controller usability and sustained performance have not been confirmed on a headset. Do not describe Milestone 1 as fully accepted yet.

Cloud resolution is now configurable live at 100/75/50/35/25%, default 100%. Reduced modes render linear cloud contribution/transmittance to a half-float target per eye (reused sequentially), then composite with full-resolution opaque color. Four-neighbor depth comparisons trigger full-resolution marching at depth boundaries. This is an experimental quality/performance tradeoff pending Quest validation; the extra composite and fallback work mean pixel-count reductions are not guaranteed speedups. The user has not authorized publication.

Root `index.html`, `README.md` and `AGENTS.md` register Clouds. The whole `projects/clouds/` directory is currently untracked. Two unrelated untracked Chess backups remain untouched and must stay excluded from any Clouds commit:

- `assets/chess/opponent/ManLP-articulated.blend1`
- `assets/chess/opponent/ManLP-articulated.blend2.blend`

## Run and resume

Serve the repository root, then open `/projects/clouds/`. There is no build or dependency-install step. A loopback preview on port 8081 was used for desktop validation; check that it is serving this checkout before reusing it. The preview URL is `http://127.0.0.1:8081/projects/clouds/`.

For a fresh desktop preview:

```sh
cd /Users/mm/Documents/GitHub/CodexTest
python3 -m http.server 8080 --bind 127.0.0.1
```

For Quest, use `/Users/mm/Documents/Start-Quest-VR.command` with a USB-connected, authorized headset, per root guidance. It serves the checkout and reverse-forwards port 8080. Keep the launcher terminal and USB connection active; open `http://localhost:8080/projects/clouds/` in Quest Browser. WebXR requires HTTPS or trusted localhost. Entry script currently uses `main.js?v=2`; advance relevant import versions if headset caches become stale.

Run the focused suite directly; Clouds has not been added to root package scripts:

```sh
node --test projects/clouds/tests/*.mjs
git diff --check
```

If system Git reports an Xcode license error or Node is absent, use the workspace dependency discovery tool to find bundled Git/Node. Do not accept an Xcode license or hardcode runtime cache paths into repository files.

## Environment and controls

Uniform gray sky, flat gray checkerboard at Y=0, one bounded density volume centered at `(0, 7, -20)`, size `20 × 10 × 20 m` at scale 1. The bounding base is Y=2; the density envelope has irregular rounded lobes. Scaling is about the fixed center, so large scales can extend below ground. There are no collisions or vertical flight controls.

Six opaque columns share a box geometry, each 1 m wide/deep and 15 m tall, centered at Y=7.5:

| Column | X | Z | Initial purpose |
| --- | ---: | ---: | --- |
| Red | -12 | -20 | Outside volume |
| Green | -4 | -17 | Intersects volume |
| Blue | 4 | -23 | Intersects volume |
| Yellow | 0 | -34 | Behind cloud |
| Cyan | -2 | -7 | In front of cloud |
| Magenta | 12 | -18 | Outside volume |

Desktop: WASD walks; dragging the scene changes look direction; arrows turn. VR: left thumbstick walks head-relative at 3 m/s; right thumbstick turns at 90°/s around the tracked head. Room-scale head offset is preserved. Tracking loss pauses input/rendering. B/Y toggles the panel on button edges. The panel opens on the first tracked frame of each XR session, 45° right, 1.2 m away, slightly below head height. It remains fixed in world space; reopening places it relative to the current head pose. Either controller ray and trigger can adjust sliders/toggles. Four tabs: Cloud, Rendering, Diagnostics, Performance.

## Parameter defaults and ranges

| Setting | Default | Range / choices |
| --- | --- | --- |
| Density | 1.0 | 0.1–5.0 |
| Threshold | 0.4 | 0–1 |
| Noise octaves | 2 | 1–6 |
| Noise texture | 64³ | 32³, 64³, 128³ |
| Cloud scale | 1.0 | 0.25–4.0 |
| Ray-march steps | 16 | 4–128 |
| Cloud resolution | 100% | 100%, 75%, 50%, 35%, 25% |
| Early termination | 0.02 | 0.001–0.1 |
| Foveation | 0 | 0–1, only when exposed by active session |
| Rendering mode | Normal | Normal, Density, Sample Count |
| Cloud / columns | On / On | Independent toggles |

Density, threshold, scale, sample count, termination, cloud resolution and diagnostics update live. Noise octave/noise-texture-resolution edits generate a replacement texture asynchronously. Cloud-resolution changes do not regenerate noise; they resize the cloud render target on the next render. Both desktop and VR Rendering tabs expose the five cloud-resolution settings, and the performance readouts show the selected percentage. No settings persistence was requested or implemented.

## Modules and rendering architecture

- [main.js](src/main.js): scene/XR setup, columns, frame loop, control wiring, cadence and CPU submission timing. Exposes `window.cloudLab` for debugging.
- [volume-renderer.js](src/volume-renderer.js): owns the worker, 3D texture, full-resolution color/depth target and reduced-resolution cloud target, and orchestrates the per-eye render/composite passes.
- [shaders.js](src/shaders.js): shared ray-march functions, full-resolution reference shader, reduced cloud shader and depth-aware composite shader.
- [noise.js](src/noise.js), [noise-worker.js](src/noise-worker.js): fixed-seed 1337 continuous value noise with multiple octaves. The worker runs one request at a time with only the latest pending configuration retained. Replaced textures are disposed; no per-frame noise generation.
- [parameters.js](src/parameters.js): shared desktop/VR definitions, defaults, clamping/quantization and subscriptions. Cloud resolution is stored as index 0–4 for 25/35/50/75/100%. Noise texture resolution is stored as index 0/1/2; rendering modes as 0/1/2.
- [player.js](src/player.js), [environment.js](src/environment.js), [controls.js](src/controls.js), [fps.js](src/fps.js): independent copies adapted from Weather conventions. Weather runtime/source is unchanged. The existing Three.js r180 bundle and MIT license under `shared/vendor/three-r180/` are reused unchanged.
- [lab.mjs](tests/lab.mjs), [input.mjs](tests/input.mjs): focused Node tests.

Each XR eye renders opaque scene geometry into the full-resolution color/depth target and immediately composites its cloud result into that eye's XR framebuffer viewport. The target is reused sequentially; neither eye samples a monoscopic cloud image. Automatic XR camera substitution is temporarily disabled, and the current eye's world/projection matrices are copied into a plain pass camera. Preserve the copied local matrix as well as world matrix, because Three.js updates cameras during rendering. Restore renderer state after the passes.

At 100%, cloud marching and compositing run in one full-resolution final pass. Below 100%, each eye first produces a cloud-only RGBA half-float texture: RGB is linear cloud contribution and alpha is transmittance (diagnostics use alpha zero where the volume is hit). Target dimensions are `ceil(eyeWidth * scale)` by `ceil(eyeHeight * scale)`, at least one pixel. The final pass manually bilinearly interpolates four cloud samples and combines them with full-resolution opaque color. It compares reconstructed view-space depths at those four sample positions against the current full-resolution pixel; a difference greater than `max(0.03 m, viewDepth * 0.002)` invokes full-resolution marching for that pixel. This heuristic requires headset inspection, especially on thin geometry and sloping surfaces.

The reduced target is reused sequentially between eyes, with each eye's cloud pass immediately consumed before the next eye overwrites it. It is allocated lazily and resized on dimension changes, not cached separately for every resolution. Switching can cause allocation or first-use shader compilation hitches. Half-float render-target support is currently assumed; there is no automatic unsupported-device fallback. The target remains allocated when returning to 100%, and is disposed with the renderer.

The shader reconstructs opaque world position using the current eye's inverse projection. Scene depth caps the ray exit distance. Uniform midpoint samples cover the actual clipped entry/exit segment, including rays starting inside the volume. Density combines precomputed noise, a threshold and overlapping rounded lobes with noise-perturbed edges. Transmittance uses `exp(-density × stepLength)` and terminates below the configured threshold. Output color conversion occurs once at final output; offscreen opaque color remains linear.

`setViewport`/`setScissor` use logical pixels in this bundled Three.js version, so physical eye dimensions/offsets are divided by renderer pixel ratio. Scissoring limits the final clear/composite to the current eye. These details were corrected during implementation; preserve them when changing the pipeline.

Density mode displays `1 - T` in grayscale, equivalent to `1 - exp(-opticalDepth)`. Sample Count maps executed samples divided by 128 to false color, providing a fixed scale across step settings. Cloud visibility off bypasses marching and the reduced cloud pass, but retains the full-resolution opaque-target/copy overhead. It is not a direct-render baseline, and in reduced modes it removes the additional cloud target and depth-aware upsampling work too.

Foveation is disabled unless the active XR layer exposes numeric `fixedFoveation`; supported changes use Three.js `setFoveation`. At 100%, ray marching runs directly into the XR framebuffer, so supported foveation may reduce its shading work. In reduced modes, the low-resolution cloud target is offscreen and not covered by XR foveation; the final composite/fallback still targets XR. Measure both paths.

## Performance interpretation

FPS and frame milliseconds measure actual rendered callback cadence over approximately 0.5 s. Hidden/untracked frames reset the counter. Desktop additionally reports CPU submission duration, including update/input and rendering commands. It is not GPU rendering time. No GPU timer measurement exists. The VR panel footer continuously displays cadence, step setting, cloud resolution and cloud on/off state without redrawing its texture while closed.

Total application budgets: 72 Hz = 13.89 ms; 90 Hz = 11.11 ms; 120 Hz = 8.33 ms. No sustained Quest benchmark or refresh-rate acceptance has been performed. Software-rendered browser FPS is not evidence about Quest performance.

## Original baseline validation — 2026-10-28

These results were recorded before the shader/resolution update. Fresh checks of the current implementation are listed below; the original pixel-depth and synthetic stereo checks were not rerun for the new reduced-resolution path.

- All 10 focused Node tests pass: deterministic noise and octave variation, coordinate consistency across texture sizes, continuity/bounds, parameter defaults/ranges/notifications, disabled controls, cadence at 72/90/120 Hz, actual controller-ray interactions across all four tabs, B/Y edges/held-entry behavior and world-lock/reopening, 3 m/s head-tracked locomotion, head-pivot turning and tracking loss.
- All source modules pass Node syntax checks; module/document links and `git diff --check` pass.
- Headless Chrome using software WebGL compiled and displayed the scene, including desktop DPR 2. Final browser launch reported no JavaScript/console errors. Explicit 128³ / 6-octave regeneration completed with an idle worker and no pending configuration.
- Browser pixel readback verified unchanged foreground opaque red with cloud on/off, obscured rear red, partially obscured intersecting red, grayscale Density output and false-color Sample Count output. Synthetic eye dispatch preserved distinct ±0.032 m origins and asymmetric projections.

Browser pixel/stereo dispatch checks were development scripts in the original chat's scratch directory, not committed browser tests or a root package command. The permanent automated suite is the 10 Node tests above. Synthetic eye checks do not establish actual headset stereo, compositor behavior, controller ergonomics or sustained performance. Shared runtime/root test tooling was unchanged; the full repository runtime suite was not run for Clouds.

## Next work / acceptance checklist

1. Test on Quest before declaring the baseline accepted: launch/exit/reentry; each eye's cloud boundaries and column intersections; foreground cyan remaining unobscured; rear yellow and internal green/blue occlusion; ground through thin cloud; moving underneath/inside/through the cloud; room-scale and thumbstick stability.
2. Check both controllers, B/Y open/close/reposition, held-button entry, every tab/slider/toggle, noise regeneration at the maximum settings and whether the session actually exposes foveation. Confirm panel text readability and world lock.
3. Measure sustained application cadence on Quest with cloud on/off, 4/16/128 steps, density/threshold changes, noise sizes/octaves and available foveation. Record actual session refresh rate, settings and results; do not call CPU submission duration GPU time.
4. Test live 100/75/50/35/25% switching, diagnostic modes, thin-column halos, panel text, and inside-cloud views in both eyes. Compare cadence against 100%; depth-boundary fallback can erase savings. Switching reallocates target storage and may hitch once. The 100% reference path bypasses the extra cloud target/composite.
5. Update this handoff with user feedback and verified results. Commit/push only when the user requests it; stage named Clouds/registration files and exclude Chess backups.

Remain within the requested laboratory scope: one stationary cloud, simple coloring, no shadows, secondary rays, atmospheric scattering, temporal accumulation, dithering, precipitation or weather simulation.

## Latest changes and validation — 2026-10-28

Shader now rejects volume misses before sampling depth, derives constant cloud color from final transmittance, and uses `1 - T` for Density mode. No additional density precomputation. Opaque geometry/UI retain full resolution. Reduced targets resize only when dimensions/settings change and are disposed with the renderer. Half-float color rendering is required for reduced modes. Fresh validation: all 10 focused Node tests pass, including controller-ray resolution switching; headless Chrome software WebGL at DPR 2 compiled and rendered all five resolutions in all three diagnostic modes without console/WebGL errors. Pixel readback confirmed grayscale Density and false-color Sample Count output. `git diff --check` passes. These checks do not establish headset stereo, boundary quality or speedup.

Changed Clouds files in this update: `src/shaders.js`, `src/volume-renderer.js`, `src/parameters.js`, `src/main.js`, `tests/lab.mjs`, `tests/input.mjs`, `index.html`, `README.md` and this handoff. Entry and changed shader/renderer/parameter imports use `?v=2`. The browser smoke script and screenshot are scratch artifacts from this chat, not permanent repository tests. No additional density precomputation, publication or Quest benchmark was performed.

## Shared Three.js relocation — 2026-10-29

Three.js r180 now lives at repository-level `shared/vendor/three-r180/`, with GLTFLoader, BufferGeometryUtils, VRButton and area-light modules in its `addons/` directory. Former Forest/Scene Test vendor directories are removed. Imports, tests, documentation and the knight exporter use the canonical shared paths. Core/license bytes are unchanged; addon code changes only adjust imports. Buildless entry/module queries use `shared-r180-1` to refresh cached module graphs. Racer, Terrain and Fishing static outputs were rebuilt from their updated sources; Swarm retains independent npm dependencies.

Validation: the complete root suite, all ten Cloud tests, three Vite builds, Scene Test browser integration and browser startup of all ten affected projects under `/CodexTest/` passed. All 525 inspected local module references resolve. No new Quest hardware benchmark is implied. The user authorized committing and pushing this relocation. See Git history for the release commit; Pages checks were not requested.

## Shared XR helpers — 2026-10-29

Clouds uses shared FrameRateCounter through its existing src/fps.js
compatibility re-export. CPU submission metrics, display, rendering, controller
UI and session handling remain local; this step changes only the FPS import.

Interfaces and current consumers are documented in the
[shared library guide](../../shared/README.md). Changed entry/import queries use `shared-xr-1`. Shared source
and tests live under `shared/xr/`, `shared/performance/`, and `tests/shared/`.

Validation: full root suite (including 12 shared regressions), all ten Cloud tests,
and Scene Test Chrome WebGL integration passed. Chrome startup/module loading
passed for Surface, Space Race, Weather and Clouds; live FPS reporting passed in
the latter three.

The user subsequently reported that Quest works correctly after these shared-helper
changes on 2026-10-29. This is user headset feedback for the shared change; no
project-by-project test matrix or formal sustained frame-rate benchmark was recorded.
The user authorized committing and pushing this shared-library release on
2026-10-29. See Git history for the release commit; deployment status is verified
separately after pushing.
