# Weather simulator handoff

## Scope and state

Current release includes snow and Rain Milestones 1–2, plus the refinements below. The user accepted the result and authorized pushing to GitHub on 2026-10-28. The earlier snow release was `f3aca5d`; consult Git history for this release's commit. GitHub Pages publishes `main` at `/projects/weather/`. Historical local-work notes below describe development stages and are superseded by this release status.

Current behavior: registry-generated Snow/Rain selectors; rain in a 60 m diameter, 12 m high cylinder; snow in a 30 m diameter cylinder; fixed 50,000 particle capacity per mode; velocity-aligned rain; 300 pooled directional splash slots; 200 pooled 12-sided ripple slots with latter-half alpha fade. Ground-effect probabilities/toggles are in the Ground Effects section. Save settings persists all weather controls and the selected mode per browser/device/site; save confirmation resets per mode on startup and edits. Switching weather refills the existing pool around the current player without reallocating particle buffers. Enter VR sits at bottom center outside the desktop settings panel, and the VR control panel opens automatically on the first tracked frame of each session. Latest entry version is v14.

Release validation: all 48 focused Weather tests pass; syntax, module/document links and whitespace checks pass. Shared runtime/vendor files and root test tooling are unchanged, so this release uses the focused Weather suite per repository policy. Earlier desktop browser checks covered both weather modes, ground effects, fading shader compilation and save/reload restoration with no console warnings/errors. User reported “Looks good” before authorizing publication. This is user acceptance, not a formal sustained Quest 90/120 Hz benchmark; unmeasured performance/stereo/comfort caveats below remain applicable.

## Modules

- `src/main.js`: WeatherSimulator creates renderer, environment and player; selects an effect from a registry; creates shared parameter state and generated desktop/VR controls. `selectEffect` rebinds generated controls while preserving the player, environment and panel world transform. Snow and rain are registered in `weather-catalog.js`; instances and per-mode parameter states are retained lazily by `weather-modes.js`. Switching deactivates the old effect and activates the selected effect.
- `src/environment.js`: uniform gray sky and an unlit procedural gray checkerboard with one-meter squares. A 2 km ground plane follows integer horizontal coordinates; shader uses world coordinates to keep checks stationary. No fog, lights or shadows.
- `src/player.js`: floor-relative XR rig including controllers; head-relative walking, head-pivot smooth yaw; desktop drag look/WASD/arrows. No vertical movement.
- `src/parameters.js`: definitions, defaults, range/step clamping, formatting and subscription/unsubscription.
- `src/effects.js`: lightweight WeatherEffect lifecycle and SnowEffect renderer. Future effects may use their own rendering and physics. RainEffect extends the same lifecycle with its own independent renderer and physics.
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

Headset checklist: floor height; both eyes' flake size/appearance; room-scale and stick spatial stability; 2 m/s movement and 90°/s head-pivot turning; B/Y edge behavior; panel 45° placement/world lock; either controller trigger dragging; live sliders including 0/50,000; controller reconnect and session exit/reentry; sustained default-count 90 Hz and experimental 120 Hz profiling. Desktop FPS display is an approximate application-loop indicator, not a headset benchmark. No accumulation, environmental collision, sound, presets or weather effects beyond snow and rain.

## Current implementation notes

XR movement, head-pivot turning, snow volume center and panel placement use the current XRFrame viewer pose transformed through the player rig. Do not use world getters on the renderer's internal parentless XR camera: that caused incorrect movement headings and reopening panels near the tracking origin. Only xr-standard controller gamepads drive movement. Frames without a valid tracked viewer pose pause simulation/input. Reopening the panel samples the current rig translation, yaw and room-scale head offset; an open panel remains world-fixed.

`src/fps.js` averages actual uncapped rendered-frame intervals over approximately half a second. The VR panel footer and desktop display share this measurement. Reset on XR session changes, hidden frames and tracking loss. Closed panels retain the latest value without uploading their texture; reopening draws it. FPS represents application cadence, not GPU/compositor timing.

