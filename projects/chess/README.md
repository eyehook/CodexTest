# VR Chess

Single-player seated chess for Meta Quest 3 and desktop browsers. White is the player; Black uses a locally bundled, single-threaded Stockfish WASM worker. A procedural seated opponent moves pieces using an analytic two-bone arm solver. No backend, API, CDN, account, or build step is used.

## Local development

From the CodexTest repository root:

```sh
python3 -m http.server 8080 --bind 127.0.0.1
```

Open `http://localhost:8080/projects/chess/`. Edit ES modules in `projects/chess/src/` directly. The root index links here. With Node available, run `npm run test:chess`; `npm test` includes these tests. Tests require no package installation. The live engine test launches the checked-in WASM in a subprocess; its small vendor `package.json` enables CommonJS for Node without altering browser worker loading.

## Controls and seated setup

Choose an opponent target Elo, then Enter VR. Either controller: point at a White piece and press trigger; point at a green legal square and press trigger again. Promotion displays Queen/Rook/Bishop/Knight buttons. Gold marks the selection, olive the last move, and red a checked king. Status, restart, and board height/distance controls appear on a panel to the left of the board. Invalid selections show instructions in the status panel. Desktop uses the same two-click sequence, with launcher buttons for promotion and restart.

The launcher offers height (10–65 cm below the initial eyes), forward distance (45–100 cm), and lateral offset (±25 cm). These settings and Elo persist in localStorage when storage is available. During a piece animation, table movement is locked. Elo changes restart the game. Settings changes need no build. Game history is not persisted.

Uses WebXR `local` reference space. On the first tracked frame, the environment anchors to the initial seated headset position and horizontal heading. The XR camera is never repositioned, and there is no artificial player locomotion. Adjustments move the table and opponent together. Animation pauses when the immersive session is hidden or viewer tracking is unavailable. Ending VR cancels pending work and asks for a fresh game; restart also cancels any pending search/animation.

## HTTPS / Quest testing

WebXR needs a secure context. Use the repository's USB Quest launcher (`Start-Quest-VR.command` outside this repository), which serves this checkout and reverse-forwards port 8080, then open `http://localhost:8080/projects/chess/` in Quest Browser. Alternatively use static HTTPS hosting. A plain LAN HTTP URL is not sufficient for immersive WebXR. The engine must be served over HTTP(S), not opened as a `file:` URL. Serve `.wasm` as `application/wasm` and `.js` as JavaScript. Python's server and GitHub Pages do this.

No physical Quest 3 testing or headset frame-time measurements have been performed by the implementing agent. Check seat alignment, both controllers, tracking loss/recovery, all panel controls, arm appearance, stereo, comfort and sustained 72 FPS on hardware. The single-threaded engine does not need cross-origin isolation headers, so it is compatible with ordinary GitHub Pages hosting.

## Difficulty

Options: 800, 1000, 1200, **1500 default**, 1800, 2000, 2200. Initialization reads the actual engine's advertised `UCI_Elo` min/max before enabling `UCI_LimitStrength`. Bundled Stockfish advertises **1320–3190**, so 800/1000/1200 are visibly clamped to **1320**. The selected option still persists; the engine status reports its effective value. These are approximate targets, especially with the Lite network and 300 ms search limit, and not guaranteed playing ratings. No artificial weakening is added.

## Architecture

