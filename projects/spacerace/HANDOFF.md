# Space Race handoff

## Start here

Read the repository `../../AGENTS.md`, this file, and [README.md](README.md). Inspect Git status before editing. [MILESTONE_1.md](MILESTONE_1.md) preserves the original request; current code and the settings below supersede its initial numbers.

Space Race is a minimal seated/standing WebXR speed experiment for Meta Quest 3, with a desktop preview. Straight flight only: keep the player stationary and move the environment backward. Preserve normal headset translation/rotation. No steering, artificial camera rotation, shake, FOV changes, terrain, spacecraft, collisions or scoring.

## Handoff maintenance

The user requires this handoff to be reviewed and updated before every push of Space Race changes to GitHub. Update the current settings, behavior, architecture, validation results and remaining work as applicable, and include the handoff update in the same release.

## Release and run instructions

The implementation was committed and pushed to `main` as `60fb73d` (`Add Space Race WebXR speed experiment`). GitHub Pages deploys the repository root from `main`:

- Project: https://eyehook.github.io/CodexTest/projects/spacerace/
- Local: serve the repository root with `python3 -m http.server 8080 --bind 127.0.0.1`, then open `http://localhost:8080/projects/spacerace/`.
- The existing `Start-Quest-VR.command` launcher also serves this project through USB/ADB reverse forwarding. See the repository AGENTS.md.

Buildless ES modules; no installation/build step. Reuse Three.js r180 from `../forest/vendor/`, retaining its MIT license. All imports/assets are local and relative for the Pages subpath. Increment entry/import query versions after runtime changes to avoid stale headset caches. This handoff was added with the subsequent ring-wake release. Future commits/pushes require user authorization.

## Current settings and controls

Design units are feet; simulation/rendering use metres (`FT = 0.3048`). Settings live in `config.mjs`.

| Setting | Current value |
| --- | --- |
| Maximum speed | 300 mph = 440 ft/s = 134.112 m/s |
| Acceleration / braking | 60 / 100 ft/s²; full speed in about 7.33 s |
| Requested XR refresh rate | 120 Hz; `null` selects browser default |
| Particle pool | 3,000 quads |
| Radial particle range | 10–200 feet from the flight axis, uniform by annular area |
| Longitudinal particle range | 500 feet ahead to 20 feet behind |
| Density curve | 200 / 400 / 800 / 1,500 / 3,000 at 0 / 25 / 50 / 75 / 100% speed |
| Particle width / maximum streak | 0.3 / 10 feet |
| Rings | Five; 20-foot radius; 200-foot spacing; initially out to 1,000 feet |
| Ring appearance | #112233 blue, unlit, 0.25-foot outline |
| Whoosh | 350 Hz broad band; 1,200 Hz low-pass; master gain 0.325 |
| Whoosh reach | 65 feet; fades to silence before rear recycling |

Right trigger accelerates; left trigger brakes. Analog pressures combine; both fully held give net braking of 40 ft/s². Release coasts. Desktop Up/Down mirror these controls; drag the background to look. Sound can be toggled before entering VR. Each VR session starts at rest, with the fixed path anchored once to the initial eye position and horizontal heading. Looking around does not redirect travel. Physical leaning can naturally move the viewer off the axis.

## Modules and constraints

- `main.js`: rendering, desktop input, XR session lifecycle, one-time anchoring, rings, HUD and audio integration. Passes the active configuration into `Simulation`. Camera far clipping covers all five rings. One instanced ring draw plus one particle draw, one wake draw when moving, and one additional HUD draw in XR.
- `simulation.mjs`: capped, frame-independent speed/distance integration, fixed arrays, annular particle scattering and recycling. Particle and ring motion share the same integrated distance. Preserve overshoot and uniform ring spacing when recycling.
- `particles.js`: one fixed instanced quad batch, custom shader. Stretch along the actual flight axis; calculate width separately per eye. Preserve point shape at rest and avoid degenerate on-axis quads. Density fades across a rank band and eases toward its target; far/rear alpha fades mask recycling. HUD particle count is the effective density setting, not a count of on-screen pixels/particles.
- `frame-rate.mjs`: half-second average of uncapped frame intervals. Count once per app frame, not once per eye; reset across inactive/session transitions. This is app cadence, not a GPU/compositor measurement.
- `xr-frame-rate.mjs`: feature/support checks and guarded refresh request. **Never await this request during startup.** The previous implementation waited before `renderer.xr.setSession()` and hung on the headset. The fixed implementation requests once, after rendering the first visible tracked XR frame, without blocking subsequent frames. Keep rejected or indefinitely pending requests harmless.
- `ring-audio.mjs`: one generated looping noise buffer, two HRTF rim emitters per ring (10 fixed voices). Explicit radial-velocity Doppler shifts playback/filter frequency; panners alone do not implement it. Listener pose is transformed into the flight frame. Speed/proximity control gain; stopped fields are silent. Preserve the gentle low-pass and current reduced master gain. Audio unlock runs on a user gesture, never gates XR startup, and failures leave visuals usable. Inactive frames/session changes/muting silence output; page exit disposes it.

