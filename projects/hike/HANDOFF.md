# The Hike — unified landscape

## State and preview

The initial release is on GitHub (`8e9e0ef`); the unified landscape and fine trail
were released in `94f1131`. The user authorized the follow-up release below on
2026-11-10. Consult Git history for its commit and publication state; local-status
notes in the implementation sections describe their state when first written.

Buildless entry: `projects/hike/`. Serve the repository root with
`python3 -m http.server 8080 --bind 127.0.0.1`, then open `/projects/hike/`.
Quest USB testing uses root `Start-VR.command`. All runtime dependencies are local.
Vegetation, wildlife, collectibles and bridges remain unimplemented.

## Controls retained

- Desktop: Start walking, WASD / up/down arrows, mouse look after clicking the
  world, left/right arrows turn. Esc releases mouse, P toggles diagnostics, R resets.
- Quest: left stick walks relative to the horizontal headset heading; right stick
  turns smoothly at 60°/s about the physical headset. B/Y opens field notes 45°
  right at 2.1 m; controller ray + trigger adjusts controls. Panel stays world locked.
- Testing speed remains **14 m/s**, ten times the normal 1.4 m/s. Both diagnostic
  views share the same 0.7–30 m/s speed bounds and increments.
- Terrain above **35°** causes downhill sliding with walking/turning still active.
  Drift starts at 1.15× walking speed, accelerates and caps at max(6 m/s, 1.5×
  walking speed). Short steps stop it on gentler ground. Reset clears slide state.
- Hidden/untracked XR pauses navigation and rays; held toggles are absorbed on resume.
- Reset now faces the first part of the hiking path. The user explicitly permits
  the destination to be occluded from the lowest-point trailhead.

## One terrain definition for the whole landscape

`geology.mjs` exports `generateLandscape(config)`. It creates a **3.84 × 3.84 km**
heightfield centered on the origin, spanning ±1920 m. This size keeps the 1 km view
range inside generated terrain throughout the default hiking area.

The field combines seeded, correlated ridge families at several scales, domain
warping, rotation/stretch and broad central uplift. These same rules cover the
whole map: there is no central-mountain generator plus separately placed background
peaks. Hydraulic sediment transport and talus relaxation operate across that field.
A drainage outlet creates the low valley before route planning; the trail does not
control the underlying geology.

A 1025×1025 Float32 cache stores heights at **3.75 m spacing**, about 4 MiB retained.
Around 100k–140k bounded droplet paths and five talus passes run once during loading.
Elevation is normalized to a seeded budget around the configured elevation scale.
The outer 100 m blends to a 20 m boundary height; beyond the generated domain is
flat continuation. That remote boundary is outside the default hike’s visible area.

The default start is the actual global minimum of the cached field. The destination
is the actual global maximum, normally in its central region. A single seed fixes
all terrain, endpoints, erosion and routes. No generation depends on player travel.

## Endpoint-driven route planning

`createWorld({seed, elevation, trailWidth, targetLength, start?, end?})` defaults
to seed 41729, elevation scale 220, 5 m tread width and 1600 m target length.
Optional `start`/`end` are world `{x,z}` coordinates inside ±1920 m. Their elevations
are sampled from the same field; supplying them does **not** change the geology.
`targetLength` may be 200–5000 m for explicit endpoint experiments.

`trail.mjs` searches a terrain-cost graph using A*: slope and descent penalties
favor traversable valleys, ridge traverses and passes. Several slope weights and
scenic intermediate passes seek the desired length. Different legs avoid one
another; exact and near-closed loops are removed before corner rounding.
Difficult approaches retry with a 4 m navigation grid instead of the usual 8 m.
This replaces the previous radial contour/spiral assumption.

The result is rounded, resampled to 801 points, smoothed and grade-projected to a
30% maximum centerline grade (16.7°). The trail is flattened into the authoritative
height query with a 9 m blending shoulder. It is not an overlapping ribbon.
Grounding and sliding use this query, independently of rendered mesh density.
The fine walking surface now supplies a shared, LOD-independent triangle definition
for both display and collision, as described below.

Length is a routing target, not a guaranteed exact distance: difficult terrain can
produce a shorter/longer route or require conspicuous cut/fill. The default route
is about 1.57 km, roughly 18.7 minutes at 1.4 m/s, or 1.9 minutes at test speed.
Sharper approaches can still require substantial earthworks; bridges and more
sophisticated route engineering remain future improvements.

