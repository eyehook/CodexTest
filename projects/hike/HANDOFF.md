# The Hike — single snapped terrain grid

## Testing policy — reduced iteration checks

User preference, agreed 2026-11-11: keep checks proportional to the change.
Do not run the full Hike suite after every small edit.

- Simple tuning (height, density, color, spawn): syntax and diff checks, plus
  directly affected tests where useful. Avoid new tests for trivial reversible
  tuning unless they protect a meaningful constraint.
- Placement or rendering changes: focused grass, terrain or shadow tests.
- Worker, input or structural changes: the relevant regression suites.
- Before a push: run the full Hike suite once on the final code.
- Shared runtime changes: follow root AGENTS.md requirements for broader
  repository and affected-consumer checks.
- Browser checks: reserve for visual changes or integration behavior that
  automated tests cannot establish. Do not repeat successful checks unless new
  changes, failures or unresolved concerns justify it.
- Documentation-only edits: check content/links as applicable and run
  `git diff --check`; no runtime tests.

## State and preview

Buildless entry: `projects/hike/`. Serve the repository root with
`python3 -m http.server 8080 --bind 127.0.0.1`, then open `/projects/hike/`.
Quest USB testing uses root `Start-VR.command`. Runtime dependencies are local.

Release version: **v0.18.1**, with tabbed Settings, Base/Summit teleport
and optional nearby pine shadows. The expensive grass patches are removed; an experimental, capped single-triangle
surface field replaces them.
B/Y open Settings or Save and Close it. The standalone VR Field Notes panel is
removed; its controls/readouts are on Debug. General controls the persisted
Shadows setting (default off). All **85 Hike tests pass**; syntax and whitespace checks
pass. Chrome simulated XR checks pass for B/Y transitions and both endpoint
teleports with physical offsets, with no page errors. The user reported “Better”
after worker-backed grass generation and authorized GitHub publication on
2026-11-11. This is user feedback, not a formal Quest CPU/GPU benchmark.
Historical local/unpublished notes below are superseded by this release review.

Previous release: **v0.10.2**, with thumbstick flight steering, angular inertia
and summit spawn. The user accepted the current behavior and authorized GitHub
publication on 2026-11-11. All **69 Hike tests pass** on the final code; app syntax
and `git diff --check` pass. Previous release: v0.8.2, commit `10fd2a6`.

Final defaults: **90 m/s** total glide speed cap, **75-degree** maximum dive,
**60 deg/s** flight turn cap, stick dead zone 0.15 with rescaling, and turn
response 3/s (about 95% angular deceleration after one second of release).
Right stick steers; head pitch controls climb/descent; head yaw/roll do not steer.
Desktop arrow keys turn in flight. Banking is disabled by default; climb
deceleration remains halved, and landing friction is 8 m/s² with movement-speed
handoff. Ground turning remains 90 deg/s. Startup, XR entry and Reset use the trailhead facing up the trail.
Formal sustained Quest profiling remains unrecorded. Sections below retain
implementation history; these release settings take precedence.

Previous published baseline: **v0.6.0**, commit `ddad67f` (2026-11-11), with dense all-3D pine forests,
a 450–500 m distance fade and incremental vegetation updates. The user reported
“Performance is good” and authorized pushing this release on 2026-11-11. This is
user test feedback, not a formal standalone Quest frame-time benchmark. Previous
published baseline: `0083fbc` / v0.4.0. Wildlife, collectibles, bridges and tree
collisions remain unimplemented.

## Controls and gameplay

- Desktop: Start walking, WASD / up/down arrows, mouse look after clicking the
  world, left/right arrows turn. Space launches gliding; mouse look steers flight.
  Esc releases mouse, P toggles diagnostics, R resets.
- Quest: left stick walks relative to horizontal headset heading; right stick
  turns smoothly at 90°/s about the physical headset. B/Y opens black-background
  Settings or saves and closes it. Both controller lasers use trigger selection.
  Left tabs select General, Teleport or Debug; Teleport returns to Base/Summit.
  A/X launches gliding. In flight, right stick steers with inertia and headset
  pitch controls climb/dive; left-stick walking is disabled.
  Landing restores walking. A fresh press is required for another launch.
- Testing speed is **14 m/s**, ten times normal walking. Desktop/VR share the same
  0.7–30 m/s range and 0.1 m/s step.
- Above **35°**, downhill sliding starts at 1.15× walking speed, accelerates, and
  caps at max(6 m/s, 1.5× walking speed). Walking/turning still work. Short steps
  stop sliding on gentler ground; reset clears slide state.
- Hidden/untracked XR pauses navigation and rays; held toggles are absorbed on
  resume. The physical viewer pose is composed with the rig exactly once, after
  movement/turning/sliding. Ground height is queried under the headset's world X/Z.
- Reset uses the trailhead facing up the trail. Summit line of sight from the low
  trailhead is not required. The destination flag remains; its text label is removed.

## Authoritative world, independent of the renderer

`geology.mjs` generates the same **3.84 × 3.84 km** field (±1920 m), using seeded,
warped ridge families, broad uplift, drainage, hydraulic sediment transport and
five talus passes. Its 1025×1025 Float32 cache has **3.75 m spacing**, about 4 MiB.
The outer 100 m blends to a 20 m boundary; beyond the field the height is flat.
The original global minimum/maximum determine the default start/destination.
There are no separately placed background mountains or travel-driven geology.

`createWorld({seed,elevation,trailWidth,targetLength,start?,end?})` defaults to seed
41729, elevation 220, width 5 m and target length 1600 m. Explicit endpoints are
world `{x,z}` inside ±1920 m and do not regenerate geology. Target length supports
200–5000 m; width supports 3–10 m. One seed determines all generation.

`trail.mjs` uses terrain-cost A*, slope/descent penalties and scenic passes, with
an optional 4 m navigation retry instead of the usual 8 m grid. It removes loops
and width-conflicting folds, rounds/resamples to 801 points and limits centerline
grade to 30%. The trail is carved into the ground with overlapping adaptive shoulders (minimum
9 m; deeper cut/fill widens the affected ground).
Length is a target, not an exact guarantee. Default hiking time is about 19 minutes
at 1.4 m/s. Some approaches need substantial cut/fill; seed 1 reaches about 35.13 m.
The regression allowance is 36 m, without relaxing walking slope limits.

A **3 m diameter level destination** is prepared before routing, with a 4 m
smoothstep shoulder. Elevation engineering reserves a level final approach. CPU
walking triangles touching the destination disk are fixed at its original height;
the flat triangle edge can extend slightly past the disk. This is unchanged by
the new renderer.

`trail-surface.mjs` still creates the canonical **0.5 × 1 m CPU walking surface**,
using quarter-metre clipping coordinates, bundled Clipper and Three.js Earcut.
These triangles are used for collision, height queries and slope validation,
**not as an additional rendered mesh**. The solver targets 28° walking planes and
validates below 30°. Isolated interior bank peaks are lowered to the inverse-distance
mean of their neighbors; tread vertices, endpoints and the patch perimeter stay
fixed. That correction does not handle all broad ridges or open-boundary spikes.

The old renderer's tile-edge maps and render-patch metadata are no longer retained.
The CPU surface keeps the triangles and lookup data needed for authoritative
queries. The seeded geology, route, CPU vertices and walking indices were compared
against the published version for seeds 41729, 1 and 3307485663 and were identical.

### Query API

- `world.height(x,z)`: finished ground, including trail, bank corrections and landing.
- `world.rawHeight(x,z)`: original geology before those modifications.
- `world.normal(x,z,out)`: authoritative surface normal and slope in degrees.
- `world.trail(x,z,out,global=false)`: distance, tread height and along-route distance.
  Local projection returns Infinity outside its envelope; diagnostics use global
  projection twice per second. Progress is nearest-route projection, not checkpoints.
- `world.route`, `start`, `summit`, `landscape` (`mountain` alias), `landmarks`,
  `sections`, `extent`, `boundaryHeight`, `totalLength`, `maxGrade`, `maxEarthwork`.
- `world.samplingData`: serializable references to the existing cache, original
  route-height profile and CPU surface query data; no regenerated world.

`route-query.mjs` and `surface-query.mjs` share projection and surface queries
between gameplay and the worker. `terrain-sampler.mjs` reconstructs the remaining
read-only heightfield/carving queries from that snapshot; parity tests compare
heights, normals and route distances, including outside the generated field.

