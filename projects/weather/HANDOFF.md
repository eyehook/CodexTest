# Weather simulator handoff

## Scope and state

Milestone 1 implements snowfall only. The user authorized updating this handoff and pushing the complete Weather project to GitHub on 2026-10-27. This release targets `main`; GitHub Pages serves `/projects/weather/`. Consult Git history for the release commit. Original specifications supplied by the user on 2026-10-27 govern this implementation. Quest validation remains required before declaring headset acceptance or sustained performance.

## Modules

- `src/main.js`: WeatherSimulator creates renderer, environment and player; selects an effect from a registry; creates shared parameter state and generated desktop/VR controls. `selectEffect` cleans up the prior effect and controls. Only snow is registered.
- `src/environment.js`: uniform gray sky and an unlit procedural gray checkerboard with one-meter squares. A 2 km ground plane follows integer horizontal coordinates; shader uses world coordinates to keep checks stationary. No fog, lights or shadows.
- `src/player.js`: floor-relative XR rig including controllers; head-relative walking, head-pivot smooth yaw; desktop drag look/WASD/arrows. No vertical movement.
- `src/parameters.js`: definitions, defaults, range/step clamping, formatting and subscription/unsubscription.
- `src/effects.js`: lightweight WeatherEffect lifecycle and SnowEffect renderer. Future effects may use their own rendering and physics. No additional effects implemented.
- `src/simulation.js`: Three.js-independent typed-array snow state and reusable cylindrical SimulationVolume. No per-flake objects or interactions.
- `src/controls.js`: definition-generated HTML sliders and a canvas-textured VR panel, with controller rays and trigger drag state. B/Y edge toggles are handled per input source. Panel opens 45° right, 1.2 m away, slightly below head height and facing the player; it remains fixed in world space until reopened.

## Snow behavior

Radius 15 m; ground 0 m; top 12 m. Initial particles fill the volume with an area-uniform horizontal distribution. World positions persist while the player moves; out-of-radius particles wrap along the radial line to the opposite side. Ground hits recycle to the top with a fresh horizontal position. Center follows tracked head horizontal world position, including room-scale movement.

50,000 particle capacity is allocated once. Active count changes draw range with no buffer reallocation. Newly enabled particles are brought inside the current volume by the next simulation update before rendering. Flake sizes are fixed at initialization, 0.0013–0.0076 m, biased toward smaller sizes. Terminal speed smoothly interpolates 1.2–0.4 m/s with ±15% variation. Wind is world X velocity; two low-frequency sinusoidal components per axis provide continuous spatial/phase-dependent horizontal turbulence; zero turbulence removes lateral wandering.

One THREE.Points draw, custom perspective-scaled point shader using each XR eye viewport height or desktop drawing-buffer resolution, 1–32 pixel clamp, circular soft alpha edges, depth test on/depth write off, no particle sorting. Active position range uploads each frame. Background/hidden XR simulation pauses; frame delta is capped at 50 ms to prevent large resume jumps. Renderer disables antialiasing and caps desktop DPR at 2. Ground and snow need two draws; open VR panel and two rays add up to three draws.

| Parameter | Default | Range | Step |
| --- | --- | --- | --- |
| Snowflake count | 5,000 | 0–50,000 | 1 |
| World X wind | 0 m/s | −6–6 m/s | 0.1 |
| Turbulence | 20% | 0–100% | 1% |
| Snowflake size | 1× | 0.1×–10× | 0.1× |

## Validation and remaining work

Run `npm run test:weather` for deterministic parameter, distribution, size/speed, wrapping, recycling, frame-step and maximum-count simulation checks. Run `git diff --check` for every edit. Runtime/browser validation results are recorded separately below after execution.

Headset checklist: floor height; both eyes' flake size/appearance; room-scale and stick spatial stability; 2 m/s movement and 90°/s head-pivot turning; B/Y edge behavior; panel 45° placement/world lock; either controller trigger dragging; live sliders including 0/50,000; controller reconnect and session exit/reentry; sustained default-count 90 Hz and experimental 120 Hz profiling. Desktop FPS display is an approximate application-loop indicator, not a headset benchmark. No accumulation, collision, sound, presets or other weather effects.

## Current implementation notes

XR movement, head-pivot turning, snow volume center and panel placement use the current XRFrame viewer pose transformed through the player rig. Do not use world getters on the renderer's internal parentless XR camera: that caused incorrect movement headings and reopening panels near the tracking origin. Only xr-standard controller gamepads drive movement. Frames without a valid tracked viewer pose pause simulation/input. Reopening the panel samples the current rig translation, yaw and room-scale head offset; an open panel remains world-fixed.

`src/fps.js` averages actual uncapped rendered-frame intervals over approximately half a second. The VR panel footer and desktop display share this measurement. Reset on XR session changes, hidden frames and tracking loss. Closed panels retain the latest value without uploading their texture; reopening draws it. FPS represents application cadence, not GPU/compositor timing.

Snowflake size is a shader uniform multiplying each original flake diameter, with no buffer regeneration or falling-speed changes. At 10× the physical diameter range is 0.013–0.076 m, subject to the existing 1–32 pixel apparent-size clamp. Both panels generate all four sliders from the same definitions; the VR canvas grows to include them and the FPS footer. Current entry version is v5; imports carry their last applicable change version.

## Release validation — 2026-10-27

- All 17 focused Weather tests pass: parameter bounds/notifications, initial distribution, size/speed relationship, world-stable wrapping, ground recycling, straight-motion frame independence, sustained maximum-count simulation, fixed 50,000 rendering buffers/draw range, live size uniform/clamping, FPS at 10/90/120 Hz, generated panel ray sliders, FPS text and closed-panel behavior, B/Y edge toggles, translated/rotated XR walking, head-pivot turning, strafing/deadzone/diagonal speed, tracking loss and panel reopening after movement/turning/physical head motion.
- The complete root test command passed for this release, including Weather; root test tooling now includes `test:weather` and adds Weather to the full suite.
- Desktop browser checks during implementation confirmed checkerboard/sky/snow rendering, live count/wind/turbulence changes at the then-current 20,000 limit and default/zero count. Later 50,000 and size-limit changes are covered by automated tests; no headset performance claim follows from these checks.
- Reviewed project files, module/document links and scoped diff; whitespace checks pass. Two unrelated Chess backups remain excluded.
- User reported initial movement/turning/panel-placement defects; these were corrected and have regression coverage. The user has not explicitly confirmed final headset acceptance or sustained 90/120 Hz performance. Final headset checklist above remains pending, including 50,000 flakes and 10× size.

Buildless project; no generated build output is needed. Shared Three.js vendor files are reused unchanged. This release adds the root project card and README/AGENTS routing. No other weather types or excluded milestone features are implemented.