Snowflake size is a shader uniform multiplying each original flake diameter, with no buffer regeneration or falling-speed changes. At 10× the physical diameter range is 0.013–0.076 m, subject to the existing 1–32 pixel apparent-size clamp. Both panels generate all four sliders from the same definitions; the VR canvas grows to include them and the FPS footer. Current entry version is v14; imports carry their last applicable change version.

## Release validation — 2026-10-27

- All 17 focused Weather tests pass: parameter bounds/notifications, initial distribution, size/speed relationship, world-stable wrapping, ground recycling, straight-motion frame independence, sustained maximum-count simulation, fixed 50,000 rendering buffers/draw range, live size uniform/clamping, FPS at 10/90/120 Hz, generated panel ray sliders, FPS text and closed-panel behavior, B/Y edge toggles, translated/rotated XR walking, head-pivot turning, strafing/deadzone/diagonal speed, tracking loss and panel reopening after movement/turning/physical head motion.
- The complete root test command passed for this release, including Weather; root test tooling now includes `test:weather` and adds Weather to the full suite.
- Desktop browser checks during implementation confirmed checkerboard/sky/snow rendering, live count/wind/turbulence changes at the then-current 20,000 limit and default/zero count. Later 50,000 and size-limit changes are covered by automated tests; no headset performance claim follows from these checks.
- Reviewed project files, module/document links and scoped diff; whitespace checks pass. Two unrelated Chess backups remain excluded.
- User reported initial movement/turning/panel-placement defects; these were corrected and have regression coverage. The user has not explicitly confirmed final headset acceptance or sustained 90/120 Hz performance. Final headset checklist above remains pending, including 50,000 flakes and 10× size.

Buildless project; no generated build output is needed. Shared Three.js vendor files are reused unchanged. This release adds the root project card and README/AGENTS routing. At that release, only snow was implemented. Rain is described below; excluded atmospheric features remain absent; Rain Milestone 2 adds ground geometry as documented below.

## Rain Milestone 1 — 2026-10-28 (local work)

Original user requirements: [RAIN_MILESTONE_1.md](RAIN_MILESTONE_1.md). Snow remains the startup mode, with its 50,000 limit and 10× size range unchanged.

### Registry and future effects

- `src/weather-catalog.js` is the single registration list: `{id, label, title, particleLabel, create}`. Desktop mode options and VR mode buttons both derive from it. `title` and `particleLabel` are optional presentation metadata.
- `src/weather-modes.js` owns lazy initialization, active state, independent per-mode parameters, activation/deactivation and disposal. Inactive effects retain their pools/settings but receive no simulation updates and remain invisible. All initialized effects are disposed on application cleanup.
- To add a future type, implement the WeatherEffect lifecycle, register its parameter definitions during initialization, and add one catalog descriptor. Particle systems are optional: the controller, generated sliders and mode menu do not require a particular rendering technique or particle count. Do not implement other weather types ahead of a requested milestone.
- `VRControlPanel.setEffect` changes subscriptions/canvas dimensions/geometry and recreates its texture while preserving the mesh's world transform, visibility, FPS and input-edge state. A held selection trigger cannot accidentally drag a newly appeared slider. Desktop controls rebuild only the parameter rows, leaving the shared selector available. Each mode keeps its wind/turbulence independently to preserve its settings, while using identical controls/ranges.

### Rain rendering and physics

`src/rain-effect.js`: one opaque light-gray `THREE.LineSegments` batch using `LineBasicMaterial`, normal depth testing/writes and `NoBlending`. Two vertices per drop; a preallocated 50,000-drop pool (100,000 vertices), active draw range and active position upload range. No opacity effects, trails/history, per-drop meshes, sorting or dynamic lights. World-space segments render in both XR eyes.

