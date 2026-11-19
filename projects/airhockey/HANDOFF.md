# Air Club — Air Hockey

Buildless single-player WebXR air hockey at `projects/airhockey/`, using local Three.js r180. All assets/audio are procedural and local; no build, physics library, shadows or postprocessing. Current version: **1.0.27**, displayed on the page and used by the entry query. Increment the patch for every project update; see [project instructions](AGENTS.md).

## Play and controls

- Desktop: mouse positions the blue mallet. Settings / Pause or Escape opens settings; Resume closes them. For a player serve, position the puck with the mouse and click the canvas to place it.
- Quest: settings open on VR entry. B / Y toggles them. Either controller can point and trigger menu controls. Main Hand switches Left / Right, default Right; only that controller drives the mallet. Triggers never select the playing hand. The opposite hand positions player serves and its fresh trigger press places the puck.
- Hold either grip button anywhere to pause and translate the table relative to the controller's press-time position, without snapping. One controller owns the grab until release; another held grip cannot steal it or acquire automatically. Height follows freely, with no limits or rounding. No handles or hand-marker spheres; the bot's yellow mallet hand is also omitted.
- Table, opponent, lights and puck move together. Physics stays table-local; tracking origin stays fixed. Current-frame grip poses are composed with the player rig exactly once, then table translation is subtracted. Mallet input uses X/Z only, with no smoothing or controller-height/rotation coupling. No artificial locomotion or headset-following table.
- The first tracked frame of each VR session sets table height to half floor-relative head height and aligns the table in front of the initial horizontal viewer pose. Calibration does not repeat after tracking recovery. Desktop starts at 80 cm.
- Settings contain Opponent skill (0–100, default 50, step 1), Main Hand, Debug FPS and New game. Desktop and VR share ControlModel definitions. New game closes settings/results and preserves skill, Main Hand and table placement. Settings are session-local, not persisted.
- Physics/timers pause for settings, grabs, missing viewer/main-hand tracking and hidden sessions. Main-hand loss never selects the other hand automatically. Returning tracking, switching hands, recenter and jumps over 32 cm reset mallet velocity history; impact velocity caps at 5 m/s. Grabs cancel on session/reset/tracking interruptions and require a fresh press.
- Each VR session requests 120 Hz after its first rendered tracked frame, without awaiting it. Unsupported/rejected requests keep the browser default. Debug FPS updates about twice per second from uncapped animation-frame intervals, including while settings pause play; it resets on session/visibility/tracking transitions. This measures app cadence, not GPU/compositor time or guaranteed sustained 120 FPS.

## Matches and serving

First to seven, no win-by-two. Each New game assigns first serve with a 50/50 draw, followed by a one-second ready interval. After a goal, the conceding side receives service following a 1.4-second reaction; possession/stall transfers use a one-second interval.

Player serves enter `placing`: the off-hand grip projects onto the player half, bounded for the full puck radius, rounded corners and mallet clearance. Until the first valid preview the puck stays hidden, avoiding a flash at the reset position. Once previewed it stays on the surface with zero velocity until a fresh off-hand trigger places it. Settings/grabs/missing tracking block confirmation. Held triggers are absorbed on entry, resume, reconnect and Main Hand changes. Desktop uses mouse/click. No serve receives an artificial launch impulse.

The bot selects a varied legal point (X ±0.42 m, Z −0.25 to −0.85 m), clear of its mallet. `botplacing` animates a 1.1-second eased cubic arc from behind its goal (Z −1.52 m), 18 cm below the surface, over the rail and onto that point at rest. AI/collisions wait until touchdown; the arc pauses with gameplay. The AI then strikes normally. New player/bot pucks may sit indefinitely until first movement: possession/stall timers remain zero until then. Afterward, seven seconds continuously on one half or three seconds below .08 m/s transfers service without a penalty goal.

## Score lights and result dialog

Both long edges have black rectangular extensions exactly 6 inches (15.24 cm) wide. Seven blue player lights occupy the left player half; seven red bot lights occupy the right opponent half, viewed from the player end. They fill from the scoring player's end toward the center. Each is an 80-triangle flat-shaded icosphere, centered at the panel top (Y .025 m), exposing its upper hemisphere. Unscored balls are black; lit balls have colored emission and circular panel-only halos (15 cm diameter, opacity .8). No labels/status texture, point lights or bloom.

At seven, the winner's seven lights flash every .55 seconds. Three small winner-colored fireworks launch from the table center over 3.3 seconds of active celebration. New game resets them; settings/tracking/grabs pause the effect.

After fireworks, a modal shows **You Won!** or **You Lost!** with a beveled **New Game** button. In VR it is upright at the table center, aligned with table axes and facing the player end (+Z). Its bottom edge is 2 inches above the surface: the 40 cm panel center is table-local (0, .2508, 0). Parenting it to the table makes placement independent of head movement. Desktop uses a viewer-facing modal. Settings/table interactions are blocked while open.

Either controller ray or desktop mouse can operate the shared 3D button: hover highlights, press depresses, leaving cancels, and only release while still hovered activates once. Returning while held cannot re-arm. Held buttons on opening/resume, tracking loss and disconnect never activate. New Game dismisses the modal and starts a fresh match.

