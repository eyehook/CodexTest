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

Buildless ES modules; no installation/build step. Reuse Three.js r180 from `../../shared/vendor/three-r180/`, retaining its MIT license. All imports/assets are local and relative for the Pages subpath. Increment entry/import query versions after runtime changes to avoid stale headset caches. This handoff was added with the subsequent ring-wake release. Future commits/pushes require user authorization.

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
git diff --check
```

For isolated Space Race code changes, these project checks suffice before publishing. Run the full root suite only for shared or cross-project changes; documentation-only edits need content/link checks and `git diff --check`.

Twelve Space Race tests and the complete root suite passed before the implementation release. Tests cover units, speed limits/integrated distances across frame rates, coasting, bounds/distribution, recycling/spacing, trigger mapping, FPS sampling, refresh startup ordering and audio model/lifecycle. Desktop browser checks exercised rendering, acceleration, braking, mouse look and sound controls without console warnings/errors. Some browser visual checks preceded the final speed/range changes; automated checks cover the final parameters.

The user tested the refresh-rate comparison on Quest: browser default gave 90 FPS, requesting 120 Hz gave 120 FPS. They explicitly chose to retain the request. Audio was then revised through feedback: lower volume, smoother filtering, finally a much lower 350 Hz center. Do not revert it to the earlier 2,200 Hz version.

Remaining physical checks include sustained 120 FPS with the final five-ring/audio pool and particle range, stereo appearance, distant ring recycling, sound loudness/spatial feel, HUD readability, tracking/session re-entry and comfort. User-reported cadence is not a formal frame-time benchmark.

Two unrelated untracked backups existed before this work: `assets/chess/opponent/ManLP-articulated.blend1` and `assets/chess/opponent/ManLP-articulated.blend2.blend`. They were excluded from the release. Preserve them and exclude them from future Space Race commits.

## Ring motion wakes release

`rings.js` now owns the opaque leading rings and a shared instanced open-cylinder wake mesh (128 radial divisions, eight connected longitudinal segments). Both batches reference the same instance matrix buffer; recycling/spacing stays authoritative in the unchanged simulation. The wake extends -Z into the distance, scaled by a length uniform to speed × 12/120 seconds. At rest the wake batch is hidden; the original rings retain their exact radius/thickness/material. The fragment shader uses continuous linear alpha from 1 to 0 and #112233 blue additive blending, with depth test on, depth writes off, double-sided single-pass drawing. No radial softness, bloom or postprocessing. Added cost: one draw batch and 2,048 wake triangles per ring when moving, without per-frame geometry allocation.

`config.mjs` exports the requested `RING_WAKE_SEGMENTS`, `RING_WAKE_FRAME_COUNT`, `RING_WAKE_REFERENCE_HZ`, and `RING_WAKE_ENABLED` constants (8, 12, 120, true). The visual reference rate does not change headset refresh settings. `main.js` delegates only ring updates to the module; particle behavior, movement, controls, HUD and audio remain unchanged. Entry/import cache versions were advanced.

The twelfth project test covers wake lengths including 300 mph (44 feet), continuous topology/radius, material settings, hiding at zero speed, reused geometry and shared transforms through repeated recycling. Desktop full-speed shader/rendering checked without console errors. Physical Quest checks for stereo alignment, transparency appearance, temporal effect and sustained 120 FPS remain pending. The user accepted the final appearance (five rings, #112233, 12-frame wakes) and authorized this release to GitHub. The complete root suite and all twelve project tests passed before release. Formal sustained headset performance measurements remain pending. This handoff is included with the release; use Git history for its final commit ID.

## Additional reference

[Former root project notes](ROOT_CONTEXT.md) preserve the project-specific material removed from AGENTS.md. These are optional historical context; this handoff and current source/Git state take precedence.

## Repository guidance update

Root AGENTS.md now contains shared guidance and a project handoff index. Project-specific root notes were preserved in handoffs or optional ROOT_CONTEXT.md reference files. Isolated project changes use project checks; shared tooling/code changes use the affected broader suite. Documentation-only edits use content/link and whitespace checks. The repository now has a shared release checklist and `npm run test:forest`; there is no CI workflow, and future CI should follow the selective-testing policy. The full root suite and documentation links passed for this tooling/documentation update. Space Race runtime behavior is unchanged. The user authorized publishing this update.

## Weather release review — 2026-10-27

Reviewed before the Weather project push as required by root guidance. Space Race runtime and settings are unchanged. The full root suite, including the twelve Space Race tests, passed for the Weather release. Existing headset validation limits remain as documented above.

## Weather rain release review — 2026-10-28

Reviewed before the authorized Weather rain/ground-effects/settings push as required by root guidance. Space Race runtime, shared vendor files and root tooling are unchanged. This Weather-only runtime release uses its 48 focused passing tests; Space Race settings and prior validation limitations remain unchanged.

## Scene Test release review — 2026-10-29

Reviewed before the authorized Scene Test push as required by root guidance. Space Race runtime/settings and shared vendor files are unchanged. The complete root suite, including the twelve Space Race tests, passed for this release. Existing headset validation limitations remain unchanged.

## Shared Three.js relocation — 2026-10-29

Three.js r180 now lives at repository-level `shared/vendor/three-r180/`, with GLTFLoader, BufferGeometryUtils, VRButton and area-light modules in its `addons/` directory. Former Forest/Scene Test vendor directories are removed. Imports, tests, documentation and the knight exporter use the canonical shared paths. Core/license bytes are unchanged; addon code changes only adjust imports. Buildless entry/module queries use `shared-r180-1` to refresh cached module graphs. Racer, Terrain and Fishing static outputs were rebuilt from their updated sources; Swarm retains independent npm dependencies.

Validation: the complete root suite, all ten Cloud tests, three Vite builds, Scene Test browser integration and browser startup of all ten affected projects under `/CodexTest/` passed. All 525 inspected local module references resolve. No new Quest hardware benchmark is implied. The user authorized committing and pushing this relocation. See Git history for the release commit; Pages checks were not requested.

## Shared XR helpers — 2026-10-29

Space Race now uses shared FrameRate/refresh helpers and buttonValue trigger
pressure. Local frame-rate.mjs and xr-frame-rate.mjs remain compatibility
re-exports. Target rate remains 120 Hz, requested once after the first rendered
tracked frame without awaiting it. Simulation, audio, HUD and lifecycle stay local.

Interfaces and current consumers are documented in the
[shared library guide](../../shared/README.md). Changed entry/import queries use `shared-xr-1`. Shared source
and tests live under `shared/xr/`, `shared/performance/`, and `tests/shared/`.

Validation: full root suite (including 12 shared regressions), all ten Cloud tests,
and Scene Test Chrome WebGL integration passed. Chrome startup/module loading
passed for Surface, Space Race, Weather and Clouds; live FPS reporting passed in
the latter three.

The user subsequently reported that Quest works correctly after these shared-helper
changes on 2026-10-29. This is user headset feedback for the shared change; no
project-by-project test matrix or formal sustained frame-rate benchmark was recorded.
The user authorized committing and pushing this shared-library release on
2026-10-29. See Git history for the release commit; deployment status is verified
separately after pushing.

## Local launcher release review — 2026-10-29

Reviewed before the authorized launcher/documentation push. `Start-VR.command`
now lives in the repository root and serves its containing directory. Root launch
instructions are updated, and `.gitignore` excludes `*.blend1` backups. Space Race
runtime and settings are unchanged. Launcher shell syntax, checkout path resolution,
executable permission, ignore matching, documentation links and whitespace checks
passed; no runtime suite was rerun for this launcher/documentation-only change.

## Swarm buildless release review — 2026-10-29

Reviewed before the authorized Swarm push. Space Race runtime/settings and shared
Three.js bytes are unchanged. Swarm now consumes that canonical runtime directly
and uses native HTML controls; its obsolete Vite/lil-gui artifacts are removed.
The full root suite, ten Cloud tests, seven Swarm tests and Swarm browser checks
passed during this work. Swarm tests also passed after deleting its node_modules.
No new Space Race headset benchmark is implied.

## Shared UI release review — 2026-10-29

Reviewed before the authorized shared UI push. Space Race runtime/settings and
shared Three.js bytes are unchanged. Surface, Swarm and Weather now use common
control models/renderers; Weather supplies reusable VR sliders and selectors/tabs.
The complete root suite, 31 shared regressions, 50 Weather tests, seven Swarm tests,
ten Cloud tests and browser checks for the three UI consumers passed during this
work. Physical Quest retesting of the new UI remains outstanding.

## Scene Test Milestone 2 release review — 2026-10-29

Reviewed before the authorized Scene Test objects/materials/duplication release as required by repository guidance. Space Race runtime and shared runtime are unchanged. The complete root suite, including Space Race and 31 shared regressions, passed before publication. Existing physical-headset validation limits remain unchanged.
