# Chess agent handoff

Snapshot: **2026-10-25**. Includes the Options menu, cached per-turn move evaluation, tile scores/colors and A/X best-piece hint. The user requested a local commit of these changes; publishing still requires separate authorization.

## Start here

1. Read repository [AGENTS.md](../../AGENTS.md), [Chess README](README.md), [validation/status](MILESTONES.md) and [opponent asset instructions](../../assets/chess/opponent/README.md).
2. Inspect `git status`, recent commits and current source before changing anything. This document is a snapshot, not a substitute for Git state.
3. Serve the repository root and run `npm run test:chess`; run `npm test` and `git diff --check` for relevant changes before publishing.

Repository: `/Users/mm/Documents/GitHub/CodexTest`; remote `https://github.com/eyehook/CodexTest.git`; branch `main`. Chess is buildless. Do not edit the original Quest backup or create a Sites project for this existing local application.

## Working-tree and publication state

The previous release was **7575ea1 — Replace chess opponent with articulated Blender rig**. The user authorized committing/pushing this handoff release on 2026-10-24. This release includes:

- Replace the original head/ears and temporary sphere eyes with the complete eleven-part `HeadLP.blend` assembly.
- Make eyes use the same skin material as the face.
- Smooth head tracking during opponent moves and player-held board/promotion pieces.
- Blend neck weights between chest and head; user reported this looks much better.
- Associated real-asset/input/gaze/neck regression tests and this documentation cleanup.

The active Blender file, generated GLB and new `HeadLP.blend` source are included together in this release. There are also user/Blender backup files such as `ManLP-articulated.blend1` and `ManLP-articulated.blend2.blend`; inspect current status and preserve them, but do not add them indiscriminately. The latter was present before the recent automated edits. Backup files remain outside the release. Check current Git status/log for any later work; future publication still requires user authorization.

## Authoritative files

| Purpose                                              | File                                                      |
| ---------------------------------------------------- | --------------------------------------------------------- |
| Scene wiring, update order and cache imports         | `projects/chess/src/main.mjs`                             |
| Rules, epochs, promotion and turn transaction        | `projects/chess/src/GameController.mjs`                   |
| Board transforms, captured pieces, promotion visuals | `projects/chess/src/ChessBoard.mjs`                       |
| Controller/desktop held-piece state                  | `projects/chess/src/InputController.mjs`                  |
| Opponent move sequence and shared gaze ownership     | `projects/chess/src/OpponentAnimator.mjs`                 |
| Actual bone, finger, torso and head animation        | `projects/chess/src/RiggedAvatar.mjs`                     |
| **Active editable opponent**                         | `assets/chess/opponent/ManLP-articulated.blend`           |
| Original head source                                 | `assets/chess/opponent/HeadLP.blend`                      |
| Original body / earlier rig                          | `assets/chess/opponent/ManLP.blend`, `ManLP-rigged.blend` |
| Runtime opponent export                              | `projects/chess/assets/opponent/manlp.glb`                |
| Opponent exporter                                    | `assets/chess/opponent/export.py`                         |
| Knight source/exporter                               | `assets/chess/knight/`                                    |
| Real GLB/animation regression                        | `tests/chess/rigged-avatar.mjs`                           |
| Grab, interruption and gaze ownership regression     | `tests/chess/input.mjs`                                   |

The active Blender file contains the complete later edits. `rig-manlp.py` and `upgrade-fingers.py` are earlier-stage generators and refuse to overwrite their outputs. They do not recreate HeadLP integration or blended neck weights. Editing HeadLP alone does not change the game: edit the combined active file or explicitly reintegrate changes, then export.

## Options update — 2026-10-25

Press **Y (left) or B (right)** to open Options. The chess scene hides and piece/avatar animation pauses while the panel is open. Either controller aims a pointer; press trigger to toggle **Evaluate Move** (default Off). **Save Changes**, or Y/B again, saves the draft to the existing localStorage settings and restores play. Session exit also saves and closes. Opening cancels any held piece/positioning safely; fresh presses are required after closing or tracking recovery. The physical Quest Menu button is reserved by the browser and cannot open this panel. Future settings can be added as rows in `OptionsMenu.mjs`.

The implementation is local and unpublished. `OptionsMenu.mjs` owns the panel/draft, Y/B edge handling and controller rays; `main.mjs` gates normal input and animation while open. `Settings.mjs` persists `evaluateMove`. Tests in `tests/chess/options.mjs` cover persistence, ray activation and tracking recovery. Validation: 119 Chess tests and the full root suite passed; browser startup/panel rendering and `git diff --check` passed. Physical Quest checks remain pending.

## Move evaluation — 2026-10-25

