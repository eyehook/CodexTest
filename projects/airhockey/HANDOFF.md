# Air Club — Air Hockey

Buildless single-player WebXR air hockey at `projects/airhockey/`, using local Three.js r180. No runtime downloads, physics library, build step, skeletal animation, shadows or postprocessing. Entry query version: `1`.

## Play and controls

- Desktop: move the mouse over the table to position the blue mallet. Settings / Pause (or Escape) opens the native panel; Resume closes it. Mouse input is a desktop-only ray/plane projection.
- Quest: Enter VR; the settings panel opens initially. B / Y closes or opens it. Point either controller and hold trigger to drag sliders; trigger the New game button once to reset. Select a playing hand with either trigger; release it and keep playing. Rays are only for the menu, never for mallet positioning.
- The selected controller has a blue marker. Its current-frame **grip** position is composed with the rig once, then projected onto table X/Z. Rotation and height do not drive the mallet. No artificial locomotion or headset-relative following. The initial viewer yaw and horizontal physical offset place the table in front of the player once per session; the table then remains fixed in scene world space.
- Settings pause physics, possession and game timers. Missing viewer/active-hand tracking and hidden sessions also pause. Release and freshly press a trigger after entering/resuming if no hand is selected. Returning tracking, switching hands, recenter events and jumps over 32 cm reset mallet velocity history. Visual position is unsmoothed; impact velocity is capped at 5 m/s.
- Height: 60–110 cm, default 80, 1 cm increments. Skill: 0–100, default 50, increments of 1 (continuous slider). Desktop and VR share ControlModel definitions and increments. Changes apply immediately; New game preserves both settings. Settings are session-local, not persisted.

## Game and physics

First to seven. Neutral initial puck drifts toward the player after a one-second ready interval. The conceding side receives the next puck at ±0.48 m, with a brief 1.4-second score reaction before play. A match victory holds until New game. The integrated scoreboard displays both scores and status; the robot reacts to goals and outcomes.

Physics uses metres/seconds, table-centred X/Z, a 1.22 × 2.44 m surface, 13 cm corner radius, 42 cm goals, 3.2 cm puck radius and 5.2 cm mallets. The entire table/opponent assembly moves vertically for height changes; tracking origin and 2D physics do not move.

240 Hz fixed steps, at most 12 per render frame (50 ms catch-up cap). Player movement is interpolated across the frame's steps; it reaches the tracked/clamped position without smoothing. Circle-circle relative-motion CCD accounts for moving mallets. Swept circle-versus-segment/endpoint CCD covers straight rails, eight-segment rounded corners, posts and recessed goal throats. Collision restitution is .94 for rails and .90 relative to mallets; puck speed caps at 8 m/s, drag at .075/s. Only the full puck passing the end line inside the opening scores. Initial overlaps separate without added velocity; a bounded 16-contact loop discards unresolved time under extreme pinning rather than permitting unchecked motion.

Seven seconds continuously on one half transfers service; three seconds below .08 m/s also releases a stalled/pinned puck through the same reset. No penalty goal, obscure fouls, vertical motion or puck flipping. The stall reset also applies to a freely stopped puck. Reset timers pause with gameplay.

## Architecture

- `physics.mjs`: geometry, legal bounds, swept collisions, impulse limits; no Three.js/DOM.
- `game.mjs`: scores, ready/play/goal/serve/won states, possession, player targets and fixed-step orchestration.
- `ai.mjs`: observation snapshot, reflected-trajectory prediction, defend/intercept/attack/recover decisions, target position and acceleration-limited movement. One balanced opponent. Skill changes reaction delay (320–40 ms), speed (.55–3 m/s), acceleration (2.5–18 m/s²), prediction/defence error, shot accuracy and bank selection. Fast incoming pucks retain defensive priority; slow pucks allow approach-behind/strike attacks. The AI never writes puck state.
- `input.mjs`: shared ButtonEdges with source identity; current-frame grip and pointer transforms, disconnect/recovery handling. XR controller matrices are explicitly recomposed because Three.js controller objects disable automatic matrix updates.
- `view.mjs`: procedural table texture, low-poly meshes, robot and event-driven scoreboard canvas uploads. Approximately 76 desktop draw calls; this is not a Quest benchmark.
- `audio.mjs`: rate-limited synthesized impact/menu/goal/victory tones; lightweight stereo pan by table X (not a world-space positional listener). Browser audio unlock requires interaction.
- `app.mjs`: lifecycle, initial rig placement, fixed-step accumulator, native/shared VR UI and desktop adapter. `window.airhockey` exposes explicit diagnostics for tests.

Shared consumers: Three.js/VRButton, XRFrameState, ButtonEdges, ControlModel, DesktopControls, VRSliderPanel and its controller pointers. No shared runtime modules modified. All art and audio are procedural; Three.js retains the shared MIT license.

## Validation and preview

Run `npm run test:airhockey` (also in root `npm test`). Tests cover moving/static mallet CCD, rail/post/rounded-corner bounces, full-disc goals, legal bounds, impulse limits, seven-point matches, possession, AI prediction and movement, long deterministic play, current-frame rig composition, hand switching and tracking recovery.

Optional `node projects/airhockey/tests/browser.cjs` uses Playwright against `http://127.0.0.1:8080/projects/airhockey/`. Set `PLAYWRIGHT_MODULE`, `CHROME_PATH`, `AIRHOCKEY_URL` or `AIRHOCKEY_SCREENSHOT` for the host. It checks actual WebGL startup, desktop pause/settings/reset/mouse movement, composed grip transforms, switching/recovery and real VR-panel ray hits for slider/new-game controls. It is a simulated XR input check, not an immersive session.

Use the root [Start-VR.command](../../Start-VR.command) with the USB-connected Quest, then visit `/projects/airhockey/`. Stop any ordinary desktop preview server first so the launcher can bind port 8080.

Local validation (2026-11-18): full root suite and focused tests passed; Chrome WebGL integration passed with no console/module errors; desktop screenshot visually reviewed. A deterministic tuning probe (10 seeded, 180-second games against a stationary centred human mallet per level) yielded AI wins 0/10 at skill 0, 8/10 at 50, and 10/10 at 100. This checks basic progression only, not human difficulty calibration.

**User acceptance and release:** the user reported “Works great” after the Quest testing handoff and authorized committing and pushing Milestone 1. This records positive play-test feedback, not an exhaustive headset test matrix or a formal performance benchmark. Targeted recenter/tracking-interruption checks, sustained frame-time/GC measurements and broader human difficulty tuning remain useful follow-up validation. Standard primitive legs move with table height; the sparse environment and character are deliberately simple. The complete root suite, including all 16 Air Hockey tests, was rerun successfully before publication; documentation links and whitespace checks passed. See Git history for the release commit.
