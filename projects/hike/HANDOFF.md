# The Hike — current handoff

Keep this document a current-state guide. Update the relevant section in place;
do not append release notes, tuning history or repeated test reports. Use Git
history for changes and [PROFILING.md](PROFILING.md) for the capture schema.

## State and workflow

- Release version: **v0.25.2** (ground teleport/snap controls; Quest validation pending).
- Current published release: **v0.24.1** (forest ambience and saved Sound checkbox; listening/Quest review pending).
- Previous published baseline: **v0.23.1**, commit `6283bc4` (noise-hill grass and graphics warm-up).
- Buildless Three.js r180 / WebXR project in `projects/hike/`, targeting Quest 3.
  Follow [repository guidance](../../AGENTS.md) for shared modules and publication.
- Preview: serve the repository root and open `/projects/hike/`. For USB Quest
  testing, run root `Start-VR.command`; keep its terminal and cable connected.
- Startup uses a random uint32 seed. A valid, nonblank `?seed=41729` selects a
  repeatable world. Seed controls remain available if generation fails.
- `version.mjs` supplies the header/title and `hike.version`. Increment the patch
  for every completed update, including unpublished edits, so Quest testing can
  identify the latest build. Patch numbers may grow without limit; reset to zero
  when incrementing the minor version. Update the entry and version import queries
  to match, and advance affected runtime import/asset queries to prevent stale caches.
- Publish only on a new explicit request. **Do not check GitHub Pages after pushes.**
- Reverted experiments are not part of this version: pyramid tree LODs, 1–5 grass
  clumps, explicit teleport terrain refresh, automatic
  entry captures and demand-sized tree buffers. Do not accidentally restore them.

## Testing policy

Keep checks proportional to the change; the user explicitly prefers reduced testing.

- Small tuning: syntax and `git diff --check`, plus directly relevant tests when
  useful. Do not add tests that merely restate trivial tuning constants.
- Rendering/placement/worker/input changes: run the relevant regression suites.
- Before a push: run the full Hike suite once on final runtime code:
  `npm run test:hike` or `node --test projects/hike/tests/*.mjs`.
- Shared runtime/tooling changes: follow root guidance for affected consumers.
- Browser checks are for visual/integration behavior not established by tests;
  do not repeat successful checks without a new reason.
- Documentation only: content/link and whitespace checks; no runtime suite.

World fixtures live in Git-ignored `.test-cache/`, keyed by generation settings,
transitive generation-source hashes and schema/runtime compatibility. Renderer-only
edits reuse them; missing/corrupt entries rebuild atomically with locking. Fresh
world determinism and cached/fresh/query parity checks remain in the suite.
`HIKE_TEST_CACHE=off` bypasses fixtures; `HIKE_TEST_CACHE_DIR` relocates the cache.

## Controls and player state

| Context | Controls |
| --- | --- |
| Desktop | Start walking, WASD/up/down, mouse look with pointer lock, left/right turn; Space launches glide; P diagnostics; R trailhead reset; Esc releases mouse |
| Quest ground | Default: either stick forward aims teleport, release travels; either stick sideways snaps 30°. VR settings offer smooth head-relative walking and 30–120°/s turning; A/X launches glide |
| Quest flight | Right stick steers with inertia; headset pitch controls climb/dive; head yaw/roll do not steer; left-stick walking is disabled |
| Settings | B/Y opens, or saves and closes from any tab; either controller laser and trigger select |

Startup, first tracked VR entry, session exit and Reset use the trailhead, facing
up the route. Teleports place the physical head over Base/Summit, accounting for
rig rotation and physical X/Z offset exactly once. Hidden/untracked XR pauses
movement and interaction; held buttons are absorbed on resume.

