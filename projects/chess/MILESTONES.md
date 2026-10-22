# Chess milestone report

Milestones A–D are implemented. No headset testing is claimed.

## A — Playable Chess

Implemented the launcher, persisted 1500 default Elo, local worker/WASM engine, procedural board/pieces, controller rays and desktop clicks, legal destinations and selection/check/last-move feedback, explicit promotion choices, full chess.js rules, restart and game-over state. The initial opponent API used automatic movement before introducing the avatar.

Verified an actual desktop browser e2–e4 and Stockfish reply before starting B. Tests cover castling, en passant, all promotions, checkmate, stalemate, repetition, insufficient material, fifty-move draw, turn locking, transaction commit order, engine validation, restarts, stale searches, settings and range clamping. A live test loads the actual WASM, performs UCI initialization, requests legal moves and reinitializes at another Elo. A separate actual-engine run completed 48 legal plies through Black checkmate (scripted White moves, engine Black).

Known issues: lower Elo choices clamp visibly to the actual 1320 engine minimum; ratings are approximate. No headset validation. Next: procedural avatar and reach verification (implemented in B).

## B — Procedural Opponent

Implemented a seated primitive humanoid, static other arm, articulated shoulder/elbow/hand, replaceable avatar contract and independent analytic two-bone IK. Fixed pole direction, elbow limits and reach clamping prevent unconstrained poses. Hand targets use world space; rules remain outside the avatar.

Tests verify all 64 squares at low pickup and elevated carry heights under a translated/rotated parent, arm segment lengths, continuous elbow response, zero-distance and extreme-target clamping. Desktop screenshot confirmed the seated character and resting arm.

Known issues: the minimal character has intentionally simplified anatomy, without legs, face or fingers. Arm/head appearance needs headset review. Next: controlled pickup/transport (implemented in C).

## C — Physical Piece Movement

Implemented a cancellable reach, lower, attach, lift, carry, place, clear and return sequence with upright pieces and 24 cm travel clearance. Captures disappear before movement. En passant removes the correct adjacent pawn; Black castling runs two carry sequences. Pawn promotion replaces the visual after placement and authoritative commit.

Tests run at 30, 72 and 120 Hz, verifying attachment, world scale, clearance, exact final position and unchanged authoritative state during animation. Capture, en passant, both castling directions, promotion and cancellation during reach/lower/lift/carry/place/return are covered. Cancellation rebuilds from chess.js and leaves no pieces attached to the hand. Integrated browser play also completed a legal player/opponent turn with the avatar enabled.

Known issues: captures use immediate removal; hand is a simple block and has no finger grip. Next: refinement and hardware review.

## D — Refinement

Implemented smooth elapsed-time interpolation, upright preserved transforms, reach/bend bounds, piece-aware ray targeting, tracking/visibility gates, seated height/distance/offset persistence and controls, engine failures/timeouts, one-search-at-a-time enforcement, VR-session cancellation, and locks that prevent table adjustment or VR entry during animation. Board squares use one instanced mesh; each piece reuses a merged geometry, with simple lights and no shadows.

All 20 Chess tests passed. Automated suites cover the transaction/animation interruption boundaries, special rules, both controller tracking gates and settings fallback. The repository-wide test command also passed. Browser checks cover actual WASM loading, legal play, Elo persistence/range messaging and restart. Initial desktop scene: 45 draw calls / 9,316 triangles (VR adds panel/rays). This does not establish headset performance.

Remaining acceptance work is physical Quest 3 validation: secure-context launch, both trigger rays, comfortable seated alignment, promotion/restart/setup panels, tracking loss/recovery, piece/arm appearance in stereo and sustained 72 FPS or better. Test the existing local USB launcher before asking to publish. There is no game saving/resume, draw negotiation/resignation, physical grabbing, audio or idle animation in this scope.
