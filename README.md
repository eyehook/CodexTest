# CodexTest

A collection of static browser and WebXR projects, prepared for GitHub Pages.

For project context in a new Codex conversation, read [AGENTS.md](AGENTS.md).

## Projects

- [Swarm 3D](projects/swarm/): live 3D flocking simulation for desktop and Quest; [setup](projects/swarm/README.md).

- [Racer](projects/racer/): seated WebXR driving prototype; see its [setup and milestone report](projects/racer/README.md).
- [Endless Grove](projects/forest/): a 100 × 100 foot wrapping forest with animated trees, butterflies, and a 60-second day/night cycle.

The root `index.html` is the project directory. Add future projects under `projects/<name>/` with their own `index.html`, then add a card to the root index. Keep links relative so they work under GitHub Pages’ `/CodexTest/` path.

## Local preview

From the repository root, run `python3 -m http.server 8080` and open http://localhost:8080/. The included Racer build and the Forest run without installing anything. To edit Racer, install the Vite development dependency and rebuild as described in its README. Desktop controls: WASD to walk, left/right arrows to turn, R to reset.

## GitHub Pages and Quest 3

1. Commit and push these files to `main`.
2. In repository **Settings → Pages**, choose **Deploy from a branch**, select **main** and **/(root)**, and save.
3. Enable **Enforce HTTPS** if available.
4. Once deployment finishes, open https://eyehook.github.io/CodexTest/ in Meta Quest Browser. Choose **Endless Grove**, then **Enter VR**.

Forest URL: https://eyehook.github.io/CodexTest/projects/forest/

HTTPS provides the secure context required for WebXR. All runtime modules and models are bundled locally; there are no CDN requests. Left stick walks in the direction you look; right stick turns smoothly. The user has verified the forest and immersive controls on Quest 3; formal performance benchmarking remains outstanding.

GitHub documentation: [publishing source](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site), [HTTPS](https://docs.github.com/en/pages/getting-started-with-github-pages/securing-your-github-pages-site-with-https).

## Dependencies and editable sources

`projects/forest/vendor/` contains Three.js r180, GLTFLoader, BufferGeometryUtils, and their MIT license. Runtime models are in `projects/forest/trees/` and `projects/forest/butterflies/`. Editable butterfly Blender source and generation script are in `assets/forest/butterfly/`; Blender is only needed to edit/rebuild that model. Tree Blender sources were not present in the original Quest folder.

## Validation

Run `npm test` with Node.js to verify wrapping, planting, input deadzone, day/night lighting, and loading/animation of all tree and butterfly models. No external npm dependencies are required.

Migrated from `Documents/Codex/Quest`; the original files are retained as a backup.

### Forest touch feedback

Tracked controllers buzz gently for the duration of approximate bush or trunk contact (10% intensity for bushes, 16% for trunks). Short 120 ms pulses renew every 80 ms; leaving contact, losing tracking, disconnecting, or ending/pausing the session cancels feedback. Contacts follow the wrapped world. Haptics are skipped when unsupported. Contact volumes approximate the models and do not follow individual moving branches. Test intensity and alignment on Quest before publishing.

### Nighttime fireflies

Butterflies fade out with daylight, replaced at night by sixteen fireflies across the wrapped tiles. Each firefly has a small yellow sphere inside a larger yellow sphere at 50% opacity at full night. Both use unlit materials to remain bright without extra lights or bloom. Instancing adds two draw batches while fireflies are visible; butterfly skinning updates stop at full night.

### Vertical movement

Hold A (right controller) or X (left controller) to apply upward thrust, accelerating smoothly toward 1.5 m/s, the same as walking. Releasing both preserves upward momentum; gentle gravity (1.5 m/s²) slows ascent and then brings you down, capped at 1.5 m/s. At full ascent speed, release adds approximately 0.75 m over one second before descent. Landing resets vertical velocity. Holding both does not double the speed. Tracked headset/controller height is preserved; flight pauses while the XR session is hidden or viewer tracking is unavailable. Entering or leaving VR resets elevation and velocity.

## Racer development

From this repository root: `pnpm install`, `pnpm dev:racer`, and `pnpm build:racer`. npm equivalents (`npm install`, `npm run dev:racer`, `npm run build:racer`) also work; pnpm is used for the checked-in lockfile. Racer source is in `src/racer/`, and build output is in `projects/racer/`. Commit the rebuilt output alongside source when publishing through the existing Pages branch setup. [Full instructions and validation](projects/racer/README.md).
