# Forest handoff

Read [repository guidance](../../AGENTS.md), then this document and the project README if present. Inspect Git status and relevant source before editing. These project notes were moved from root AGENTS.md; they are preserved context, not a fresh implementation audit. Current code and Git state are authoritative, especially for historical validation and publication claims. Paths below are repository-relative unless their context says otherwise.

## Forest architecture

- `forest.js`: scene, rendering, rig, controllers, locomotion, XR lifecycle, and animation integration.
- `forest-world.mjs`: seeded plant placement, input deadzone, and 30.48 m (100 ft) horizontal wrapping.
- `forest-trees.js`: three GLB tree rigs; CPU skinning updates shared geometry used by instanced copies. Procedural trees remain a loading/error fallback.
- `forest-butterflies.js`: animated butterfly GLB, sixteen insects repeated across nine tiles; visibility fades with daylight and deformation updates stop at full night.
- `forest-fireflies.js`: sixteen fireflies repeated across nine tiles, two instanced sphere batches. Small bright yellow core inside a larger yellow halo with 50% opacity at full night. Unlit materials, no individual lights or bloom.
- `forest-sky.js`: 60-second repeating day/night cycle with opposing sun/moon, sky, fog, and ambient lighting. Daylight drives the butterfly/firefly crossfade.
- `forest-haptics.mjs`: approximate trunk cylinders and bush ellipsoids, using nearest wrapped positions. Sustained contact buzzing: bushes 0.10 intensity, trunks 0.16. Pulses last 120 ms, renewed every 80 ms. Cancels on exit, tracking loss, disconnection, or inactive session; unavailable/rejected haptics do not interrupt rendering.
- `forest-flight.mjs`: A/X input and vertical thrust/gravity integration. Keep physical tracking separate from rig elevation.
- `shared/vendor/three-r180/`: repository-level Three.js r180 and MIT license; GLTFLoader and BufferGeometryUtils live in its `addons/` directory.
- `trees/` and `butterflies/`: runtime GLBs. Editable butterfly Blender source/generator is in `assets/forest/butterfly/`. Original tree Blender source was not supplied.

## Controls and movement

- Left stick: head-directed horizontal walking at 1.5 m/s.
- Right stick: smooth turning at up to 60 degrees/second around the viewer.
- Hold A (right) or X (left): upward thrust 4.5 m/s² against gravity 1.5 m/s², capped at 1.5 m/s ascent. Quest's `xr-standard` A/X button is index 4 on either controller.
- Release both: preserve vertical velocity; gravity produces a smooth apex and descent, capped at 1.5 m/s. Releasing at full ascent speed adds about 0.75 m over one second before descent.
- Holding both buttons does not double thrust. Landing clamps rig elevation to zero and resets vertical velocity. Entering/leaving VR resets elevation and momentum. Vertical simulation pauses while XR is hidden or viewer tracking is unavailable.
- Plants remain pass-through; haptic contact does not block movement.
- Desktop: WASD, left/right arrows, R reset. Flight currently uses VR controller buttons only.

## Validation and working notes

The user has tested the published forest, sustained contact buzzing, nighttime fireflies, and thrust/gravity flight on Quest and reported that they work well. No formal frame-time benchmark has been recorded. Keep Quest costs low: prefer instancing, simple contact volumes, and no per-insect lights or per-frame animated-mesh collision tests. Update the entry script query version and relevant changed module import versions when cache invalidation is needed.

Forest is buildless. Serve the repository root; open `/projects/forest/`. Live URL: https://eyehook.github.io/CodexTest/projects/forest/. Run `npm run test:forest` for isolated Forest changes. Changes to shared vendor code require checks for its consumers under the root validation policy.

## Maintaining this handoff

Keep project behavior, architecture, commands, validation and pending work current here. Follow the shared local-test-then-publish workflow in root AGENTS.md and preserve unrelated work.

## Shared Three.js relocation — 2026-10-29

Three.js r180 now lives at repository-level `shared/vendor/three-r180/`, with GLTFLoader, BufferGeometryUtils, VRButton and area-light modules in its `addons/` directory. Former Forest/Scene Test vendor directories are removed. Imports, tests, documentation and the knight exporter use the canonical shared paths. Core/license bytes are unchanged; addon code changes only adjust imports. Buildless entry/module queries use `shared-r180-1` to refresh cached module graphs. Racer, Terrain and Fishing static outputs were rebuilt from their updated sources; Swarm retains independent npm dependencies.

Validation: the complete root suite, all ten Cloud tests, three Vite builds, Scene Test browser integration and browser startup of all ten affected projects under `/CodexTest/` passed. All 525 inspected local module references resolve. No new Quest hardware benchmark is implied. The user authorized committing and pushing this relocation. See Git history for the release commit; Pages checks were not requested.
