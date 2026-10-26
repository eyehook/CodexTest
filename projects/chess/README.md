# VR Chess

Single-player seated chess for Meta Quest 3 and desktop browsers. A locally bundled Stockfish worker plays against the user; a skinned Blender opponent physically moves its pieces and smoothly watches either player's held piece. The game is buildless, with no backend, account, CDN or runtime network service.

For a new agent, start with [HANDOFF.md](HANDOFF.md), then this document and the repository [AGENTS.md](../../AGENTS.md). [MILESTONES.md](MILESTONES.md) records the current delivery/validation state.

## Run and test

Serve the **repository root**, because Chess shares Three.js with Forest:

```sh
python3 -m http.server 8080 --bind 127.0.0.1
```

Open `http://localhost:8080/projects/chess/`. Edit `src/*.mjs` directly; no build or dependency installation is needed for Chess.

```sh
npm run test:chess
npm test
git diff --check
```

`pnpm test:chess` / `pnpm test` are equivalent. Tests use Node's built-in runner and the checked-in assets. The live Stockfish test launches the bundled WASM in a subprocess. Latest validation: **188 Chess tests and the full repository suite passed** on 2026-10-26. Automated and desktop checks do not establish headset performance.

## Play and controls

Choose White, Black or Random in the desktop launcher. White is the default. Random resolves once per new game; the launcher shows the assigned color. Changing side or Elo restarts. Only the playing board rotates for Black; the opponent, side trays and move-list panel retain their positions. Rank/file labels on the left and bottom edges follow the player's orientation.

In VR, each tracked controller grip has a 50%-transparent sphere with a 1-inch radius. Intersecting the column above a player's piece highlights it; columns extend 6 inches above the square, with sphere-radius overlap included. Hold trigger or grip to pick it up, move the hand, and release over a legal square to commit. If both buttons are held, release both. The destination highlights green/red. Invalid or off-board drops restore the piece. Only one hand owns a piece at a time. Tracking loss, disconnect, hidden XR or restart cancels the grab; recovery requires a fresh press. Controller rays appear only in Options mode. Desktop uses drag-and-drop.

Press **Y (left) or B (right)** to open Options. The chess scene hides and piece/avatar animation pauses while the panel is open. Either controller aims a pointer; press trigger to toggle **Evaluate Move** (default Off). **Save Changes**, or Y/B again, saves the draft to the existing localStorage settings and restores play. Session exit also saves and closes. Opening cancels any held piece/positioning safely; fresh presses are required after closing or tracking recovery. The physical Quest Menu button is reserved by the browser and cannot open this panel. Future settings can be added as rows in `OptionsMenu.mjs`.

For table positioning, press **grip in open space outside occupied piece pickup columns**. The owner sphere becomes six RGB axis arrows. Move up/down, forward/back or left/right; release grip to save, even if trigger remains held. This moves the table and opponent together without moving the XR camera. There is no gold handle mesh. Positioning is exclusive and locked during piece movement, promotion and computer thinking/movement; pickup columns remain reserved regardless of piece color/turn. Interruptions end positioning at the last valid position.

The desktop seated setup persists height, distance and lateral offset with side/Elo in `localStorage` (`codextest.chess.v1`), with safe unavailable/corrupt-storage fallback:

| Setting                   | Default | Range              |
| ------------------------- | ------- | ------------------ |
| Height below initial eyes | 35 cm   | 10–65 cm           |
| Forward distance          | 65 cm   | 45–100 cm          |
| Lateral offset            | 0       | ±25 cm             |
| Opponent target Elo       | 1500    | 1350–2000, step 50 |

Game history is not persisted. In VR, move history occupies a viewer-facing panel above/behind the opponent on the viewer's right, with an optional evaluation gauge above it. History has fixed White/Black headings, numbered SAN columns and the newest eight rows. The table has no restart or promotion buttons. Restart remains in the desktop launcher. At game over, a win/loss/draw illustration appears above the board with a proximity-highlighted **New Game** button, activated by trigger/grip in VR or a desktop click.