## Replacement renderer: one fixed BufferGeometry

`terrain-grid.mjs` constructs **one indexed grid** of **12,281 square 16 m cells**.
Cell centers within a 1000 m radius are included; the outline is a staircase-like
circle. This is the current rendered window, not the size of the underlying world.
The grid has **150,057 vertices / 299,612 triangles**, including transition stitching
(293,440 triangles before stitching). One `Terrain.mesh`, one material and one draw
call render the terrain. `tile-mesh.mjs`, persistent tile meshes, LOD index patterns
and the separate outer ground mesh have been removed.

| Region | Subdivisions per 16 m cell | Spacing | Outer cell-center radius |
| --- | --- | --- | --- |
| Central 3×3 cells | 64×64 | 0.25 m | Fixed 48×48 m square |
| Band 1 | 32×32 | 0.5 m | 64 m |
| Band 2 | 16×16 | 1 m | 120 m |
| Band 3 | 8×8 | 2 m | 200 m |
| Band 4 | 4×4 | 4 m | 272 m |
| Band 5 | 2×2 | 8 m | 336 m |
| Outer terrain | 1×1 | 16 m | 1000 m coverage |

The center always uses full resolution. Other cells use the fixed thresholds in
`RESOLUTION_BANDS`, selecting the first radius strictly greater than cell-center
distance. Bands remain square-grid approximations of circles. Their widths now
vary to spend the 300,000-triangle budget in the near/mid field; stitching is
included in that budget. Compared with `79ba73c`, 0.5 m detail extends from 56 to
64 m, 1 m from 88 to 120 m, 2 m from 120 to 200 m, 4 m from 152 to 272 m, and 8 m
from 184 to 336 m. The central core, snapping and world generation are unchanged.

Every matching quarter-metre point shares an index. Only coarse boundary quads
need center fans, subdividing each edge to match the finer neighbor. A single
polygon ring handles all four sides, including corners with multiple refined
neighbors. All projected triangle areas sum to the included cells exactly once;
every interior edge has two incident triangles. Index buffer, vertex count and
connectivity never change after construction.

## Snapping, sampling and continuity

The desired origin is `(floor(playerX/16)*16, floor(playerZ/16)*16)`, including
negative coordinates and multi-cell moves. The central cell starts at that origin;
the grid center is 8 m farther in X/Z. The 48×48 m fine region spans origin−16 to
origin+32 on each axis. There is no continuous movement or height resampling while
the player stays within the same snap cell.

`terrain-samples.mjs` fills reusable height/normal/color arrays using the existing
CPU height function. Samples shared with the prior origin are copied in stable detailed/distant regions;
the moving blend annulus is refreshed from retained detailed source data. Before
averaging, a cardinal snap sampled 19,506 new points instead of all 150,057.
Collision heights never change according to resolution; distant render heights
now use the averaged cache described below. World-space normals and
UVs, nested spacings and consistent diagonals keep common points and lighting
stable. The fine core keeps the nearest resolution transition away from the player.
Coarser triangle interpolation can still pop at a snap; no temporal geomorphing or
per-frame vertex animation is used.

Profiling found synchronous snaps too expensive, so browsers use
`terrain-worker.mjs`. It receives one read-only world snapshot and samples only on
snap requests. There is no erosion, pathfinding or clipping in the worker. The
transfer buffer is returned/reused; the worker keeps one previous-sample buffer.
Only one job is in flight. Every completed result is applied, then a new job
targets the latest desired origin, skipping intermediate requests. A completed
grid can briefly represent an earlier position while the next job catches up.

A snap is **committed atomically when its worker result is ready**. The existing
position, normal, color and UV buffers are updated in place; index data is untouched.
The mesh moves once to the requested world-aligned origin. Bounds use the new
height extent and the fixed horizontal footprint. The terrain update in the main render loop only
checks the snap cell; it performs no mesh-height sampling, reconstruction or
interpolation. Gameplay still queries the ground for player collision.

There is worker latency after crossing a cell boundary. The prior grid remains
stationary and visible until a completed result arrives, even outside its fine
core. Completed grids are applied even when the player has requested a newer
cell; the worker then samples the latest desired origin. This prevents repeated
result discards and deliberate whole-terrain hiding during walking. Ground can
briefly be coarser than the collision surface outside the old fine core; a distant
teleport can leave the old grid outside the viewer's area until sampling completes.
Startup awaits the first result behind the existing loading card. Worker failures
stop the render loop and open seed-recovery diagnostics. Node tests use a
synchronous adapter for the same sampling implementation; browsers use the worker.

The world snapshot is cloned once into the worker; this deliberately duplicates CPU
query data to keep sampling off the render thread. There is only one rendered
geometry, with no duplicated terrain layer. Disposal terminates the worker and
releases the geometry, material and texture.

## Styling and diagnostics

Lambert lighting, slope/elevation vertex colors, trail tint and the 256×256
mipmapped grayscale texture (12 m repeat) are retained. No shadows, triplanar layers,
normal maps or postprocessing were introduced. Steep slopes can stretch the texture.
Radial fog starts at 650 m and now ends at **950 m**, hiding the stepped boundary
even while waiting for a snap within the old fine core. Camera far plane remains
1200 m. This is the only atmospheric change needed for the smaller rendered window.

The obsolete radius/quality/LOD-band controls are removed from both desktop and VR.
Shared controls still expose speed, slide threshold and reset. Readouts now include
FPS, submitted triangles, snap apply CPU time, worker sampling time, end-to-end snap
latency, generation time, terrain vertex count, completed snaps, elevation and
remaining route distance. FPS is application cadence, not GPU/compositor time.

The centered loading card reads “Shaping the mountain...” / “Please wait a moment.”
P/footer diagnostics and manual/random seed recovery are initialized before world
generation. `?seed=...` selects the world; failures keep recovery controls available.

## Validation and remaining limits

Run `npm run test:hike` or `node --test projects/hike/tests/*.mjs`.
On 2026-11-11, **all 26 Hike tests passed**. Chrome also passed walking/reset,
negative snaps, rapid multi-cell requests, unchanged buffers between snaps,
responsive diagnostics and forced worker-failure recovery. Trailhead, midpoint,
summit and mobile diagnostic screenshots were reviewed. Local module links and
`git diff --check` passed.
The renderer tests now verify resolution distribution/counts, 2 km coverage,
shared indices and winding, exact projected coverage, manifold transition edges,
negative/diagonal/multi-cell snapping, no updates within a cell, persistent buffers,
unchanged shared samples, bounds, stale worker results, failure/disposal, worker
query parity and near-player trail/landing alignment. Existing generation,
route-grade, seed, sliding and XR transform tests remain.

The regular rendered grid samples the authoritative CPU surface; it no longer
copies its clipped walking triangles. Vertex heights match exactly (Float32
rounding aside), while between-vertex interpolation is an approximation. A default
route regression checks near-tread errors below 8 cm at nine route locations.
Coarse distant terrain and very sharp banks may deviate more. Collision behavior
is unchanged; exact coincidence of arbitrary clipped edges and a fixed square-grid
triangulation is not guaranteed.

Chrome checks observed 0.4–2.0 ms main-thread apply times and roughly 49–73 ms worker
sampling for eight cardinal snaps after startup. Observed frame intervals were
about 16.7 ms median, 17.3 ms maximum in that short desktop run. The terrain submitted
299,612 triangles in one draw call. These are desktop observations, not a standalone
Quest benchmark. GPU buffer-upload cost, stereo rendering, sustained FPS, worker
latency under headset load and perceptibility of snapping still need Quest checks.
The one mesh submits its full triangle count; there is no tile-level frustum culling.

Browser world generation and fixed topology now run in a dedicated startup
worker; the synchronous generator remains available for tests/tools. Earlier
routing/drainage optimizations are retained. Other remaining limits: steep banks/large earthworks,
finite seed coverage, possible unhandled inside-turn spikes, and no bridges.
Route-aligned trail-grid refinement remains explicitly deferred. New renderer
cache versions are advanced for the 300k experiment. This release includes the tuning; Quest validation remains outstanding.


### Near/mid snap comparison — 2026-11-11

An offline comparison used the actual indexed triangles of `79ba73c` and the
new layout, with the unchanged default world. It measured absolute interpolated
height differences before/after 16 m cardinal and diagonal snaps: eight directions,
five route locations (indices 0, 200, 400, 600, 800), and points on an offset 8 m
sampling grid 32–200 m from the mesh center. There were 76,640 comparisons.

