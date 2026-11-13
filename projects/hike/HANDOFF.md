# The Hike — current handoff

Keep this document a current-state guide. Update the relevant section in place;
do not append release notes, tuning history or repeated test reports. Use Git
history for changes and [PROFILING.md](PROFILING.md) for the capture schema.

## State and workflow

- Release version: **v0.25.26** (raptor remains opaque at every distance; Quest review pending).
- Previous pushed version: **v0.25.25** (safe raptor placement with distance fade), commit `55fc7e6`.
- Earlier pushed version: **v0.25.21** (clear-afternoon atmosphere and gradient sky; appearance approved by user).
- Earlier pushed version: **v0.25.20** (nearby procedural rocks and terrain-matched brightness).
- Earlier audio release: **v0.24.1** (forest ambience and saved Sound checkbox; listening/Quest review pending).
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

Release checks for v0.25.26: the complete root suite passed, including all
**138 Hike tests**. Syntax, handoff links and whitespace checks passed. The user
authorized publication. Quest appearance and sustained performance remain
unverified.

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

Settings hides world roots against black while preserving head/controller tracking.
Startup explicitly sets XR foveation to **1**. Opening settings sets it to **0**
for full-resolution menu rendering. Every close path sets it back to **1**, including
session exit and Base/Summit actions; a failed save leaves the menu open at zero.
The XR manager retains this policy even without an active layer. Desktop rendering
is unaffected. Focused lifecycle tests cover disable/reenable and failed-save behavior;
Quest menu sharpness still needs headset validation:

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
- `trailhead.mjs`: selects existing low benches without changing geology. Search
  uses a 15 m grid, 500–900 m from the summit, below 35% of summit elevation
  and at least 180 m from the map boundary. Scores elevation, 15/30 m relief,
  local slope and enclosure; compares the best 32 candidates using three-lane,
  90 m summit-facing approaches, penalizing steep exits. Selection is deterministic;
  explicit start coordinates still override it. The route planner retains its
  own terrain-cost search, so the sampled exit is a suitability estimate, not
  a required route segment. Multi-seed generation/world checks and a synthetic
  pit-avoidance check pass; starting scenery and initial earthwork need Quest review.
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

`surface.mjs` keeps green terrain higher: green-to-ochre blends over normalized
altitudes .25–.46, ochre-to-brown over .45–.64 and brown-to-stone over
.61–.81 (including existing patch variation). Snow and steep-slope rock thresholds
are unchanged. Grass inherits the adjusted surface palette. Quest visual review pending.

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

## Atmospheric perspective and sky

`atmosphere.mjs` centralizes clear-afternoon defaults in `ATMOSPHERE`. One
shared shader hook wraps the existing terrain displacement, pine coverage and
shadow hooks; it also covers grass wind, rocks and the summit marker. No changes
to terrain geometry, culling, vegetation fade radii or the 650–950 m visibility
fog range. UI, loading cover, teleport indicators and shadow-only materials are
excluded. The existing single fog blend remains the final visibility boundary.

Per-fragment eye-view distance drives a smoothstep from 90–950 m, reaching
48% atmospheric color before visibility fog. Near colors are unchanged. One
blend toward pale blue-gray provides cooling, desaturation and reduced contrast.
Average camera/fragment world elevation adds at most 16% haze strength below
240 m, with no discrete layers. World height is recovered from the actual
render eye view matrix after displacement/instancing/wind; no CPU XR camera
pose, extra player transforms or per-object distance work is used.

Haze mixes lit, tone-mapped linear RGB before output encoding. The retained
visibility fog uses its original factor and blends toward the matching sky-ray
color in output space. The horizon color is shared throughout, avoiding a seam
where terrain disappears. A single fullscreen background triangle draws a
continuous horizon/mid-sky/zenith gradient without textures, depth writes or
parallax. Its inverse projection refreshes for each actual eye, including
asymmetric frusta; orientation comes from the eye view rotation. No extra render
pass, postprocessing, ray marching or per-frame geometry work is introduced.
Menus hide/restore the sky with the other world roots; graphics preparation
compiles it with the outdoor scene. Page exit releases its resources.

Local validation: 36 focused atmosphere/terrain/flora/grass/shadow/warm-up checks
pass. Chrome compiled all outdoor materials and verified loading, settings and
travel/revisit without shader, page or worker errors. Browser pixel checks confirm
exact foreground-color preservation, fog-boundary/sky equality and sky translation
invariance; a simulated two-eye ArrayCamera render invokes separate eye projections.
These are desktop checks. The user reviewed the appearance, reported that it
looks good and authorized publication. This feedback is not a formal stereo or
sustained Quest performance benchmark.

