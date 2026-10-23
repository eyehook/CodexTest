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

Remaining acceptance work is physical Quest 3 validation: secure-context launch, both trigger rays, comfortable seated alignment, promotion/restart/setup panels, tracking loss/recovery, piece/arm appearance in stereo and sustained 72 FPS or better. Test the existing local USB launcher before asking to publish. There is no game saving/resume, draw negotiation/resignation, audio or idle animation in this scope.


## Direct hand pickup update

Replaced ray chess selection with 50%-opacity controller-grip spheres (1-inch radius), finite 6-inch square-column hover tests, trigger/grip pickup and release-to-drop. Carried pieces retain their pickup offset and upright orientation. Destination feedback follows the piece’s projected square; legal drops commit once, illegal/offboard drops restore the origin. Menu rays remain for empty hands only. Desktop uses pointer-captured drag/drop. Promotion remains pending until a menu choice. Tracking loss, hidden XR, disconnects and restart cancel safely; simultaneous hands/buttons cannot duplicate a move. Existing A–D entries describe the original milestone validation; controller feel and appearance for this update require Quest testing.

Validation for this update: all 34 Chess tests passed within the full repository test command, and `git diff --check` passed. An actual desktop drag from e2 to e4 committed the move and received a legal Stockfish reply. Publication follows the repository’s user-authorized commit/push workflow.


## Table positioning handle

Added a visible gold handle on the near tabletop edge for VR trigger/grip pickup. Height, forward distance and lateral offset follow controller displacement in seated-anchor coordinates within existing setup limits (±25 cm sideways). The entire environment follows, with no camera movement. One hand owns the handle, piece pickup is excluded, and thinking/moving turns lock adjustment. Releasing or losing input ends at the last position and saves once. Automated checks cover transformed-anchor motion, no cumulative drag drift, bounds, ownership and interruption. Physical Quest feel remains pending.


## VR menu removal

Removed the VR side menu and all controller pointing rays. Essential status, restart and promotion controls now sit on the tabletop and accept hand-sphere proximity plus a fresh trigger/grip press. The desktop launcher sidebar and drag/drop are preserved. The table handle supplies VR positioning. Historical milestone sections above describe earlier control layouts.

Validation after the handle and menu updates: all 43 Chess tests and the full repository test command passed. VR tests assert that no controller line meshes are created and no XR interaction calls the raycaster. Physical contact checks cover tabletop button bounds after translation/rotation; desktop launcher retention was verified in the browser. Quest testing remains pending.


## Player side selection

Added persisted White/Black/Random preference, with White as the default. Random assigns once per new game; the assigned color is displayed. The board rotates toward the player, while the handle, controls and avatar stay in place. Stockfish opens as White for a Black player. Own-piece pickup, status, promotion and computer transactions are side-aware. Tests cover both orientations, Black opening/turn flow/promotion, random assignment, settings persistence, stale opening cancellation and an actual White carry animation on the flipped board.


## Captured piece trays

Captured pieces now remain on side trays grouped by their own color. The table is widened to 1.25 m to keep full trays clear of the board and tabletop controls. Captures and en passant place victims in their tray before attacker placement; committed verbose move history reconstructs captures after synchronization. Promotion captures retain their actual piece type, custom starting FENs do not invent captures, interrupted captures restore the board, and restart clears trays. Side choice rotates only the board; trays and all pieces still follow table adjustments.

Capture-tray validation: all 55 Chess tests and the full repository suite passed. Narrow desktop previews use a wider field of view to include both trays; the XR projection remains headset-controlled.

Browser verification: played e4, d4 and exd5 against the actual Stockfish worker; the captured black pawn appeared on its side tray.


## Capture flight animation

Replaced instant tray placement with a visible five-inch lift, elevated carry and landing using the same victim mesh. Both player and opponent captures wait for the flight before completing the transaction. Player attackers wait clear of the flying victim and settle afterward. Restart cancels at any flight stage and reconstructs the authoritative state. Tests check frame-to-frame continuity, lift/transport/landing at 30/72/120 Hz, both table orientations, en passant, promotion capture types and cancellation in all three stages.