`src/rain-simulation.js`: terminal falling speeds uniformly sampled from 4–9 m/s, multiplied by the fall-speed slider. Horizontal wind acts along world X. Smooth shared sinusoidal spatial fields provide coherent lateral turbulence, with no independent per-drop jitter. The leading endpoint is the current position; the back endpoint is `position − velocity × duration`, exactly equivalent to normalized velocity times speed times duration, with no temporary vectors. Ground/boundary clipping shortens newborn streaks at the inlet while retaining orientation.

Rain cylinder radius 30 m (60 m diameter), ground 0 m, top 12 m, centered horizontally on the current tracked headset. Snow retains its 15 m radius. Nearby particle positions remain world-stable as the center moves. Ground/out-of-cylinder drops enter via the top or the upwind cylindrical boundary; relative inlet frequency follows projected area × inward velocity (top: πr² × fall speed; side: 2rh × horizontal speed). The side's chord coordinate is sampled uniformly to match flux across the curved inlet. This maintains coverage under strong wind. Center jumps beyond one radius repopulate the pool throughout the destination volume to avoid waiting for rainfall to travel across it.

The complete velocity-aligned segment is tested against a 0.5 m sphere at the live headset world position/height. Intersecting drops recycle to the top; a deterministic far-side fallback guarantees separation if a random replacement still intersects (including unusual head heights). No fades and no conspicuous larger exclusion volume. Typed arrays and existing segment buffers are reused; the normal per-drop update path allocates no objects, vectors or arrays.

| Rain control | Default | Range | Step |
| --- | --- | --- | --- |
| Rain density | 2,000 | 0–50,000 | 1 |
| Wind speed | 0 m/s | −6–6 m/s | 0.1 |
| Turbulence | 0% | 0–100% | 1% |
| Fall speed multiplier | 1× | 0.25×–3× | 0.05× |
| Trail duration | 15 ms | 5–50 ms | 1 ms |

Only defaults were specified for some rain controls; the additional ranges above are implementation choices. Milestone 2 adds the splashes/ripples below. Puddles, wet materials, reflections, mist, fog, lightning and audio remain excluded.

### Validation and remaining work

Run `npm run test:weather`. Existing snow/input/FPS regressions remain in the suite. Rain tests cover defaults/distribution, terminal motion and frame independence, velocity-aligned segment direction/length and controls, spatially coherent turbulence, tail-only sphere intersections and changing headset height, flux-weighted wind inlets/coverage, pooled maximum-density updates at extreme controls with moving/teleported head positions, bounded finite endpoints, opaque single-batch rendering/disposal, per-mode state/pool retention, and generic future catalog entries. VR mock tests select rain/snow via actual ray intersections, retain panel world pose/FPS, drag the new density slider, suppress held-trigger edits, and select a third future catalog entry without changing menu code.

Desktop browser checked both modes and live rain wind/fall-speed/trail-duration changes, with diagonal opaque streaks, preserved settings when switching, and no console warnings/errors. No immersive session was available in the desktop browser. Quest validation remains pending: stereo line visibility, 50 cm exclusion during crouching/movement, controller mode buttons and all rain sliders, panel readability/world lock, sustained cadence at 2,000 default drops and higher counts, and session exit/re-entry. No formal 90/120 Hz performance benchmark has been established.

Final local validation on 2026-10-28: all 28 Weather tests pass; module syntax/import paths, documentation links, whitespace and `git diff --check` pass. Final browser reload confirmed snow startup and rain selection at default controls, with no warning/error console entries. Rain has not been committed or pushed.

### Rain volume adjustment — 2026-10-28

User reported the rain boundary was visible. Doubled only the rain diameter from 30 m to 60 m (radius 15 m → 30 m). Height remains 12 m, headset exclusion remains 0.5 m, and particle counts are unchanged, so the same count covers four times the horizontal area. Snow volume is unchanged. Wind inlet flux, boundary recycling/clipping and relocation threshold derive from the rain volume radius. Entry and changed rain import chain advance to v7. Boundary visibility on Quest requires retesting.

## Rain Milestone 2 — Ground interaction (2026-10-28, local)