When **Evaluate Move** is On, each player turn starts one independent full-strength Stockfish analysis cycle: static scoring of the current board, a 1000 ms MultiPV search to choose opponent replies, then static scoring of each board after the candidate move plus that reply, after the opponent move is committed and its animation finishes. White's initial turn is included; game-over positions are skipped. All legal moves are analyzed once and cached by piece; pickup only selects which cached hints to show. Once scores are available, the held piece's legal destination tiles show red for worse moves, white for neutral changes (within 0.1 pawn, displayed as `0.0`; tinted values retain one-decimal rounding), and green for improvements from the player's perspective. Negative tints start at `#ffcccc`, positive tints at `#ccffcc`; intensity increases with the evaluation change, reaching full tint at three pawns. Regular tiles remain visible while analysis is pending or unavailable. Temporary testing numbers are drawn flat on the evaluated squares using one transparent board-sized canvas atlas (one additional draw). The text uses normal depth testing, so pieces can hide it, and rotates within each square for Black. Promotion squares use the best available promotion result. Forced-mate outcome changes use saturated red/green rather than invented pawn values. Displayed delta = score(board after candidate + best response) − score(current board), converted to the player's perspective. Both board scores use Stockfish's static NNUE evaluator, not candidate search scores or the best candidate's value. A move preserving the score is zero. Stockfish cannot static-evaluate a checked position, so checked endpoints/baselines use a depth-one check/quiescence search; immediate mate/draw is handled explicitly. Candidate PV replies are checked for legality; missing replies trigger a short depth-four child search. The 1000 ms reply-search budget excludes worker startup, static trace scoring and these fallbacks. Baseline and per-piece results are cached once per turn. Dropping/canceling, opening Options and tracking loss hide hints without canceling the turn search or discarding its cache. Changing turns/positions, restart, disabling the option and session exit invalidate pending analysis. Completed results survive Options/tracking changes. A failed analysis is not retried on every pickup. The analysis worker is independent of the opponent's Elo-limited worker. These are quick estimates, not guarantees of tactical accuracy.

With Evaluate Move enabled, hold **A (right) or X (left)** to highlight the piece with the best cached move in blue. It waits for the complete turn cache, ranks the same candidate+reply endpoint scores as the tile hints (from the player's perspective), chooses one deterministically on ties, and includes the least-bad move if every choice loses value. Either held button keeps it active; releasing both restores normal hover/selection. Options, hidden/untracked input, turn changes, disabling and session exit clear the highlight. It never starts another search.

`MoveEvaluation.mjs` manages lifecycle/cache; `MoveEvaluationOverlay.mjs` colors the board's existing square instances; `EngineController.analyzeMoves()` parses complete MultiPV iterations. Tests cover real WASM queen blunders for both colors, signs, mates, cancellation, caching and transformed board colors and promotion aggregation. All 154 Chess tests and the full root suite passed, including tile gradients, pending tiles and transformed board hover/clearing. Physical Quest appearance/performance checks remain pending.

## Current behavior to preserve

- Direct controller proximity pickup in normal play; Options mode uses pointers. Open-space grip positions the environment; there is no gold handle. Desktop launcher/dragging remain.
- White/Black/Random orientation and left/bottom coordinates. Elo 1350–2000 by 50, default 1500, actual UCI Elo limiting.
- Continuous arm arcs; capture flight begins near arrival and never blocks the attacking arm. Geometry intersections are intentionally acceptable.
- Physical promotion tray after pawn landing, hover highlight, return-to-tray cancellation/glow and selected-piece glide. Game-over artwork/New Game button, status/history panels on viewer's right. No table restart button.
- Actual Blender skin rig with fixed native arm lengths, torso lean and closest-hand choice. No extra old-hand return arc when already resting.
- Three bones per finger, two per thumb; palms face down. Thumb contact was accepted by the user. First index bone extends straight from the hand; remaining joints reach forward/down to a lower contact near the thumb. The earlier shared-contact and lateral index-curl experiments are superseded. Unused fingers curl in separate lanes.
- HeadLP head, ears, eyes, eyelids and nose; eyes match skin. No procedural mouth/blinks or evaluation-driven facial expressions. Gaze watches the actual piece center; own move has priority over player-held piece. Arms stay idle while observing the player. Clear gaze on drop, interruption and restart.
- Neck skin is smoothly chest→head weighted (Blender Z 0.60–0.71 m), preserving rest geometry. User approved the improvement. Do not replace this with rigid neck weights.

Main frame order is input → board motion → opponent motion/gaze (`input.getHeldPiece()`) → avatar gaze smoothing → render. XR animation pauses if hidden/untracked. Keep world/local conversions correct for table translation/yaw and the Black-facing board. Restart cancels tweens/workers and epochs prevent stale commits.

## Validation and practical workflow

Latest full run: **115 Chess tests, all passing; complete root `npm test` equivalent passed; `git diff --check` passed**. Coverage includes real WASM, rules, capture/promotion/castling/cancellation, controller interruption, side orientation, actual GLB skinning, all-square arm reach, finger alignment, HeadLP integration, gaze smoothing/ownership and blended neck anchoring.

Desktop previews confirmed the head replacement. User feedback accepted the current direction; no formal headset performance/stereo/comfort measurements exist. Old procedural-avatar draw-call figures are not current. A future visual change should be checked in browser and on Quest as appropriate; automated tests do not certify appearance.

Default preview command is in the README. During this chat a loopback server was also used on **8093**; it is transient and must not be assumed running. Serve the repository root, not only `projects/chess/`. The external USB Quest launcher serves port 8080. Runtime dependencies and result images are all local.

Export the opponent using the command in the asset README. Update relevant entry/import query versions and GLB URL query after runtime/asset edits to avoid cached Quest resources. Run the focused tests, then full suite once relevant changes pass. Preserve GPL/BSD/MIT notices and the distributed Stockfish corresponding source archive.

On this Mac, `/usr/bin/git` previously failed because of an unaccepted Xcode license, and sandboxed Blender previously failed during graphics initialization. Use the available working Git/runtime toolchain and approved Blender execution rather than changing system settings. If Blender crashes again, the user explicitly prefers receiving the exact command to run manually. Never claim an export succeeded without checking its output.

Publish only when the user explicitly requests it. Review/stage named project files, keep source and GLB together, leave unrelated user backups untouched, then commit/push `main` and verify clean/synchronized status. GitHub Pages publication follows the push; do not claim deployment completion without checking it.