VR smooth walking defaults to **2 m/s**, adjustable from **1–10 m/s** in **0.5 m/s**
steps. Desktop retains **14 m/s** for testing. Sliding begins above **35°**,
accelerates downhill and stops on gentler ground. Flight caps at **90 m/s**, with
75° maximum dive, 60°/s turn cap, .15 rescaled stick dead zone and 3/s turn response.
Banking defaults to zero. Landing preserves horizontal momentum in runout, uses
8 m/s² friction and hands off to walking when input can keep up. A fresh launch
press is required after landing.

Settings hides world roots against black while preserving head/controller tracking:

- **General:** persisted Sound (default true) and Shadows (default false). Sound
  toggles take effect immediately while editing; opening settings leaves ambience
  playing. Closing without saving restores the saved Sound preference.
- **VR:** Height offset first: 0–1.5 m, .05 m steps, default zero. Applied once
  through `heightRig`; collision/ground rig height stays independent. Teleport movement and Snap turning default on (off selects smooth); snap
  angle slider 15°/30°/45°, default 30°. With Snap turning off, the same row
  becomes a Turn speed slider: 30/60/90/120°/s, default 90°/s. Both values are
  remembered independently. Movement speed sits beneath Teleport movement,
  is disabled while teleport is on, and retains its value. Preferences persist
  through Save and Close.
  Ground only; gliding and landing runout retain their existing physics.
- **Teleport:** Base/Summit saves settings, closes the menu and queues placement.
- **Debug:** Start/Cancel 30-second capture, status, CPU/frame/GPU summary,
  Send capture to computer and Export JSON. The standalone field guide is removed.

Ground teleport uses a curved initiating-controller arc against `world.height`, with green
valid/red invalid feedback. Maximum displacement is a fixed **15 m**, measured in 3D
from the current ground position beneath the head; pointing selects the distance.
Landings outside the world or steeper than 35° are rejected. Orientation is retained;
physical head X/Z and seated height offsets are composed once. Release commits only
a valid aim. New controllers, tracking recovery, menus and flight cancel aiming and
require neutral input; snap turning likewise requires neutral between turns.
With teleport on, either stick can aim with its own controller or turn sideways.
The initiating hand owns the teleport until release; the other hand cannot take over.
Equal simultaneous turns never double speed/angle, and equal opposite turns cancel.
With teleport off, the left stick walks/strafes and only the right stick turns.
`ground-navigation.mjs` owns these policies and reuses shared Locomotion for smooth
movement and head-pivot turns. Desktop movement remains smooth.

Release validation: the full root suite passed, including **116 Hike tests**,
with physical-offset placement, pivot turns, neutral gating, slope/range rejection
and smooth fallback. Syntax/whitespace and documentation link checks passed. Arc appearance, controller feel
and comfort still require Quest validation.

Storage failure leaves Settings open for retry; session exit discards unsaved drafts.
For XR coordinate transforms, follow root AGENTS.md: use the current viewer pose
composed with the rig, not an independently world-updated internal XR camera.

## World generation and queries

`world-async.mjs` / `generation-worker.mjs` run deterministic geology, routing,
walking-surface construction, pine placement and fixed render-grid construction
in a startup worker. Typed snapshots transfer to the main thread; reconstruction
restores queries without regenerating geometry. Generation terminates on success,
failure or cancellation; there is no synchronous browser fallback. The loading
screen waits for initial terrain, pine visibility, grass preparation and the
graphics warm-up below.

- `geology.mjs`: finite **3.84 × 3.84 km** field, ±1920 m; 1025² Float32 height
  cache at 3.75 m spacing. Outer 100 m blends to the flat boundary.
- `world.mjs` defaults: seed 41729 when called directly, elevation 220 m, trail
  width 5 m, target length 1600 m. Browser startup overrides the seed randomly.
- `trail.mjs`: terrain-cost routing, loop/fold removal, 801 route points and
  ≤30% centerline grade. Explicit endpoints change routing, not geology.