## Architecture and performance

- `physics.mjs`: metre/second geometry, legal bounds, swept collision detection and impulse limits; no Three.js/DOM. Surface 1.22 × 2.44 m, corner radius .13 m, goals .42 m, puck radius .032 m and mallet radius .052 m.
- `game.mjs`: scores, `ready/play/goal/serve/placing/botplacing/won`, randomized service, legal placement and fixed-step orchestration.
- `ai.mjs`: observation, reflected-trajectory prediction and defend/intercept/attack/recover movement. Skill adjusts reaction 320–40 ms, speed .55–3 m/s, acceleration 2.5–18 m/s², errors and shot/bank selection. It never writes puck state.
- `input.mjs`, `serve-input.mjs`, `table-grab.mjs`: configured handedness/source identity, current-frame rig composition, off-hand confirmation and grip ownership. Controller matrices are explicitly recomposed because Three.js XR controllers disable automatic matrix updates.
- `view.mjs`, `rails-view.mjs`: procedural meshes/texture and matching mitered rail cross-sections, without overlapping coplanar joins or internal caps. Visual rail mesh has three material groups; collision rails are unchanged.
- `score-lights.mjs`: one instanced sphere mesh plus one instanced halo mesh. Instance colors also tint emission through a small material hook. Buffers update only on score/flash changes; unlit balls have zero emission/halo.
- `celebration.mjs`: one reusable 96-particle buffer/material/draw call, table-local fireworks; no dynamic lights.
- `result-dialog.mjs`: project-owned modal, table-aligned VR/viewer-facing desktop placement and shared controller pointers/BeveledButton.
- `app.mjs`: lifecycle, initial rig placement, fixed-step accumulator, settings/FPS and desktop adapters; explicit `window.airhockey` diagnostics for integration tests.
- `audio.mjs`: rate-limited synthesized impacts/menu/goals/victory, light stereo pan by table X; not a world-space listener. Audio unlock requires interaction.

Physics runs at 240 Hz, at most 12 steps/render frame (50 ms catch-up cap). Player motion is interpolated across steps. Relative-motion circle CCD handles moving mallets; swept segments/endpoints cover rails, eight-segment corners, posts and recessed throats. Restitution .94 rails/.90 relative to mallets; puck caps at 8 m/s with .075/s drag. Only the full disc crossing an end line inside the opening scores. Initial overlaps separate without extra velocity; a bounded 16-contact loop discards unresolved extreme-pinning time.

Normal desktop scenes use roughly 34–36 draw calls depending on puck visibility; fireworks add one, and the modal/pointers add a few more. This is not a Quest benchmark. Reused buffers, geometry and instancing bound runtime work.

Shared consumers: local Three.js/VRButton, XRFrameState, requestFrameRate, FrameRateCounter, ButtonEdges, ControlModel, DesktopControls, VRSliderPanel, ControllerPointer and BeveledButton. The new `shared/ui/beveled-button.mjs` is consumed only by Air Hockey; existing shared helpers/vendor files are unchanged. See [shared interfaces](../../shared/README.md). Three.js retains its shared MIT license.

## Validation, release and preview

Run `npm run test:airhockey` (32 tests; included in root `npm test`) and `npm run test:shared` (includes five beveled-button regressions). Focused tests cover physics/AI, randomized legal serves and arc clearance/landing, indefinite stationary-serve waits, rig composition, hand selection/recovery, grip ownership/interruption and rail joins.

`node projects/airhockey/tests/browser.cjs` uses Playwright against `http://127.0.0.1:8080/projects/airhockey/`; configure `PLAYWRIGHT_MODULE`, `CHROME_PATH`, `AIRHOCKEY_URL` or `AIRHOCKEY_SCREENSHOT` for the host. It checks WebGL startup, desktop/menu controls, off-hand placement, table translation/pause, score/halo colors, fireworks/results, button mouse/controller-ray gestures, and uncapped FPS/refresh requests. Full XR-shaped source collections are used: they have indices/iteration but no `.includes()`. Modal membership and gesture pruning must remain array-like-safe; assuming Array methods previously crashed on Quest after fireworks.

Release validation (2026-11-19): complete root suite, Air Hockey Chrome integration, documentation links/content and whitespace checks passed before the authorized v1.0.27 commit/push. Browser checks cover upright VR modal alignment/clearance, head independence, table-following and controller-ray activation. These are simulated XR inputs, not an immersive session. Screenshots of score/halo, bot serve and desktop modal visuals were reviewed during implementation.

The user authorized publication of the accumulated update. Prior Milestone 1 had positive Quest feedback; the newer VR modal crash was reproduced/fixed automatically, but no final physical-headset acceptance or sustained 120 FPS benchmark is claimed. Quest checks remain useful for modal placement/trigger feel, tracking/recenter recovery, serve/grab comfort, stereo visuals and sustained cadence. Git history holds release history.

Use root [Start-VR.command](../../Start-VR.command) with a USB-connected, authorized Quest and visit `/projects/airhockey/`. Stop ordinary desktop servers first so the launcher can bind port 8080. Desktop preview: `python3 -m http.server 8080 --bind 127.0.0.1` from the repository root.
