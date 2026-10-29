# Racer handoff

Read [repository guidance](../../AGENTS.md), then this document and the project README if present. Inspect Git status and relevant source before editing. These project notes were moved from root AGENTS.md; they are preserved context, not a fresh implementation audit. Current code and Git state are authoritative, especially for historical validation and publication claims. Paths below are repository-relative unless their context says otherwise.

## Racer — Milestone 1

Read `projects/racer/README.md` and `projects/racer/MILESTONE_1.md`. Source modules in `src/racer/`: `main.js` integrates rendering; `xr.mjs` anchors the cockpit/environment once at the initial seated viewer pose without moving the XR camera; `cockpit.mjs` builds original primitive geometry; `world.mjs` recycles a bounded ring of road/scenery in nine instanced batches; `input.mjs` reads left thumbstick or A/D/arrows; `simulation.mjs` tracks distance, speed, and lateral position; `config.mjs` exposes tuning values.

Cockpit and camera reference frame stay fixed while road/scenery move backward and opposite steering. Auto acceleration reaches 28 m/s in five seconds. Steering changes lateral position progressively, clamps to ±3.5 m, and preserves position on release. No curves, hills, traffic, collisions, sound, HUD, score, or manual throttle/brake in this milestone. Runtime Three.js imports reuse the shared licensed r180 bundle; Vite packages it locally for deployment.

Development: `pnpm install`, `pnpm dev:racer` (port 5173). Build: `pnpm build:racer`. Existing launcher: http://localhost:8080/projects/racer/. Vite has `base: './'` for both local and GitHub subpaths; preserve that. Serve the repository root to test project-index navigation (the isolated Vite server contains only Racer). Racer has not been physically tested on Quest by the implementing agent. Do not claim headset comfort or frame-rate validation from desktop tests.

Keep generated `projects/racer/` outputs with `src/racer/` source in commits: GitHub Pages publishes the root of main. The checked-in build also works with the existing Python/Quest launcher.

## Maintaining this handoff

Keep project behavior, architecture, commands, validation and pending work current here. Follow the shared local-test-then-publish workflow in root AGENTS.md and preserve unrelated work.

## Shared Three.js relocation — 2026-10-29

Three.js r180 now lives at repository-level `shared/vendor/three-r180/`, with GLTFLoader, BufferGeometryUtils, VRButton and area-light modules in its `addons/` directory. Former Forest/Scene Test vendor directories are removed. Imports, tests, documentation and the knight exporter use the canonical shared paths. Core/license bytes are unchanged; addon code changes only adjust imports. Buildless entry/module queries use `shared-r180-1` to refresh cached module graphs. Racer, Terrain and Fishing static outputs were rebuilt from their updated sources; Swarm retains independent npm dependencies.

Validation: the complete root suite, all ten Cloud tests, three Vite builds, Scene Test browser integration and browser startup of all ten affected projects under `/CodexTest/` passed. All 525 inspected local module references resolve. No new Quest hardware benchmark is implied. The user authorized committing and pushing this relocation. See Git history for the release commit; Pages checks were not requested.
