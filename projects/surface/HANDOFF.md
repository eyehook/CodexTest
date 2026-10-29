# Surface handoff

Read [repository guidance](../../AGENTS.md), then this document and the project README if present. Inspect Git status and relevant source before editing. These project notes were moved from root AGENTS.md; they are preserved context, not a fresh implementation audit. Current code and Git state are authoritative, especially for historical validation and publication claims. Paths below are repository-relative unless their context says otherwise.

## Surface

Buildless project in `projects/surface/`, using the locally bundled Three.js r180 in `shared/vendor/three-r180/`. `surface.js` renders 64 × 64 separate horizontal quads using `THREE.InstancedMesh`: each is 9 cm square, on 10 cm centers (1 cm gaps, 6.39 m overall footprint). `DEFAULTS.spacing = 0.1` and `DEFAULTS.quadFill = 0.9` in `settings.mjs` define these dimensions, adjustable live; desktop framing and VR starting distance scale with spacing. Each particle moves a whole quad vertically without tilt. Quads are solid, with no triangle outlines. Height-based blue lightness through unlit `MeshBasicMaterial` (darker below rest, lighter above, default saturation at ±0.03 m; adjustable down to ±0.01 m) and the initial VR viewpoint 1.4 m from the center are retained. Desktop drag orbits and wheel zooms; Reset clears waves and restarts the rain timer. `../../shared/xr/locomotion.mjs` provides head-directed left-stick walking (1.5 m/s) and right-stick smooth turning (60°/s) about the tracked headset, with 15% deadzone. Motion is horizontal, without collision or edge clamping; hidden/untracked XR pauses it. No manual force controls in this version. `controls.mjs` binds one shared model; `tuning.js` and `VRPanel.js` adapt the shared desktop/VR renderers with controller rays and a canvas panel 3 m away, 45° right, following rig translation/yaw independently of head-look. A/X edge presses toggle the panel (initially visible); trigger adjusts minus/plus or actions. Shared settings cover damping, spring/restoring strength, rain strength/interval, color range, spacing and fill. Pause freezes physics/rain; reset retains settings; defaults restores and unpauses. Settings are page-session only. `tests/surface-tuning.mjs` covers live parameters, pause, bounds, stability and VR ray targeting. Surface explicitly sets XR foveation to 0; the user confirmed on Quest that this fixes the lighter rectangular peripheral bands.

`simulation.mjs` uses Float32 height/velocity arrays, a 120 Hz fixed timestep, four-neighbor spring coupling, a restoring force, velocity damping, and a 12-cell damped edge band. Every three simulated seconds, one uniformly random particle anywhere on the full 64 × 64 grid, including edge cells, receives an 8 m/s downward velocity impulse. All velocity updates read the previous height state before integrating heights. Hidden/untracked XR pauses simulation; elapsed frame time is capped to prevent catch-up bursts. `tests/surface.mjs` covers drop timing, one-point impact, propagation, damping, stability, reset, and frame-rate independence; included in the root test command. The user has tested Surface on Quest and confirmed the foveation fix; no formal performance benchmark has been recorded.

Surface defaults in `settings.mjs`: damping 0.1, spring strength 10, restoring strength 0.1, rain strength 8, interval 3 s, color range 0.03 m, spacing 0.1 m, fill 0.9, unpaused.

## Maintaining this handoff

Keep project behavior, architecture, commands, validation and pending work current here. Follow the shared local-test-then-publish workflow in root AGENTS.md and preserve unrelated work.

## Shared Three.js relocation — 2026-10-29

Three.js r180 now lives at repository-level `shared/vendor/three-r180/`, with GLTFLoader, BufferGeometryUtils, VRButton and area-light modules in its `addons/` directory. Former Forest/Scene Test vendor directories are removed. Imports, tests, documentation and the knight exporter use the canonical shared paths. Core/license bytes are unchanged; addon code changes only adjust imports. Buildless entry/module queries use `shared-r180-1` to refresh cached module graphs. Racer, Terrain and Fishing static outputs were rebuilt from their updated sources; Swarm retains independent npm dependencies.

