# The Hike — Milestone 1

## Current state

Buildless desktop/WebXR prototype at `projects/hike/`. The user authorized publication on 2026-11-10; consult Git history and GitHub Pages
for the current release/deployment state. A single seeded mountain replaces the previous fixed three-peak layout.
No vegetation, wildlife, collectibles or bridges are implemented.

Serve the repository root with `python3 -m http.server 8080 --bind 127.0.0.1`,
then open `/projects/hike/`. For Quest use root `Start-VR.command` over USB or
HTTPS after a separately authorized publication. All runtime dependencies are local.

## Controls and test settings

- Desktop: Start walking, WASD / up/down arrows; mouse look after clicking the
  world; left/right arrows turn. Esc releases mouse, P opens diagnostics, R resets.
  After using a diagnostic button, click the world to return keyboard/mouse focus.
- Quest: left stick walks relative to the headset, right stick smoothly turns at
  60°/s about the physical headset. B/Y toggles field notes; controller ray + trigger
  adjusts controls. The panel opens 45° right at 2.1 m and stays world locked.
- Current testing speed is **14 m/s**, ten times normal 1.4 m/s. The shared web/VR
  control range is 0.7–30 m/s. A normal hike remains approximately 18–20 minutes.
- Slopes above **35°** cause automatic downhill sliding with steering and turning
  still active. No slope-based blocking. Drift starts at 1.15× walking speed,
  accelerates under gravity and is capped at max(6 m/s, 1.5× walking speed).
  Short steps and a boundary search stop sliding on gentler ground. Reset clears it.
- Hidden/untracked XR suspends navigation and pointers. Entry/exit resets to the
  trailhead, with tracked physical head offsets and floor height preserved.

## Source map

- `geology.mjs`: seeded mountain structure, hydraulic erosion, talus relaxation,
  cached heightfield and actual summit selection.
- `trail.mjs`: contour-following route search and grade/earthwork validation.
- `world.mjs`: authoritative terrain/trail queries and spatial hash.
- `terrain.mjs`: persistent mesh pool and index-only LOD.
- `surface.mjs`: baked elevation/slope palette and broad world-space mottling.
- `detail-texture.mjs`: shared 256×256 mipmapped noise bitmap.
- `movement.mjs`: independent downhill sliding.
- `app.mjs`: shared XR/UI integration, desktop input, grounding and scene.
- `tests/`: deterministic generation, route, sliding, mesh persistence and seams.

## Single-mountain generation

`createWorld({seed, elevation, trailWidth, targetLength})` defaults to seed 41729,
elevation scale 220, width 5 m and target route length 1600 m. Elevation scale is
not an exact summit height. The seed changes summit position, elliptical footprint
(260–490 / 280–500 m radii), orientation, overall height, summit cap width,
profile, flank asymmetry, spur count/strength/twist, a localized headwall hollow
and erosion intensity. Spurs belong to one dominant peak, not independent cones.

Generation samples a 513×513 Float32 heightfield spanning ±640 m (2.5 m spacing).
A rounded apex feeds asymmetric radial ridges and branching detail. A bounded
45k–80k droplet transport pass erodes downhill water and deposits sediment; five
short talus passes remove isolated needles while preserving ridges. This is a
compact visual erosion approximation, not a full geological simulation.

The maximum cached height selects the destination summit. All later rendering,
normal and collision queries bilinearly sample this same immutable world-space
field. The retained heightmap is approximately 1 MiB. Generation and erosion run
once at page load, currently synchronously, not in the render loop. Startup can
pause longer on Quest; worker generation is a possible later improvement.

The footprint fades to zero before its square boundary. Outside it is a flat
plain, with no surrounding mountains or scenery. Seeded world coordinates remain
independent of player movement and LOD, suitable for future scenery placement.

## Terrain-following trail

