# Chess handoff history

Archived handoff before consolidation. Historical validation counts and publication statements below refer to different snapshots; they are not current status. Start with [HANDOFF.md](HANDOFF.md) for active guidance.

# Chess agent handoff

Snapshot: **2026-10-26**. Includes wire-rim glasses, a separate handlebar mustache, natural eyelid blinking, the player-turn evaluation gauge modal undo and the approved neck/jaw refit. The user authorized committing and pushing these changes on 2026-10-26; future releases still require authorization.

## Start here

1. Read repository [AGENTS.md](../../AGENTS.md), [Chess README](README.md), [validation/status](MILESTONES.md) and [opponent asset instructions](../../assets/chess/opponent/README.md).
2. Inspect `git status`, recent commits and current source before changing anything. This document is a snapshot, not a substitute for Git state.
3. Serve the repository root and run `npm run test:chess` for isolated Chess code changes, including before publishing. Run the full root suite only for shared or cross-project changes, following root AGENTS.md; run `git diff --check` for edits.

Repository: `/Users/mm/Documents/GitHub/CodexTest`; remote `https://github.com/eyehook/CodexTest.git`; branch `main`. Chess is buildless. Do not edit the original Quest backup or create a Sites project for this existing local application.

## Movement and gaze release — 2026-10-26

The user reviewed and approved the movement/gaze changes and requested a GitHub push on 2026-10-26. This release builds on neck-refit commit `6375ad3`: adjacent opponent moves and all pawn moves slide (0.5 seconds for one square, 0.9 seconds for double pawn advances), the player-to-opponent gaze gap stays on the board, player-turn idle gaze alternates slowly between live head tracking and pieces of either color, and player castling animates the rook in an arc. All 211 Chess tests, the full root suite and `git diff --check` passed. The user reported that it all looks good. Blender backups remain excluded. Consult Git log for this release commit and actual publication state.

## Working-tree and publication state

Published baseline: **a9e68c0 — Add chess avatar details, evaluation gauge and modal undo** (after **fa4af74**, Options and cached move hints). That baseline includes:

- Separate frames-only wire glasses and a thick handlebar mustache in the active Blender document and exported GLB, with reproducible accessory generators.
- Natural blinking of the existing eyelid meshes around eyeball centers.
- Persisted Show Evaluation option, a red/white/green semicircular player-turn gauge, smooth needle movement and a ±0.1 neutral dead zone.
- Left-thumbstick Yes/No undo for either hand, restoring the last player move and opponent reply with complete history/capture reconstruction.
- Stable modal layering and scene hiding while dialogs are open, plus regression tests and updated documentation.

The current user-authorized release adds the approved upper-neck/jaw refit, its Blender generator, source/export, cache updates and regression checks. The user approved its appearance and requested publication on 2026-10-26.

Keep the active Blender source and GLB together. User/Blender backups `ManLP-articulated.blend1` and `ManLP-articulated.blend2.blend` remain untracked and outside this release. The original `HeadLP.blend` source remains untouched. Inspect Git status/log for actual current publication state.

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

Options are part of the published baseline; the expanded gauge and modal behavior are included in this release. `OptionsMenu.mjs` owns the panel/draft, Y/B edge handling and controller rays; `main.mjs` gates normal input and animation while open. `Settings.mjs` persists `evaluateMove`. Tests in `tests/chess/options.mjs` cover persistence, ray activation and tracking recovery. Validation: 119 Chess tests and the full root suite passed; browser startup/panel rendering and `git diff --check` passed. Physical Quest checks remain pending.

## Move evaluation — 2026-10-25