When **Evaluate Move** is On, each player turn starts one independent full-strength Stockfish analysis cycle: static scoring of the current board, a 1000 ms MultiPV search to choose opponent replies, then static scoring of each board after the candidate move plus that reply, after the opponent move is committed and its animation finishes. White's initial turn is included; game-over positions are skipped. All legal moves are analyzed once and cached by piece; pickup only selects which cached hints to show. Once scores are available, the held piece's legal destination tiles show red for worse moves, white for neutral changes (within 0.1 pawn, displayed as `0.0`; tinted values retain one-decimal rounding), and green for improvements from the player's perspective. Negative tints start at `#ffcccc`, positive tints at `#ccffcc`; intensity increases with the evaluation change, reaching full tint at three pawns. Regular tiles remain visible while analysis is pending or unavailable. Temporary testing numbers are drawn flat on the evaluated squares using one transparent board-sized canvas atlas (one additional draw). The text uses normal depth testing, so pieces can hide it, and rotates within each square for Black. Promotion squares use the best available promotion result. Forced-mate outcome changes use saturated red/green rather than invented pawn values. Displayed delta = score(board after candidate + best response) − score(current board), converted to the player's perspective. Both board scores use Stockfish's static NNUE evaluator, not candidate search scores or the best candidate's value. A move preserving the score is zero. Stockfish cannot static-evaluate a checked position, so checked endpoints/baselines use a depth-one check/quiescence search; immediate mate/draw is handled explicitly. Candidate PV replies are checked for legality; missing replies trigger a short depth-four child search. The 1000 ms reply-search budget excludes worker startup, static trace scoring and these fallbacks. Baseline and per-piece results are cached once per turn. Dropping/canceling, opening Options and tracking loss hide hints without canceling the turn search or discarding its cache. Changing turns/positions, restart, disabling the option and session exit invalidate pending analysis. Completed results survive Options/tracking changes. A failed analysis is not retried on every pickup. The analysis worker is independent of the opponent's Elo-limited worker. These are quick estimates, not guarantees of tactical accuracy.

