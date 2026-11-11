# The Hike — single snapped terrain grid

## State and preview

Buildless entry: `projects/hike/`. Serve the repository root with
`python3 -m http.server 8080 --bind 127.0.0.1`, then open `/projects/hike/`.
Quest USB testing uses root `Start-VR.command`. Runtime dependencies are local.

Last published baseline: `692a42a` (2026-11-10), including bank-peak smoothing,
generation optimization, centered loading UI and the level destination landing.
The user authorized publishing the **2026-11-11 terrain renderer replacement**
to the repository’s established `main` branch. Git history records the release
commit; deployment status is verified separately. The user confirmed
that the earlier version functions on Quest, with slow generation; this renderer
still needs physical headset validation. Vegetation, wildlife, collectibles and
bridges remain unimplemented.

## Controls and gameplay

- Desktop: Start walking, WASD / up/down arrows, mouse look after clicking the
  world, left/right arrows turn. Esc releases mouse, P toggles diagnostics, R resets.
- Quest: left stick walks relative to horizontal headset heading; right stick
  turns smoothly at 60°/s about the physical headset. B/Y opens field notes 45°
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
grade to 30%. The trail is carved into the ground with a 9 m blending shoulder.
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
The grid has **102,917 vertices / 205,332 triangles**, including transition stitching
(200,488 triangles before stitching). One `Terrain.mesh`, one material and one draw
call render the terrain. `tile-mesh.mjs`, persistent tile meshes, LOD index patterns
and the separate outer ground mesh have been removed.

| Region | Subdivisions per 16 m cell | Spacing |
| --- | --- | --- |
| Central 3×3 cells | 64×64 | 0.25 m |
| Band 1 | 32×32 | 0.5 m |
| Band 2 | 16×16 | 1 m |
| Band 3 | 8×8 | 2 m |
| Band 4 | 4×4 | 4 m |
| Band 5 | 2×2 | 8 m |
| Outer terrain | 1×1 | 16 m |

The center always uses full resolution. Other cells use center distance in cell
units, with band boundaries at 1.5, 3.5, 5.5, 7.5, 9.5 and 11.5 cells. All bands
are square-grid approximations of circles, not radial vertices.

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
CPU height function. Samples shared with the prior origin are copied exactly;
a normal cardinal snap samples 18,036 new points instead of all 102,917. Sampling
never changes terrain heights according to resolution. World-space normals and
UVs, nested spacings and consistent diagonals keep common points and lighting
stable. The fine core keeps the nearest resolution transition away from the player.
Coarser triangle interpolation can still pop at a snap; no temporal geomorphing or
per-frame vertex animation is used.

Profiling found synchronous snaps too expensive, so browsers use
`terrain-worker.mjs`. It receives one read-only world snapshot and samples only on
snap requests. There is no erosion, pathfinding or clipping in the worker. The
transfer buffer is returned/reused; the worker keeps one previous-sample buffer.
Only one job is in flight and newer requested origins replace obsolete requests.
Late responses never move the mesh back to an old origin.

A snap is **committed atomically when its worker result is ready**. The existing
position, normal, color and UV buffers are updated in place; index data is untouched.
The mesh moves once to the requested world-aligned origin. Bounds use the new
height extent and the fixed horizontal footprint. The terrain update in the main render loop only
checks the snap cell; it performs no mesh-height sampling, reconstruction or
interpolation. Gameplay still queries the ground for player collision.

There is a short worker latency after crossing a cell boundary. The prior grid
remains stationary during that interval. Its 48 m core has room for normal walking;
if a teleport or a severely delayed job takes the player outside that core, the old
terrain is hidden until the new grid arrives rather than showing coarse ground
underfoot. This temporary absence on distant teleports is a known tradeoff. Startup
awaits the first result behind the existing loading card. Worker failures stop the
render loop and open seed-recovery diagnostics. Node tests use a synchronous adapter
for the same sampling implementation; browser execution uses the worker.

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

Chrome checks observed 0.3–1.5 ms main-thread apply times and roughly 50–66 ms worker
sampling for eight cardinal snaps after startup. Observed frame intervals were
about 16.6 ms median, 17.7 ms maximum in that short desktop run. The terrain submitted
205,332 triangles in one draw call. These are desktop observations, not a standalone
Quest benchmark. GPU buffer-upload cost, stereo rendering, sustained FPS, worker
latency under headset load and perceptibility of snapping still need Quest checks.
The one mesh submits its full triangle count; there is no tile-level frustum culling.

World generation remains synchronous at startup, though earlier routing/drainage
optimizations are retained. Other remaining limits: steep banks/large earthworks,
finite seed coverage, possible unhandled inside-turn spikes, and no bridges.
Route-aligned trail-grid refinement remains explicitly deferred. New renderer
cache versions are advanced. The user authorized this revision’s commit and push
on 2026-11-11; Quest validation remains outstanding.
