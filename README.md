# CodexTest

A collection of static browser and WebXR projects, prepared for GitHub Pages.

For project context in a new Codex conversation, read [AGENTS.md](AGENTS.md).

## Projects

- [VR Chess](projects/chess/): seated chess against a local Stockfish opponent, with direct hand pickup, a rigged Blender opponent and smooth piece-following head motion; [setup and licensing](projects/chess/README.md), [agent handoff](projects/chess/HANDOFF.md).

- [Fishing](projects/fishing/): independent copy of Terrain as the foundation for a fishing simulator; [setup and validation](projects/fishing/README.md).

- [Terrain](projects/terrain/): GPU-displaced, deterministic rolling hills, lakes, and clustered triangle trees for desktop and Quest; [setup and validation](projects/terrain/README.md).

- [Surface](projects/surface/): 64 × 64 spring-connected quad surface with automatic raindrops; [details](projects/surface/README.md).

- [Swarm 3D](projects/swarm/): live 3D flocking simulation for desktop and Quest; [setup](projects/swarm/README.md).

- [Racer](projects/racer/): seated WebXR driving prototype; see its [setup and milestone report](projects/racer/README.md).
- [Endless Grove](projects/forest/): a 100 × 100 foot wrapping forest with animated trees, butterflies, and a 60-second day/night cycle.

The root `index.html` is the project directory. Add future projects under `projects/<name>/` with their own `index.html`, then add a card to the root index. Keep links relative so they work under GitHub Pages’ `/CodexTest/` path.

## Local preview

From the repository root, run `python3 -m http.server 8080` and open http://localhost:8080/. Chess, Forest and the included Racer build run without installing anything. To edit Racer, install the Vite development dependency and rebuild as described in its README. Forest desktop controls: WASD to walk, left/right arrows to turn, R to reset. Chess uses drag-and-drop; other projects document their own controls.

## GitHub Pages and Quest 3

Pages is already configured for `main`, `/(root)`. Test locally and publish only when the user requests commit/push. The following describes the existing setup:

1. Commit and push these files to `main`.
2. In repository **Settings → Pages**, choose **Deploy from a branch**, select **main** and **/(root)**, and save.
3. Enable **Enforce HTTPS** if available.
4. Once deployment finishes, open https://eyehook.github.io/CodexTest/ in Meta Quest Browser. Choose **Endless Grove**, then **Enter VR**.

Forest URL: https://eyehook.github.io/CodexTest/projects/forest/

HTTPS provides the secure context required for WebXR. All runtime modules and models are bundled locally; there are no CDN requests. Left stick walks in the direction you look; right stick turns smoothly. The user has verified the forest and immersive controls on Quest 3; formal performance benchmarking remains outstanding.

GitHub documentation: [publishing source](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site), [HTTPS](https://docs.github.com/en/pages/getting-started-with-github-pages/securing-your-github-pages-site-with-https).

## Dependencies and editable sources

`projects/forest/vendor/` contains Three.js r180, GLTFLoader, BufferGeometryUtils, and their MIT license. Runtime models are in `projects/forest/trees/` and `projects/forest/butterflies/`. Editable butterfly Blender source and generation script are in `assets/forest/butterfly/`; Blender is only needed to edit/rebuild that model. Tree Blender sources were not present in the original Quest folder.

Chess editable sources live in `assets/chess/`: the active opponent is `opponent/ManLP-articulated.blend` (see its [export workflow](assets/chess/opponent/README.md)); the edited knight has its own [source/exporter](assets/chess/knight/README.md). Exported runtime assets stay under `projects/chess/`. Preserve the active combined rig; early generation scripts do not recreate its later head/neck edits.

## Validation

Run `npm test` with Node.js for the root suite covering Forest, Racer, Surface, Terrain, Fishing and Chess. No external npm dependencies are required for these tests. Swarm has its own package and tests; see its README. Use project-specific scripts from `package.json` for focused checks and `git diff --check` before committing.

For the current Chess handoff, see [HANDOFF.md](projects/chess/HANDOFF.md): 115 Chess tests and the full root suite passed on 2026-10-24. The user authorized the HeadLP, gaze, blended-neck and documentation release on that date; consult Git status/log for current publication state. Automated checks do not establish headset appearance or performance.

Migrated from `Documents/Codex/Quest`; the original files are retained as a backup.

### Forest touch feedback

Tracked controllers buzz gently for the duration of approximate bush or trunk contact (10% intensity for bushes, 16% for trunks). Short 120 ms pulses renew every 80 ms; leaving contact, losing tracking, disconnecting, or ending/pausing the session cancels feedback. Contacts follow the wrapped world. Haptics are skipped when unsupported. Contact volumes approximate the models and do not follow individual moving branches. Test intensity and alignment on Quest before publishing.

### Nighttime fireflies

Butterflies fade out with daylight, replaced at night by sixteen fireflies across the wrapped tiles. Each firefly has a small yellow sphere inside a larger yellow sphere at 50% opacity at full night. Both use unlit materials to remain bright without extra lights or bloom. Instancing adds two draw batches while fireflies are visible; butterfly skinning updates stop at full night.

### Vertical movement

Hold A (right controller) or X (left controller) to apply upward thrust, accelerating smoothly toward 1.5 m/s, the same as walking. Releasing both preserves upward momentum; gentle gravity (1.5 m/s²) slows ascent and then brings you down, capped at 1.5 m/s. At full ascent speed, release adds approximately 0.75 m over one second before descent. Landing resets vertical velocity. Holding both does not double the speed. Tracked headset/controller height is preserved; flight pauses while the XR session is hidden or viewer tracking is unavailable. Entering or leaving VR resets elevation and velocity.

## Racer development

From this repository root: `pnpm install`, `pnpm dev:racer`, and `pnpm build:racer`. npm equivalents (`npm install`, `npm run dev:racer`, `npm run build:racer`) also work; pnpm is used for the checked-in lockfile. Racer source is in `src/racer/`, and build output is in `projects/racer/`. Commit the rebuilt output alongside source when publishing through the existing Pages branch setup. [Full instructions and validation](projects/racer/README.md).