The planner searches visible starting aspects around the mountain. For each of
up to eight initial candidates, it traces increasing elevation contours along a winding
ascent, adjusting angular travel toward the requested length. This wraps around
the actual mountain, not a fixed sinusoid in world Z. It is not a general A* route
planner, and currently favors an ascending spiral rather than discrete hairpins.

Pixel-scale contour wiggles are smoothed, tread elevations are grade-projected
in both directions, and valid candidates are scored by earthworks with an extra
penalty for the largest cut/fill. Valid routes remain 1.5–1.7 km with centerline
grade ≤30% (16.7°). The default is approximately 1.60 km and a 227 m summit.
The tread is carved/flattened in the authoritative height function with a 9 m
blending shoulder, never rendered as an overlapping ribbon. Significant cut/fill
can still occur on difficult seeds; a global route search could improve this.

Twenty-four starting aspects are checked for line of sight to the summit marker.
Reset now faces the generated summit rather than a fixed compass direction.
Current routes are entirely ground-supported. `sections` records typed ground
ranges (`{kind:'ground', start, end}`) as a starting point for future elevated bridge
sections; bridge selection, geometry and separate walking surfaces remain future work.

Queries:

- `rawHeight(x,z)`: eroded heightfield before trail earthworks.
- `height(x,z)`: authoritative carved terrain surface.
- `normal(x,z,out)`: normal components and slope in degrees.
- `trail(x,z,out,global=false)`: lateral distance, tread height and along-route distance.
  Local mode uses a segment hash and returns Infinity outside its search envelope;
  global mode projects onto the entire route for twice-per-second diagnostics.
- `route`: x/y/z and cumulative 3D distance; `start`, `summit`, `landmarks`, `sections`,
  `totalLength`, `maxGrade`, `maxEarthwork`, `generationMs` and `mountain` metadata.

## Persistent LOD, rendering and surfaces

100 permanent 128 m tiles each own preallocated 65×65 position/normal/color/UV
arrays and a maximum-capacity index buffer. Geometry is sampled once at 2 m
spacing. Indices select 2/4/8/16 m interiors. The trail corridor and generated summit
stay at 2 m; there are no hard-coded side-peak coordinates. Every tile renders a
fixed fine perimeter, with coarse boundary cells fanning into existing center
vertices: shared edges have no overlapping LOD layers, skirts or T-junctions.

LOD updates after 16 m displacement or a setting change, with 24 m near-detail
hysteresis. Defaults: radius 160 m, quality 1 (4 m nearby), intermediate band 160 m
(8 m), then 16 m. Quality 2 uses 2 m nearby. Ordinary movement only changes indices;
no mesh creation or vertex/color uploads. Steep off-trail interiors can still pop
at finite LOD changes; there is no temporal geomorphing. The whole mountain stays
resident, and frustum culling only removes tiles outside the camera view.

Shared Lambert lighting, elevation colors (green/ochre/brown/gray/white), exposed
rock on steep slopes and the noise texture remain. The 12 m world-space texture
repeat is stable across LODs. One 256×256 RGBA bitmap with mipmaps uses about
341 KiB plus approximately 3.2 MiB static UVs; no normal/triplanar maps. Near-vertical
faces can show stretched texture mapping. No postprocessing or shadow maps.
The exterior plain surrounds, rather than overlaps, terrain; this avoids the
previous flat-base depth-buffer flickering.

Grounding uses the authoritative surface beneath the physical headset's world
X/Z with exponentially smoothed rig elevation. Locomotion/turning is applied
first, then sliding adds world-space translation without changing yaw or physical
head offsets. XR poses are composed with the rig once; renderer XR-camera world
getters are not used for collision. Physical room-scale movement cannot be blocked.

## Diagnostics and regeneration

Both views share detail radius/quality/band, walking speed, slide threshold and
reset. Readouts refresh twice per second: application FPS, submitted triangles
(approximate terrain count including small UI/marker geometry, stereo count in XR),
last changed LOD update time, combined world + mesh generation time, resident tile
count, elevation and geometric distance remaining. Nearest-route progress can
change when exploring off trail; it is not a checkpoint system.