When **Evaluate Move** is On, each player turn starts one independent full-strength Stockfish analysis cycle: static scoring of the current board, a 1000 ms MultiPV search to choose opponent replies, then static scoring of each board after the candidate move plus that reply, after the opponent move is committed and its animation finishes. White's initial turn is included; game-over positions are skipped. All legal moves are analyzed once and cached by piece; pickup only selects which cached hints to show. Once scores are available, the held piece's legal destination tiles show red for worse moves, white for neutral changes (within 0.1 pawn, displayed as `0.0`; tinted values retain one-decimal rounding), and green for improvements from the player's perspective. Negative tints start at `#ffcccc`, positive tints at `#ccffcc`; intensity increases with the evaluation change, reaching full tint at three pawns. Regular tiles remain visible while analysis is pending or unavailable. Temporary testing numbers are drawn flat on the evaluated squares using one transparent board-sized canvas atlas (one additional draw). The text uses normal depth testing, so pieces can hide it, and rotates within each square for Black. Promotion squares use the best available promotion result. Forced-mate outcome changes use saturated red/green rather than invented pawn values. Displayed delta = score(board after candidate + best response) − score(current board), converted to the player's perspective. Both board scores use Stockfish's static NNUE evaluator, not candidate search scores or the best candidate's value. A move preserving the score is zero. Stockfish cannot static-evaluate a checked position, so checked endpoints/baselines use a depth-one check/quiescence search; immediate mate/draw is handled explicitly. Candidate PV replies are checked for legality; missing replies trigger a short depth-four child search. The 1000 ms reply-search budget excludes worker startup, static trace scoring and these fallbacks. Baseline and per-piece results are cached once per turn. Dropping/canceling, opening Options and tracking loss hide hints without canceling the turn search or discarding its cache. Changing turns/positions, restart, disabling the option and session exit invalidate pending analysis. Completed results survive Options/tracking changes. A failed analysis is not retried on every pickup. The analysis worker is independent of the opponent's Elo-limited worker. These are quick estimates, not guarantees of tactical accuracy.

