# CodexTest project context

## Start here

This repository is a collection of static browser/WebXR experiments for Meta Quest 3. The root `index.html` is a project directory; current projects are **Endless Grove**, under `projects/forest/`, and **Racer**, under `projects/racer/`.

Read this file and `README.md`, inspect `git status`, then inspect the relevant modules before editing. Treat the code and current Git state as authoritative if this document becomes stale. Keep this document current when behavior, setup, or architecture changes.

## Repository and deployment

- Local checkout: `/Users/mm/Documents/GitHub/CodexTest`.
- GitHub: https://github.com/eyehook/CodexTest (public).
- Development/publishing branch: `main`.
- Live index: https://eyehook.github.io/CodexTest/
- Live forest: https://eyehook.github.io/CodexTest/projects/forest/
- GitHub Pages uses `main`, `/(root)`, with HTTPS. Pushing to `main` triggers publication.
- Forest is buildless. Racer uses Vite (root dev dependency) with source in `src/racer/`; `pnpm build:racer` writes its static HTML/CSS/JS to `projects/racer/`. Keep those outputs with the source when committing because Pages deploys the root of `main`. The checked-in build also works with the existing Python/Quest launcher.
- All runtime assets are bundled locally. Use relative URLs so GitHub Pages' `/CodexTest/` prefix works. Preserve `.nojekyll` and the vendor license.
- Future projects belong in `projects/<name>/` with their own `index.html` and a card in the root index.

## Local Quest testing

Double-click `/Users/mm/Documents/Start-Quest-VR.command` with a USB-connected, authorized Quest. It serves this checkout on port 8080, binds to loopback, and uses Meta Quest Developer Hub's ADB to reverse-forward the port.

- Project index: http://localhost:8080/
- Forest: http://localhost:8080/projects/forest/
- Keep the launcher window and USB connection active. Rerun after reconnecting.
- Launcher is outside the repository; it is not published or versioned here.
- An old server on port 8080 may need stopping before launching this checkout.
- For desktop-only preview: `python3 -m http.server 8080 --bind 127.0.0.1` from the repository root.
- Original projects remain in `/Users/mm/Documents/Codex/Quest` as backups. Edit this GitHub checkout, not those originals.

## Forest architecture

- `forest.js`: scene, rendering, rig, controllers, locomotion, XR lifecycle, and animation integration.
- `forest-world.mjs`: seeded plant placement, input deadzone, and 30.48 m (100 ft) horizontal wrapping.
- `forest-trees.js`: three GLB tree rigs; CPU skinning updates shared geometry used by instanced copies. Procedural trees remain a loading/error fallback.
- `forest-butterflies.js`: animated butterfly GLB, sixteen insects repeated across nine tiles; visibility fades with daylight and deformation updates stop at full night.
- `forest-fireflies.js`: sixteen fireflies repeated across nine tiles, two instanced sphere batches. Small bright yellow core inside a larger yellow halo with 50% opacity at full night. Unlit materials, no individual lights or bloom.
- `forest-sky.js`: 60-second repeating day/night cycle with opposing sun/moon, sky, fog, and ambient lighting. Daylight drives the butterfly/firefly crossfade.
- `forest-haptics.mjs`: approximate trunk cylinders and bush ellipsoids, using nearest wrapped positions. Sustained contact buzzing: bushes 0.10 intensity, trunks 0.16. Pulses last 120 ms, renewed every 80 ms. Cancels on exit, tracking loss, disconnection, or inactive session; unavailable/rejected haptics do not interrupt rendering.
- `forest-flight.mjs`: A/X input and vertical thrust/gravity integration. Keep physical tracking separate from rig elevation.
- `vendor/`: locally bundled Three.js r180, GLTFLoader, BufferGeometryUtils, and MIT license.
- `trees/` and `butterflies/`: runtime GLBs. Editable butterfly Blender source/generator is in `assets/forest/butterfly/`. Original tree Blender source was not supplied.