- `trail-surface.mjs`: authoritative .5 × 1 m walking surface, clipped on quarter-
  metre coordinates; target planes 28°, validated below 30°. These triangles are
  for queries/collision, not a second rendered layer.
- Adaptive trail shoulders widen with earthwork. Interior bank-spike correction
  preserves tread, endpoints and open boundaries. Summit landing is a level
  3 m diameter disk with a 4 m smooth shoulder.

Core API: `world.height(x,z)`, `rawHeight`, `normal(x,z,out)`,
`trail(x,z,out,global=false)`, `route`, `start`, `summit`, `landscape`, `extent`,
`totalLength` and `samplingData`. Local route projection returns Infinity outside
its envelope; progress uses global projection twice per second. The original
route-height profile and surface data are shared through `world-snapshot.mjs`,
`route-query.mjs`, `surface-query.mjs` and `terrain-sampler.mjs`.

## Loading and graphics preparation

Startup shows an opaque loading screen with stage labels, a progress bar and
the current `APP_VERSION` in its top-right corner.
Web/XR preparation uses deep evergreen `#10251C`, warm ivory `#EEE8D5`;
web supporting text is sage `#B7C7AD`, with a shaded fern `#253E2D` progress
track and woodland gold `#D1AD62` fill.
Generation/terrain progress uses worker-reported stage fractions and a monotonic
percentage; graphics preparation switches the bar to indeterminate. Start walking and Enter VR remain disabled until initial graphics
preparation completes. `graphics-warmup.mjs` calls `compileAsync`, waits without
using the landscape programs, then submits two real landscape frames and polls
a WebGL2 GPU fence with zero timeout. No `gl.finish()` or blocking fence wait.
Mesh frustum culling is temporarily disabled so initial buffers also upload for
objects outside the current view; original flags restore on finish/cancellation.
Optional saved shadows are prepared before compilation/drawing.

First tracked XR entry repeats this gate for the actual XR render path and
coverage setting. `loading-view.mjs` draws a clip-space evergreen/text cover for both
eyes; while compiling, only its separate loading scene draws. During upload/draw
warm-up, the landscape renders underneath the final opaque cover. Head tracking
continues; locomotion, interactions, profiling and vegetation/terrain maintenance
pause. Held inputs are absorbed and frame delta resets when the gate finishes.

An eight-second frame-polled timeout, unavailable fence or failed wait releases
the gate with a diagnostic fallback/timeout status. Synchronous driver calls
cannot be preempted by that timeout. Shader readiness is strongest when the
parallel-compile extension is supported; real draws exercise the fallback path.
Completed preparation is cached per desktop/XR mode, shadows and MSAA setting;
session exit cancels unfinished work, and context restoration clears readiness.
Normal later VR entries reuse preparation; changed settings prepare again after
the settings panel closes. No teleport loading/terrain refresh was added.

Debug shows the latest graphics-preparation duration/status. `window.hike.warmup`
holds per-stage compile/render/GPU/total durations and readiness details; capture
metadata includes these records plus world-generation/preparation durations.
Existing seed recovery remains available on generation failure.

## Terrain rendering

`terrain-grid.mjs` builds one fixed indexed mesh: **150,057 vertices / 299,612
triangles**, 12,281 cells, one terrain draw per eye. Cell centers cover a 1000 m
radius. Topology and static X/Z never change.

| Region | Vertex spacing |
| --- | --- |
| Central 3×3 cells (48×48 m) | .25 m |
| Cell-center radius <64 / 120 / 200 m | .5 / 1 / 2 m |
| Radius <272 / 336 m | 4 / 8 m |
| Outer region to 1000 m | 16 m |

Shared vertices and stitched transition fans prevent interior cracks. Origin is
`floor(playerXZ/16)*16`; mesh center is origin+(8,8). The fine core spans
origin−16 to origin+32. No sampling occurs while the desired snap cell is unchanged.