The lowest valley may hide the summit behind nearer ridges. Endpoint distance
stays within the atmospheric range in the tested seeds; direct line of sight is
not required, as clarified by the user. `sections` contains typed ground ranges
(`{kind:'ground',start:0,end:800}`), leaving an extension point for future bridges.
Bridge selection, geometry and separate elevated walking surfaces are not present.

## Route-driven mesh allocation

`terrain.mjs` divides the whole field into **30×30 persistent 128 m tiles**.
`tile-mesh.mjs` allocates vertex density from distance to the actual route:

- Trail/endpoint tiles: a permanent 2 m baseline, with the sub-metre walking
  patches described below.
- Tiles within a 160 m route buffer: reserve a 2 m grid.
- Intermediate tiles out to a 384 m route buffer: reserve an 8 m grid.
- Remaining terrain: reserve a 32 m grid.

Distance uses each tile’s footprint, so tile extents make these broad corridors,
not exact circular boundaries. Dense buffers follow a changed route/endpoints;
the generated field itself remains identical. Background meshes are just coarser
samples of the same height query, not a separate atmospheric terrain generator.
The 2 m mesh spacing interpolates the 3.75 m geology cache and resolves trail cuts;
it does not create extra geological detail finer than the source cache.

Each tile adds only the edge/center vertices needed to stitch its finer neighbors.
A shared edge always uses the finer allocation’s fixed spacing. Boundary-cell fans
join it to coarser interiors. Positions, normals, colors and UVs match across tiles,
including between 2/8/32 m allocations. All required LOD index patterns are cached at startup; fine-trail tiles keep
one fixed pattern.
No overlapping LOD surfaces, skirts, per-frame mesh allocation or vertex uploads.

Within its allocated density, nearby terrain draws 4 m by default (2 m at quality
2), then 8 m in the intermediate band and 32 m farther out. Trail/endpoint tiles
remain 2 m. LOD checks happen after 16 m travel or setting edits, with 24 m near-detail
hysteresis. Only a changed tile’s reused index buffer is uploaded. Settings cannot
promote distant 32 m allocations into a dense exploration region. Moving far off
trail therefore retains coarse visual terrain, while collision still uses the
fine authoritative field; extending detailed off-trail exploration is future work.

The default allocation stores about **196k vertices**, versus 422.5k for the old
1.28 km all-dense grid. Resident triangle count is about 157k in the default initial
view/settings, varying by route and LOD. The 900 resident tiles are not 900 visible
draw calls: distance culling rejects tiles wholly beyond 1 km, then normal frustum
culling rejects off-screen tiles. All terrain tiles share one material and texture.
The far flat continuation is also skipped when entirely outside the fade range.
It surrounds, never overlaps, the generated map and matches its fine outer edge.

## Atmosphere, surfaces and XR

Terrain fog starts at **650 m** and reaches full sky color at **1000 m**. A small
vertex-shader substitution uses radial view distance, keeping wide/XR views
consistent with distance culling. The camera far plane is 1200 m, behind full fog.
Elevation/slope vertex colors, exposed rock and the single repeating 256×256
mipmapped grayscale noise texture remain. No normal maps, triplanar layers,
postprocessing or shadow maps. Steep faces can show stretched texture mapping.

The physical headset’s local pose is composed with the rig once. Movement and
turning apply first, then world-space sliding translates the rig without changing
yaw or physical head offsets. Ground height is evaluated under the headset’s
world X/Z and smoothed vertically; renderer XR camera world getters are not used.
Physical room-scale movement cannot be blocked by software.

## Queries, diagnostics and failure recovery

- `landscape`: cached field, extrema, domain, generation parameters and timing.
  `mountain` remains an alias for compatibility with earlier inspection code.
- `rawHeight(x,z)`: landscape before trail earthworks.
- `height(x,z)`: carved authoritative terrain, also used by rendering and collision.
- `normal(x,z,out)`: normal components and slope in degrees.
- `trail(x,z,out,global=false)`: distance, tread height and along-route distance.
  The local spatial hash returns Infinity outside its search envelope; global
  projection is used only for twice-per-second diagnostic progress.
- `route`, `start`, `summit` (destination), `landmarks`, `sections`, `extent`,
  `boundaryHeight`, `totalLength`, `maxGrade`, `maxEarthwork`, `generationMs`.

Both web/VR diagnostics share near LOD radius/quality/band, walking speed, slide
threshold and reset. Readouts include FPS, approximate submitted triangles,
last index-update time, combined world + mesh generation time, distance-active tile
count, elevation and geometric trail distance remaining. These update twice per
second. FPS is application cadence, not GPU/compositor timing. Off-trail progress
is nearest-route projection, not checkpoint completion.