Pause simulation when hidden or XR is not visible/tracked; cap simulation delta to 50 ms without catch-up. Keep FPS measurement based on raw elapsed time. Avoid per-frame geometry creation, individual particle draws, lighting, shadows, bloom and postprocessing.

## Verification and user feedback

Run from the repository root:

```sh
npm run test:spacerace
npm test
git diff --check
```

Twelve Space Race tests and the complete root suite passed before the implementation release. Tests cover units, speed limits/integrated distances across frame rates, coasting, bounds/distribution, recycling/spacing, trigger mapping, FPS sampling, refresh startup ordering and audio model/lifecycle. Desktop browser checks exercised rendering, acceleration, braking, mouse look and sound controls without console warnings/errors. Some browser visual checks preceded the final speed/range changes; automated checks cover the final parameters.

The user tested the refresh-rate comparison on Quest: browser default gave 90 FPS, requesting 120 Hz gave 120 FPS. They explicitly chose to retain the request. Audio was then revised through feedback: lower volume, smoother filtering, finally a much lower 350 Hz center. Do not revert it to the earlier 2,200 Hz version.

Remaining physical checks include sustained 120 FPS with the final five-ring/audio pool and particle range, stereo appearance, distant ring recycling, sound loudness/spatial feel, HUD readability, tracking/session re-entry and comfort. User-reported cadence is not a formal frame-time benchmark.

Two unrelated untracked backups existed before this work: `assets/chess/opponent/ManLP-articulated.blend1` and `assets/chess/opponent/ManLP-articulated.blend2.blend`. They were excluded from the release. Preserve them and exclude them from future Space Race commits.

## Ring motion wakes release

`rings.js` now owns the opaque leading rings and a shared instanced open-cylinder wake mesh (128 radial divisions, eight connected longitudinal segments). Both batches reference the same instance matrix buffer; recycling/spacing stays authoritative in the unchanged simulation. The wake extends -Z into the distance, scaled by a length uniform to speed × 12/120 seconds. At rest the wake batch is hidden; the original rings retain their exact radius/thickness/material. The fragment shader uses continuous linear alpha from 1 to 0 and #112233 blue additive blending, with depth test on, depth writes off, double-sided single-pass drawing. No radial softness, bloom or postprocessing. Added cost: one draw batch and 2,048 wake triangles per ring when moving, without per-frame geometry allocation.

`config.mjs` exports the requested `RING_WAKE_SEGMENTS`, `RING_WAKE_FRAME_COUNT`, `RING_WAKE_REFERENCE_HZ`, and `RING_WAKE_ENABLED` constants (8, 12, 120, true). The visual reference rate does not change headset refresh settings. `main.js` delegates only ring updates to the module; particle behavior, movement, controls, HUD and audio remain unchanged. Entry/import cache versions were advanced.

The twelfth project test covers wake lengths including 300 mph (44 feet), continuous topology/radius, material settings, hiding at zero speed, reused geometry and shared transforms through repeated recycling. Desktop full-speed shader/rendering checked without console errors. Physical Quest checks for stereo alignment, transparency appearance, temporal effect and sustained 120 FPS remain pending. The user accepted the final appearance (five rings, #112233, 12-frame wakes) and authorized this release to GitHub. The complete root suite and all twelve project tests passed before release. Formal sustained headset performance measurements remain pending. This handoff is included with the release; use Git history for its final commit ID.