User specification: [RAIN_MILESTONE_2.md](RAIN_MILESTONE_2.md). The 60 m rain diameter, 12 m height, falling-rain exclusion and all snow controls remain unchanged. This work is not committed or pushed; earlier snow-release authorization does not authorize this release.

### Impact detection and ground reference

`RainSimulation.onImpact` receives numeric coordinates, wind and within-frame impact age immediately before ground recycling. The crossing fraction is `(previousY − groundY) / (previousY − nextY)`, interpolating actual wind/turbulence displacement in X/Z at the ground crossing. Emit only for crossings inside the current rain cylinder; side/top/exclusion recycling emits nothing. The remaining frame time initializes the impact age, so rendering does not treat an earlier-in-frame hit as brand new.

`WeatherModes` accepts a shared context containing `Environment.ground`, passed to effect initialization. Rain reads that mesh's Y for both falling-rain ground level and new ground-effect origins. Each existing impact stores its original ground Y. No raycasts or independent collision/physics bodies are introduced.

### Fixed pools and rendering

`src/ground-effects.js` contains independent `ImpactPool` instances and a `GroundEffects` renderer/manager. Splash capacity 300; ripple capacity 200. Each uses preallocated active flags, free-list, world impact positions, age, wind/randomized shape state and vertex arrays. Spawn pops an available slot in O(1); saturation skips requests; expiry clears the slot's geometry to degenerate lines and returns it once. Probabilities never resize the pools. Existing impacts keep their world coordinates as the player moves.

Splash batch: four pale-gray line segments per slot, randomized radial angles and 2.4–3.6 cm lengths. Segment heads expand out to 8 cm with a simple ballistic center-height arc peaking at 12 cm halfway through the 0.20 s lifetime. Segments point upward initially and downward later, with a 0.005 m ground offset. Subtle world-X wind drift is wind × 0.02 × age. Positions are computed directly; no per-segment physics objects.

Ripple batch: 12-sided closed outlines, 2–25 cm radius linear over a fixed 0.45 s lifetime, parallel to the ground at a 0.01 m offset. Cached unit-circle coordinates avoid repeated trigonometry. Color/line width stay fixed; expiry is abrupt, with no fade. Wind never distorts the circle.

Two separate opaque `THREE.LineSegments` batches add at most two draw calls. No textures, transparency, additive blending, sprites, fluid simulation, puddles, wet surfaces, reflections or audio. Animation and impact spawning allocate no temporary objects, vectors or arrays. A persistent rain upload-range object replaces the previous per-frame `addUpdateRange` allocation; ground vertex buffers upload in place. Existing generic UI/raycast/browser allocations discussed earlier are not a claim of zero garbage collection for the entire app.

Disabling the master or an individual effect immediately hides and clears its existing pool and prevents spawns. Re-enabling starts empty and resumes normal impact sampling. Splash/ripple trials are independent, including when one pool is full. Deactivating rain hides its ground group and clears short-lived effects; inactive rain receives no animation updates. Parameters/pool allocations persist through weather-mode switches.

### Ground Effects controls

Both desktop and VR expose master Ground effects, Splash effects and Ripple effects toggles (all enabled by default), Splash probability 0–100% (15% default) and Ripple probability 0–100% (10% default), in 1% increments.

Generic parameter metadata `kind: 'toggle'` generates checkboxes on desktop and trigger-toggle bars in VR; `section` groups controls. VR rain has Weather and Ground Effects tabs with five controls per page, retaining mode buttons, FPS, world transform and current visibility. Section/parameter rebinding can allocate texture/geometry only when explicitly changing menus. Holding a trigger cannot repeatedly toggle controls or accidentally edit a newly opened page. Desktop uses a scrollable control panel with a Ground Effects heading. Future effects can reuse the same metadata without weather-specific UI code.

### Validation

All 37 focused Weather tests pass, including previous snow/rain/XR regressions and new checks for interpolated wind-driven crossing coordinates, outside-cylinder suppression, nonzero ground reference/offsets, pool saturation/free-list reuse/expiry, ballistic splash height/expansion, frame-rate independence, linear symmetric 12-sided ripples, independent probabilities, immediate toggle clearing/restart, pooled buffer retention, opaque untextured batches, mode deactivation, and actual controller-ray Ground Effects tab/toggle/probability interactions while retaining panel pose/FPS.