| Geometric change on snap | 205k baseline | 300k layout |
| --- | --- | --- |
| Mean absolute height change | 10.61 cm | 0.52 cm |
| RMS height change | 54.10 cm | 2.05 cm |
| Maximum sampled change | 12.18 m | 0.61 m |

The mean reduction is about 95% **within this sampled range and seed**, not a
claim of 95% less perceptible popping everywhere. Coarser transitions now happen
farther away; steep banks can still pop, and this is not temporal geomorphing.
The final layout favors a broader 2–4 m region over spending nearly all extra
triangles on the closest half-metre band. It uses about 46% more triangles than
the published grid, so Quest GPU cost needs checking despite low desktop snap
apply times. All 26 Hike tests passed, including the budget ceiling and seam
checks. Chrome rendered the new counts with no errors; eight snaps and
trailhead/midpoint/summit views were checked.


### Cached mountains for automated tests — 2026-11-11

Generation and renderer tests now reuse serialized CPU worlds in the Git-ignored
`projects/hike/.test-cache/` directory. Fixtures include the heightfield, route,
corrected walking surface and spatial query data. This is test-only; startup in
the browser and on Quest is unchanged.

Each fixture is keyed by generation settings and seed. Its version hashes
`world.mjs` and its transitive local imports, including vendored dependencies,
plus a fixture schema and runtime compatibility identifiers. Generation source
changes rebuild fixtures on their next use; renderer-only changes reuse them.
Missing or corrupt entries rebuild automatically. Atomic writes and per-fixture
locks prevent concurrent tests from consuming partial files. The current sample
cache occupies approximately 94 MB and is not committed.

Two fresh default worlds still run on every full test pass for determinism.
Fresh-versus-cached parity checks compare terrain, routes, surface geometry and
height/normal/trail queries; worker query parity also uses a freshly generated
world. Cache unit tests cover invalidation, settings, concurrency and corruption.
All 31 tests passed with the warm cache in 6.93 seconds on this desktop,
versus 26.09 seconds with caching disabled (also 31 passing): about 73% less
elapsed time, or 3.8× faster.

Use `HIKE_TEST_CACHE=off npm run test:hike` to bypass world fixtures, or
`HIKE_TEST_CACHE_DIR=/some/path npm run test:hike` to choose another cache
directory. Deleting `.test-cache/` forces a cold rebuild. This release includes the test cache and the 300k renderer experiment.
Generated cache files remain local and excluded from Git.


### Adaptive trail banks — local change, 2026-11-11

`bank-height.mjs` replaces the fixed-width nearest-route shoulder with a shared
CPU/worker bank query. Each route segment has a minimum 9 m shoulder, widened to
five times its maximum sampled cut/fill depth (endpoints and midpoint). Spatial
buckets bound candidate searches. Outside the tread, inverse-square edge-distance
weights blend all nearby segment elevations with the prepared geology. Influence
and its first derivative vanish at each outer shoulder; influence approaches the
segment height at the tread. This removes nearest-leg elevation jumps between
separated switchback treads and spreads deep earthworks over more ground.

Routing, tread constraints, destination preparation and the rendered grid are
unchanged. Existing narrow clipped-bank peak cleanup remains. Both gameplay and
the terrain worker use the same shaping function; cache versions are advanced.
Generation fixtures invalidate automatically because the new module is a world
import. Wider banks modify more of the mountain and increase query work; no
universal bank slope cap is claimed. Closely spaced treads at different heights
can still require a steep connecting slope. Route spacing/rerouting was not
changed, and broad bank shaping does not eliminate every clipped-patch artifact.

Validation: all 33 Hike tests passed in 22.56 seconds, including new synthetic
checks for a 30 m deep cut, continuous tread joins, outer shoulder return and
continuity across a switchback nearest-leg boundary. Existing multi-seed walking
slopes, landing, near-tread rendered alignment and fresh-world worker parity
checks passed. `git diff --check` passed. No browser visual review or Quest test
has been performed by the agent for this change. The user tested the change,
reported “Much better,” and authorized publication on 2026-11-11. Formal Quest
performance measurements remain outstanding. This release includes adaptive banks.


### Visible terrain catch-up — local change, 2026-11-11

The user reported a roughly half-second terrain disappearance during ascent.
Code inspection found an explicit hide outside the last committed 48 m core;
this is a plausible cause, not a measured headset diagnosis or GC finding.
At the user's request, `terrain.mjs` now retains the old mesh visibility while
sampling and applies every completed result before requesting the latest cell.
Only one job remains in flight and pending destinations are still coalesced.
Startup, failure and disposal behavior remain guarded. Latency uses the applied
job's request timestamp, rather than a newer pending destination's timestamp.
Entry/import cache versions are advanced. Regression coverage checks delayed
startup, visible old terrain outside the core, intermediate-result application,
latest-cell catch-up without input, returning to a prior cell and disposal.
Validation: all 33 Hike tests passed in 7.07 seconds with warm fixtures;
`git diff --check` passed. The user reported that this appears to fix the
disappearance and authorized pushing to GitHub on 2026-11-11. This release
includes visible terrain catch-up; formal headset performance profiling remains
outstanding.


### Averaged distant render heightmap — v0.4.0, 2026-11-11

`averaged-heightmap.mjs` adds a render-only cache over the existing finished
`world.height`, including trail banks and the landing. World/trail generation,
collision, sliding and authoritative queries are unchanged. All 299,612 triangles,
150,057 vertices, current resolution bands, stitched indices and the one draw call
remain unchanged. The older two-cell band widths in the request were not restored,
as doing so would change the current triangle budget.

`AVERAGED_TERRAIN` exposes 16 m spacing, a 16×16 m footprint, 3×3 deterministic
stratified samples (supports 4×4), and blend distances. Float32 averages sit on
fixed world multiples of 16 m and are bilinearly interpolated. Numeric column/tile
lookups store 16×16-node arrays plus ready flags; each node is generated only once.
Initial sampling fills the rendered footprint and its normal/interpolation halo;
new world regions are cached lazily in the worker. There is no per-frame work or
full cache regeneration at snaps. Initial coverage used 12,883 nodes / 85,760 bytes
of tile arrays; eight cardinal snaps grew this to 13,999 nodes / 90,880 bytes in
an offline start-area run. Maps/objects add overhead beyond these array sizes.
There is no eviction, so exploring new regions grows the cache until disposal.

Detailed heights remain exact within 120 m of mesh center (origin+8 in X/Z).
Smoothstep blends from 120 to **336 m**, then uses only averaged heights. The
suggested 184 m outer distance caused large sampled snap changes, so the wider
blend was selected. Normals blend detailed and averaged gradients, including the
radial weight derivative. Bilinear heightmap grid lines can still change gradient;
finite differences across 0.7 m soften those changes. No per-frame morphing is used.

`TerrainSamples` reuses stable detailed/distant values, recalculating shared blend
vertices instead of incorrectly copying center-dependent heights. Two compact
annulus-only source arrays retain detailed heights/normals for subsequent snaps;
region/slot arrays avoid repeated classifications. These arrays total about
1.74 MB for the current grid. Float32 retained sources can cause tiny roundoff
changes (tests allow 0.02 mm). Colors use rendered elevations/normals. Mesh buffers,
bounds updates, worker transfer reuse and visible completed-result catch-up stay
in place. Worker results expose `heightmapNodes`/`heightmapBytes` through Terrain
for inspection; existing sampling/apply timings remain. Cache versions advanced.

Validation: all 40 Hike tests pass, covering deterministic averages, negative/tile
coordinates, cache reuse/growth, attenuation of high-frequency detail, untouched
near heights, zero detailed evaluations for warmed distant queries, blend-boundary
continuity, gradient correctness and shared-vertex refresh. Existing generation,
collision/landing, topology, worker and near-tread alignment tests pass. Chrome
reviewed trailhead and same-camera direct-versus-averaged midpoint screenshots;
distant jagged silhouettes were softened with no visible cracks in those views.
Chrome reported no errors, one terrain draw, persistent buffers and no hidden
terrain during pending snaps. These checks do not establish Quest performance.