Random seed and manual regeneration use `?seed=...`. Diagnostics and seed controls
are initialized before generation. Any setup/generation failure automatically
opens the inline recovery panel; footer/P toggles and both seed controls remain
usable without a world/renderer. Historical failing seed 3307485663 is retained
in the regressions. Entry/module cache versions were advanced for this revision.

## Validation and remaining limits

Run `npm run test:hike` / `node --test projects/hike/tests/*.mjs`. Tests cover unified
near/distant heights, global extrema, seed variation, endpoint changes preserving
geology but moving dense allocation, walkable route grades, determinism, sliding,
translated/rotated XR offsets, persistent buffers, mixed-density live edge indices,
matching vertex shading/UVs, 1 km culling and non-overlapping flat continuation.

Chrome checks cover compilation of the radial fog shader, walking/reset, live
LOD settings, responsive UI, seed regeneration, startup failure recovery and views
from trailhead/midpoint/summit. Final results are recorded below. Changes are local;
no new commit/push is implied by this implementation.

Generation/route solving and mesh baking are synchronous startup work. A Web Worker
is a future loading improvement. Terrain appearance, loading time, sustained FPS,
VR controller mapping/rays, tracking recovery, sliding comfort and a full human
hike still need physical Quest checks. Desktop/headless timings are not headset
benchmarks. Finite index changes can still pop off trail; there is no geomorphing.

### Unified revision checks — 2026-11-10

All **21 Hike tests** passed, including eight seeded landscape/route cases and
explicit endpoints changing dense allocation while retaining identical geology.
Chrome compiled the radial fog shader without errors; walking/reset, P diagnostics,
live LOD controls, responsive layout and both seed-recovery paths passed. Reported
seed 3307485663 loads with an approximately 1606 m route. Whole-map (fog temporarily
disabled for inspection) and normal trailhead/midpoint/summit views were reviewed.
No near/distant terrain layer boundary or independent background generator exists.

Default measurements: 1574 m route, about 196,469 stored terrain vertices, 156,742
resident terrain triangles, and 224 distance-active tiles out of 900. The normal
trailhead view submitted about 29,284 triangles / 68 draw calls in this desktop
run; frustum culling further reduced the active set. World generation took about
0.96 s and tile baking about 0.23 s. These are single desktop observations, not
controlled performance benchmarks or Quest results. Import links and whitespace
checks passed. The user clarified that summit line of sight from the trailhead is
not required. This revision remains local and unpublished.

## Fine trail surface — 2026-11-10

`trail-surface.mjs` constructs a **0.5 × 1 m walking grid** with explicit clipped tread
edges. The extra density is limited to the tread. Only 2 m landscape cells touched
by it are replaced; the remaining parts of those cells form a narrow, coarse bank
transition. Small adjoining cells receive matching edge vertices when needed.
Whole tiles, surrounding landscapes and distant allocations are not made denser.

`planar.mjs` uses locally bundled JavaScript Clipper (Boost Software License 1.0,
with its JSBN notice) for robust offset/intersection/subtraction at startup. Cuts
use quarter-metre coordinates to avoid unstable sliver triangles. Three.js’s
existing Earcut utility triangulates the resulting polygons, with every shared
collinear edge point explicitly reinstated. The new patches replace old terrain
triangles, rather than floating over them. They remain part of the existing tile
meshes and material, so they add no terrain draw calls or new texture layers.

Wide paths also need width-aware route cleanup: the planner now removes folds
closer than the tread can support, using a spatial hash to keep startup bounded.
Endpoints and geology are unchanged; the exact route can differ from the previous
revision. The route still targets roughly 1.6 km.

The actual walking triangle planes are slope-limited, targeting 28 degrees and
validated below 30 degrees. A neighboring-constraint queue preserves the 30%
centerline grade and fixed endpoint heights while correcting tight inside bends.
Banks may remain steep. Invalid surfaces fail into the existing seed-recovery UI.
This fixes geometry that could connect a walkable tread to an adjacent steep bank.

The fine triangle data is a CPU terrain definition, independent of Three.js mesh
objects or LOD. `height()` uses its barycentric surface inside the replaced cells,
and `normal()` uses the corresponding plane. Rendering copies the same data into
the existing tile buffers. Public route elevations, lengths and proximity heights
are refreshed from this corrected surface, keeping grounding and diagnostics
consistent with what is drawn. All fine geometry is persistent; movement does not
allocate or rebuild it.

The cost is additional walking triangles, a cached CPU query structure and startup
clipping/slope solving. There is no per-frame polygon clipping. Physical Quest FPS
and loading time must still be measured. Sub-metre walking triangles, actual
Float32-rendered slopes, exact projected map coverage, manifold patch edges, shared
tile seams and corridor-only added vertices have dedicated regressions.