With Evaluate Move enabled, hold **A (right) or X (left)** to highlight the piece with the best cached move in blue. It waits for the complete turn cache, ranks the same candidate+reply endpoint scores as the tile hints (from the player's perspective), chooses one deterministically on ties, and includes the least-bad move if every choice loses value. Either held button keeps it active; releasing both restores normal hover/selection. Options, hidden/untracked input, turn changes, disabling and session exit clear the highlight. It never starts another search.

**Show Evaluation** is an independent persisted Options toggle, default Off. It replaces the former status box above the move list with a semicircular dial: red at bottom left, white at the top center, green at bottom right. The black needle shows the board score at the start of the player's turn, from the player's perspective, clamped at −5/+5 pawns, with an inclusive −0.1 to +0.1 pawn dead zone pointing straight up. It retains the previous turn's score while the next is pending, then smoothly eases from its current angle to the new target over 0.55 seconds; unknown initial scores hide the needle. `CurrentEvaluation.mjs` refreshes only at the start of a playable player turn, after the opponent's move commits and its animation finishes. It does not score the player's move or game-over boards; those retain the last turn's indication. New-game reset clears the old score. It reuses the move-hint baseline when available; otherwise it lazily uses its own scoring worker, so Show Evaluation also works with Evaluate Move Off. `EvaluationGauge.mjs` draws the cached dial face and animates only the needle when the score changes; hidden/untracked XR and Options pause its easing. The desktop status text remains available; there is no separate in-world status box.

## Undo confirmation

During a normal player turn, push either thumbstick left to open **“Do you want to undo your last move?”**. The rest of the scene hides while the modal is open, leaving the dialog and pointers visible; closing restores the previous scene visibility. Either controller points/trigger-clicks **Yes** or **No**. Yes removes the player's last committed move and the opponent's reply, returning to the position before that player move; No leaves history untouched. Captures/trays, castling rights, en passant, promotions, move history and last-move highlights are rebuilt from chess.js history. Analysis epochs invalidate stale results and start fresh scoring for the restored turn. Black's initial opponent opening is preserved; no undo is offered before the player has made a move. Undo is locked during thinking, move animation, promotion and game over. Opening safely returns a held piece and finishes table positioning. Fresh stick deflection is required after neutral/tracking recovery; holding left cannot repeatedly open the dialog. Options and undo are mutually exclusive, and session exit/restart dismisses the prompt. The transparent modal uses fixed render layers: backdrop first, question/buttons next, pointer rays last, so head/view changes cannot paint the backdrop over its content.

## Promotion and captures

After the player's pawn lands on the back rank, a floating tray 22 cm above the board offers queen, rook, bishop and knight meshes. Hover highlights a choice like an ordinary piece. Grab a choice and release outside the tray: the pawn disappears and the actual selected mesh glides to its square over 0.5 seconds, then the move commits. Release within the tray's return bounds to cancel the selection and ease it back to its slot over 0.22 seconds. The tray glows gold when return is eligible. Lost tracking restores the choice; restart clears the tray. Desktop sidebar promotion buttons remain available.

Captured pieces use the actual victim mesh, including en passant, moving to separate White/Black side trays in one eased 0.8-second arc with 15 cm lift. Opponent captures start only at 85% of the attacker's carry. The attacking arm continues without pausing for the victim; geometry intersections are allowed. Player captures start after release at the destination; placement/settling and victim flight are coordinated before committing. Restart cancels and rebuilds from authoritative verbose history, including captured promotion types. Custom FENs do not manufacture missing pieces as captures.

## Opponent model and movement

The live avatar is `src/RiggedAvatar.mjs`, loading `assets/opponent/manlp.glb`: **34 skinned meshes**, approximately 947 KiB at this handoff. The editable combined source is [`ManLP-articulated.blend`](../../assets/chess/opponent/ManLP-articulated.blend). See the [asset workflow](../../assets/chess/opponent/README.md).

The rig has 46 authoring bones / 41 exported deform bones. Body parts mostly have rigid weights; fingers have blended knuckle weights, three bones per finger and two per thumb. The complete eleven-part `HeadLP.blend` face replaces the initial head, ears and temporary added sphere eyes. Eyes currently share the face's skin material. Neck weights blend smoothly from chest to head so the collar stays anchored while the head turns; the upper neck is tapered and recessed behind the jawline rather than flaring beneath the ears. Separate wire-rim glasses (no lenses) use a named metallic material and are fully bound to the head bone. A separate thick dark-brown handlebar `mustache` object also follows the head, with curled tips and its own named hair material. **The existing eyelids blink naturally; there is no animated mouth or evaluation-driven facial expression.**

The runtime measures native upper-arm/forearm lengths (~0.273/0.237 m), solves bone rotations without stretching, leans the torso and adds bounded forward travel for distant targets. The closest resting hand is selected per piece. Switching after a completed move does not lift the old resting hand; castling returns the king hand before switching to the rook if necessary.

Approach and return use gentle 8 cm arcs. Carry is one continuous 0.9-second arc with 18 cm lift. At the piece top, fingers close over 0.16 seconds before attaching; after placement they open over 0.16 seconds, then return. The upright attachment follows a virtual pinch anchor, with wrist IK compensating for its offset. Palms face the board, hands extend nearly straight from the forearms with slight downward flexion, and forearm roll distributes the twist. Thumb contact stays fixed. The first index phalanx extends along hand-local +Y; its last two joints reach toward a lower, forward contact near the thumb, clamped to native reach. Middle/ring/pinky curl through all joints in their own knuckle lanes. Reset restores all joints.

Head gaze follows the actual moving piece center during the opponent's reach/pinch/carry/place. When the player holds a board or promotion piece, the same smoothed gaze follows that mesh without moving the arms. Head turns are bounded (yaw ±0.8 rad, pitch −0.2 to 1.05 rad) and smoothed at rate 10/s, accounting for table transforms and torso lean. During an idle player turn, gaze alternates between the current player head position (live headset pose in XR, camera position on desktop) and randomly chosen board pieces of either color every 3–6 seconds, avoiding the previous board piece when possible. These idle glances use a slower 1.5/s response in both directions. Held-piece and opponent-move tracking take priority at the existing 10/s rate. Player placement and engine thinking retain the board gaze until the opponent starts moving; arm return eases back toward the player. Cancel/reset restores immediately. Hidden/untracked XR and open dialogs pause animation and idle timers.

The existing upper/lower eyelid objects blink together at randomized 2.5–6.5-second intervals. Closing takes 55–85 ms, holds for 15–35 ms, then reopens over 90–140 ms. `EyelidBlink.mjs` measures the matching eyeball center and rotates each lid's rest geometry around that pivot (upper +0.50 rad, lower −0.16 rad around model X); head skinning then applies normally. It does not scale the eyes, add meshes, alter Blender geometry or add bones. Lid normals rotate with the vertices, idle frames do not upload geometry, and reopening/reset restores exact rest arrays. `RiggedAvatar.update()` advances blinks alongside gaze, so hidden/untracked XR and Options pause both without catch-up.

## Architecture

| Module                                       | Responsibility                                                                                                                                                                             |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `main.mjs`                                   | Scene, seated XR anchor, awaited GLB load, controllers, per-frame gaze routing and render loop.                                                                                            |
| `GameController.mjs`                         | Authoritative chess.js rules/history and turn phases. Validate a clone → lock → animate → commit → synchronize. Epoch guards reject stale async work.                                      |
| `ChessBoard.mjs`                             | Reusable piece geometry, instanced squares, highlights, captures, promotion tray/flights and visual reconstruction from history.                                                           |
| `BoardCoordinates.mjs`                       | One canvas/plane for correctly oriented rank/file labels.                                                                                                                                  |
| `InputController.mjs`, `HandInteraction.mjs` | Proximity pickup/drop, trigger/grip edges, exclusive ownership, promotion choice grabs and desktop pointer dragging. `getHeldPiece()` validates ownership before exposing the gaze target. |
| `EngineController.mjs`                       | Classic Worker, UCI handshake, Elo limiting, serialized searches, timeouts and termination.                                                                                                |
| `OpponentAnimator.mjs`                       | Cancellable hand sequence and piece attachment; shared gaze target selection, preferring its own move over a player-held mesh.                                                             |
| `RiggedAvatar.mjs`, `ArmIK.mjs`              | Actual skin/bone posing, native-length arm IK, fingers, torso and smoothed head gaze. Mirrored triangle winding is repaired once at load; materials stay opaque.                           |
| `OpponentAvatar.mjs`                         | Replaceable world-space target/attachment/rest contract; optional pinch/gaze methods.                                                                                                      |
| `Motion.mjs`                                 | Elapsed-time eased tweens with cancellation.                                                                                                                                               |
| `TableHandle.mjs`, `Settings.mjs`            | Open-space positioning state/math (despite historical name), persisted bounded configuration.                                                                                              |
| `TableControls.mjs`, `GameOverPanel.mjs`     | Status/move canvases and result artwork/New Game contact interaction.                                                                                                                      |

`ProceduralAvatar.mjs` and `OpponentFace.mjs` remain reference/tested utilities; `Evaluation.mjs` also supplies live move-score parsing/formatting. The procedural avatar is not instantiated by the game. `EngineController.scorePosition()` supplies static current-board and two-ply endpoint scores for optional move hints; checked positions use a short resolving search. Do not infer live behavior from these legacy modules or old `?v=face-*` cache labels.

## Engine strength

Stockfish 17.1.0 Lite single-threaded uses `UCI_LimitStrength=true`, `UCI_Elo=<selected rating>`, a 300 ms move search and 16 MB hash. Initialization reads the actual advertised Elo range (1320–3190), which contains every launcher option. Ratings are approximate targets, not guaranteed playing ratings; no extra artificial weakening is applied. Restart replaces the worker; epochs and worker termination prevent stale responses from changing a new game.

## Editable assets and export

Edit the combined active opponent file, preserving bone names/rest transforms, weights and native scale. `HeadLP.blend` is an unmodified source, not the directly exported file. Export from the repository root:

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --python assets/chess/opponent/export.py
```

The exporter opens `ManLP-articulated.blend` and rewrites `projects/chess/assets/opponent/manlp.glb`, without baked clips. Blender constraints are authoring aids; the browser drives deform bones directly. Regeneration scripts create earlier rig stages and **do not reproduce the later HeadLP/neck edits**; preserve the active file.

The edited knight source/exporter lives in [`assets/chess/knight/`](../../assets/chess/knight/README.md); it generates `src/KnightGeometry.mjs` (186 triangles). The runtime applies a 90° Y rotation. Game-over artwork is bundled in `assets/game-over/{win,loss,draw}.png`. Update changed-module import/entry query versions, and the GLB URL query in `RiggedAvatar.mjs` when exporting, to avoid stale headset caches.

## WebXR, validation and publishing

WebXR uses `local` reference space. The first tracked viewer pose establishes the environment's seated origin and horizontal heading; the camera is never artificially moved. Session exit cancels pending work and asks for restart.

Use the USB launcher `/Users/mm/Documents/Start-Quest-VR.command` (outside the repository) to serve/reverse-forward port 8080, or use static HTTPS. A plain LAN HTTP URL is insufficient for immersive WebXR. Serve engine JS/WASM over HTTP(S), not `file:`; WASM needs `application/wasm`. Python's server and GitHub Pages work. Single-threaded Stockfish needs no cross-origin isolation headers.

The user has accepted the visual refinements during interactive testing, including the blended neck. No formal Quest frame-time, stereo or comfort benchmark was recorded by the agent. Verify controller behavior, promotion reach, gaze/neck extremes and sustained performance on hardware after substantial changes. Historical draw-call/triangle counts from the procedural avatar are obsolete; use `chessDiagnostics()` and the viewport's live DOM diagnostic attributes for current scene information.

Changes stay local until the user asks to commit/push. Publishing `main` updates GitHub Pages from the repository root. Preserve relative URLs, vendors/licenses, corresponding Stockfish source, `.nojekyll`, editable assets and exported runtime assets. Live entry: `https://eyehook.github.io/CodexTest/projects/chess/`.

## Dependency licensing and source

Chess application code in this directory is licensed under **GPL-3.0-or-later**, see [LICENSE](LICENSE). Third-party components retain their licenses:

- **Three.js r180**: existing local bundle at `../forest/vendor/three.module.js`, `three.core.js`, `BufferGeometryUtils.js`, MIT license at `../forest/vendor/LICENSE`. Unmodified reuse.
- **chess.js 1.4.0**: local ESM distribution in `vendor/chess/chess.mjs`, BSD-2-Clause notice in `vendor/chess/LICENSE`. Source project: https://github.com/jhlywa/chess.js/tree/v1.4.0 . Npm package `chess.js@1.4.0`.
- **Stockfish.js 17.1.0 Lite single-threaded**: unmodified `stockfish-17.1-lite-single-03e3232.js` and matching `.wasm`, GPLv3, `vendor/stockfish/Copying.txt` and `AUTHORS`. Npm package `stockfish@17.1.0`, upstream https://github.com/nmrugg/stockfish.js .

[Stockfish corresponding source](vendor/stockfish/source-17.1.0.tar.gz) is distributed locally, pinned to npm's `gitHead` **602fd7e1a571a2be71f242942db90483731f2a1f**. It includes engine C++/JS, upstream build scripts/Makefile, bundled minifier and the Lite network `nn-9067e33176e8.nnue` (SHA-256 prefix verified against its filename). Generated binaries for other engine variants are omitted; no engine source is modified. Source snapshot: https://github.com/nmrugg/stockfish.js/tree/602fd7e1a571a2be71f242942db90483731f2a1f .

To rebuild the engine, extract the archive into a separate working directory, use the Emscripten version identified by upstream `build.js` and follow the included README. Run `node build.js --lite --single-threaded --no-split` with Node, make, Python and the activated Emscripten toolchain available. The Lite network is already in `src/`; no network download is needed for that evaluation file. The source archive includes upstream's build instructions. Exact byte reproduction has not been tested here. Preserve all dependency notices and provide corresponding source with any distribution. These links are documentation only; the game makes no runtime requests to them.

When the player castles, the rook floats to its destination in a 0.55-second arc after the king lands. This applies to controller placement and desktop moves, on either castling side and for either color. The move commits after the rook lands; restart cancels the flight.
