# Chess agent handoff

Current-state guide, consolidated 2026-10-26. Read [repository guidance](../../AGENTS.md), this handoff, [README](README.md), and the [opponent asset workflow](../../assets/chess/opponent/README.md). Inspect Git status and source before editing. Older implementation/export details are preserved in [HISTORY.md](HISTORY.md); read it only when needed. Current source/Git state wins over snapshots.

## Run, validate and publish

Chess is buildless: serve the repository root, then open `/projects/chess/`. Run `npm run test:chess` for isolated Chess code changes and `git diff --check` for edits. Use the full suite only for shared or cross-project changes, as defined in root AGENTS.md. Documentation-only changes need content/link checks instead. Physical Quest testing is still required for appearance, stereo, controller feel, comfort and sustained performance.

Latest previously recorded focused validation: 211 Chess tests passed for the movement/gaze release. Older counts in archived notes refer to earlier snapshots. That release was pushed as `c9ceebf`, following neck refit `6375ad3` and avatar/gauge/undo `a9e68c0`. Inspect Git for later releases. No formal headset frame-time/stereo/comfort benchmark exists; user feedback accepted the recent visual direction. A documentation edit is not a new runtime validation result.

Follow the root release checklist. Keep editable Blender source and exported GLB together; increment changed module/entry/GLB query versions to avoid stale Quest caches. Preserve GPL Chess/Stockfish, corresponding source archive, chess.js BSD and Three.js MIT notices. Do not publish without current user authorization. Preserve and exclude `ManLP-articulated.blend1` and `ManLP-articulated.blend2.blend` backups.

## Code map and transaction rules

Paths here are repository-relative.

| Responsibility | Files |
| --- | --- |
| Scene integration and frame order | `projects/chess/src/main.mjs` |
| Authoritative rules/history/epochs | `GameController.mjs` |
| Board transforms, captures, promotion | `ChessBoard.mjs` |
| Held-piece ownership and controller/desktop input | `InputController.mjs` |
| Opponent motion and gaze priority | `OpponentAnimator.mjs`, `RiggedAvatar.mjs` |
| Options and undo | `OptionsMenu.mjs`, `UndoDialog.mjs`, `Settings.mjs` |
| Engine and move hints | `EngineController.mjs`, `MoveEvaluation.mjs`, `MoveEvaluationOverlay.mjs` |
| Turn evaluation dial | `CurrentEvaluation.mjs`, `EvaluationGauge.mjs` |
| Runtime opponent | `projects/chess/assets/opponent/manlp.glb` |
| Editable opponent and export | `assets/chess/opponent/ManLP-articulated.blend`, sibling `export.py` |
| Knight source/export | `assets/chess/knight/`; runtime `KnightGeometry.mjs` |

Unqualified module names above live in `projects/chess/src/`. Rules flow: validate on a clone → lock → animate → commit → rebuild. Epochs, worker termination and cancellable motion must prevent stale commits on restart/session exit. Frame order is input → board motion → opponent motion/gaze using `input.getHeldPiece()` → avatar smoothing → render. Hidden/untracked XR pauses animation; invalid controller tracking cancels ownership.

White/Black/Random and seated positioning persist. Only the playing board rotates for Black; preserve coordinates and world/local conversions through board rotation and environment translation/yaw. XR local space anchors once to initial eye position/yaw without artificial camera motion. Stockfish 17.1 Lite single-threaded uses 300 ms opponent searches, 16 MB hash and real UCI Elo limiting (1350–2000 by 50, default 1500).

## Interaction and motion to preserve

Normal play uses direct controller sphere proximity grab/drop or desktop dragging, with no rays, table restart/promotion buttons or gold handle. Fresh open-space grip shows six positioning arrows and moves the environment in seated axes. Promotion uses a physical floating tray after pawn arrival, hover/return cancellation and selected-piece glide. Captures arc late to side trays without stopping the attacking arm; geometry intersections are acceptable. Game-over artwork includes a proximity-highlighted New Game button. Move list and optional evaluation dial sit above/behind the opponent on the viewer's right; there is no separate in-world status box.

Adjacent opponent moves and all pawn moves slide. One-square slides take 0.5 s; double pawn advances take 0.9 s; longer non-pawn moves retain a 0.9 s arch. Player castling sends the rook along a 0.55 s, 0.15 m-high arc after king placement; commit/start opponent thinking only after landing. Restart/board sync cancels it. Opponent castling stays hand-driven.

Y/B opens Options, hides the world and pauses normal input/animation. Either controller points and trigger-clicks; Save Changes or Y/B persists settings and closes; session exit saves/closes too. Opening cancels held input/positioning, and fresh presses are required afterward. Physical Quest Menu is browser-reserved.