Run `node projects/hike/tools/measure-averaged.mjs [seed]` for reproducible offline
startup/cardinal snap timings, cache sizes and geometric snap probes. A desktop
run observed direct versus averaged startup sampling of 460 / 500 ms; warm snap
means of 72 / 88 ms. Thus this is **not yet an overall sampling speedup**, despite
avoiding detailed height queries in warmed distant regions. Chrome's isolated
midpoint worker snaps took 70–89 ms; applies were usually 0.3–1.1 ms with one
15.9 ms outlier. Main-thread uploads and sustained Quest costs remain unmeasured.

At five default-route locations, 50,520 comparisons of fixed world points 96–208 m
from mesh center over six cardinal/diagonal snap directions found mean blend-only
height changes of 6.2 cm, 95th percentile 26.0 cm and maximum 2.08 m with the wider
blend. The initial 120–184 m version measured 15.0 cm / 74.2 cm / 6.25 m. These
probes exclude interpolation/topology popping and do not cover all seeds or the
whole blend range. Sharp ravines/banks still permit visible snap movement and
averaging can flatten peaks or fill valleys; no claim of movement-free snapping
is made. Quest appearance, actual sustained latency and acceptable smoothing need
user testing. This enhancement is included in the v0.4.0 release.


### Version, loading progress and asynchronous startup — v0.4.0

`version.mjs` defines `APP_VERSION` (currently **0.4.0**), displayed in the page
header and document title and available as `hike.version`. Advance it together
with entry/import cache versions when shipping a new version.

`app.mjs` now awaits `createWorldAsync` from `world-async.mjs`. Its dedicated module
worker runs the unchanged deterministic generation algorithms: geology/erosion,
routing, carving/slope correction, validation and fixed terrain-grid construction.
`world.mjs`/`geology.mjs` accept optional progress callbacks without changing RNG
or numerical ordering. The worker sends stage updates, then a plain world
snapshot. Geology and grid typed-array buffers are transferred once rather than
copied. The worker terminates after success, errors or cancellation. Page exit
aborts generation; worker failures retain the existing seed/random recovery UI.
There is deliberately no synchronous browser fallback that would freeze the UI.

`world-snapshot.mjs` promotes the already-tested fixture serialization/restoration
format to runtime use; the test fixture helper imports the same functions. Main
thread reconstruction restores only read-only height/normal/trail queries and
metadata. It does not regenerate erosion, routes, walking triangles or topology.
`Terrain` consumes the transferred grid; standalone synchronous tests/tools can
still construct their own grid. The separate long-lived terrain-sampling worker
continues to own the distant-heightmap cache and snap sampling.

The native progress bar shows weighted completed stages, not a predicted duration:
2–45% shaping/erosion, 45% route planning, 68% walking surface, 86–90% validation,
91–92% grid/snapshot, 93% scene setup, 93–99% first terrain sampling, and 100% on
the first rendered frame. Coarse stages may hold their percentage while working.
First-sample worker progress is emitted at bounded intervals; subsequent snaps do
not send loading progress. The loading value is monotonic. Version and bar remain
visible while the intro is hidden during loading. Desktop/mobile screenshots were
reviewed for legibility and layout.

Validation: 43 Hike tests pass, including a real worker-thread execution with a
live main-thread timer and exact route/geology plus sampled height/normal/trail
parity. Fake-worker tests cover progress, cancellation (including pre-abort),
launch/runtime/message failures and termination. Terrain progress messages do
not complete or disturb an in-flight job. Chrome showed version 0.4.0, progressing
stages, final 100%, responsive diagnostic buttons during generation and no page
errors; blocking the generation-worker module produced usable seed recovery.
The worker-built topology remained 150,057 vertices / 299,612 triangles. A separate
Chrome startup probe saw one 61 ms long task during data restoration/scene setup;
startup is not claimed to be completely free of main-thread pauses, and total
CPU generation time is not inherently reduced by running it off-thread.

The earlier averaged-heightmap enhancement is included in this release. The user
reported “Works well” and authorized publication to GitHub on 2026-11-11. All 43
Hike tests passed on the final code; `git diff --check` passed. Formal Quest
loading-latency, memory-pressure and performance measurements remain outstanding.


### Pine forests — v0.6.0

`flora-placement.mjs` generates deterministic world-space pines in the startup
worker after detailed terrain/trail creation. Its typed tree/cell arrays are
transferred with the world snapshot. No terrain, route or movement algorithms are
changed; trees have no collision. Startup reports “Planting pine clusters” at
90–91.5%, then topology at 91.8%. The loading card awaits the initial budgeted
visibility pass. `hike.flora` exposes inspection and disposal.

`PINE_RULES` defines seeded, jittered, rotated elliptical clusters targeting 5–20
accepted trees; undersized groups are removed. Spacing is enforced across cells.
Suitability uses actual geology min/max: low-elevation fade at 3–12% of that range,
treeline fade at 64–82%, slope fade at 24–32 degrees. Trail clearance is half the
trail width +3.5 m, and the outer 120 m of the finite world is excluded. Planting
queries authoritative finished ground. Locations with more than 0.65 m difference
between detailed and averaged heights are rejected to reduce floating/buried roots;
trunks extend below planting height. Root positions never follow terrain snaps.
Coarse rendered interpolation can still differ from these planting queries.

The density factor is **11.5**, calibrated to **129,978 trees in 12,311 clusters**
on seed 41729: 10.09× the original 12,885-tree population. Counts vary by seed.
Cell spacing, cluster radii and minimum trunk spacing scale inversely with the
square root of this factor. Effective cell spacing is about 21.2 m and minimum
trunk spacing 1.62 m; overlapping crowns are expected. Passing
`{densityMultiplier:1}` restores the original layout. Returned rules preserve base
input values, while `cellSize`/`minSpacing` give effective dimensions. Packed
arrays occupy about 4.94 MB; one desktop placement observation took 2.44 seconds.
These are not Quest timings. Shared suitability/rule helpers support later flora;
no other tree species, wind or seasonal behavior are implemented. Static grass is
now provided separately by `grass.mjs` (see v0.14.0 below).

`pine-geometry.mjs` creates four reusable variants: five-sided brown trunks and
3–5 overlapping six-sided green cones, with flat normals and 56–80 triangles each.
Instance width, height, yaw and tint vary deterministically. All trees use full
3D geometry in four InstancedMeshes with one shared Lambert material. There is no
billboard geometry, atlas, capture pass, texture lookup or 200 m representation
switch. The earlier unpublished billboard experiments have been removed.

`FLORA_RENDER` exposes **450 m fade start / 500 m invisible boundary**. Trees are
fully visible inside 450 m, fade out from 450–500 m, and are invisible at/beyond
500 m; approaching reverses the fade. The GPU measures horizontal root distance
from the same composed world-space head center for both XR eyes. No instance
rewrite is needed for fading. MSAA alpha-to-coverage retains depth writing and
opaque ordering. A stable tree-anchored pattern, used only inside the fade band,
smooths MSAA's few coverage levels; without MSAA it gives a dithered cutout fade.
The pattern has no time or per-eye screen coordinate. Conventional alpha blending
is not used. Actual framebuffer sample counts are queried once on startup and
on each XR session's first tracked frame; the desktop count is restored on exit.

CPU membership prefetches to 516 m and retains members to 524 m to hide update lag
and reduce churn. The shader discards those extra instances outside 500 m, so
assigned counts can include an invisible preload ring. There are at most four
vegetation batches per eye. Diagnostics show generated/assigned 3D counts,
vegetation batches, fade MSAA samples, current work-slice time and lifetime peak.

Persistent tree-to-slot mappings retain matrices/colors for unchanged members.
Arrivals compose one transform; removals swap the last slot into the hole, copying
matrix/color data and fixing the mapping. Uploads cover changed spans and reuse
range objects, combining pending writes when several CPU slices precede a render.
Visibility passes snapshot only active IDs, then scan nearby cells for arrivals.
A pass's target remains fixed until completion; newer positions coalesce into the
next pass. Moves over 64 m replace unfinished work from current live membership.
The soft budget is **0.75 ms**, checked every 64 items, with a **2,048-item cap**
per frame. Small snapshot/finalization costs are outside the inner checks, so this
is not a hard duration guarantee. Very slow devices/rapid travel can leave
membership a few frames behind, while fade distance uses the current viewer.

Conservative bounds use static planting-height limits and geometry padding,
enclosing previous/new member regions during a pass and shrinking in constant
time on completion. No per-update full instance bounds scans are needed. Spatial
chunk batches were not added, avoiding unmeasured extra draw-call costs. The loop
defers vegetation work on terrain-apply frames and avoids diagnostic-control
refreshes while both panels are hidden. The native status text still updates.
`update(viewer,true)` is a synchronous inspection/test adapter, not normal walking.
Turn speed is **90 degrees/second** (PI/2 rad/s), shared by Quest right-stick and
desktop arrow turning.