## Controls and movement

- Left stick: head-directed horizontal walking at 1.5 m/s.
- Right stick: smooth turning at up to 60 degrees/second around the viewer.
- Hold A (right) or X (left): upward thrust 4.5 m/s² against gravity 1.5 m/s², capped at 1.5 m/s ascent. Quest's `xr-standard` A/X button is index 4 on either controller.
- Release both: preserve vertical velocity; gravity produces a smooth apex and descent, capped at 1.5 m/s. Releasing at full ascent speed adds about 0.75 m over one second before descent.
- Holding both buttons does not double thrust. Landing clamps rig elevation to zero and resets vertical velocity. Entering/leaving VR resets elevation and momentum. Vertical simulation pauses while XR is hidden or viewer tracking is unavailable.
- Plants remain pass-through; haptic contact does not block movement.
- Desktop: WASD, left/right arrows, R reset. Flight currently uses VR controller buttons only.

## Validation and working approach

Run `npm test` or `pnpm test` (seven forest scripts plus six Racer tests; Node tests have no external package dependencies). Tests cover wrapping/planting, lighting, tree/butterfly model loading and animation, fireflies, contact haptics, and thrust/gravity. Also run `git diff --check` for edits.

If Node/npm is missing from the shell PATH in this desktop environment, locate the bundled runtime using the workspace dependency tool and run each `tests/*.mjs` with its Node executable. Do not hardcode an app cache path into project scripts.

The user has tested the published forest, sustained contact buzzing, nighttime fireflies, and thrust/gravity flight on Quest and reported that they work well. Automated tests do not replace headset checks for visual appearance, performance, controller mapping, or comfort; no formal frame-time benchmark has been recorded.

Keep Quest costs low: prefer instancing, simple contact volumes, and no per-insect lights or per-frame animated-mesh collision tests. When browser caching affects local testing, update the entry script query version in `projects/forest/index.html` and relevant changed module import versions.

The established workflow is to implement locally, validate, let the user test on Quest, then commit/push when requested. Report clearly whether changes are local, committed, or pushed. Do not assume approval for a previous release automatically covers publishing new changes. Before committing, inspect the diff and preserve unrelated user work.

## Racer — Milestone 1

Read `projects/racer/README.md` and `projects/racer/MILESTONE_1.md`. Source modules in `src/racer/`: `main.js` integrates rendering; `xr.mjs` anchors the cockpit/environment once at the initial seated viewer pose without moving the XR camera; `cockpit.mjs` builds original primitive geometry; `world.mjs` recycles a bounded ring of road/scenery in nine instanced batches; `input.mjs` reads left thumbstick or A/D/arrows; `simulation.mjs` tracks distance, speed, and lateral position; `config.mjs` exposes tuning values.

Cockpit and camera reference frame stay fixed while road/scenery move backward and opposite steering. Auto acceleration reaches 28 m/s in five seconds. Steering changes lateral position progressively, clamps to ±3.5 m, and preserves position on release. No curves, hills, traffic, collisions, sound, HUD, score, or manual throttle/brake in this milestone. Runtime Three.js imports reuse Forest's licensed r180 bundle; Vite packages it locally for deployment.

Development: `pnpm install`, `pnpm dev:racer` (port 5173). Build: `pnpm build:racer`. Existing launcher: http://localhost:8080/projects/racer/. Vite has `base: './'` for both local and GitHub subpaths; preserve that. Serve the repository root to test project-index navigation (the isolated Vite server contains only Racer). Racer has not been physically tested on Quest by the implementing agent. Do not claim headset comfort or frame-rate validation from desktop tests.

## Swarm 3D

Ground: subtle gray checkerboard, generated once as a repeating canvas texture, with 3-foot (0.9144 m) squares, mipmaps and up to 4× anisotropic filtering.