Width-aware routing can change the earthwork budget on difficult seeds: the seed-1
approach currently needs about 33 m maximum cut/fill. The broad regression budget
is 35 m; actual walking-plane slope and the 30% centerline grade remain strict
checks. Better summit approach planning/bridges remain future improvements.

### Final fine-trail testing — 2026-11-10

- Complete root test command passed, including all **24 Hike tests**.
- Actual Float32-rendered tread triangles were checked below 30 degrees; the
  centerline grade limit, shared grounding heights, persistent buffers and mixed
  tile seams passed.
- Full-map projected triangle area matches the map exactly once, and patch-edge
  manifold checks pass: no overlapping terrain layer or open interior patch edge.
- Added off-grid vertices are confined to the tread and narrow transition cells.
- Chrome: walking/reset, diagnostics/live LOD, responsive layout, normal startup,
  manual/random seed recovery after forced failure and seed 3307485663 passed
  without browser errors. Final trailhead and mid-route screenshots were reviewed.
- Module links, retained vendor notices and whitespace checks passed.

The final grid uses 0.5 m spacing in world X and 1 m in world Z, giving fine tread
triangles while keeping the cost near the original estimate. Default: **34,334
walking triangles**, about **6,887 bank triangles**, and **210,576 resident terrain
triangles** at initial settings/location. Tile draw-call count is unchanged.
Exact counts vary with the seed and route. The default route is about 1582 m.

### Outstanding issues / validation

1. **Quest functionality validated by the user (2026-11-10).** The hike works on
   Quest, with slow but functional generation. This is user headset feedback, not
   a formal sustained-FPS/memory benchmark. The bank-smoothing change below still
   needs a headset retest against the reported inside-turn spike.
2. **Startup remains synchronous.** Routing, clipping and slope correction can
   block interaction during generation; difficult seeds take longer. A loading
   worker or staged generation is not implemented. None of that polygon work runs
   during normal walking.
3. **Steep banks and large earthworks remain possible.** The walking surface is
   slope-validated, but its adjoining banks are not constrained to walking grade.
   Seed 1 needs roughly 33 m maximum cut/fill at a difficult approach. Better
   summit routing and bridge construction remain deferred.
4. **The sampling grid is world-aligned.** It is not adaptive to the trail tangent;
   quarter-metre clipping coordinates can make close-up tread outlines slightly
   angular. Adaptive route-aligned sampling is explicitly deferred by the user.
5. **Off-trail terrain keeps its existing density/LOD tradeoffs:** coarse geometry
   outside the corridor and finite index transitions can still pop or differ from
   the finer authoritative ground query. No geomorphing has been added.
6. **Seed coverage is finite.** Tests cover multiple seeds including previous
   failures; bounded routing/surface solving can still reject an untested seed.
   Recovery controls remain available in that case.

Release status: the user authorized committing and pushing the tested unified-
landscape and fine-trail changes on 2026-11-10. Git history records the release
commit. GitHub Pages deployment was not checked, as requested.


## Inside-turn bank smoothing — 2026-11-10 (local)

The user validated that the hike functions on Quest and reported slow generation
and occasional single-vertex spikes on the inside of sharp turns. No reproducing
seed/location was available. Trail-grid changes are deferred.

After the existing walking-plane correction, `smoothBankPeaks` removes isolated
upward peaks in bank-only vertices inside the replacement patch. A peak exceeding
all its connected neighbors by more than 2 cm is lowered to their inverse-distance
weighted mean. The pass reads original heights before applying edits; ordinary
slopes, walking vertices, fixed endpoints and the patch perimeter stay unchanged.
This targets narrow bank remnants enclosed by trail geometry without adding
vertices, changing topology or performing per-frame work. Rendering, height and
normal queries use the same corrected surface. Open-boundary spikes and broader
ridges are outside this deliberately limited correction.

The default seed smooths five bank vertices, including a regression case at
(-388, 148). All **28 Hike tests** pass, including peak removal, preserved slopes
and boundaries, deterministic traversal, rendered grounding, existing walking
slope limits, shared seams and exact map coverage. Headless Chrome loads and
renders with no page errors; maximum walking slope remains about 28 degrees.
Entry/world/surface cache versions were advanced. `git diff --check` passed.

Slow synchronous generation remains outstanding. This change is local, uncommitted
and unpublished; the exact user-observed spike has not been confirmed fixed on
Quest because no reproducing seed/location was available.


## First generation optimization pass — 2026-11-10 (local)

