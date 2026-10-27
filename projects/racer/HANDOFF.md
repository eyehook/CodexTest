# Racer handoff

Read [repository guidance](../../AGENTS.md), then this document and the project README if present. Inspect Git status and relevant source before editing. These project notes were moved from root AGENTS.md; they are preserved context, not a fresh implementation audit. Current code and Git state are authoritative, especially for historical validation and publication claims. Paths below are repository-relative unless their context says otherwise.

## Racer — Milestone 1

Read `projects/racer/README.md` and `projects/racer/MILESTONE_1.md`. Source modules in `src/racer/`: `main.js` integrates rendering; `xr.mjs` anchors the cockpit/environment once at the initial seated viewer pose without moving the XR camera; `cockpit.mjs` builds original primitive geometry; `world.mjs` recycles a bounded ring of road/scenery in nine instanced batches; `input.mjs` reads left thumbstick or A/D/arrows; `simulation.mjs` tracks distance, speed, and lateral position; `config.mjs` exposes tuning values.

Cockpit and camera reference frame stay fixed while road/scenery move backward and opposite steering. Auto acceleration reaches 28 m/s in five seconds. Steering changes lateral position progressively, clamps to ±3.5 m, and preserves position on release. No curves, hills, traffic, collisions, sound, HUD, score, or manual throttle/brake in this milestone. Runtime Three.js imports reuse Forest's licensed r180 bundle; Vite packages it locally for deployment.

Development: `pnpm install`, `pnpm dev:racer` (port 5173). Build: `pnpm build:racer`. Existing launcher: http://localhost:8080/projects/racer/. Vite has `base: './'` for both local and GitHub subpaths; preserve that. Serve the repository root to test project-index navigation (the isolated Vite server contains only Racer). Racer has not been physically tested on Quest by the implementing agent. Do not claim headset comfort or frame-rate validation from desktop tests.

Keep generated `projects/racer/` outputs with `src/racer/` source in commits: GitHub Pages publishes the root of main. The checked-in build also works with the existing Python/Quest launcher.

## Maintaining this handoff

Keep project behavior, architecture, commands, validation and pending work current here. Follow the shared local-test-then-publish workflow in root AGENTS.md and preserve unrelated work.