Validation: the complete root suite, all ten Cloud tests, three Vite builds, Scene Test browser integration and browser startup of all ten affected projects under `/CodexTest/` passed. All 525 inspected local module references resolve. No new Quest hardware benchmark is implied. The user authorized committing and pushing this relocation. See Git history for the release commit; Pages checks were not requested.

## Shared locomotion extraction — 2026-10-29

Surface and Scene Test now import `shared/xr/locomotion.mjs`, with reusable
axis/deadzone helpers in `shared/xr/input.mjs`. Surface's former local module is
removed. Each project retains its movement/turn speeds and deadzone response:
Surface rescales outside the deadzone; Scene Test preserves raw analog magnitude.
Scene Test supplies its parented viewer camera's local pose and keeps desktop
input and light interaction local. Frame deltas cap at 50 ms. Changed entry/module
queries use `shared-motion-1` for cache refresh. Other projects are not migrated.

Validation: all existing root-suite checks and all three new shared regression
tests passed. Scene Test Chrome WebGL integration passed, including its navigation
regressions. Subsequent Quest feedback is recorded in the shared XR helpers
section below. Publication is covered by the shared XR helpers release review below.

## Shared XR helpers — 2026-10-29

Surface uses shared button edges for A/X toggles, controller pointer rays and
visuals, and XRFrameState for visibility/tracking. Simultaneous A/X presses still
toggle once; panel placement/actions remain local. Inactive frames clear the
previous simulation timestamp to prevent catch-up on resume.

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

## Shared desktop/VR UI — 2026-10-29

`controls.mjs` binds the settings table and pause/reset/default actions into one
shared `ControlModel` used by both views. `tuning.js` and `VRPanel.js` are thin
adapters to `shared/ui/desktop.mjs` and `shared/ui/vr-panel.mjs`. Native styles load
from `shared/ui/desktop.css` before project styling. All number inputs and VR
minus/plus controls use the existing VR steps; defaults remain unchanged. Desktop
inputs now quantize using the same relative stepping as VR. Pause/default labels,
dimensions, reset behavior, controller rays, 3 m/45-degree rig-relative placement,
foveation and simulation settings are retained. External action buttons delegate
to the shared model. Source/entry/style cache queries use `shared-ui-slider-1`.

The shared UI also supports toggles, disabled controls and readouts; Surface keeps
its existing action-based pause control. Interfaces, lifecycle and consumer lists
are in the [shared library guide](../../shared/README.md).
Validation: the full root suite (including 21 shared regressions), all seven
Swarm tests and all ten Cloud tests passed. Chrome exercised every desktop number
field and slider against the VR step, two-way model synchronization, deferred bee
count commits, invalid/bounded values, blank-field keyboard recovery, actions,
actual transformed controller rays/triggers, readouts/toggles/disabled states and
idempotent cleanup. Desktop/mobile layouts were visually checked under the
`/CodexTest/` prefix with no runtime or local-module-loading errors. Model/ray/theme
regressions live in `tests/shared/ui.mjs`. Documentation links and whitespace
checks passed. Physical Quest retesting of this shared UI remains required.
Publication is covered by the release review below; Quest retesting remains outstanding.

## Shared slider framework regression check — 2026-10-29

Weather now uses a shared slider renderer and segmented choices/tabs. This project
retains its minus/plus VR presentation; desktop and VR increments remain identical.
Shared model, native rendering and base VR resource handling were regression-tested
against this project, including Chrome controls/synchronization/ray interactions
and layout. Shared import/style versions use `shared-ui-slider-1`.
Publication is covered by the release review below; Quest retesting remains outstanding.

## Shared UI release review — 2026-10-29

The user authorized committing and pushing the shared control model, native desktop
renderer, VR button/slider renderers, segmented selectors/tabs, themes and Surface,
Swarm and Weather migrations. Desktop/VR steps use the existing VR increments.
The full root suite (31 shared regressions and 50 Weather tests), seven Swarm tests,
ten Cloud tests and browser checks for all three migrated projects passed.
Documentation/module links and whitespace checks passed. Physical Quest retesting
of this shared UI remains outstanding. Source, tests and documentation are included
together; see Git history for the release commit and check Pages status separately.