Validation: all **54 Hike tests pass**, covering deterministic placement and density,
spacing/suitability/trail exclusion, all-3D yaw/height through the fade band,
texture-free four-batch rendering, prefetch/hysteresis, shared fade uniforms,
coverage/fallback paths, incremental/reference membership parity, buffer reuse,
bounds and movement/teleports. Existing world/terrain/XR checks pass. Chrome
confirmed 129,978 generated / 6,287 assigned 3D trees, four vegetation batches,
no atlas/material map and 709,752 submitted scene triangles including terrain in
one trailhead view. Higher triangle counts do not alone predict GPU performance.

Actual-render pixel comparisons showed full contribution at 440/450 m, about
51% at 475 m, a faint contribution at 490 m and zero at 500/510 m. The non-MSAA
fallback also gave a partial fade at 475 m. These include lighting/coverage effects,
not exact linear opacity. Stereo ArrayCamera rendering shared viewer/range
uniforms with no shader/page errors; screenshots were reviewed. `git diff --check`
and runtime module-link checks pass. The user subsequently reported good
performance and authorized publication. Formal sustained Quest CPU/GPU frame-time,
memory and binocular/fade-quality measurements remain unrecorded.


### Momentum gliding — local v0.7.0

`gliding.mjs` provides reusable position/velocity state and bounded, dt-based arcade
flight physics. Launch preserves walking momentum (including limited positive
uphill floor velocity), supplies at least 4 m/s horizontal speed, and adds an
impulse for roughly 0.9 m stationary rise. Repeated activation cannot boost flight.
Gravity and quadratic drag trade speed for height; neutral flight approaches an
8:1 glide ratio, dives build speed, and low speed reduces lift and forces descent.
Defaults cap normal flight at 32 m/s. All tuning lives in `GLIDE_DEFAULTS`.

Head yaw outside a 5-degree dead zone drives inertial steering capped at 90 deg/s.
Head pitch outside a 5-degree dead zone controls climb/dive, with smooth rate and
angle limits. There is no stick navigation or turning during flight. The field
notes expose maximum glide speed, glide ratio, and bank amplitude (0 disables it).
`flight-input.mjs` samples fresh A/X and independent B/Y edges, absorbs held
buttons during landing/resume/tracking recovery, and seeds reconnected sources.
Desktop Space provides a fresh-press launch for testing.

`flight-view.mjs` composes rig and raw headset orientation exactly once, excluding
presentation banking from steering. Camera/controllers live under a bank parent;
its compensated transform rolls at most 5 degrees around the current tracked
head center without modifying the tracked pose or moving the head center. Bank
returns smoothly to neutral after landing; disabling it or resetting clears it.
Hidden/untracked XR pauses motion; reset and session exit clear flight state.

Collision follows the player floor under actual tracked-head world X/Z, preserving
live headset height rather than subtracting a fixed eye height. Flight caps elapsed
time at 50 ms and subdivides at 1/120 s and at most 0.25 m travel. Detailed ground
queries at segment midpoint/end plus 12-step contact bisection catch fast descent
and narrow ridges. Landing places the floor on authoritative ground, clears all
velocity and restores walking. Terrain snapping remains independent; world
generation, placement, vegetation and terrain rendering are unchanged. Trees still
have no collision. No glider models, effects, audio or stamina were added.

Validation: **64/64 Hike tests pass**, including launch/momentum, energy behavior,
30/72/120 Hz consistency, swept landing, held/reconnected input, and translated/
yawed rigs with physical head offsets and bank. Syntax and `git diff --check` pass.
Chrome integration exercised the actual frame loop with simulated XR poses and
gamepads: A/X launch, ignored sticks, head steering/dive acceleration, landing,
fresh-press relaunch, pause, bank disable and reset passed. Desktop Space and a
real rendered airborne view passed with no page/shader errors; terrain stayed
visible through four snaps. Simulated XR is not a physical headset test.

A 720-frame CPU-only detailed-world flight probe measured about 0.021 ms mean,
0.034 ms p95 and 2.34 ms maximum; position/velocity objects retained identity.
These figures do not establish Quest frame time or globally allocation-free
height queries. Physical Quest mapping, comfort (especially banking), terrain
contact and sustained performance still need user testing before publication.


### Flight steering correction — local v0.7.1

The initial flight implementation changed velocity heading without rotating the
player rig, producing sideways-looking travel. `FlightView.advance` now uses head
yaw relative to the rig as steering input and applies the resulting trajectory yaw
delta to the rig. Holding a sideways look continues the turn; facing forward
eases angular velocity to zero. Rotation pivots at the live head X/Z after flight
displacement, preserving collision position with nonzero room-scale offsets. Bank
still stays out of steering, and raw tracking is unchanged. Both signs, yaw-wrap
crossing, offset rigs, pause and neutral settling have regression coverage.

Validation for the steering correction: all **65 Hike tests pass**, including the
new coupled trajectory/rig-turn regression; syntax and `git diff --check` pass.
Physical headset turn feel and comfort still require user testing. Changes remain
local and unpushed.


### Temporary summit spawn for gliding tests

`START_AT_TRAIL_END=true` in `app.mjs` temporarily starts desktop, XR and Reset at
the trail endpoint, facing back downhill along the route. Set it false to restore
the trailhead. Terrain's optional `initialPosition` and initial pine visibility
use the same spawn so the first view is prepared there. World generation and
canonical route start/end remain unchanged. This is temporary and local.


### Gentler flight steering — local v0.7.2

Flight turn-rate cap is now **60 degrees/second** (previously 90), and yaw gain
is **1.5** (previously 2.2). The 5-degree dead zone and exponential turn response
4/s remain: approximately 0.25 s time constant. A 20-degree sideways look requests
22.5 deg/s rather than 33 deg/s before smoothing. Walking turn speed remains
90 deg/s. Temporary summit spawn remains enabled.


Default glide banking is now **0 degrees** (disabled). Diagnostics still allows
0–5 degrees; the bank behavior test explicitly enables 5 degrees.


Default maximum glide speed is now **60 m/s** (previously 32). This is the
combined velocity cap; gravity, drag and dive angle still determine attainable
speed. The existing Diagnostics speed control remains 8–60 m/s.


### Gentler climb speed loss — local v0.7.3

`climbDeceleration:0.5` halves the combined gravity/drag deceleration while the
actual flight path pitches upward. Level/descent behavior, launch impulse and
low-speed stall behavior remain unchanged. This intentionally makes arcade
climbing more forgiving rather than preserving a strict energy budget. A regression
checks the exact half-rate upward loss and unchanged level/descent velocities.


### Landing momentum — local v0.7.4

Landing now captures horizontal impact velocity before flight velocity is cleared.
`LandingRunout` carries it along detailed ground with constant **8 m/s² friction**
until exact rest (12 m/s takes 1.5 s and 9 m). Vertical impact speed is discarded.
Ground following uses steps no longer than 0.25 m; runout adds no slope gravity.
Walking, turning, launch and XR controller panel interaction are blocked throughout
runout, including its final frame. Button edges continue sampling, so held launch
buttons cannot retrigger afterward. Head tracking remains live. Reset/session exit
clear runout; hidden/untracked frames pause it. Diagnostics identifies Landing runout.
Temporary summit spawn remains enabled.

Landing validation: all **67 Hike tests pass**, including exact friction stopping
distance, ground following, velocity reuse, pause/reset, and 30/72/120 Hz agreement.
App syntax and `git diff --check` pass. Quest landing feel remains to be tested.


### Landing-to-walking handoff — local v0.7.5

Landing runout now hands off before full rest whenever requested walking speed
is positive and at least the current horizontal slide speed. Requested speed uses
the same shared stick dead zone/rescaling and diagonal cap as Locomotion, times
the configured walking speed. Desktop movement keys use the same rule. The normal
walking branch runs immediately on handoff; controller turning/panel controls
unlock too. While slide speed is greater, friction and input lock remain. With no
movement input, runout still stops naturally; turn-only input cannot end it.
Handoff follows the player's requested direction, including sideways/backward.


The temporary summit spawn has been removed. Startup, XR entry and Reset again
place the player at the canonical trailhead facing up the trail. Initial terrain
and pine visibility use that same trailhead position.