Capture-flight validation: all 61 Chess tests and the full repository test command passed; `git diff --check` passed. Headset visual timing and comfort remain unverified.


## Strength range update

Launcher ratings now run from 1350 through 2000 in steps of 50, with 1500 still the default. Persisted choices are validated against these 14 values; older unsupported ratings reset to 1500. Every offered rating lies within the actual bundled Stockfish UCI range. Historical milestone entries above describe earlier options.

Strength-range validation: all 62 Chess tests and the repository suite passed. The browser dropdown lists all 14 options and retains 1500 as its initial selection. Capture flight also completed during actual browser play.

The user reported that the updated game works well and authorized publication of these improvements. Automated checks pass; formal Quest frame-time measurements have not been recorded.


## Evaluation-driven opponent face

Added two low-poly black sphere eyes and a basic black mouth curve. Full-strength 150 ms worker analysis after each completed move drives opponent-relative curvature; near-equal positions are flat, advantage smiles and disadvantage frowns. Amount scales continuously and transitions smoothly. Analysis is serialized with playing searches, restores the Elo limit, and rejects stale results after restart or side changes. Checkmate/draw set final expressions. Tests cover score sign for both colors and side-to-move, mate/bound/MultiPV handling, curvature direction/magnitude, buffer reuse, strength restoration, analysis cancellation and terminal results. Actual bundled WASM analysis is checked on clear White/Black material advantages.

Face validation: all 67 Chess tests and the full repository suite passed. The browser displayed both eyes and the mouth, received a real opponent-relative cp score and completed a normal player/computer turn. Changes are local; Quest appearance/performance remain pending.


## Cube head and blinking

Replaced the faceted round head with a cube and moved the facial graphics onto its front surface. Added synchronized brief blinks at randomized 2.5–6.5 second intervals, independent of mouth evaluation. Tests verify cube proportions/front-face placement, eye closure and reopening at 30/72/120 Hz, random rescheduling, expression continuity and safe timing after pauses.

Cube/blink validation: all 73 Chess tests and the repository suite passed, and `git diff --check` passed. Browser preview confirmed the cube head and front-mounted facial graphics. Physical Quest appearance remains unverified.

Open-space positioning replaces the tabletop handle: fresh grip outside occupied pickup columns shows six axis arrows at the owner hand and moves the environment in seated axes; grip release saves and restores the sphere. Table buttons and piece pickup take priority, one owner is allowed, and tracking/session/restart interruptions end safely. All 76 Chess tests and the full repository suite passed, including gesture priority, trigger/grip release, ownership, bounds and interruptions. Physical Quest gesture/arrow appearance remains unverified.

Floating promotion tray: four shared-geometry player-colored choices appear above the board only after the pawn lands, with capture clearance/settling completed first. Trigger/grip pickup carries a choice; release commits promotion once. Tracking loss restores the choice without committing; restart/session interruption clears the tray. Table movement is locked during selection. Desktop sidebar choices remain; VR uses the tray. All 86 Chess tests and the repository suite passed, including all four types for both colors, cancellation and capture-landing timing. Physical Quest appearance/reach remains unverified.

Promotion finish/return: releasing outside the floating tray removes the pawn immediately and glides the selected mesh from its release pose to the promotion square over 0.5 s, committing only after arrival. Releasing over the tray cancels the choice and returns it to its slot over 0.22 s without changing the pawn or turn. Restart cancels safely. All 88 Chess tests and the repository suite passed, covering all choices/colors, tray return and restart during flight. Quest appearance remains unverified.

Chess opponent arms: `ProceduralAvatar` now has matching left/right upper-arm, forearm and hand meshes, sharing geometry/materials. Each arm has fixed 0.30 m upper and 0.28 m forearm lengths; the rig supplies these lengths to the independent IK solver. `OpponentAnimator` selects the closest resting hand to the source piece in world space and keeps that arm throughout the carry; it returns the previous arm before switching for a second castling piece. The upper body/head lean about a hip pivot as targets move across the board (up to 0.5 radians and 4 cm forward hip travel); shoulders follow the torso while the inactive hand stays at its resting target. Returning to rest removes the lean. No arm stretching or camera movement.