## Pine trees and shadows

`flora-placement.mjs` uses one world-aligned **4 m grid** with candidate centers
jittered independently **±1 m in X/Z**. Smooth seeded value noise with a **32 m**
lattice and **0.7 threshold** selects woodland patches before terrain queries.
The same seed produces the same forest. Existing 120 m boundary exclusion, trail
edge clearance of 3.5 m, gradual elevation/slope suitability and maximum .65 m
detailed/averaged ground difference remain. There are no ellipse clusters,
cluster-count limits, spacing searches or minimum-five-tree rule. The jittered
grid guarantees at least 2 m horizontal separation.

Output is grouped into **32 m spatial buckets solely for rendering/shadows**;
buckets never select trees or impose population rules. Grid jitter, woodland
noise, terrain thinning and appearance use independent seeded channels. Changing
bucket size preserves all tree records; raising the threshold removes candidates
without changing surviving trees' appearance. Startup reports “Planting woodland”.
Trees have no collision. At the default threshold, seeds 41729 / 1435171212 / 42
produce **71,060 / 77,048 / 96,068** trees, respectively (about 54–56% of their
previous forest counts). The full map tests 921,600 cheap grid/noise candidates;
only threshold survivors reach terrain checks. The complete root suite passed, including **118 Hike tests** and real worker
generation; syntax, references and whitespace checks pass.
The user preferred the 32 m pattern over 64 m and requested the denser 0.7
threshold; final density and loading time still need Quest review.
`surface-query.mjs` retains numeric column-map query
indices; triangle interpolation, boundary tolerances and serialized data are unchanged.

`pine-geometry.mjs` supplies three flat-shaded variants: five-sided trunks and
2/3/4 six-sided foliage cones, **44/56/68 triangles**. The two-tier model
extends the upper cone down 30% of its former height, placing its base at 32.4%
of the foliage span (formerly 48%), with the tip fixed. Its bottom cone is 8%
narrower. The upper base radius is 60% of the original bottom radius, giving
about 37% overhang beyond the lower cone at their join, similar to the other
variants. The three/four-tier profiles are unchanged. `pine-config.mjs`
keeps placement and geometry variant counts aligned. `flora.mjs` renders three
instanced batches using seeded width, height, yaw and tint. Existing appearance
ranges and the three variants are retained with the new placement system.
Existing instance RGB colors add smooth seeded 48 m patches spanning yellow-green,
olive/deep green and blue-green, with smaller per-tree hue variation. Independent
per-tree brightness spans **0.75–2.0** in linear RGB (previously 0.82–1.11),
allowing visibly lighter trees without changing the hue selection. Appearance randomness is independent of the density threshold. Generated once
in the startup worker, tints transfer as three floats/tree (~0.8 MB at 65k trees)
and reuse existing GPU color attributes. No shader, draw-call or per-frame color
calculation is added. Trunks receive the same tint pending visual review.
Local validation covers grid jitter/spacing, noise continuity, deterministic
appearance, threshold thinning, bucket independence, terrain exclusions, instance
colors, shadow membership and asynchronous generation.
Updated tree silhouettes, tint strength and trunk appearance require Quest review. All trees remain full
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

## Rocks

`rock-cells.mjs`, `rock-worker.mjs` and `rocks.mjs` provide decorative rocks
without collision or shadows. One deformed, flat-shaded 40-triangle subdivided icosahedron
is shared by one Lambert instanced batch. Each rock samples one .1–2 m base size, weighted toward
small stones, then independently enlarges each axis by 0–10% (up to 2.2 m).
This preserves the original proportions instead of creating shards. Full XYZ rotations and muted
linear gray/brown/charcoal hues remain. Rock linear luminance follows the local
`surfaceColor` with ±10% seeded variation, baked into instance colors in the
worker; face lighting still depends on rock normals. Centers sit .1×the smallest axis size below authoritative ground.
Placement uses two seeded jittered 4 m candidate grids (twice the initial
frequency), smooth 48 m density patches and
additional slope/elevation suitability; slopes above 38° are excluded. Trail
clearance includes half the largest axis size plus 1 m; the summit landing and outer
120 m map margin stay clear. Tree overlap is possible.