`terrain-worker.mjs` samples heights/normals/colors off-thread. Only one request
is in flight; every completed result applies, then the latest desired cell is
requested, skipping intermediate requests. The old mesh stays visible while
waiting. Teleports can temporarily leave the old mesh outside the viewer's area.
No explicit teleport refresh is currently implemented; the VR loading cover is
for graphics preparation only.

`terrain-samples.mjs` reuses stable overlapping samples and refreshes the moving
blend annulus. An eight-entry LRU caches overlap source-index plans (up to ~4.8 MB).
`averaged-heightmap.mjs` caches world-aligned 16 m averages from 3×3 samples:
detailed heights through 120 m, smooth blend to 336 m, averaged heights beyond.
Normals include the blend derivative. This render-only cache grows lazily without
eviction; authoritative collision heights do not change with render resolution.

Main-thread apply bulk-copies scalar `terrainHeight`, normal and color attributes
(**4,201,596 bytes per snap**), updates origin/bounds and notifies the profiler.
CPU mesh position Y is zero: inspections must read `terrainHeight`. UVs derive
from static X/Z plus the origin uniform. Lambert lighting, surface colors/trail
tint, a 12 m repeating detail texture and radial fog at 650–950 m are retained.
Camera far plane is 1200 m. Worker failure stops rendering and opens seed recovery.

## Pine trees and shadows

`flora-placement.mjs` generates seeded clustered pines on authoritative ground,
with slope/elevation suitability, spacing, trail clearance and detailed/averaged
height agreement. Density multiplier is 11.5; seed 41729 produces about 130,000
world trees. Counts vary by seed; trees have no collision.

`pine-geometry.mjs` supplies four flat-shaded variants: five-sided trunks and
3–5 six-sided foliage cones, **56/68/80/56 triangles**. `flora.mjs` renders four
instanced batches using varied width, height, yaw and tint. All trees remain full
geometry: full contribution through **450 m**, fade to invisible at **500 m**.
CPU membership prefetches to 516 m and retains existing members to 524 m.
World-root distance and stable MSAA coverage/dither are shared between XR eyes.

Persistent ID/slot maps preserve unchanged matrices/colors; removal swaps the
last member into its slot. Visibility work uses a .75 ms soft budget, checked
every 64 items, with 2,048 items/frame; large moves replace unfinished passes.
Conservative bounds avoid full instance scans. Terrain-apply frames defer tree
work. `update(viewer,true)` is a synchronous test/inspection adapter only.

`pine-shadows.mjs` respects saved Shadows. One **2048²** directional map covers
receivers through 200 m, full strength to **180 m**, fading to zero at **200 m**.
Coverage is elevation-aware and texel-aligned. Separate shadow-only instances
use the detailed pine variants without duplicate eye-pass geometry. Membership
refreshes after 2 m movement; retained slots avoid recomposing unchanged trees.
Map rendering updates only for camera/caster changes. Receivers outside the
shadow range skip sampling. Disabling retains resources for reuse. Grass neither
casts nor receives shadows.

## Grass placement, maintenance and wind

`field-cells.mjs`: 8 m cells with **1,500 jittered candidates/cell** (30×50).
Seeded smooth value noise on an 8 m world lattice replaces elliptical clumps.
Each cell hashes four shared corners once, then interpolates per candidate;
neighboring cells match continuously at their edges. Noise ≤.45 is bald; density fills in smoothly over .45–.55.
Height rises smoothly from zero at .45 noise to 1.28 m at .9,
with .85–1 independent variation; width .016–.035 m,
random yaw. Noise/edge rejection precedes terrain queries. Exclude path/landing,
slopes >30°, snow line (`SNOW_LINE=.82` with surface patch variation), high rocky
ground and world edges. Color starts from `surfaceColor`, then shifts hue by up to ±30° using a
separate smooth 32 m world-aligned noise lattice (four hashes per cell).
Hue patches cross cell boundaries continuously, independently of height/density.
Hue rotation preserves RGB extrema/HSL lightness and saturation; existing seeded
brightness variation remains. Colors bake in the worker into the existing RGB
attribute, with no new shader work, attributes, draw calls or per-frame sampling.
1,500 is the candidate budget before noise and terrain exclusions, not guaranteed
accepted blades. No runtime noise texture or additional shader work is used.

