# VR Chess

Single-player seated chess for Meta Quest 3 and desktop browsers. The player chooses White, Black or Random; the opponent uses a locally bundled, single-threaded Stockfish WASM worker. A procedural seated opponent moves pieces using an analytic two-bone arm solver. No backend, API, CDN, account, or build step is used.

## Local development

From the CodexTest repository root:

```sh
python3 -m http.server 8080 --bind 127.0.0.1
```

Open `http://localhost:8080/projects/chess/`. Edit ES modules in `projects/chess/src/` directly. The root index links here. With Node available, run `npm run test:chess`; `npm test` includes these tests. Tests require no package installation. The live engine test launches the checked-in WASM in a subprocess; its small vendor `package.json` enables CommonJS for Node without altering browser worker loading.

## Controls and seated setup

Choose White, Black or Random and an opponent target Elo, then Enter VR. White is the default; the side preference persists. Random assigns a color once per new game. The board faces the player’s color, and Stockfish opens as White when the player is Black. The launcher shows the assigned color. Changing side or Elo restarts the game. Each tracked controller grip displays a 50% transparent sphere of 1-inch radius. When it intersects a piece square’s vertical column from the board surface to 6 inches (15.24 cm) above it, the nearest piece highlights. Reach above one of your pieces, hold trigger or grip to pick it up, carry it, and release over a legal destination to commit the move. When both buttons are held, release both to drop. The square beneath the carried piece highlights green for a legal destination or red for an illegal one. Illegal/offboard releases return the piece without making a move. Only one piece can be held across both hands. Captured White and Black pieces lift five inches, glide to separate side trays, then land outside the playable squares and controls. The original victim mesh stays visible throughout the roughly one-second flight. They follow table adjustments and clear on restart. Promotion displays Queen/Rook/Bishop/Knight buttons. Gold marks the selection, olive the last move, and red a checked king. VR status sits on the far tabletop edge; restart and promotion buttons sit on the right tabletop. Bring a hand sphere to a button and press trigger or grip to activate it. The VR side menu and controller pointing rays are removed. Invalid selections show instructions in the tabletop status. There is no VR pointing functionality; interaction uses physical hand proximity. Desktop uses drag-and-drop, with launcher buttons for promotion and restart. A promotion pawn stays on its dropped square until a menu choice commits it.

In VR, grab the gold handle on the near edge of the tabletop using trigger or grip. Move your hand up/down, left/right and toward/away from your seat; the table, board, opponent and tabletop controls follow together. Move left/right to adjust side offset, within ±25 cm of the seat center. Release all held buttons to save the setup. Only one hand can adjust the table, and pieces cannot be picked up during adjustment. The handle is unavailable while a piece is being carried or the computer is thinking/moving. Tracking loss, disconnects, hiding VR or restart end adjustment at its last position and save it.

The launcher offers height (10–65 cm below the initial eyes), forward distance (45–100 cm), and lateral offset (±25 cm). These settings and Elo persist in localStorage when storage is available. During pickup/carry and piece animation, table movement is locked. Tracking loss, hidden sessions, disconnects and restart cancel a held piece without a move; recovery requires a fresh button press. Elo changes restart the game. Settings changes need no build. Game history is not persisted.

Uses WebXR `local` reference space. On the first tracked frame, the environment anchors to the initial seated headset position and horizontal heading. The XR camera is never repositioned, and there is no artificial player locomotion. Adjustments move the table and opponent together. Animation pauses when the immersive session is hidden or viewer tracking is unavailable. Ending VR cancels pending work and asks for a fresh game; restart also cancels any pending search/animation.

## HTTPS / Quest testing

WebXR needs a secure context. Use the repository's USB Quest launcher (`Start-Quest-VR.command` outside this repository), which serves this checkout and reverse-forwards port 8080, then open `http://localhost:8080/projects/chess/` in Quest Browser. Alternatively use static HTTPS hosting. A plain LAN HTTP URL is not sufficient for immersive WebXR. The engine must be served over HTTP(S), not opened as a `file:` URL. Serve `.wasm` as `application/wasm` and `.js` as JavaScript. Python's server and GitHub Pages do this.

No physical Quest 3 testing or headset frame-time measurements have been performed by the implementing agent. Check seat alignment, both controllers, tracking loss/recovery, tabletop buttons and the handle, arm appearance, stereo, comfort and sustained 72 FPS on hardware. The single-threaded engine does not need cross-origin isolation headers, so it is compatible with ordinary GitHub Pages hosting.

## Difficulty

Options run from **1350 to 2000 in increments of 50**, with **1500 default**. The selected rating persists. Older saved choices outside this range reset to 1500. Initialization reads the actual engine's advertised `UCI_Elo` min/max before enabling `UCI_LimitStrength`; the bundled engine advertises **1320–3190**, which includes every launcher option. These are approximate targets, especially with the Lite network and 300 ms search limit, and not guaranteed playing ratings. No artificial weakening is added.

## Architecture

- `GameController.mjs`: authoritative chess.js instance, selection, promotion, status, turn flow and generation-guarded transactions. Validate on a clone → lock → animate → commit → synchronize → unlock. Repetition/history remain in the authoritative instance.
- `ChessBoard.mjs`: square/world conversion, merged reusable piece geometries, instanced colored board squares, highlights and synchronization. The player’s chosen color sits closest; h1 is light; queens begin on d1/d8.
- `InputController.mjs` / `HandInteraction.mjs`: finite sphere/column proximity, tracked grip spheres, trigger/grip edge polling, exclusive pickup/carry/drop, desktop dragging and tabletop button proximity. Only visible tracked controller input is accepted in XR.
- `EngineController.mjs`: dedicated classic Worker, UCI handshake, advertised Elo range, bounded single outstanding search, timeouts, failures and worker termination. Each restart replaces the worker so stale responses cannot enter a new game.
- `OpponentAvatar.mjs` / `ProceduralAvatar.mjs`: replaceable world-space hand-target, attachment and rest-pose interface. No chess rules or square notation in avatar geometry.
- `ArmIK.mjs`: geometry-independent analytic two-bone solver with consistent pole direction, 15–155° bend bounds and distance clamping. All squares are reachable without moving the torso.
- `OpponentAnimator.mjs`: cancellable asynchronous reach/lower/attach/lift/carry/place/clear/return sequence. The carried piece remains upright; `Object3D.attach` preserves its world transform. Transport clearance is 24 cm, above the tallest pieces. Captured pieces complete their lift/carry/landing flight to a side tray first; en passant removes the adjacent pawn; castling carries king then rook. Promotion replaces the mesh after placement and commit.
- `Motion.mjs`: elapsed-time easing, paused with rendering visibility/tracking, cancellable jobs.
- `TableControls.mjs`: tabletop status, promotion and restart labels drawn using local system fonts, with sphere-proximity activation.
- `TableHandle.mjs`: near-edge procedural handle, sphere proximity, seated-anchor drag axes, bounded height/distance/side offset and save-on-release.
- `Settings.mjs`: bounded persisted configuration with storage/corruption fallback.

No full-body IK, textures for pieces/avatar, fingers, legs, shadows, dynamic per-piece lights, idle animation, sound, alternative themes or rigged GLBs. Typical initial desktop rendering measured 45 draw calls and 9,316 triangles, in the original scene before the handle and tabletop control updates. This is a desktop scene count, not a Quest FPS measurement. `chessDiagnostics()` and the viewport/status DOM data attributes expose read-only diagnostics.

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
