# Chess delivery and validation status

Current-state report, **2026-10-24**. For the next agent, read [HANDOFF.md](HANDOFF.md); for controls and architecture, read [README.md](README.md). This report replaces the accumulated chronological notes whose older behavior descriptions had become contradictory. Git history preserves those earlier milestones.

## Delivered behavior

| Area           | Current implementation                                                                                                                                |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Playable chess | Authoritative chess.js history/rules, legal validation, special moves, restart, game-over results and player side selection.                          |
| Engine         | Local Stockfish 17.1.0 Lite single-threaded WASM; UCI Elo 1350–2000 by 50, default 1500; 300 ms move searches. No gameplay analysis phase.            |
| Input          | Direct hand-sphere hover/grab/drop using trigger or grip; exclusive ownership, interruption recovery; desktop drag/drop. No VR rays/side menu.        |
| Setup          | Open-space grip with six axis arrows positions table/opponent in seated axes; persisted height/distance/lateral offset. No handle mesh.               |
| Piece motion   | Continuous opponent arm arcs, late concurrent victim arc to side trays, castling king then rook, upright carried pieces and safe cancellation.        |
| Promotion      | Floating physical choice tray after pawn landing; hover, return/cancel highlight, selected-mesh glide and authoritative commit after arrival.         |
| Displays       | Player-oriented rank/file labels, viewer-facing status/move history, result illustrations and proximity-highlighted New Game button.                  |
| Character      | Actual Blender skin rig, closest-hand selection, fixed arm lengths, lean, multi-joint fingers and top pinch; old-hand switching glitch fixed.         |
| Head/neck      | Complete HeadLP assembly, skin-colored eyes, blended neck weights, smooth gaze at opponent/player-held piece; no mouth/blinks/evaluation expressions. |

Original A–D milestones established playable chess, a procedural opponent, physical movement and interruption/refinement coverage. The procedural character and initial ray/menu/handle/expression designs were subsequently replaced. `ProceduralAvatar`, `OpponentFace` and evaluation utilities remain reference/tested code and are not the live avatar path.

## Latest validation

On 2026-10-24, **115 Chess tests passed**, the full repository test command passed and `git diff --check` passed. Chess tests require no external npm installation. Relevant commands:

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
