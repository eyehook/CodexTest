# CodexTest

A collection of static browser and WebXR projects, prepared for GitHub Pages.

## Projects

- [Endless Grove](projects/forest/): a 100 × 100 foot wrapping forest with animated trees, butterflies, and a 60-second day/night cycle.

The root `index.html` is the project directory. Add future projects under `projects/<name>/` with their own `index.html`, then add a card to the root index. Keep links relative so they work under GitHub Pages’ `/CodexTest/` path.

## Local preview

From the repository root, run `python3 -m http.server 8080` and open http://localhost:8080/. No build or npm install is required. Desktop controls: WASD to walk, left/right arrows to turn, R to reset.

## GitHub Pages and Quest 3

1. Commit and push these files to `main`.
2. In repository **Settings → Pages**, choose **Deploy from a branch**, select **main** and **/(root)**, and save.
3. Enable **Enforce HTTPS** if available.
4. Once deployment finishes, open https://eyehook.github.io/CodexTest/ in Meta Quest Browser. Choose **Endless Grove**, then **Enter VR**.

Forest URL: https://eyehook.github.io/CodexTest/projects/forest/

HTTPS provides the secure context required for WebXR. All runtime modules and models are bundled locally; there are no CDN requests. Left stick walks in the direction you look; right stick turns smoothly. Headset performance and immersive controls still need verification on a Quest 3.

GitHub documentation: [publishing source](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site), [HTTPS](https://docs.github.com/en/pages/getting-started-with-github-pages/securing-your-github-pages-site-with-https).

## Dependencies and editable sources

`projects/forest/vendor/` contains Three.js r180, GLTFLoader, BufferGeometryUtils, and their MIT license. Runtime models are in `projects/forest/trees/` and `projects/forest/butterflies/`. Editable butterfly Blender source and generation script are in `assets/forest/butterfly/`; Blender is only needed to edit/rebuild that model. Tree Blender sources were not present in the original Quest folder.

## Validation

Run `npm test` with Node.js to verify wrapping, planting, input deadzone, day/night lighting, and loading/animation of all tree and butterfly models. No external npm dependencies are required.

Migrated from `Documents/Codex/Quest`; the original files are retained as a backup.