Left on either thumbstick during a player turn opens pointer-operated Yes/No undo. Yes removes the player's last move plus the opponent reply, restores board/history/trays and advances epochs; preserve Black's opening. No undo before a player move or during thinking, motion, promotion or game over. Undo and Options exclude each other; closing restores previous scene visibility. Session exit/restart dismisses dialogs. Keep transparent layers distinct: backdrop/content/rays at 100/101/102 to prevent view-dependent disappearance.

## Evaluation behavior

Evaluate Move and Show Evaluation are independent persisted Options toggles, both Off by default.

Evaluate Move starts one full-strength analysis cycle per playable player-turn position, including White's initial turn. Compute static current-board score, 1000 ms MultiPV best replies, then static candidate+reply endpoint scores; cache all pieces once per turn. Display delta from the player's perspective, not search score or the best candidate: red bad, white neutral within ±0.1 pawn, green good, saturated at three pawns. Keep ordinary tiles while pending; promotion uses the best result and mate/draw endpoints are explicit. Temporary tile numbers use one depth-tested atlas, with normal piece occlusion and Black orientation. Checked positions require depth-one resolving search; missing PV replies use depth-four child search. This overhead is additional to the 1000 ms reply budget.

Drops, Options and tracking loss hide hints while preserving the turn search/cache. Position/turn/epoch changes, disabling and session exit invalidate it; failures do not retry on every pickup. The analysis worker is independent of Elo-limited play. Hold A/X to highlight the best piece blue from the completed cache, with deterministic ties and no extra search; release/Options/tracking loss clears it.

Show Evaluation displays a red-left/white-top/green-right semicircle and black needle, player perspective clamped to ±5 pawns with inclusive ±0.1 neutral zone pointing up. Score only playable player-turn starting boards, reuse move-hint baseline when possible, otherwise use a separate lazy worker. Retain old score while waiting and during opponent/game-over; ease changes over 0.55 s, hide initially unknown values and clear on new game. Options/hidden tracking pause easing.

## Avatar and editable asset constraints

Live `RiggedAvatar` loads 34 skinned meshes / 41 deform bones. Edit the combined `ManLP-articulated.blend`, then export with its sibling `export.py`. `HeadLP.blend` is an original source; editing it alone does not update the game. Earlier rig/finger generators do not reconstruct later edits and must not overwrite the active document. Preserve body scale, bone names/rest transforms, native arm lengths (~0.273/0.237 m), closest-hand selection, torso compensation and palm-down pinch. Avoid redundant old-hand return arcs when already resting.

Each finger has three bones and each thumb two. Keep the first index bone straight along the hand; later joints reach toward the accepted lower thumb contact, unused fingers curl in separate lanes. HeadLP has eleven parts and skin-colored eyes. Separate frames-only wire glasses retain their named brushed-silver material; separate thick handlebar mustache retains named dark-brown material and full head weights. Their generators are `add-glasses.py` and `add-mustache.py`; the latter excludes the nose bridge when finding its anchor. Preserve original head sources/backups.

Keep chest→head neck weights blended over Blender Z 0.60–0.71 m, intact collar anchors, and approved upper-neck taper/recession from `refit-neck.py` (influence Z 0.64–0.73 m). No live mouth animation. `EyelidBlink.mjs` rotates existing lids about matching eyeball centers (upper +0.50 rad, lower −0.16 rad), with 2.5–6.5 s intervals; preserve head skinning and exact rest on reset without extra meshes/bones. Blinks pause with avatar animation.

Gaze follows actual piece centers; own moves take priority over player-held pieces/promotion. Retain board gaze through player placement and opponent thinking, then look toward the player on return. Idle player turns alternate live headset gaze with random pieces of either color, dwelling 3–6 s, avoiding immediate repeated piece targets. Idle transitions are slower; active piece tracking keeps its response. Pause idle timing with animation; cancellation/restart clears retained state. Arms stay idle while observing. `ProceduralAvatar`/`OpponentFace` are reference/tested modules, not the live avatar.

## Tooling and additional detail

The system Git may fail on an unaccepted Xcode license; use an available working Git/runtime rather than changing system settings. Sandboxed Blender previously failed during graphics initialization. If it crashes again, the user prefers the exact command to run manually; verify actual export output before claiming success. Use the normal repository-root preview/Quest launcher; do not assume old temporary servers remain running.

See [asset workflow](../../assets/chess/opponent/README.md) for export commands, [history](HISTORY.md) for detailed implementation/validation snapshots and [former root notes](ROOT_CONTEXT.md) for additional historical context. Keep this handoff focused on final behavior; consolidate updates rather than appending contradictory release status or test counts.