### Head-tilt steering — local v0.8.0

Flight turn input is now ear-to-shoulder head tilt relative to gravity, rather
than headset yaw. `FlightView` projects world up onto tracked-head right/up axes
and uses atan2 to measure signed tilt independently of compass facing. Gameplay
orientation excludes optional presentation bank. At near-vertical gaze, steering
fades to neutral (horizontal forward magnitude 0.15 to 0.05) because gravity
cannot define roll there. Positive/left tilt turns left; right tilt turns right.

`Glider.update` now accepts signed tilt directly; defaults are `tiltDeadZone`
5 degrees, `tiltGain` 1.5, 60 deg/s cap and response 4/s. Upright head eases turn
rate to zero. Head yaw remains free for looking around, walking and stationary
launch direction; moving launch still preserves momentum. Pitch still controls
climb/dive. Rig rotation follows trajectory yaw around the live head pivot.
Bank defaults to zero; all landing behavior and trailhead spawn remain unchanged.
Desktop mouse look supports pitch/yaw but has no roll input, so flight turning
with this experiment requires a tracked headset (or test pose).

Tilt steering validation: all **69 Hike tests pass**, including tilt sign, upright
neutral at multiple headset yaw/pitch and rig yaw combinations, sideways-facing
launches, head-pivot preservation, and near-vertical gaze. App syntax and
`git diff --check` pass. Physical Quest tilt feel/comfort remains untested.


Tilt sensitivity doubled in local v0.8.1: `tiltGain` is now **3** (was 1.5).
The 5-degree dead zone, 60 deg/s cap and 4/s smoothing remain unchanged.


Local v0.8.2 increases `tiltGain` another 50% to **4.5** and halves
`tiltDeadZone` to **2.5 degrees**. The 60 deg/s cap and 4/s smoothing remain.


### Thumbstick flight turning — local v0.10.0

Head tilt steering is removed. Right-stick X turns the rig and flight trajectory
with the same direction, shared rescaled 0.15 dead zone and immediate 90 deg/s
full-deflection response as ground Locomotion. Release stops turning immediately.
Desktop left/right arrows provide equivalent flight turning. Head yaw/roll are
free look; head pitch still controls climb/dive. Left-stick walking remains
disabled during flight. Landing friction/input handoff remains unchanged. Startup
and Reset stay at the trailhead; banking defaults to zero.

User additionally requested summit spawn: startup, XR entry and Reset now use
`world.summit`, facing back downhill along the trail. Terrain and pine visibility
initialize there. This supersedes the trailhead note above.

Validation: all **69 Hike tests pass**, including 90 deg/s full-stick and 45 deg/s
half-effective-stick turns, release-to-stop, head yaw/roll independence, retained
pitch sampling and physical head pivot. App syntax and `git diff --check` pass.
Quest flight-control feel remains for user testing. Local and unpushed.


### Gliding turn inertia — local v0.10.1

Flight turn cap is now **60 deg/s**. Thumbstick input sets a target angular
velocity; actual turn rate eases toward it with `turnResponse:3` per second
(time constant 0.33 s). Release removes about 78% of turn rate after 0.5 s and
95% after 1 s; tiny residuals below 0.0001 rad/s become exactly zero. The same
response smooths turn onset and reversal. Ground turning stays 90 deg/s with its
existing immediate response. Pitch control, landing and summit spawn remain.


Local v0.10.2 raises the total glide speed cap to **90 m/s** and maximum dive
angle to **75 degrees**. Diagnostics maximum-speed range now extends to 90 m/s.
Drag remains unchanged, so sustained terminal descent can stay below the cap.


### Black settings menu — local v0.11.0

Y (left controller button 5) opens Settings on a black background, hiding world
roots while preserving the camera/controller rig. B retains Field Notes. Both
controllers use shared laser pointers and trigger selection. The menu contains
a Shadows checkbox (default false, boolean only with no rendering effect) and
Save and Exit. Saving persists `hike.settings` in localStorage and restores the
prior background, fog and individual world visibility. Storage failure keeps the
menu open with a retry message. Movement, flight, runout and terrain/flora updates
pause while open; physical head/controller tracking remains live. Session exit
closes the menu without saving draft changes. Y uses fresh-press/resume protection.

Validation: all 72 Hike tests, app syntax and `git diff --check` pass.
Automated checks cover input, persistence and scene restoration. Browser visual
review was unavailable because the Playwright browser runtime is missing;
physical Quest menu placement, pointer interaction and comfort need user testing.
Changes remain local and unpublished.


### Tabbed Settings — local v0.12.0

B and Y now both open Settings, or Save and Close it from any tab. The old
standalone VR Field Notes panel is removed. Left-side tabs are General (Shadows
checkbox), Teleport (Base and Summit), and Debug (the former controls/readouts,
paged seven rows at a time). Both controller lasers select tabs, controls, pages
and the persistent Save and Close button. Shadows drafts survive tab switches.
Teleport saves settings and closes the menu; the next tracked frame places the
head at the canonical trail start or summit, facing along the trail, clears
flight/runout/sliding momentum and requests terrain/vegetation catch-up normally.
The live viewer offset is compensated exactly once. World simulation stays paused
while viewing Settings. Desktop diagnostics remain available for seed recovery.
Changes remain local and unpublished; physical Quest validation remains pending.


### Pine shadows — local v0.13.0

`pine-shadows.mjs` connects the saved General/Shadows boolean to actual rendering.
Saving through B/Y, Save and Close or Teleport applies it on the next world frame;
stored values are loaded on startup. Off disables the renderer shadow map, sun
casting and all shadow-caster work. On uses one 2048×2048 PCFSoft directional map.
Terrain and visible pines receive shadows; only dedicated nearby pine instances
cast them. Terrain, the summit flag and distant forest batches do not cast.

Receiver shaders fade direct-light occlusion by horizontal distance from the
composed world-space head: full through 80 m, smoothstep to zero at 100 m. Ambient
light is retained. Both eyes share the same world head center. No caster fade at
100 m is used; trees outside the receiver radius can cast shadows inward. The
existing 450–500 m visible-tree fade is unchanged.

The shadow camera keeps the original sun direction and uses a conservative
world elevation envelope (geology range, boundary, earthwork allowance and tree
heights). Its right/up/depth coordinates are snapped to shadow texels. The
coverage is padded and fixed in size, following player X/Z without tracking head
height, changing the sun direction or depending on terrain snaps. Default-world
coverage is about 216×345 m in light space, so actual texel spacing is about
10.5×16.9 cm. This spends resolution to avoid clipping on mountain slopes.

Caster searches use existing tree cells, an elevation-aware uphill reach and
light-space bounds, rebuilding after 2 m of horizontal movement, immediately on
teleports or enabling. Default conservative search radius is about 319 m; only
intersecting trees are submitted. Four shadow-only instance batches reuse the
pine shapes and have draw range zero during normal eye rendering. Their native
onBeforeShadow/onAfterShadow hooks expose triangles only during shadow draws.
Instance buffers grow geometrically if needed and are reused between rebuilds.
The map updates only after a snapped-camera or caster-membership change. Off
retains allocated buffers/map for reuse, while disposal frees owned resources.
Debug includes shadow-caster count and setup CPU time; setup excludes GPU cost.

Validation: all **76 Hike tests pass**, with app syntax and `git diff --check`.
New checks cover shader fade, off/enable/disable/re-enable gating, camera coverage
at elevation extremes, texel alignment, spatial selection, reused buffers and
shadow-only draw ranges. Chrome on/off forest views were reviewed with no page
or shader errors. In one desktop view, 7,810 visible trees used 1,035 shadow
instances in four depth draws, with zero duplicate normal-pass proxy draws;
turning off removed all depth draws. One selection observation took 1.3 ms;
this is not a Quest benchmark or a sustained CPU/GPU measurement.

An isolated rendered receiver probe measured pixel darkening 112 at 0/70/80 m,
56 at 90 m, 1 at 99 m and zero at 100/110 m. Off restored the unshadowed sample.
These are rendered test pixels, not a universal brightness calibration. Quest
stereo quality, shadow bias/acne, sustained frame times and fast-flight behavior
still need physical headset testing. Work remains local and unpublished.


### Extended shadow radius — local v0.13.1