With Evaluate Move enabled, hold **A (right) or X (left)** to highlight the piece with the best cached move in blue. It waits for the complete turn cache, ranks the same candidate+reply endpoint scores as the tile hints (from the player's perspective), chooses one deterministically on ties, and includes the least-bad move if every choice loses value. Either held button keeps it active; releasing both restores normal hover/selection. Options, hidden/untracked input, turn changes, disabling and session exit clear the highlight. It never starts another search.

`MoveEvaluation.mjs` manages lifecycle/cache; `MoveEvaluationOverlay.mjs` colors the board's existing square instances; `EngineController.analyzeMoves()` parses complete MultiPV iterations. Tests cover real WASM queen blunders for both colors, signs, mates, cancellation, caching and transformed board colors and promotion aggregation. All 188 Chess tests and the full root suite passed, including tile gradients, pending tiles and transformed board hover/clearing. Physical Quest appearance/performance checks remain pending.

## Wire-rim glasses — 2026-10-25

The active `ManLP-articulated.blend` and runtime GLB now include a separate `GEO-wire_rim_glasses` mesh: oval rims spaced slightly farther apart and closer to the face, nose-surface-fitted bridge and temple wires, no lenses, brushed-silver named material, 100% head-bone weighting. The avatar now has 34 skinned meshes / 41 deform bones; the accessory adds 3,524 triangles. `assets/chess/opponent/add-glasses.py` is the generator; normal exports still use `export.py`. Blender crashed in the sandbox; the user executed the generator manually and the resulting GLB was verified. Source and export are included together in this release. A front/three-quarter geometry preview and head-motion/material/open-rim regression passed; physical Quest appearance still needs user review. Preserve the original HeadLP source and existing Blender backups.

## Handlebar mustache — 2026-10-25

The active Blender source and exported GLB include a separate `mustache` mesh with thick dark-brown handlebar geometry and curled tips, fully weighted to the head bone. The named hair material survives the runtime skin-palette fallback. The avatar now contains 34 skinned meshes / 41 deform bones; mustache geometry adds 2,632 triangles. `assets/chess/opponent/add-mustache.py` saves and exports the accessory without replacing glasses or other face parts; its nose selector explicitly excludes the nose-bridge object. User ran the generator manually after correction of the initial anchor. Geometry preview and real-asset head-following/placement checks pass. Source/export and cache versions are included in this user-authorized release. Physical Quest appearance still needs review.

## Eyelid blinking — 2026-10-25

The existing upper/lower eyelid objects blink together at randomized 2.5–6.5-second intervals. Closing takes 55–85 ms, holds for 15–35 ms, then reopens over 90–140 ms. `EyelidBlink.mjs` measures the matching eyeball center and rotates each lid's rest geometry around that pivot (upper +0.50 rad, lower −0.16 rad around model X); head skinning then applies normally. It does not scale the eyes, add meshes, alter Blender geometry or add bones. Lid normals rotate with the vertices, idle frames do not upload geometry, and reopening/reset restores exact rest arrays. `RiggedAvatar.update()` advances blinks alongside gaze, so hidden/untracked XR and Options pause both without catch-up.

Real-GLB regressions cover matching pivots, full closure of both eyes, dominant upper-lid travel, radial-distance preservation, 30/72/120 Hz timing, random intervals, pause/catch-up protection, head/lean attachment and exact reset. Open/closed geometry preview inspected. This runtime change is included in the release; source Blender geometry remains unchanged and Quest appearance still needs review.

## Evaluation gauge — 2026-10-25

**Show Evaluation** is an independent persisted Options toggle, default Off. It replaces the former status box above the move list with a semicircular dial: red at bottom left, white at the top center, green at bottom right. The black needle shows the board score at the start of the player's turn, from the player's perspective, clamped at −5/+5 pawns, with an inclusive −0.1 to +0.1 pawn dead zone pointing straight up. It retains the previous turn's score while the next is pending, then smoothly eases from its current angle to the new target over 0.55 seconds; unknown initial scores hide the needle. `CurrentEvaluation.mjs` refreshes only at the start of a playable player turn, after the opponent's move commits and its animation finishes. It does not score the player's move or game-over boards; those retain the last turn's indication. New-game reset clears the old score. It reuses the move-hint baseline when available; otherwise it lazily uses its own scoring worker, so Show Evaluation also works with Evaluate Move Off. `EvaluationGauge.mjs` draws the cached dial face and animates only the needle when the score changes; hidden/untracked XR and Options pause its easing. The desktop status text remains available; there is no separate in-world status box.

The dial and expanded Options layout were verified in a browser at −5/0/+5. Tests cover player perspective, clamping, persistence, independent scoring, baseline reuse, terminal states and stale-result rejection. Physical Quest readability remains pending.

## Undo confirmation — 2026-10-26

During a normal player turn, push either thumbstick left to open **“Do you want to undo your last move?”**. The rest of the scene hides while the modal is open, leaving the dialog and pointers visible; closing restores the previous scene visibility. Either controller points/trigger-clicks **Yes** or **No**. Yes removes the player's last committed move and the opponent's reply, returning to the position before that player move; No leaves history untouched. Captures/trays, castling rights, en passant, promotions, move history and last-move highlights are rebuilt from chess.js history. Analysis epochs invalidate stale results and start fresh scoring for the restored turn. Black's initial opponent opening is preserved; no undo is offered before the player has made a move. Undo is locked during thinking, move animation, promotion and game over. Opening safely returns a held piece and finishes table positioning. Fresh stick deflection is required after neutral/tracking recovery; holding left cannot repeatedly open the dialog. Options and undo are mutually exclusive, and session exit/restart dismisses the prompt. The transparent modal uses fixed render layers: backdrop first, question/buttons next, pointer rays last, so head/view changes cannot paint the backdrop over its content.

The undo-label disappearance was reproduced in a browser at oblique views with the former shared transparent layer; explicit backdrop/content/ray layers correct it. Regression moves one pointer while the other points away and shifts the camera. Quest verification of this fix remains pending.

## Neck/jaw fit — 2026-10-26

The active Blender source and GLB now have a tapered/recessed upper neck beneath the jaw. `assets/chess/opponent/refit-neck.py` changes only neck vertices, with smooth influence from Blender Z 0.64–0.73 m; source originals are stored on the neck object for idempotent reruns. The user ran the generator manually. Verification against the prior release: 116 changed neck vertices, 76 unchanged collar vertices, unchanged skin weights and unchanged geometry in all other 33 meshes. Existing chest/head blending and collar anchors remain intact. Cache URLs are updated for this asset revision. The user approved its appearance and authorized commit/push on 2026-10-26. All 188 Chess tests and the full root suite passed; no formal Quest performance benchmark was recorded.

## Adjacent opponent moves — 2026-10-26

In this release: opponent moves whose file/rank distance is at most one square slide along the board, including diagonal captures and single-step promotions. One-square slides take 0.5 seconds. All pawn moves slide, with two-square pawn advances taking 0.9 seconds; longer moves by other pieces retain the existing 0.9-second arch. Reach, pinch, release, capture timing and return remain unchanged.

## Gaze handoff — 2026-10-26

In this release: retain the last board gaze target during player placement, promotion and opponent thinking, bridging the gap before the opponent starts reaching. His own piece still takes gaze priority throughout its motion; the existing look back toward the player on arm return is preserved. Cancellation clears the retained target; an initial computer turn defaults to board center.

## Player-turn idle gaze — 2026-10-26

In this release: during an idle player turn, alternate a gaze that follows the current player head position with random board pieces of either color, dwelling 3–6 seconds per target. Successive board glances choose different pieces when available. Idle head transitions use a slower response; held-piece and opponent-move tracking retain their existing priority and speed. Idle timing pauses with scene animation, resets on active tracking/turn changes, and cancellation clears retained state.

## Player castling rook — 2026-10-26

In this release: after the player places the castling king, the rook floats to its castled square on a 0.55-second, 0.15 m-high arc. Desktop animated king moves use the same rook flight. The transaction commits and opponent thinking begins only after the rook lands. Board sync/restart cancels the flight; opponent castling retains its existing hand-driven sequence.

## Current behavior to preserve

- Direct controller proximity pickup in normal play; Options mode uses pointers. Open-space grip positions the environment; there is no gold handle. Desktop launcher/dragging remain.
- White/Black/Random orientation and left/bottom coordinates. Elo 1350–2000 by 50, default 1500, actual UCI Elo limiting.
- Continuous arm arcs; capture flight begins near arrival and never blocks the attacking arm. Geometry intersections are intentionally acceptable.
- Physical promotion tray after pawn landing, hover highlight, return-to-tray cancellation/glow and selected-piece glide. Game-over artwork/New Game button, move-list panel and optional evaluation gauge on viewer's right. No table restart button.
- Actual Blender skin rig with fixed native arm lengths, torso lean and closest-hand choice. No extra old-hand return arc when already resting.
- Three bones per finger, two per thumb; palms face down. Thumb contact was accepted by the user. First index bone extends straight from the hand; remaining joints reach forward/down to a lower contact near the thumb. The earlier shared-contact and lateral index-curl experiments are superseded. Unused fingers curl in separate lanes.
- HeadLP head, ears, eyes, eyelids and nose; eyes match skin. Existing HeadLP eyelid meshes blink around their eyeball centers; no procedural mouth or evaluation-driven facial expressions. Gaze watches the actual piece center; own move has priority over player-held piece. Arms stay idle while observing the player. Clear gaze on drop, interruption and restart.
- Neck skin is smoothly chest→head weighted (Blender Z 0.60–0.71 m), with the approved upper-neck taper/recession and intact lower collar. User approved the improvement. Do not replace this with rigid neck weights.

Main frame order is input → board motion → opponent motion/gaze (`input.getHeldPiece()`) → avatar gaze smoothing → render. XR animation pauses if hidden/untracked. Keep world/local conversions correct for table translation/yaw and the Black-facing board. Restart cancels tweens/workers and epochs prevent stale commits.

## Validation and practical workflow

Latest full run: **115 Chess tests, all passing; complete root `npm test` equivalent passed; `git diff --check` passed**. Coverage includes real WASM, rules, capture/promotion/castling/cancellation, controller interruption, side orientation, actual GLB skinning, all-square arm reach, finger alignment, HeadLP integration, gaze smoothing/ownership and blended neck anchoring.

Desktop previews confirmed the head replacement. User feedback accepted the current direction; no formal headset performance/stereo/comfort measurements exist. Old procedural-avatar draw-call figures are not current. A future visual change should be checked in browser and on Quest as appropriate; automated tests do not certify appearance.

Default preview command is in the README. During this chat a loopback server was also used on **8093**; it is transient and must not be assumed running. Serve the repository root, not only `projects/chess/`. The external USB Quest launcher serves port 8080. Runtime dependencies and result images are all local.

Export the opponent using the command in the asset README. Update relevant entry/import query versions and GLB URL query after runtime/asset edits to avoid cached Quest resources. Run the focused tests, then full suite once relevant changes pass. Preserve GPL/BSD/MIT notices and the distributed Stockfish corresponding source archive.

On this Mac, `/usr/bin/git` previously failed because of an unaccepted Xcode license, and sandboxed Blender previously failed during graphics initialization. Use the available working Git/runtime toolchain and approved Blender execution rather than changing system settings. If Blender crashes again, the user explicitly prefers receiving the exact command to run manually. Never claim an export succeeded without checking its output.

Publish only when the user explicitly requests it. Review/stage named project files, keep source and GLB together, leave unrelated user backups untouched, then commit/push `main` and verify clean/synchronized status. GitHub Pages publication follows the push; do not claim deployment completion without checking it.

## Additional reference

[Former root project notes](ROOT_CONTEXT.md) preserve the project-specific material removed from AGENTS.md. These are optional historical context; this handoff and current source/Git state take precedence.