`triangle-field.mjs` uses one InstancedBufferGeometry and one triangle/blade.
A 15×15 cell window allocates **337,500 blades**, the fixed hard cap
(13.5 MB of root/shape/color attributes per CPU/GPU copy).
Accepted blades are densely packed; empty cells remain cached but draw no blades.
Root/shape/color attributes replace full matrices. Full visibility through
**40 m**, fade to invisible at **50 m**, with root clipping before rasterization.

`field-worker.mjs` generates cells from a cloned query snapshot; one job of at
most four cells and one completed result can be pending. Transfer buffers recycle.
Main-thread updates validate/apply results, maintain packed owners and upload
changed 128-instance blocks. Departing cells retire at most two/frame with a
.35 ms soft budget; one cell can exceed it. Moves replan near-first; distant
teleports clear directly. Work defers on terrain-apply frames and inactive/menu
frames. Worker failure disables optional grass without a synchronous fallback.

Wind is entirely in the existing vertex shader, driven by one frame-time uniform:

- Broad ~79 m waves travel continuously at ~8.75 m/s along world direction (.8,.6),
  with a slower crosswind sine warping their fronts. No global timed gust pauses.
- Curve `wave*(.75+.25*wave)` gives **40% forward / 20% reverse** peak displacement.
  Existing yaw varies response **50–100%**: actual peaks 20–40% / 10–20% of height.
- Bases stay fixed. Tips move horizontally and lower by
  `sqrt(height²-offset²)`, approximately preserving length with the original lean.
  Motion crosses upright smoothly without clipped peaks or holds.
- Two sine evaluations per in-range tip. Wind adds no per-frame allocations,
  per-blade CPU work, buffer writes, attributes, geometry, draw calls or textures.
  Fade dithering stays anchored to undeformed geometry.

## Forest ambience

`forest-audio.mjs` adds a non-positional stereo bed. General Settings has a
persisted **Sound** checkbox (default on, including older saved settings).
Edits apply immediately; Save and Close persists them. Disabling uses the existing
fade/stop/suspend path; enabling resumes with retained buffers. Start walking,
Enter VR and existing controller/desktop gestures unlock Web Audio. Sound plays
during visible/tracked gameplay, including settings, desktop diagnostics
and graphics warm-up; opening menus does not interrupt it. Session exit stops it; a new gesture/VR entry restarts it.
Page exit aborts downloads and disposes nodes, buffers, timers and the context.

Five non-overlapping 20-second wind/vegetation clips from bruno.auzet's CC0
recording are bundled in `assets/hike/audio/`: stereo 32 kHz Vorbis, plus MP3
fallback. Four static cuts are attenuated and one boosted, all within ±3 dB,
toward −23 LUFS. Two gain lanes alternate random clips without immediate repeats,
with five-second equal-power gain automation. A five-second timer schedules
60 seconds ahead, independently of rendering. Buffers/lanes/fade curves reuse;
one-shot source nodes are renewed and released after playback. Requested 32 kHz
decoded memory is 25.6 MB. Master gain is .35. No positional transforms, per-frame
audio buffers, music or procedural wind coupling are added.

The original WAV requires login, so clips use the source's public HQ MP3 preview.
Waveform/spectral selection is complete; **auditory review is still pending**.
Minimal bird/handling noise, natural event cuts, perceived crossfade quality and
extended Quest playback require listening/headset confirmation. See [AUDIO.md](AUDIO.md)
for architecture/activation/limits and [asset notes](../../assets/hike/audio/README.md)
for timestamps, provenance, formats, measurements and the reproducible FFmpeg tool.