The shadow map remains 2048×2048. Shadows stay at full strength through 180 m
and fade smoothly to zero at 200 m. Receiver coverage and conservative caster
selection expand with the radius; texel alignment and the saved Shadows toggle
are retained. This supersedes the 80–100 m distances above. Keeping the map
resolution spreads texels over a larger area and includes more shadow casters.
Camera-coverage and fade regressions use the new distances. Work remains local
and unpublished; physical Quest quality/performance testing is pending.


### Static mature grass — local v0.14.0

`grass.mjs` adapts Secret Garden's mature plain grass without importing its
plant manager/growth system. Each shared blade has seven vertices/five triangles
with a tapered, bent tip. Seeded 320–460-blade patches use .35–.7 m irregular
radii, .24–.45 m nominal center heights, shorter edges and varied widths, lean,
yaw and greens. These are plain blade patches; seed stalks, growth and wind
are not included. Secret Garden files are unchanged.

Deterministic 16 m cells have a 75% patch candidate chance. Placement rejects
slopes above 30 degrees, the upper 10% of the world elevation range, the trail
with an additional shoulder margin, the summit disk and the outer world edge.
Every blade root uses finished `world.height` minus 1.5 cm, so patches conform
to ground rather than using a flat patch plane. Render interpolation can still
differ slightly from collision heights between terrain vertices.

One double-sided Lambert InstancedMesh renders all nearby blades. Grass never
casts shadows. It receives the optional pine shadows controlled by the existing
saved Shadows setting. Full grass coverage extends through 80 m, fading to zero
at 100 m horizontal root distance with the same stereo-stable MSAA/dither method
as the pines. The shader has no time-based animation.

Cell searches prefetch one cell beyond the fade range and retain a second cell
to limit churn. Cells outside the retained area are removed; new work is sorted
near-first and checked against a soft .75 ms / eight-cell frame budget. An
individual patch may exceed that budget. Moves/teleports replace pending work
with the latest nearby cells; old distant patches are invisible via the fade.
Initialization awaits the first nearby pass behind the loading screen. Gameplay
updates defer grass work on terrain-apply frames, while the fade center stays
current. Settings pauses grass work with the rest of the world.

Patch transforms stay fixed once built. Contiguous 460-slot blocks support
swap-removal without rebuilding other patches; unused blade slots are tiny
degenerate geometry. Instance buffers start small, grow geometrically to a
bounded cell capacity and reuse storage. GPU uploads cover only changed spans.
No world-sized grass population, per-blade Object3D, texture atlas or new draw
per patch is added. Debug shows patch/blade counts and update CPU time.

Validation: all **79 Hike tests pass**, app syntax and `git diff --check` pass.
Grass tests cover blade topology, seeded mature forms, root heights, exclusions,
bounded streaming/teleports, static buffers, fade configuration, MSAA fallback
and shadow flags. Chrome rendered a slope-conforming close-up with shadows on
and no page/shader errors. In that inspected forest view there were 120 retained
patches / 46,903 real blades, with 276,000 submitted grass triangles including
unused slots. Retained/preloaded patches can extend beyond the visible radius.
These counts do not establish Quest performance. Physical headset appearance,
stereo fade quality, fast-travel catch-up and sustained frame times remain to
be tested. Changes remain local and unpublished.


### Denser, ground-colored grass clumps — local v0.14.1

Grass now generates ten mature patches around each eligible seeded clump center
instead of one patch per candidate cell. `GRASS_RENDER.patchesPerClump=10` is
the density control. Each clump has a rotated, jittered elliptical footprint
about 2.4–3.8 m by 1.8–3.2 m in radius, with gaps between clumps. Individual
patches retain their mature blade counts, root terrain queries and exclusions.
Tenfold candidate density is exact; actual accepted totals vary near trails,
summits, cliffs and world edges. Streaming budgets apply per patch, distributing
a clump across frames instead of building all ten patches at once.

Patch base colors use the same `surfaceColor` elevation/slope/noise palette as
the terrain. A .78 brightness multiplier approximates the ground detail texture,
and each blade gets modest brightness variation. The earlier independent green
hue/light ranges are removed. This matches the ground palette without runtime
texture reads or changing the terrain material. Grass stays static, never casts
shadows, receives optional pine shadows, and retains the 80–100 m fade.

All **80 Hike tests pass**, including new tenfold-density, within-clump spread,
determinism and ground-palette checks; syntax/whitespace checks pass. Chrome
compiled/rendered the new grass with no page or shader errors. An inspected
forest window retained 1,158 patches / 453,438 blades, submitting 2,663,400 grass
triangles including unused slots. Counts include the invisible preload ring.
These are desktop observations; the increased geometry/memory and sustained
Quest performance remain to be tested. Changes remain local and unpublished.


### Grass removed — local v0.15.0

The user reported that grass kills performance. All Hike grass is removed,
including its module/tests, import, initialization/loading stage, per-frame
updates, instance buffers/draws and Debug readouts. The previous grass sections
are historical only. Pines, the 200 m pine shadows with 180 m fade, the saved
Shadows setting, Settings tabs and teleport are retained. Secret Garden grass
is untouched. Entry/app version advances to invalidate browser caches.

Validation: app syntax and the remaining 76 Hike tests pass; `git diff --check`
passes. Physical Quest confirmation of restored performance is pending.
Changes remain local and unpublished.


### Capped triangle surface field — local v0.16.0

At the user's request, `triangle-field.mjs` tries a much smaller surface-detail
field after removing the expensive mature grass. One blade is one upright,
slightly bent triangle with seeded width, height and yaw. The field is static,
with no animation, light/shadow sampling, textures, cast or received shadows.
Colors use `surfaceColor` with baked brightness variation and a .68 multiplier
to approximate the lit/textured ground. Seeded elliptical clumps use 88 blade
candidates per 8 m cell, an 85% clump chance, and individual finished-ground roots.
The path (with a small clearance), summit landing, slopes above 30 degrees, high
rocky elevations and world boundary are excluded.

The field is fully visible through 40 m horizontal head distance and fades to
zero at 50 m. The shader uses stereo-stable world-space MSAA coverage/dither,
with no conventional transparency sorting. One InstancedBufferGeometry stores
three shared vertices and compact root/shape/color attributes, without full
instance matrices or per-blade objects. A fixed 15×15 cell window caps all
submitted geometry at **19,800 triangles per eye**, including empty/preloaded
slots; it never allocates extra instance capacity. Instance data occupies
**792,000 bytes** on the CPU, plus corresponding GPU buffers.

Cells stay fixed in world space and reuse their slots until they leave the
window. Only new edges are queued, near-first, with a soft .5 ms / four-cell
frame budget; one cell's queries can exceed the time budget. Teleports replace
pending work and refill the nearby window incrementally. The fade center always
tracks the composed head position, including when work is deferred on terrain
apply frames. Initialization awaits the first pass behind the loading card.
Settings pauses the field with the world. Debug reports actual candidate count
and update CPU time. No world-generation or collision behavior changes.

Validation: all **79 Hike tests pass**, syntax and `git diff --check` pass. New
checks cover deterministic clumps, terrain roots, exclusions, compact fixed
buffers, the hard cap, static idle data, teleports, MSAA fallback and shadow flags.
Chrome rendered a close-up with no page/shader errors: one field draw, 15,294
nonempty triangles, 19,800 submitted including empty slots, 792,000 instance bytes.
A separate rendered fade probe counted 1,433 colored pixels at 0/40 m, 724 at
45 m, 54 at 49 m and zero at 50/60 m. These are test pixels, not a frame-rate
benchmark. Physical Quest appearance, stereo fade, fast-flight catch-up and
sustained performance still need user testing. Changes are local and unpublished.


### Taller, denser triangle field — local v0.16.1

At the user's request, blade height doubles: the base range is now .24–.64 m
before the unchanged clump-edge height factor. Width remains .016–.035 m.
Density doubles from 88 to 176 candidates per cell. `BLADES_PER_CELL` now drives
all buffer sizing, copying, slot offsets and generation counts. The same 225-cell
window therefore submits at most **39,600 triangles per eye** under an updated
40,000-triangle hard budget, with **1,584,000 bytes** of instance data. Clump
locations, colors, path exclusions, shadow-free rendering and 40–50 m fade are
retained. This supersedes the prior 19,800 cap.

All 79 Hike tests, app syntax and `git diff --check` pass. Physical Quest
appearance/performance testing remains pending. Changes are local and unpublished.


### Higher maximum and doubled density — local v0.16.2

