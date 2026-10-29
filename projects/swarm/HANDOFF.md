# Swarm handoff

Read [repository guidance](../../AGENTS.md), then this document and the project README if present. Inspect Git status and relevant source before editing. These project notes were moved from root AGENTS.md; they are preserved context, not a fresh implementation audit. Current code and Git state are authoritative, especially for historical validation and publication claims. Paths below are repository-relative unless their context says otherwise.

## Swarm 3D

Ground: subtle gray checkerboard, generated once as a repeating canvas texture, with 3-foot (0.9144 m) squares, mipmaps and up to 4× anisotropic filtering.

Buildless source: `projects/swarm/src/`, loaded directly by `projects/swarm/index.html` with `src/style.css`. Serve the repository root or use `Start-VR.command`; edits need only a browser reload. Three.js r180 and VRButton use `shared/vendor/three-r180/`; `controls.mjs` binds settings to shared native HTML and canvas VR controls through thin `tuning.js` and `VRPanel.js` adapters. The local package.json retains only module type and an optional test script, with no dependencies. Run `node --test projects/swarm/tests/*.mjs` from the repository root (or `npm test` inside Swarm without installing packages). No Vite, build output or installation step is needed. Wasp uses sliding Catmull–Rom segments with arc-length traversal; Swarm computes all steering before integration and uses bounded time substeps. Standard Three.js VRButton. `locomotion.js` implements head-directed left-stick walking at 1.5 m/s and right-stick smooth turning at 60°/s about the tracked headset, with 15% deadzone. A/X edge presses toggle the VR panel; simultaneous presses toggle once. Motion pauses without a visible, tracked XR frame. Desktop and VR start halfway horizontally from their former overview positions toward the captured wasp spawn, retaining ground-level viewing; the desktop GUI overview reset still frames the full flight box. XR rig compensates initial headset position/yaw once and uses the halfway spawn. `VRPanel.js` places a player-following tuning panel 3 m away, 45 degrees right of rig forward (independent of head-look yaw); either controller points and trigger-clicks minus/plus controls. Desktop mouse drag and wheel; desktop GUI hides during XR. Headset performance and appearance require physical Quest testing.

## Maintaining this handoff

Keep project behavior, architecture, commands, validation and pending work current here. Follow the shared local-test-then-publish workflow in root AGENTS.md and preserve unrelated work.

## Buildless conversion — 2026-10-29

The root index is now the single editable entry; the former Vite source HTML,
configuration, dependency lockfile and generated `build/` files are removed.
Source and tests import canonical Three.js modules by relative path. Desktop
controls are now native HTML, as described below.
The root index loads CSS with a normal stylesheet link. Entry/style queries use
`native-controls-1` to refresh cached Quest reloads.

Simulation, desktop framing, control settings and project-local locomotion/pointer
logic are unchanged; the desktop panel implementation is described below. This change adopts shared third-party dependencies; migration
to first-party shared XR helpers remains separate work.

Validation: all seven Swarm Node tests, the full root suite and all ten Cloud
tests passed. Chrome checks passed at both `/projects/swarm/` and
`/CodexTest/projects/swarm/`: startup, local Three.js/CSS loading, changing
bee count through the desktop GUI, animated rendering and desktop drag/zoom. No
external, node_modules, Vite or generated-bundle requests or browser errors occurred.
The browser screenshot was visually checked. Module paths, documentation links and whitespace were verified.

Quest retesting remains required for this conversion. Publication is covered by the release review below.

## Native desktop tuning — 2026-10-29

`tuning.js` generates paired native sliders/number inputs, collapsed steering and
flight-volume groups, and the Frame full flight volume button. It replaces gui.js
and the lil-gui module/license introduced during the uncommitted buildless change;
no lil-gui files remain in shared/vendor. Values are clamped/quantized. Bee count
rebuilds the pool on change/commit rather than every slider movement. Other values
update live. The native panel hides on XR entry, returns on exit, and synchronizes
from VR changes. Desktop changes also redraw the VR panel. Population and control
ranges are preserved, with explicit native steps. Styles are responsive and
keyboard-focusable; the panel scrolls when needed. UI policy remains project-local.

Validation: all seven Swarm Node tests passed. Chrome exercised all 15 native
controls under `/CodexTest/`, paired values, commit-only bee-count rebuilds,
clamping/blank restoration, keyboard slider input, VR-to-desktop synchronization,
overview framing, synthetic session hide/restore, continued animation and mobile
layout. Desktop/mobile screenshots were visually reviewed. There were no browser
errors or lil-gui, node_modules or generated-bundle requests. Documentation links
and whitespace checks passed. Physical Quest retesting remains required.
Publication is covered by the release review below.

## Obsolete dependency cleanup — 2026-10-29

Removed Swarm's ignored `node_modules/` directory, including the old Vite, lil-gui,
private Three.js installation and package-manager caches. No installation is needed
for runtime or Node tests. Root Vite dependencies remain in use by Racer, Terrain
and Fishing. The obsolete Swarm config, lockfile, generated bundle and GUI module
are removed as part of the same buildless/native-controls change. All seven
Swarm tests passed again after removing node_modules.

## Release review — 2026-10-29

The user authorized committing and pushing the buildless conversion, native desktop
controls and obsolete dependency cleanup. The final source uses shared Three.js
and no Vite/lil-gui installation or generated bundles. Validation is recorded above;
physical Quest retesting of this Swarm change remains outstanding. Source, tests
and documentation are published together. See Git history for the release commit;
GitHub Pages status is checked separately after pushing.

## Shared desktop/VR UI — 2026-10-29

`src/controls.mjs` is the sole definition table for desktop and VR settings;
`src/tuning.js` and `src/VRPanel.js` are thin adapters to `shared/ui/`. Main creates
one shared model, and both views subscribe to it. Duplicate numeric ranges,
validation, HTML generators and canvas/pointer logic have been removed. The
project retains grouping, overview action, population reset, placement and session
behavior. Panel input is now explicitly disabled without a tracked viewer.
Native styles load from shared/ui/desktop.css. Changed queries use `shared-ui-slider-1`.

Per user instruction, both interfaces use the existing VR increments: bee count 10,
bee speed 0.25, steering limit 0.5, neighbor radius 0.2, separation radius and all
steering weights 0.1, wasp speed 0.2, horizontal bounds 1, altitude bounds 0.5.
Defaults and ranges are unchanged. Relative stepping preserves defaults such as
0.65. Bee count still commits on editing completion; other controls update live.
Desktop/VR values, labels and disabled state stay synchronized through the model.
VR row order and the Bees label remain as before. Controller pointers now come
through the shared VR renderer; locomotion remains project-local.

Interfaces and disposal rules are in the [shared library guide](../../shared/README.md).
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