Validation: all 90 Chess tests and the full repository suite passed; `git diff --check` passed. Reach coverage includes all 64 squares at pickup and carry heights, both hands, transformed/flipped boards, fixed bone lengths throughout motion, castling and returning upright. Physical Quest appearance remains unverified.

Chess game-over display: `GameOverPanel.mjs` shows a viewer-facing billboard above the board with two lines, “Game Over” and “You Won!”, “You Lost!” or “Draw!”, based on the player color and terminal chess result. A “New Game” button beneath it restarts with current side/Elo settings via hand contact plus trigger/grip in VR, or mouse click on desktop. The panel hides on restart and appears only in the over phase. Table labels support explicit newlines.

Game-over validation: all 92 Chess tests and the full repository suite passed; git diff --check passed. Tests cover both player colors, mate/draw outcomes, two-line text, button contact/highlight and restart hiding. Physical Quest appearance remains unverified.

Chess result artwork: the plain game-over heading/result canvas is replaced with three generated 1536×1024 dark-teal/gold illustrations in `projects/chess/assets/game-over/{win,loss,draw}.png`. `GameOverPanel` preloads them as sRGB textures, selects the player-relative result and displays a 3:2 billboard. New Game retains its contact/click behavior and gold hover border beneath the artwork. Images are local; no runtime image service or external requests.

Artwork validation: inspected all three generated illustrations for correct wording and composition. All 92 Chess tests and the repository suite passed; git diff --check passed. Tests verify result texture mapping and preserved New Game contact/highlight/restart behavior. Quest display appearance remains unverified.

Chess status/move display: two upright framed boxes now sit above and behind the opponent on the viewer’s right, centered at (0.52, 0.66, -0.70) in table coordinates. Both face the viewer. Status is on top; below is a fixed White/Black header and eight numbered SAN rows. Committed verbose chess history supplies the actual full-move numbers, including custom Black-to-move starts. Once full, the display retains the newest eight rows, scrolling older rows off the top; reset clears the list. Canvas textures repaint only when displayed content changes.

Move-display validation: all 94 Chess tests and the repository suite passed; git diff --check passed. Tests cover columns, full-move numbering, Black starts, scrolling, fixed headers, reset and unchanged-content repaint avoidance. Quest placement/readability remains unverified.

Opponent capture timing: victims remain on their squares through reach, pickup and lift. Capture flight begins only once the attacker has covered 85% of its horizontal carry toward the destination. The attacker waits above the destination for the victim to land in its tray before lowering. Player captures already begin after release over the destination. Generation guards and restart cancellation remain active.

Late-capture validation: all 97 Chess tests and the full repository suite passed; git diff --check passed. New 30/72/120 Hz regressions verify the victim stays in place until the attacker is within the final 15% of carry distance.

Capture arc update: captured pieces follow a single eased 0.8 s parabolic arc with 15 cm lift, rather than separate lift/carry/land stages. The opponent still starts the victim flight near arrival (85% carry progress), but proceeds directly through lowering, placement, clearance and return without waiting for the victim. Player placement also settles concurrently with capture flight. Geometry intersections are allowed. Restart cancels the shared motion safely.

Board coordinates: `BoardCoordinates.mjs` draws ivory rank/file labels on the left and bottom frame edges using one transparent canvas texture and mesh. The label group stays in the table frame, independent of board rotation; White sees a–h left-to-right and 1–8 near-to-far, Black sees h–a and 8–1. Labels stay upright and update once on side changes. No external fonts/assets.

Coordinate validation: all 99 Chess tests and the full repository suite passed; git diff --check passed. Regression compares each label with actual square positions under translated/yawed parents and repeated White/Black switches. Quest text readability remains unverified.

Opponent hand motion: approach and return now follow gentle 8 cm arches. Carrying uses one continuous 0.9 s arc from the actual pickup grip to destination grip with 18 cm peak lift, replacing separate vertical lift, horizontal carry and lower/clear stages. Piece intersections near endpoints are allowed. Closest-hand selection, fixed bone lengths, torso lean and late/concurrent capture flight remain.