Maximum base blade height doubles again, from .64 to 1.28 m. The .24 m base
minimum, clump-edge height factor and .016–.035 m width remain unchanged.
Density doubles from 176 to 352 candidates per cell. The 225-cell window caps
submission at **79,200 triangles per eye**, within an 80,000-triangle budget,
and instance buffers occupy **3,168,000 bytes**. Colors, placement exclusions,
no-shadow rendering and the 40–50 m fade are retained.

All 79 Hike tests, app syntax and whitespace checks pass. Quest testing remains
pending; changes are local and unpublished.


### Trailhead default restored — local v0.16.3

Startup, first tracked XR entry, session exit and Reset return to `world.start`,
facing up the route. Initial terrain, pine visibility and triangle field use
the same trailhead position. Debug Reset is labeled Reset to trailhead and
queues Base when invoked from Settings. Teleport retains explicit Base/Summit
choices. Grass height/density, flight and shadow tuning are unchanged.

App syntax, endpoint/settings regressions and whitespace checks pass. Changes
are local and unpublished.


### Worker-generated triangle field — local v0.17.0

The user reported perceived CPU spikes and requested moving grass generation
off the render thread. `field-cells.mjs` holds the unchanged deterministic cell
generator and tuning; `field-worker.mjs` reconstructs exact read-only terrain
and trail queries from one cloned `world.samplingData` snapshot plus small
placement metadata. It does not regenerate the mountain, route, pines or terrain
mesh. The additional query snapshot costs memory in exchange for independent
worker execution, without delaying terrain sampling behind grass jobs.

Browsers use one dedicated worker. At most one four-cell job is in flight, with
at most one completed batch waiting for the next world update. Root/shape/color
arrays are transferred back; after main-thread copies into persistent instance
buffers, those transfer buffers are recycled into the next worker request.
Main-thread work is cell planning, cache removal, result validation/application
and changed-range uploads. No blade terrain, slope, trail, random-shape or color
queries occur on the render thread. Idle frames still reuse all cell data.

Completed packets do not mutate geometry from message callbacks. Application is
deferred on terrain-apply frames and while Settings/the session is inactive.
Moves coalesce into the newest target window; overlapping results remain usable,
out-of-window results are discarded, and duplicate queued cells are skipped.
The old field stays visible with its current head-distance fade while catching
up. Initialization awaits its first full window behind the loading card. Worker
launch/runtime/message/invalid-result failures disable this optional field,
terminate its worker and show the error in Debug; they do not fall back to
main-thread generation or stop the world. Disposal terminates pending work.
A synchronous adapter remains only for dependency-free Node testing.

Height, density, 79,200 per-eye triangle cap, colors, exclusions, no shadows,
40–50 m fade and trailhead spawn are unchanged. Debug now separates Field apply
CPU time from Field worker generation time and shows Ready/Generating/error.

Validation: all **82 Hike tests pass**, app syntax and `git diff --check` pass.
New fake/real worker tests cover main-thread query isolation, bounded requests,
transferred-buffer recycling, deferred application, stale teleport results,
failures, late disposal callbacks, exact cell-array parity and responsive main
event-loop timers. Chrome confirmed a real worker, zero main grass height
queries during generation and no page/shader errors. One desktop generation
probe observed main field-update p95 about .1 ms and max .4 ms; its last four-cell
worker job took .8 ms. These measurements exclude GPU upload/render time and
do not establish sustained Quest performance. The 40–50 m rendered fade probe
still passes. Quest confirmation of improved CPU spikes remains pending.
Changes are local and unpublished.


### Release review — v0.17.0, 2026-11-11

The user reported “Better” after moving triangle-field generation into a worker
and explicitly requested pushing to GitHub. This release includes the tabbed
black-background Settings menu (B/Y save-and-close), persisted Shadows toggle,
Base/Summit teleport, 2048² pine shadow map fading from 180–200 m, the capped
79,200-triangle surface field fading from 40–50 m, worker generation with
recycled transfers, and restored trailhead startup/Reset. The expensive mature
grass experiments are removed; Secret Garden and shared runtime files are
unchanged. Scope is confined to Hike source, tests and this handoff.

Final validation: 82 Hike tests pass, app/new module syntax and whitespace checks
pass. Earlier Chrome integration checked Settings/teleport, shadows, field fades,
real worker use and zero main-thread grass generation queries, with no page or
shader errors. Formal sustained Quest CPU/GPU timing, memory and stereo-quality
measurements remain unrecorded. Publication is authorized for this reviewed
release; deployment is verified separately after pushing.


### Snow-line grass exclusion — local v0.17.1

Grass candidates now stop at the same snow-onset elevation coordinate as terrain
coloring: height relative to the geology summit plus seeded broad patch noise,
with threshold .82. `surfaceAltitude` and `SNOW_LINE` in `surface.mjs` are shared
by the terrain palette and worker cell placement, preventing mismatched cutoffs.
This excludes grass above the snow line even where slope exposes bare rock.
The prior cliff/high-elevation restrictions remain; terrain appearance is
unchanged. Worker/cache entry versions advance so existing cached cells rebuild.

Validation: Hike tests, syntax and whitespace checks pass. New regression checks
cover snowy elevations that passed the old cutoff, lower grass-bearing ground,
and every generated root across the seeded snow transition. Changes are local
and unpublished.


### Multiple grass clumps per cell — local v0.17.2

Each 8 m cell now has a seeded 75% chance of getting 1–3 clumps, with equal
probability among the three clump counts. Each clump retains 352 candidate blades;
the user explicitly allowed the blade budget to increase. Cell capacity is now
1,056 blades, and the fixed 225-cell window caps geometry at 237,600 triangles
per eye (240,000 hard budget), using 9,504,000 instance bytes. Actual accepted
counts remain subject to paths, snow, slopes, landing and boundary exclusions.
The worker, fixed buffers, heights/widths, colors and 40–50 m fade are retained.

Validation includes seeded occupancy/clump-count distribution and full worker
parity/buffer-cap checks. Changes are local and unpublished; Quest performance
at the increased density remains to be tested.


### Seated height offset — local v0.18.0

General adds a true laser/trigger-drag Height offset slider: 0–1.5 m in .05 m
steps, default 0, saved with Shadows in `hike.settings`. Existing saved settings
without this field default to zero; invalid values default/clamp safely. B/Y,
Save and Close, and Teleport persist the draft value. The saved offset applies
on the next tracked/world frame. Tabs/release/disconnection/suspension cancel
drag ownership; held triggers are absorbed when entering/resuming.

The camera/controllers share a height parent under the bank rig. Gameplay adds
the same offset once to the freshly copied raw viewer position; collision and
flight keep the floor rig at ground height. Bank pivots use the effective head
position, preserving render/gameplay agreement with translated/yawed rigs and
physical head offsets. Reset and teleport retain the saved seated preference.

All 20 focused Settings/input/flight checks pass, along with syntax/whitespace
validation under the reduced testing policy. A lightweight Chrome scene passed
slider midpoint/end dragging, persistence and head/floor composition checks,
with no page errors; the rendered slider was reviewed. Physical Quest seated
comfort/interaction remains to be tested. Changes are local and unpublished.


### Random startup seed — local v0.18.1

Loading without a valid, nonblank `?seed=` now chooses a fresh uint32 seed with
`crypto.getRandomValues`, rather than always using 41729. Explicit seed links
(including zero), manual seed entry and Random seed recovery remain reproducible
and unchanged. Reloading a seedless URL chooses again; the generated seed is
shown in the existing diagnostics/seed field. Generator/test defaults remain
41729. Syntax and whitespace checks pass under the reduced testing policy;
no runtime suite was needed for this small startup-default edit. Local/unpublished.


### Release review — v0.18.1, 2026-11-11

The user explicitly requested pushing this release to GitHub. It includes grass
snow-line exclusion, a 75% per-cell chance of 1–3 full-density clumps (237,600
triangle cap), the saved General height-offset slider (0–1.5 m, default zero),
and random startup seeds while preserving explicit seed links. The reduced
iteration-testing policy is recorded near the top of this handoff.

Final checks: all 85 Hike tests pass, changed runtime modules pass syntax checks,
and `git diff --check` passes. Prior focused Chrome checks verified the seated
slider and saved height composition; no additional browser sweep was required.
Changes are confined to Hike. Publication is authorized for this reviewed
release. Per user preference, do not poll GitHub Pages after pushing.
Historical local/unpublished notes above are superseded by this release review.