CPU sampling across seeds 41729, 1 and 3307485663 identified A* routing as the
largest startup cost (roughly half the sampled CPU time). This pass preserves
search ordering, route candidates, smoothing iterations and terrain detail:

- `trail.mjs` precomputes the eight grid-edge lengths and lazily caches goal
  distances across relaxations/searches sharing a destination. A different goal
  invalidates the single cache. Fixed route-segment grade limits are calculated
  once instead of inside each of the 160 smoothing passes.
- `geology.mjs` visits only the drainage outlet's bounding square in both drainage
  passes, preserving the original update order and radius test.
- Entry, world, routing and geology cache versions were advanced.

The heuristic cache adds about 1.8 MiB at the normal 8 m navigation grid and
7.0 MiB at the fallback 4 m grid (about 8.8 MiB combined during recursive fallback).
These arrays become collectible after routing; there is no new retained world
cache or per-frame work.

Desktop Node measurements of world generation plus tile baking, using an
unprofiled baseline and the mean of two optimized runs in fresh processes:

| Seed | Before | After | Reduction |
| --- | --- | --- | --- |
| 41729 | 4.08 s | 3.84 s | 5.7% |
| 1 | 6.23 s | 5.71 s | 8.4% |
| 3307485663 | 3.92 s | 3.65 s | 6.9% |

These are small-sample desktop observations, not Quest benchmarks. SHA-256
comparisons of landscape height bytes, serialized route and surface vertices,
and every tile's rendered position buffer match the pre-optimization results for
all three seeds, including the existing bank smoothing. The 28 Hike tests and
`git diff --check` pass. Generation still blocks synchronously; worker/staged
loading and further route-search optimization remain future work. Quest loading
speed for this revision has not been measured. Changes remain local, uncommitted
and unpublished.


## Loading card and summit marker — 2026-11-10 (local)

Removed the floating summit/destination text sprite and its elevation label;
the mast and gold flag remain. The web loading message now appears in a centered,
responsive dark card: large “Shaping the mountain...” with smaller “Please wait
a moment.” below. The intro is hidden during loading. Two animation frames allow
the card to paint before synchronous generation starts; it disappears after the
first world render or on failure, leaving seed-recovery diagnostics accessible.
The footer retains its normal in-world status. App/CSS cache versions advanced.

Chrome checks passed at desktop and mobile widths: centered card, successful
startup hiding it, flag retained without sprite, and forced generation failure
hiding the card and opening recovery. Normal startup produced no page errors.
Mobile screenshot visually reviewed; `git diff --check` passed. Changes are local,
uncommitted and unpublished.


## Level destination landing — 2026-11-10 (local)

The destination now has a level arrival disk of **3 m diameter**, centered beneath
the retained flag at the existing endpoint elevation. A smoothstep shoulder blends
the prepared ground into the original terrain over the next 4 m. This preparation
happens before route planning, so navigation heights and route engineering see it.
The underlying seeded geology/cache and `rawHeight()` remain unchanged; explicit
endpoints prepare their own destination without relocating or regenerating geology.

Route elevation planning reserves a level final approach, including a fine-cell
and route-sample margin. After clipping, walking triangles touching the 1.5 m
radius disk are fixed to destination elevation before the existing slope solve.
The triangle-aligned flat edge can extend slightly beyond the requested disk;
there is no new overlay, extra mesh density or separate collision surface. This
keeps the whole disk level in both rendering and grounding. Trail carving uses
prepared terrain without reapplying the shoulder over the engineered approach.

The landing and its approach can increase earthworks: seed 1 now needs about
35.13 m maximum cut/fill, compared with roughly 33 m previously. The broad
regression allowance is now 36 m. The 30% centerline and sub-30-degree walking-plane
limits remain unchanged. Existing steep-bank limitations still apply outside the
arrival/trail surface.

Validation covers radial height/normal samples throughout the disk across eight
seeds, a custom destination, rendered landing triangles, and all existing Hike
checks. Chrome loaded without page errors; a close summit view was inspected with
the flag standing on the flat surface. App/world/trail/surface cache versions were
advanced. Changes remain local, uncommitted and unpublished; headset appearance
of the new landing has not been tested.


## Follow-up release — 2026-11-10

The user authorized committing and pushing the bank-peak smoothing, generation
optimizations, centered loading card, summit-label removal and level destination
landing together. The final scoped Hike suite contains 30 tests. Browser checks
and limitations are documented above; Quest retesting remains outstanding for
these changes. No runtime changes outside Hike are included. Git history records
the release commit; pushing main triggers GitHub Pages publication.