Desktop browser checked rain startup, generated checkboxes/probabilities, live 20,000-drop / 100%-probability stress settings, visible splashes/ripples on the checkerboard, and the immediate master toggle. Stress settings were used for inspection only; defaults remain 2,000 / 15% / 10%. This is not a sustained headset benchmark. Quest validation remains pending for readability, stereo appearance, density/size at default settings, panel tabs/toggles, world stability during locomotion, exclusion behavior and sustained 90/120 Hz cadence. Entry and changed module imports use v8.

### Ripple alpha fade — 2026-10-28

The user explicitly approved alpha blending for ripple rings, superseding Milestone 2's opaque-only ripple requirement. Rings stay fully opaque through the first half of their 0.45 s lifetime (0–0.225 s), then smoothstep-fade to zero over the remaining half. The 200-ring pool, 12 segments/ring, radius expansion, line color, lifetime and single draw batch stay unchanged. Splashes and falling rain remain opaque.

Each pooled ripple has preallocated RGBA vertex colors, with identical age-derived alpha at all 24 vertices. Three.js's shared LineBasicMaterial shader uses vertex alpha; normal blending and depth testing are enabled, depth writing is disabled. No custom per-ring materials, new objects or arrays are allocated during updates; slots clear alpha on expiry/disable and restore it on reuse. Changed import chain/entry use v9. Quest performance and stereo appearance remain to be tested; no measured comparison against dithering has been made.

Fade validation: all 38 Weather tests pass, including opaque-first-half/smooth latter-half alpha, per-ring independence, uniform alpha around each ring, pool expiry/clear/reuse, and unchanged splash rendering. Browser rain rendering checked with no warning/error console entries; stress settings restored to defaults. `git diff --check` passes.

### Splash impact direction — 2026-10-28

Splashes now use the drop's actual impact velocity (including world-X wind, Z turbulence and scaled terminal fall speed). Reflect the vertical component about the flat ground normal and scale the launch vector to the existing 2.4 m/s upward splash speed. The horizontal-to-vertical incident angle is retained in the fan's launch axis, while four randomized radial arms retain the stylized spread. Segment positions follow that launch plus the existing ballistic arc, and short lines align with their instantaneous outgoing velocities. Changing the wind afterward does not redirect an existing splash. The previous small world-X-only wind offset is replaced. Ripple circularity/fade, pool sizes and draw calls are unchanged. Only numeric callback arguments, two preallocated launch-component arrays and simple arithmetic are added; no temporary vectors or physics objects. Changed entry/import chain uses v10. Quest visual/performance confirmation remains pending.

Validation: all 40 Weather tests pass, including reflected splash launch/segment direction in X/Z, angle changes with fall speed, actual turbulent impact velocity, existing pool/fade/control regressions and whitespace checks. No headset benchmark was run.

### Explicit saved settings — 2026-10-28

Save settings buttons now appear above the desktop parameters and in the VR footer (on both Weather and Ground Effects pages). Save captures the current weather id and all initialized modes' parameter values, including toggles. Previously saved values for lazy/unvisited modes are carried forward without allocating their particle pools. The next page visit restores the chosen mode and valid per-mode settings; defaults apply if no supported save exists. Later unsaved edits do not change the stored snapshot. Position, head pose and particle/pool animation state are excluded.

`src/settings.js` wraps localStorage under `codextest.weather.settings.v1`, with versioned JSON and safe handling for corrupt/unsupported data, security restrictions and write/quota failures. `WeatherModes.restore/snapshot` handles registry-driven values; known numeric parameters pass through their definition clamping/quantization when a mode is lazily initialized. Unknown/missing controls are ignored/defaulted, and a removed weather mode falls back to the first catalog entry. Future registered weather types use the same mechanism. Storage is per browser/device/site origin; local preview and GitHub Pages do not share saved data. No automatic/per-frame storage writes.

