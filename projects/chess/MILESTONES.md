# Chess delivery and validation status

Current-state report, **2026-10-26**. For the next agent, read [HANDOFF.md](HANDOFF.md); for controls and architecture, read [README.md](README.md). This report replaces the accumulated chronological notes whose older behavior descriptions had become contradictory. Git history preserves those earlier milestones.

## Delivered behavior

| Area           | Current implementation                                                                                                                                |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Playable chess | Authoritative chess.js history/rules, legal validation, special moves, restart, game-over results and player side selection.                          |
| Engine         | Local Stockfish 17.1.0 Lite single-threaded WASM; UCI Elo 1350–2000 by 50, default 1500; 300 ms move searches. Optional independent move-hint analysis once per player turn.            |
| Input          | Direct hand-sphere hover/grab/drop using trigger or grip; exclusive ownership, interruption recovery; desktop drag/drop. Y/B Options uses pointer rays; A/X holds the best-piece hint.        |
| Setup          | Open-space grip with six axis arrows positions table/opponent in seated axes; persisted height/distance/lateral offset. No handle mesh.               |
| Piece motion   | Continuous opponent arm arcs, late concurrent victim arc to side trays, castling king then rook, upright carried pieces and safe cancellation.        |
| Promotion      | Floating physical choice tray after pawn landing; hover, return/cancel highlight, selected-mesh glide and authoritative commit after arrival.         |
| Displays       | Player-oriented rank/file labels, viewer-facing move history/optional evaluation gauge, result illustrations and proximity-highlighted New Game button.                  |
| Character      | Actual Blender skin rig, closest-hand selection, fixed arm lengths, lean, multi-joint fingers and top pinch; old-hand switching glitch fixed.         |
| Head/neck      | Complete HeadLP assembly, skin-colored eyes, blended neck weights, smooth gaze at opponent/player-held piece; random eyelid blinks; no mouth/evaluation expressions. |

Original A–D milestones established playable chess, a procedural opponent, physical movement and interruption/refinement coverage. The procedural character and initial ray/menu/handle/expression designs were subsequently replaced. `ProceduralAvatar` and `OpponentFace` remain reference/tested code and are not the live avatar path. Evaluation utilities also support the optional live move hints.

## Options addition — 2026-10-25

Y/B opens a billboard and hides the chess scene; either controller points and trigger-clicks the Evaluate Move On/Off setting. Save Changes or Y/B saves to persistent settings and closes. Evaluate Move defaults Off; when On, pickup displays per-legal-move evaluation deltas. Board/avatar animation pauses while open. Physical Quest Menu is browser-reserved. All 119 Chess tests, the full root suite and `git diff --check` passed. Browser startup and a rendered panel preview completed without page errors. New regression tests cover draft persistence, both pointers, button edges and tracking recovery. Quest appearance/controller validation remains pending.

## Move evaluation addition — 2026-10-25

