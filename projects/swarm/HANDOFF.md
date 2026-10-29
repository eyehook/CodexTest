# Swarm handoff

Read [repository guidance](../../AGENTS.md), then this document and the project README if present. Inspect Git status and relevant source before editing. These project notes were moved from root AGENTS.md; they are preserved context, not a fresh implementation audit. Current code and Git state are authoritative, especially for historical validation and publication claims. Paths below are repository-relative unless their context says otherwise.

## Swarm 3D

Ground: subtle gray checkerboard, generated once as a repeating canvas texture, with 3-foot (0.9144 m) squares, mipmaps and up to 4× anisotropic filtering.

Buildless source: `projects/swarm/src/`, loaded directly by `projects/swarm/index.html` with `src/style.css`. Serve the repository root or use `Start-VR.command`; edits need only a browser reload. Three.js r180 and VRButton use `shared/vendor/three-r180/`; `tuning.js` generates native HTML desktop controls without a GUI library. The local package.json retains only module type and an optional test script, with no dependencies. Run `node --test projects/swarm/tests/*.mjs` from the repository root (or `npm test` inside Swarm without installing packages). No Vite, build output or installation step is needed. Wasp uses sliding Catmull–Rom segments with arc-length traversal; Swarm computes all steering before integration and uses bounded time substeps. Standard Three.js VRButton. `locomotion.js` implements head-directed left-stick walking at 1.5 m/s and right-stick smooth turning at 60°/s about the tracked headset, with 15% deadzone. A/X edge presses toggle the VR panel; simultaneous presses toggle once. Motion pauses without a visible, tracked XR frame. Desktop and VR start halfway horizontally from their former overview positions toward the captured wasp spawn, retaining ground-level viewing; the desktop GUI overview reset still frames the full flight box. XR rig compensates initial headset position/yaw once and uses the halfway spawn. `VRPanel.js` places a player-following tuning panel 3 m away, 45 degrees right of rig forward (independent of head-look yaw); either controller points and trigger-clicks minus/plus controls. Desktop mouse drag and wheel; desktop GUI hides during XR. Headset performance and appearance require physical Quest testing.

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
