# Chess delivery and validation status

Current-state report, **2026-10-25**. For the next agent, read [HANDOFF.md](HANDOFF.md); for controls and architecture, read [README.md](README.md). This report replaces the accumulated chronological notes whose older behavior descriptions had become contradictory. Git history preserves those earlier milestones.

## Delivered behavior

| Area           | Current implementation                                                                                                                                |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Playable chess | Authoritative chess.js history/rules, legal validation, special moves, restart, game-over results and player side selection.                          |
| Engine         | Local Stockfish 17.1.0 Lite single-threaded WASM; UCI Elo 1350–2000 by 50, default 1500; 300 ms move searches. Optional independent move-hint analysis once per player turn.            |
| Input          | Direct hand-sphere hover/grab/drop using trigger or grip; exclusive ownership, interruption recovery; desktop drag/drop. Y/B Options uses pointer rays; A/X holds the best-piece hint.        |
| Setup          | Open-space grip with six axis arrows positions table/opponent in seated axes; persisted height/distance/lateral offset. No handle mesh.               |
| Piece motion   | Continuous opponent arm arcs, late concurrent victim arc to side trays, castling king then rook, upright carried pieces and safe cancellation.        |
| Promotion      | Floating physical choice tray after pawn landing; hover, return/cancel highlight, selected-mesh glide and authoritative commit after arrival.         |
| Displays       | Player-oriented rank/file labels, viewer-facing status/move history, result illustrations and proximity-highlighted New Game button.                  |
| Character      | Actual Blender skin rig, closest-hand selection, fixed arm lengths, lean, multi-joint fingers and top pinch; old-hand switching glitch fixed.         |
| Head/neck      | Complete HeadLP assembly, skin-colored eyes, blended neck weights, smooth gaze at opponent/player-held piece; no mouth/blinks/evaluation expressions. |

Original A–D milestones established playable chess, a procedural opponent, physical movement and interruption/refinement coverage. The procedural character and initial ray/menu/handle/expression designs were subsequently replaced. `ProceduralAvatar` and `OpponentFace` remain reference/tested code and are not the live avatar path. Evaluation utilities also support the optional live move hints.

## Options addition — 2026-10-25

Local, unpublished: Y/B opens a billboard and hides the chess scene; either controller points and trigger-clicks the Evaluate Move On/Off setting. Save Changes or Y/B saves to persistent settings and closes. Evaluate Move defaults Off; when On, pickup displays per-legal-move evaluation deltas. Board/avatar animation pauses while open. Physical Quest Menu is browser-reserved. All 119 Chess tests, the full root suite and `git diff --check` passed. Browser startup and a rendered panel preview completed without page errors. New regression tests cover draft persistence, both pointers, button edges and tracking recovery. Quest appearance/controller validation remains pending.

## Move evaluation addition — 2026-10-25

Full-strength MultiPV hints use a separate worker, a 1000 ms MultiPV reply search plus static NNUE current-board and candidate+reply endpoint scoring (additional processing time) and per-piece cached position scores from one analysis at the start of each player turn (including White's initial turn, excluding game over). Pickup/release, Options and tracking recovery do not restart analysis. Existing destination tiles shade red/white/green by player-relative evaluation delta while holding a piece. Pending/unavailable scores retain regular tiles; temporary debug numbers lie flat on evaluated tiles and can be hidden beneath pieces. Color saturates at three pawns, and promotion tiles use the best available choice. Hover preserves evaluation colors. Drop, tracking loss and Options hide hints while preserving turn analysis; game/turn changes, disabling and session exit discard stale work. All 154 Chess tests and the full root suite passed, including actual WASM queen-loss detection for both colors, color gradients, pending tiles, Black-board hover and clearing. Holding A/X highlights the best cached piece in blue while pressed, without another search; release/Options/tracking loss clears it. Quest performance/visual verification remains pending.

## Latest validation

On 2026-10-25, **154 Chess tests passed**, the full repository test command passed and `git diff --check` passed. Chess tests require no external npm installation. Relevant commands:

```sh
npm run test:chess
npm test
git diff --check
```

The suites cover the actual bundled engine and GLB, legal chess/history, controller gates and interruptions, capture/en passant/castling/promotion, transformed/flipped boards, positioning, displays, all-square native-length arm reach, finger skinning/contact/restoration, hand switching, HeadLP materials/binding, smoothed gaze and chest/head neck weighting. Some older animation tests exercise the procedural reference in addition to the current real-GLB tests.

Desktop browser checks during development confirmed real engine loading/play, current HeadLP placement and local assets. The user approved the hand-switch correction and blended-neck improvement. The implementing agent has not recorded a physical Quest frame-time/stereo/comfort benchmark. Verify headset appearance, grip feel, promotion reach, status readability and gaze/neck behavior at extreme positions when changing them. Historical rendering figures from the original procedural scene are obsolete.

## Snapshot of release state

Previous release: **7575ea1**, articulated Blender opponent and hand-switch fix. The user authorized this handoff release on 2026-10-24: it includes HeadLP integration, skin-colored eyes, head gaze for both players, blended neck weights, related tests and consolidated documentation. Source and GLB are included together; unrelated Blender backups remain untracked. See HANDOFF for source/backup handling and current Git state for the actual commit/push status. No further feature work is scheduled; later publication requires user authorization.

## Remaining limitations

- No formal Quest performance benchmark, sound, saved game history or full-body IK.
- Avatar has no legs/idle facial animation; eyes currently use the same material as skin by user choice.
- Piece/arm intersections near move endpoints are intentionally allowed. Pinch placement is visually tuned, not contact physics.
- Original supplied mesh author/license attribution was not provided; preserve any attribution supplied later.
- Early rig generation scripts do not reconstruct the later HeadLP/neck edits; the combined active Blender source is authoritative.
