# The Hike — single snapped terrain grid

## State and preview

Buildless entry: `projects/hike/`. Serve the repository root with
`python3 -m http.server 8080 --bind 127.0.0.1`, then open `/projects/hike/`.
Quest USB testing uses root `Start-VR.command`. Runtime dependencies are local.

Current release: **v0.6.0** (2026-11-11), with dense all-3D pine forests,
a 450–500 m distance fade and incremental vegetation updates. The user reported
“Performance is good” and authorized pushing this release on 2026-11-11. This is
user test feedback, not a formal standalone Quest frame-time benchmark. Previous
published baseline: `0083fbc` / v0.4.0. Wildlife, collectibles, bridges and tree
collisions remain unimplemented.

## Controls and gameplay

- Desktop: Start walking, WASD / up/down arrows, mouse look after clicking the
  world, left/right arrows turn. Esc releases mouse, P toggles diagnostics, R resets.
- Quest: left stick walks relative to horizontal headset heading; right stick
  turns smoothly at 90°/s about the physical headset. B/Y opens field notes 45°
  right at 2.1 m; controller ray + trigger adjusts controls. Panel stays world locked.
- Testing speed is **14 m/s**, ten times normal walking. Desktop/VR share the same
  0.7–30 m/s range and 0.1 m/s step.
- Above **35°**, downhill sliding starts at 1.15× walking speed, accelerates, and
  caps at max(6 m/s, 1.5× walking speed). Walking/turning still work. Short steps
  stop sliding on gentler ground; reset clears slide state.
- Hidden/untracked XR pauses navigation and rays; held toggles are absorbed on
  resume. The physical viewer pose is composed with the rig exactly once, after
  movement/turning/sliding. Ground height is queried under the headset's world X/Z.
- Reset faces the first part of the path. Summit line of sight from the low
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
no grasses, other species, wind or seasonal behavior are implemented.

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