Source and independent Vite package: `projects/swarm/src/`. Run `npm install`, `npm run dev`, `npm test`, and `npm run build` from `projects/swarm`. Build writes `projects/swarm/index.html` and `build/`; retain these for branch-based Pages. Uses Three.js r180 and lil-gui from npm, bundled locally. Wasp uses sliding Catmull–Rom segments with arc-length traversal; Swarm computes all steering before integration and uses bounded time substeps. Standard Three.js VRButton. `locomotion.js` implements head-directed left-stick walking at 1.5 m/s and right-stick smooth turning at 60°/s about the tracked headset, with 15% deadzone. A/X edge presses toggle the VR panel; simultaneous presses toggle once. Motion pauses without a visible, tracked XR frame. Desktop and VR start halfway horizontally from their former overview positions toward the captured wasp spawn, retaining ground-level viewing; the desktop GUI overview reset still frames the full flight box. XR rig compensates initial headset position/yaw once and uses the halfway spawn. `VRPanel.js` places a player-following tuning panel 3 m away, 45 degrees right of rig forward (independent of head-look yaw); either controller points and trigger-clicks minus/plus controls. Desktop mouse drag and wheel; desktop GUI hides during XR. Headset performance and appearance require physical Quest testing.

## Surface

Buildless project in `projects/surface/`, using Forest's locally bundled Three.js r180. `surface.js` renders 64 × 64 separate horizontal quads using `THREE.InstancedMesh`: each is 9 cm square, on 10 cm centers (1 cm gaps, 6.39 m overall footprint). `DEFAULTS.spacing = 0.1` and `DEFAULTS.quadFill = 0.9` in `settings.mjs` define these dimensions, adjustable live; desktop framing and VR starting distance scale with spacing. Each particle moves a whole quad vertically without tilt. Quads are solid, with no triangle outlines. Height-based blue lightness through unlit `MeshBasicMaterial` (darker below rest, lighter above, default saturation at ±0.03 m; adjustable down to ±0.01 m) and the initial VR viewpoint 1.4 m from the center are retained. Desktop drag orbits and wheel zooms; Reset clears waves and restarts the rain timer. `locomotion.mjs` provides head-directed left-stick walking (1.5 m/s) and right-stick smooth turning (60°/s) about the tracked headset, with 15% deadzone. Motion is horizontal, without collision or edge clamping; hidden/untracked XR pauses it. No manual force controls in this version. `tuning.js` creates desktop sliders/number inputs; `VRPanel.js` provides controller rays and a canvas panel 3 m away, 45° right, following rig translation/yaw independently of head-look. A/X edge presses toggle the panel (initially visible); trigger adjusts minus/plus or actions. Shared settings cover damping, spring/restoring strength, rain strength/interval, color range, spacing and fill. Pause freezes physics/rain; reset retains settings; defaults restores and unpauses. Settings are page-session only. `tests/surface-tuning.mjs` covers live parameters, pause, bounds, stability and VR ray targeting. Surface explicitly sets XR foveation to 0; the user confirmed on Quest that this fixes the lighter rectangular peripheral bands.

`simulation.mjs` uses Float32 height/velocity arrays, a 120 Hz fixed timestep, four-neighbor spring coupling, a restoring force, velocity damping, and a 12-cell damped edge band. Every three simulated seconds, one uniformly random particle anywhere on the full 64 × 64 grid, including edge cells, receives an 8 m/s downward velocity impulse. All velocity updates read the previous height state before integrating heights. Hidden/untracked XR pauses simulation; elapsed frame time is capped to prevent catch-up bursts. `tests/surface.mjs` covers drop timing, one-point impact, propagation, damping, stability, reset, and frame-rate independence; included in the root test command. The user has tested Surface on Quest and confirmed the foveation fix; no formal performance benchmark has been recorded.

Surface defaults in `settings.mjs`: damping 0.1, spring strength 10, restoring strength 0.1, rain strength 8, interval 3 s, color range 0.03 m, spacing 0.1 m, fill 0.9, unpaused.