Full-strength MultiPV hints use a separate worker, a 1000 ms MultiPV reply search plus static NNUE current-board and candidate+reply endpoint scoring (additional processing time) and per-piece cached position scores from one analysis at the start of each player turn (including White's initial turn, excluding game over). Pickup/release, Options and tracking recovery do not restart analysis. Existing destination tiles shade red/white/green by player-relative evaluation delta while holding a piece. Pending/unavailable scores retain regular tiles; temporary debug numbers lie flat on evaluated tiles and can be hidden beneath pieces. Color saturates at three pawns, and promotion tiles use the best available choice. Hover preserves evaluation colors. Drop, tracking loss and Options hide hints while preserving turn analysis; game/turn changes, disabling and session exit discard stale work. All 188 Chess tests and the full root suite passed, including actual WASM queen-loss detection for both colors, color gradients, pending tiles, Black-board hover and clearing. Holding A/X highlights the best cached piece in blue while pressed, without another search; release/Options/tracking loss clears it. Quest performance/visual verification remains pending.

## Wire-rim glasses — 2026-10-25

Separate frames-only glasses added to the active Blender document and exported GLB, fully head-bound with a retained metallic material. No lenses; 34 skinned meshes total. Real-asset checks verify open rims, material, head following and reset. Geometry preview inspected; Quest appearance remains pending. Included in the 2026-10-26 user-authorized release.

## Handlebar mustache — 2026-10-25

A separate thick, curled-tip handlebar mustache is saved in the active Blender document and GLB, head-bound with its own dark-brown material. Avatar total is 34 skinned meshes. Real-asset tests check placement below the actual nose, material, weights, head following and reset; glasses remain intact. Preview inspected. Included in the 2026-10-26 user-authorized release; Quest appearance review remains pending.

## Eyelid blinking — 2026-10-25

Existing eyelids rotate around their own eyeball centers with upper-dominant closure, randomized 2.5–6.5-second intervals and fast-close/slower-open timing. Bind-space rotation preserves head skinning and original Blender geometry. Restores exact rest positions/normals; pauses with hidden/tracking loss and Options. Open/closed geometry preview and real-GLB tests pass; physical Quest appearance review remains pending.

## Evaluation gauge — 2026-10-25

**Show Evaluation** is an independent persisted Options toggle, default Off. It replaces the former status box above the move list with a semicircular dial: red at bottom left, white at the top center, green at bottom right. The black needle shows the board score at the start of the player's turn, from the player's perspective, clamped at −5/+5 pawns, with an inclusive −0.1 to +0.1 pawn dead zone pointing straight up. It retains the previous turn's score while the next is pending, then smoothly eases from its current angle to the new target over 0.55 seconds; unknown initial scores hide the needle. `CurrentEvaluation.mjs` refreshes only at the start of a playable player turn, after the opponent's move commits and its animation finishes. It does not score the player's move or game-over boards; those retain the last turn's indication. New-game reset clears the old score. It reuses the move-hint baseline when available; otherwise it lazily uses its own scoring worker, so Show Evaluation also works with Evaluate Move Off. `EvaluationGauge.mjs` draws the cached dial face and animates only the needle when the score changes; hidden/untracked XR and Options pause its easing. The desktop status text remains available; there is no separate in-world status box.

Browser preview confirms the arc/needle at both extremes and zero, plus the expanded Options panel. Quest readability remains pending.

## Undo confirmation — 2026-10-26

During a normal player turn, push either thumbstick left to open **“Do you want to undo your last move?”**. The rest of the scene hides while the modal is open, leaving the dialog and pointers visible; closing restores the previous scene visibility. Either controller points/trigger-clicks **Yes** or **No**. Yes removes the player's last committed move and the opponent's reply, returning to the position before that player move; No leaves history untouched. Captures/trays, castling rights, en passant, promotions, move history and last-move highlights are rebuilt from chess.js history. Analysis epochs invalidate stale results and start fresh scoring for the restored turn. Black's initial opponent opening is preserved; no undo is offered before the player has made a move. Undo is locked during thinking, move animation, promotion and game over. Opening safely returns a held piece and finishes table positioning. Fresh stick deflection is required after neutral/tracking recovery; holding left cannot repeatedly open the dialog. Options and undo are mutually exclusive, and session exit/restart dismisses the prompt. The transparent modal uses fixed render layers: backdrop first, question/buttons next, pointer rays last, so head/view changes cannot paint the backdrop over its content.

Real-board regressions cover White/Black takebacks, repeated undo, captures, castling, en passant, promotion and turn locks. Modal tests cover either stick, pointer Yes/No, fresh presses, Options exclusion and restart. Browser layout/Yes/No flow checked; Quest controller/comfort review remains pending.

## Latest validation

On 2026-10-26, **188 Chess tests passed**, the full repository test command passed and `git diff --check` passed. Chess tests require no external npm installation. Relevant commands:

```sh
npm run test:chess
npm test
git diff --check
```

The suites cover the actual bundled engine and GLB, legal chess/history, controller gates and interruptions, capture/en passant/castling/promotion, transformed/flipped boards, positioning, displays, all-square native-length arm reach, finger skinning/contact/restoration, hand switching, HeadLP materials/binding, smoothed gaze and chest/head neck weighting. Some older animation tests exercise the procedural reference in addition to the current real-GLB tests.

Desktop browser checks during development confirmed real engine loading/play, current HeadLP placement and local assets. The user approved the hand-switch correction and blended-neck improvement. The implementing agent has not recorded a physical Quest frame-time/stereo/comfort benchmark. Verify headset appearance, grip feel, promotion reach, status readability and gaze/neck behavior at extreme positions when changing them. Historical rendering figures from the original procedural scene are obsolete.

## Snapshot of release state

Previous release: **fa4af74**, Options and cached move-evaluation hints. The user authorized the 2026-10-26 commit/push including glasses and mustache source/export/generators, runtime eyelid blinking, the evaluation gauge, undo and modal fixes, tests and documentation. Blender backups remain untracked. Consult Git status/log for the actual publication state; later releases require authorization.

## Remaining limitations

- No formal Quest performance benchmark, sound, saved game history or full-body IK.
- Avatar has no legs or mouth animation; eyes currently use the same material as skin by user choice.
- Piece/arm intersections near move endpoints are intentionally allowed. Pinch placement is visually tuned, not contact physics.
- Original supplied mesh author/license attribution was not provided; preserve any attribution supplied later.
- Early rig generation scripts do not reconstruct the later HeadLP/neck edits; the combined active Blender source is authoritative.