A dedicated worker reconstructs terrain queries once and generates batches of
at most four 16 m cells. A near-first 9×9 cell window provides prefetch beyond
the 50 m visibility radius; departing cells regenerate identically on return.
Only one job and one result may be pending; results apply during maintenance,
with stale locations discarded after movement/teleport. Worker errors disable
optional rocks without synchronous fallback. Initial rocks join the existing
startup graphics warm-up. Menus/tracking pauses stop maintenance; terrain-apply
frames defer it. Page exit terminates the worker and disposes GPU resources.

Each cell reserves 32 instance slots: hard cap **2,592 slots / 103,680 submitted
triangles per eye**, including degenerate unused slots. Cell removal/replacement
updates only affected matrix/color ranges; retained instances stay unchanged.
Reuse the pine stereo-stable coverage/dither shader with the grass distance
range: full through **40 m**, invisible at **50 m**. MSAA policy follows flora.
Matrix/color uploads join captures; rock maintenance contributes to total CPU
time, not the grass timing column. `window.hike.rocks` exposes inspection state.

Validation: six rock checks cover deterministic placement/exclusions and bounded
axis variation, terrain-relative luminance, closed 40-triangle geometry, bounded
residency/revisit identity, stale/malformed worker results and real worker parity.
The complete root suite passed, including all 125 Hike tests. Chrome v0.25.20
startup, settings hiding and distant travel/revisit checks passed without errors:
seed 41729 has 531 resident rocks initially, 534 after travel and 531 after reset.
Density, grounding on irregular banks, fade appearance and sustained performance
need Quest review; these desktop checks are not a headset benchmark.

## Circling raptor

`raptor.mjs` adds one fixed world-space bird centered at a seeded random
interpolated route point between **200 m from the start** and **200 m before the
summit**. These exclusions apply to the orbit center. Startup tries at most **32**
locations in a separate deterministic random channel, selecting the first clear
one. Trails shorter than 400 m or searches with no clear candidate keep the bird
hidden. The bird never relocates during play.

Baseline stays `world.height(center.x,center.z) + 45 m`; obstructed locations are
rejected rather than raising flight altitude. A conservative disk covers the
whole variable orbit plus a 1 m body/wing radius and 4 m terrain padding. At 1 m
spacing, both authoritative ground and the averaged render surface must remain
10 m below the lowest possible bird extent (including vertical bob). World-edge
crossings are rejected. Pine crown bounds come from actual variant geometry and
world-space tree scales; tall overlapping trees and the summit pole/pennant also
reject a candidate. The ground margin covers the small rocks and grass. This is
a conservative sampled startup check, not exact triangle collision detection;
extremely narrow unsampled terrain features remain a limitation. There are no
per-frame terrain queries, collision tests or dynamic avoidance. Distant ridges
can still obscure a valid orbit from the player's viewpoint.

`RAPTOR` centralizes flight and animation parameters: **25 m / 30 s** orbit,
±7% radius variation, ±1.5 m height variation, analytic velocity-aligned yaw/pitch
and curvature-derived inward bank (about 6°). A repeating 92 s schedule starts
2/3/2 wingbeat sequences at 18/42/69 s, with 1.25 s per beat and a smooth
zero-slope envelope back to glide. Active elapsed seconds drive motion independently
of frame rate; menus, graphics preparation and hidden/untracked frames pause it.
Reset and teleport leave its center and animation state intact.

Three meshes share one double-sided muted-brown Basic material and two reusable
geometries: compact body/head/fanned tail and mirrored, independently hinged broad
wings, **1.5 m span / 156 triangles / three draw calls per eye**. The unlit material
keeps undersides from turning pure black; normal depth, frustum culling, existing
atmospheric perspective and fog apply. The bird remains opaque at every viewer
distance, with depth testing and depth writes enabled. No bird-specific opacity
fade or distance-based hiding is applied. No shadows, textures, extra passes, per-frame
geometry changes or allocations. Existing settings root hiding and graphics
warm-up include it; page exit releases resources. `window.hike.raptor` exposes
inspection state without player controls.

Local validation: 13 focused raptor/atmosphere tests pass, covering deterministic
candidate rejection/retry, cliffs, averaged render terrain, pine crowns, summit
geometry, bounded failed searches, hidden fallback, route margins, movement and
visibility beyond the former fade range. Syntax, handoff links and whitespace
checks pass. Previous browser checks verified safe placement and settings hiding;
actual Quest appearance, stereo depth and sustained performance remain unverified.

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
- Wildlife beyond the solitary raptor, collectibles, bridges and tree collisions are unimplemented;
  route-aligned render-grid refinement remains deferred.