- `GameController.mjs`: authoritative chess.js instance, selection, promotion, status, turn flow and generation-guarded transactions. Validate on a clone → lock → animate → commit → synchronize → unlock. Repetition/history remain in the authoritative instance.
- `ChessBoard.mjs`: square/world conversion, merged reusable piece geometries, instanced colored board squares, highlights and synchronization. White sits at rank 1; h1 is light; queens begin on d1/d8.
- `InputController.mjs`: desktop/VR raycasting; only visible tracked controller input is accepted in XR.
- `EngineController.mjs`: dedicated classic Worker, UCI handshake, advertised Elo range, bounded single outstanding search, timeouts, failures and worker termination. Each restart replaces the worker so stale responses cannot enter a new game.
- `OpponentAvatar.mjs` / `ProceduralAvatar.mjs`: replaceable world-space hand-target, attachment and rest-pose interface. No chess rules or square notation in avatar geometry.
- `ArmIK.mjs`: geometry-independent analytic two-bone solver with consistent pole direction, 15–155° bend bounds and distance clamping. All squares are reachable without moving the torso.
- `OpponentAnimator.mjs`: cancellable asynchronous reach/lower/attach/lift/carry/place/clear/return sequence. The carried piece remains upright; `Object3D.attach` preserves its world transform. Transport clearance is 24 cm, above the tallest pieces. Captures are removed first; en passant removes the adjacent pawn; castling carries king then rook. Promotion replaces the mesh after placement and commit.
- `Motion.mjs`: elapsed-time easing, paused with rendering visibility/tracking, cancellable jobs.
- `VRPanel.mjs`: status, promotion, restart and positioning controls drawn using local system fonts.
- `Settings.mjs`: bounded persisted configuration with storage/corruption fallback.

No full-body IK, textures for pieces/avatar, fingers, legs, shadows, dynamic per-piece lights, idle animation, sound, alternative themes or rigged GLBs. Typical initial desktop rendering measured 45 draw calls and 9,316 triangles, before adding the VR panel/rays. This is a desktop scene count, not a Quest FPS measurement. `chessDiagnostics()` and the viewport/status DOM data attributes expose read-only diagnostics.

## Deployment

Changes remain local until the user requests commit/push. GitHub Pages serves the root of `main`; preserve `projects/chess/`, its local vendors, source archive, notices and the shared licensed `projects/forest/vendor/` Three.js files. All runtime URLs are relative and work under `/CodexTest/`. No generated build outputs are required. After an authorized deployment, the entry URL is `https://eyehook.github.io/CodexTest/projects/chess/`.

## Dependency licensing and source

Chess application code in this directory is licensed under **GPL-3.0-or-later**, see [LICENSE](LICENSE). Third-party components retain their licenses:

- **Three.js r180**: existing local bundle at `../forest/vendor/three.module.js`, `three.core.js`, `BufferGeometryUtils.js`, MIT license at `../forest/vendor/LICENSE`. Unmodified reuse.
- **chess.js 1.4.0**: local ESM distribution in `vendor/chess/chess.mjs`, BSD-2-Clause notice in `vendor/chess/LICENSE`. Source project: https://github.com/jhlywa/chess.js/tree/v1.4.0 . Npm package `chess.js@1.4.0`.
- **Stockfish.js 17.1.0 Lite single-threaded**: unmodified `stockfish-17.1-lite-single-03e3232.js` and matching `.wasm`, GPLv3, `vendor/stockfish/Copying.txt` and `AUTHORS`. Npm package `stockfish@17.1.0`, upstream https://github.com/nmrugg/stockfish.js .

[Stockfish corresponding source](vendor/stockfish/source-17.1.0.tar.gz) is distributed locally, pinned to npm's `gitHead` **602fd7e1a571a2be71f242942db90483731f2a1f**. It includes engine C++/JS, upstream build scripts/Makefile, bundled minifier and the Lite network `nn-9067e33176e8.nnue` (SHA-256 prefix verified against its filename). Generated binaries for other engine variants are omitted; no engine source is modified. Source snapshot: https://github.com/nmrugg/stockfish.js/tree/602fd7e1a571a2be71f242942db90483731f2a1f .

To rebuild the engine, extract the archive into a separate working directory, use the Emscripten version identified by upstream `build.js` and follow the included README. Run `node build.js --lite --single-threaded --no-split` with Node, make, Python and the activated Emscripten toolchain available. The Lite network is already in `src/`; no network download is needed for that evaluation file. The source archive includes upstream's build instructions. Exact byte reproduction has not been tested here. Preserve all dependency notices and provide corresponding source with any distribution. These links are documentation only; the game makes no runtime requests to them.

## Milestones and validation

See [MILESTONES.md](MILESTONES.md) for implemented behavior, desktop/automated evidence, known limitations and next steps for A–D.