The VR footer button preserves panel pose and input edges, runs once per trigger press and shows Settings saved or Save failed. Desktop has a separate live status message. The existing pool/update behavior is unchanged; changed entry/imports use v11.

All 44 focused Weather tests pass, including save/load of both modes and ground toggles, selected-mode restoration, unsaved edit isolation, lazy-mode preservation, range clamping/defaults, unknown/corrupt data, inaccessible/full storage and actual VR ray save-button success/failure/held-trigger behavior. Quest button/relaunch validation remains pending.

Browser persistence verified with a real save/reload: Rain selection and wind restored, and previously saved Snow size restored when switching back. Inspection values were returned to defaults and saved; Rain remains selected in the local preview. No console warnings/errors. Changes remain local and unpushed.

### Save button status correction — 2026-10-28

Save confirmation is transient per weather mode and starts at Save settings on each page startup, including restored modes. A successful explicit save marks only the selected mode Settings saved; changing any parameter resets that mode to Save settings and clears its old confirmation. Switching modes uses that mode’s own status, preventing a rain/snow confirmation leak. Status is not persisted. Both desktop and VR follow the same behavior, and failed saves remain retryable. Entry/changed imports advance to v12.

### Desktop VR entry placement — 2026-10-28

Moved the existing Enter VR button and XR status message to the top of the desktop control panel, before the title and weather settings, so entering VR does not require scrolling past rain controls. Existing button id/session behavior is unchanged. HTML ordering and `git diff --check` verified.

### VR entry placement revision — 2026-10-28

Moved Enter VR and its status outside the scrolling settings panel into a fixed bottom-center overlay, 28 px above the page bottom. The button stays accessible while settings scroll; its overlay is viewport-width constrained and hides with the panel during XR. Empty overlay space does not intercept scene input. This supersedes the earlier panel-top placement. Checked unique button/status ids, overlay placement and `git diff --check`.

### Weather-switch volume reset — 2026-10-28

User observed stale snow volume after moving in rain mode. Switching modes now passes the current tracked world position into activation and repopulates the destination effect’s full existing particle pool throughout its cylinder before rendering. Both snow and rain reset their spatial distribution/turbulence time on mode switches, retaining buffers, individual flake sizes/fall speeds and all settings. No new particle arrays are allocated. Continuous movement within the active mode still preserves world-space particle positions. The current mode is not reset if selected again. This replaces the previous inactive-field preservation behavior; it prevents delayed refilling around a moved player. Entry/changed import chain uses v13.

### Panel open on VR entry — 2026-10-28

Entering each XR session now requests the panel open automatically. Placement waits until the first visible frame with a valid tracked headset pose, then uses the usual 45° right / 1.2 m placement. B/Y and trigger states are seeded on that opening frame so buttons held during entry cannot immediately close or edit the panel. Manual closing stays closed for that session until B/Y reopens it; exiting/re-entering VR opens it again at the current location. Entry/controls cache version is v14.

## Shared Three.js relocation — 2026-10-29

Three.js r180 now lives at repository-level `shared/vendor/three-r180/`, with GLTFLoader, BufferGeometryUtils, VRButton and area-light modules in its `addons/` directory. Former Forest/Scene Test vendor directories are removed. Imports, tests, documentation and the knight exporter use the canonical shared paths. Core/license bytes are unchanged; addon code changes only adjust imports. Buildless entry/module queries use `shared-r180-1` to refresh cached module graphs. Racer, Terrain and Fishing static outputs were rebuilt from their updated sources; Swarm retains independent npm dependencies.

Validation: the complete root suite, all ten Cloud tests, three Vite builds, Scene Test browser integration and browser startup of all ten affected projects under `/CodexTest/` passed. All 525 inspected local module references resolve. No new Quest hardware benchmark is implied. The user authorized committing and pushing this relocation. See Git history for the release commit; Pages checks were not requested.