## Profiling, validation and known limits

Sound setting validation: **13 focused settings/audio tests pass**; Chrome
verified checkbox mute/unmute and persistence after reload without page errors.

Release validation: the full root suite passed, including **108 Hike tests**.
Documentation links, syntax and `git diff --check` pass. Publication is user-authorized;
auditory/extended Quest acceptance remains pending.

Audio validation: **8 audio tests pass**, including a simulated two-hour
schedule, equal-power/no-repeat behavior, bounded nodes, loading/fallback races,
rapid stop/restart, XR bindings and asset hashes. Chrome verified five Vorbis decodes at 32 kHz /
25.6 MB, a 150-second native offline render with stereo, nonzero audio and no
clipping, plus a 65-second live run with nine scheduled clips, no late recoveries
and no browser errors. All five MP3 fallbacks decoded as stereo/20 seconds;
final native stop/restart/rapid-restart/disposal checks also passed.
These are desktop/simulated checks, not an audible-quality
or sustained Quest benchmark.

Use Debug's manual **30-second active-gameplay capture**. Settings, lost tracking
and mode changes pause it. Completion builds JSON in a worker, retains the latest
capture in headset IndexedDB and uploads through the local receiver. Retry with
Send capture to computer; Export JSON downloads to the device running the browser.
The local receiver writes Git-ignored `.captures/hike/` files on this Mac.
See [profiling instructions/schema](PROFILING.md) and
[shared capture server contract](../../tools/vr-server.md).

CPU timings measure application work, including driver submission; terrain apply
is separate. Estimated uploads are bytes, not transfer latency. Callback cadence
is not compositor dropped-frame count. GPU timing uses optional asynchronous
disjoint queries every fourth frame; Quest captures so far lack that extension.
Device-side OVR Metrics remains an option, deferred until needed. No automatic
entry capture is currently enabled.

Published v0.23.1 validation: the full root suite passed, including **100 Hike tests**;
syntax, documentation links and `git diff --check` passed. Focused checks cover hue limits/wrapping,
saturation/lightness, continuous cell edges, placement/worker parity, loading
completion, GPU-fence fallback/timeout and cancellation. A 100-cell comparison
preserved exact roots, shapes and counts when adding hue variation. Chrome
verified generation progress, the forest palette, preparation completion with
shadows on/off and no page/worker errors. Simulated XR app-routing checks verified
the cover, frozen movement/maintenance, completion, repeat-entry reuse and
cancellation; these do not establish actual stereo or headset behavior.
The user reported that the final version works well and authorized publication.
Sustained Quest performance is not formally benchmarked.

For seed 41729's 225-cell trailhead window, the denser field has 90,372 blades
versus 76,450 for the 750-candidate field. Five warmed desktop passes measured
median generation of 739 versus 592 ms before adding hue variation; this is
worker generation cost, not a Quest frame-time benchmark. Bald coverage offsets
much, but not all, of the density increase. The larger fixed allocation covers
worst-case dense windows without truncating cells.

Remaining limits and investigation context:

- Terrain snaps can visibly pop; fixed-grid interpolation approximates clipped
  walking surfaces. Near-tread tests allow <8 cm error, with larger deviations
  possible at sharp banks/coarse distances. Worker latency remains significant.
- Seed coverage is finite; broad/open-boundary bank spikes and large earthworks
  remain possible. Trail length is a target, not a guarantee.
- Unpublished LOD/density/loading experiments were rolled back after a seed-
  dependent VR hitch. On seed 1435171212, a diagnostic capture showed ~10 Hz
  callbacks for ~5 s while measured CPU stayed low; cause was not established.
  Avoid attributing that to GPU or grass maintenance without further evidence.
- Wildlife, collectibles, bridges and tree collisions are unimplemented;
  route-aligned render-grid refinement remains deferred.