The top web Random seed button picks a new effective 32-bit seed and immediately
reloads/regenerates using `?seed=...`. The manual seed field remains. Seed changes
now alter the whole mountain and route, not just surface detail. Entry/module query
versions were advanced for browser/headset cache refresh.

## Validation / limits

Run `npm run test:hike` or `node --test projects/hike/tests/*.mjs`. The full root
suite also includes these tests. The focused suite covers seed/query-order
repeatability, large-scale normalized shape differences, a single connected high
summit region, finite heightmap data, visible summit markers, bounded route length,
grade/earthworks, trail walking, normal/distance queries, sliding/turning with
physical head offsets, persistent objects/buffers and matched tile boundaries.

Chrome checks cover startup, walking/reset, web diagnostics, live LOD settings,
responsive layout and base/mid/summit views. Four generated seeds were visually
compared. A separate batch examined additional seeds including unsigned/signed
limits. Final measurements and checks are recorded below.

Physical Quest testing remains required for visual realism and seed variety,
stereo appearance, controller mapping/rays, tracking loss/resume, physical head
turn/reset offsets, sliding/height-following comfort, loading time and sustained
FPS. Headless Chrome timings are not a headset benchmark. No human 20-minute
hike or bridge traversal has been validated.

### Completed single-mountain checks — 2026-11-10

All 18 Hike tests passed, including eight seeds in the topology/summit/route
regressions. An additional seed batch covered 0–10, 123, 456, 789 and signed/unsigned
limits; generated routes remained 1.5–1.7 km with centerline grades at or below 30%.
Chrome walking/reset/diagnostics/live LOD/responsive checks and random-seed
regeneration passed with no browser errors. Four seeded shapes and ground-level
views were visually reviewed. The exterior ground now matches every 2 m terrain
perimeter vertex; the final overhead view no longer shows thin boundary cracks.
Project imports and `git diff --check` passed.

Final default: 1600.0 m route, 227.0 m summit, approximately 4.0 m maximum cut/fill
and 184,584 resident terrain triangles. Cached geology + route generation measured
roughly 0.47–0.51 seconds in desktop runs, with mesh baking about another 0.23 s;
these are not controlled benchmarks or Quest results. Loading work increased,
while per-frame erosion remains zero. Quest visual/loading/FPS checks remain open.

### Failed-seed recovery — 2026-11-10

Reported seed **3307485663** reproduced an ascent failure. The search previously
kept only the final bisection trial even though contour changes make route length
non-monotonic. It now retains every valid trial and searches other visible aspects
and the opposite direction when necessary. A second reproduced failure, seed 15,
needed a larger winding range; the upper bracket now expands up to a bounded 20.
Length and walking-grade validation remain enforced. Both seeds are included in
the generation regressions.

Seed buttons, manual regeneration and diagnostic toggles are initialized before
world generation. Any generation/setup exception automatically opens diagnostics
and displays the failed seed and error inline; the intro is hidden. Random seed,
manual seed, the footer toggle and P remain usable without a world/renderer. Entry
and world/trail module cache versions were advanced.

All 18 focused tests and whitespace/syntax checks passed. Chrome forced-failure
checks confirmed automatic diagnostics and recovery via both manual and random
seeds; the reported seed also loaded normally.

### Initial release review — 2026-11-10

The user authorized committing and pushing The Hike. Reviewed all new project
source/tests and scoped directory, documentation and test-registration changes.
The complete root suite passed, including all 18 Hike regressions. Entry links,
module imports and whitespace checks passed. Prior Chrome checks include normal
controls, random regeneration, the reported seed 3307485663, and forced-failure
recovery through manual and random seed controls.

The 14 m/s testing speed and 35-degree sliding threshold are intentionally retained.
Bridges remain deferred. Physical Quest performance/comfort and the complete
human hike remain unverified; publication does not establish those results.
