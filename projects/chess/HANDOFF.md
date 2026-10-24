# Chess agent handoff

Snapshot: **2026-10-24**. The user considers the current game a good stopping point. This handoff describes the working tree; it does not authorize publishing or additional features.

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

## Current behavior to preserve

- Direct controller proximity pickup, no VR pointers or side menu. Open-space grip positions the environment; there is no gold handle. Desktop launcher/dragging remain.
- White/Black/Random orientation and left/bottom coordinates. Elo 1350–2000 by 50, default 1500, actual UCI Elo limiting.
- Continuous arm arcs; capture flight begins near arrival and never blocks the attacking arm. Geometry intersections are intentionally acceptable.
- Physical promotion tray after pawn landing, hover highlight, return-to-tray cancellation/glow and selected-piece glide. Game-over artwork/New Game button, status/history panels on viewer's right. No table restart button.
- Actual Blender skin rig with fixed native arm lengths, torso lean and closest-hand choice. No extra old-hand return arc when already resting.
- Three bones per finger, two per thumb; palms face down. Thumb contact was accepted by the user. First index bone extends straight from the hand; remaining joints reach forward/down to a lower contact near the thumb. The earlier shared-contact and lateral index-curl experiments are superseded. Unused fingers curl in separate lanes.
- HeadLP head, ears, eyes, eyelids and nose; eyes match skin. No procedural mouth/blinks or gameplay evaluation search. Gaze watches the actual piece center; own move has priority over player-held piece. Arms stay idle while observing the player. Clear gaze on drop, interruption and restart.
- Neck skin is smoothly chest→head weighted (Blender Z 0.60–0.71 m), preserving rest geometry. User approved the improvement. Do not replace this with rigid neck weights.

Main frame order is input → board motion → opponent motion/gaze (`input.getHeldPiece()`) → avatar gaze smoothing → render. XR animation pauses if hidden/untracked. Keep world/local conversions correct for table translation/yaw and the Black-facing board. Restart cancels tweens/workers and epochs prevent stale commits.

## Validation and practical workflow

Latest full run: **115 Chess tests, all passing; complete root `npm test` equivalent passed; `git diff --check` passed**. Coverage includes real WASM, rules, capture/promotion/castling/cancellation, controller interruption, side orientation, actual GLB skinning, all-square arm reach, finger alignment, HeadLP integration, gaze smoothing/ownership and blended neck anchoring.

Desktop previews confirmed the head replacement. User feedback accepted the current direction; no formal headset performance/stereo/comfort measurements exist. Old procedural-avatar draw-call figures are not current. A future visual change should be checked in browser and on Quest as appropriate; automated tests do not certify appearance.

Default preview command is in the README. During this chat a loopback server was also used on **8093**; it is transient and must not be assumed running. Serve the repository root, not only `projects/chess/`. The external USB Quest launcher serves port 8080. Runtime dependencies and result images are all local.

Export the opponent using the command in the asset README. Update relevant entry/import query versions and GLB URL query after runtime/asset edits to avoid cached Quest resources. Run the focused tests, then full suite once relevant changes pass. Preserve GPL/BSD/MIT notices and the distributed Stockfish corresponding source archive.

On this Mac, `/usr/bin/git` previously failed because of an unaccepted Xcode license, and sandboxed Blender previously failed during graphics initialization. Use the available working Git/runtime toolchain and approved Blender execution rather than changing system settings. If Blender crashes again, the user explicitly prefers receiving the exact command to run manually. Never claim an export succeeded without checking its output.

Publish only when the user explicitly requests it. Review/stage named project files, keep source and GLB together, leave unrelated user backups untouched, then commit/push `main` and verify clean/synchronized status. GitHub Pages publication follows the push; do not claim deployment completion without checking it.
