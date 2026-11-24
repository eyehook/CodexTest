# Mount Snow — terrain viewer

Buildless Three.js r180 terrain viewer for desktop and Quest, with mapped
downhill pistes in pale blue, likely tree canopy in green, simple lift models,
instanced pine trees, and ground-following skiing.

## Versioning

[version.mjs](version.mjs) defines the `major.minor.patch` version shown in the
page header and browser title. Starting with `0.1.0`, increment the patch for
each completed Ski edit, including local edits. Keep the entry script and
version import query values in sync. Update cache keys for any other changed
runtime files. Reset patch to zero when deliberately bumping major or minor.

## Preview and controls

Serve the repository root and open `/projects/ski/`. For Quest over USB, use
the [local VR launcher](../../Start-VR.command) and open the same route in
Quest Browser. Both modes start at the shared Big Dipper and Cloud Nine
trailhead (1,094.65 m NAVD88), facing down Big Dipper into Sunbrook.

- Desktop: WASD to walk or strafe, left/right arrows to turn, up/down arrows
  to look. Eye height is 1.7 m.
- Quest: left stick to walk or strafe, right stick to turn. The ground rig
  follows the DEM beneath the tracked head, with eye height from local-floor
  headset tracking.
- Quest lift map: press **Y** on the left controller to open or close the
  panel. It follows the tracked left hand and faces the viewer.
  Aim with the right controller and pull the trigger to choose a resort area
  and then a lift. The panel closes on teleport. A tracked right hand can
  point and pinch to select an open menu. Gray pills mark tracked hand or
  controller positions. Locomotion pauses while the panel is open.
- Full stick or keyboard input walks at 10 m/s and turns at 90°/s. Travel is
  clamped to the dataset extent.
- Quest ski mode: press the right trigger to push off in the direction
  you're looking. Steer with left-stick left/right and squeeze the left
  trigger to brake. Release and press the right trigger again to boost.
- Desktop ski mode: Space pushes off or boosts, A/D or left/right
  arrows steer, and Shift brakes. A full stop automatically resumes walking
  in both modes.

## Ski motion

[The ski simulation](ski-motion.mjs) projects gravity onto the local slope
sampled from the DEM. Momentum carries across the slope, steering changes
course with a speed-dependent turn rate, and sliding resistance plus
quadratic air drag slow the skier. The launch is 5.5 m/s and each fresh
boost adds 3 m/s along the current course. Brake pressure controls
deceleration. The rig follows the ground and smoothly turns toward actual
travel direction, including downhill drift. A 5° yaw dead zone limits small
corrections, and course following only runs above 1 m/s. The right stick has
no ski-mode binding. Head tracking remains independent of rig yaw.
The map, lift teleports, and tracking loss stop the current run. Skiing
also ends at the terrain edge or when speed reaches the standing threshold.

The skier leaves the snow when terrain curvature at the current speed
would require the surface to pull the skier downward, and a ballistic step
clears the next surface sample. Takeoff uses the surface grade over the
previous 1.5 m and has no fixed speed threshold. The drag model assumes a
165 lb skier. Mass cancels out of the gravity and contact equations. In the
air, gravity acts vertically and horizontal momentum carries through.
Steering, braking and boosts resume on snow contact. The XR rig follows
the airborne height without adding camera pitch or roll.

## Terrain rendering

[terrain.mjs](terrain.mjs) uses 256 m frustum-culled tiles, with 2, 4, 8, 16
and 32 m vertex spacing in distance bands. Like The Hike, it chooses detail
by player position on a snapped grid and stitches geometry across detail
boundaries. Tiles rebuild vertex data on spacing changes and reuse vertex
samples when only the edge topology changes. Indices are cached by topology.
The 1 m elevation grid remains available for ground queries.

The shader grades elevation from blue-gray low terrain to bright snow at
high elevations. DEM normals shade slopes, and a 4 m baked visibility texture
adds ridge shadows from a fixed northwest sun at 15° elevation. To regenerate
it after preparing the DEM, run `python projects/ski/bake-shadows.py` in the
same Python environment. Distance haze softens the far terrain. The viewer
uses a single terrain material. The trail mask blends pale blue (`#B8DDEB`)
into the snow before lighting, so trails inherit slope shading and distance haze
across all LODs. Near the viewer, forest ground uses the snow palette.
From 180 m to 200 m, the shader blends in the green canopy mask, which
represents distant forest after the individual trees fade out.

## Source and coverage

Elevation comes from the Vermont Center for Geographic Information and USGS
3DEP Spring 2023 QL1 hydro-flattened bare-earth DEM. The native 35 cm samples
use Vermont State Plane NAD83(2011), EPSG:6589, and NAVD88 orthometric elevations
in meters (GEOID18). See [VCGI's dataset metadata](https://maps.vcgi.vermont.gov/gisdata/metadata/ElevationDEM_DEMHF0p35M2023.htm).

The acquisition uses the handoff's provisional WGS84 rectangle, 42.945° to
42.980° N and −72.940° to −72.875° longitude. It encloses that rectangle in
the projected grid and includes a small native margin for resampling. The
native GeoTIFF crop retains the original float samples from the remote tile
windows and is held locally in `source/`. The [runtime metadata](data/mount-snow-1m.json)
records the source tiles, grid origin, spacing, and elevation range.

## Build and consume

Use a Python environment with Rasterio and NumPy, then run
`python projects/ski/prepare_dem.py` from the checkout. The first run reads
public GeoTIFF windows over HTTPS. Later runs reuse the native crop. Remove
the cached crop before rebuilding with a different footprint.

[heightmap.mjs](heightmap.mjs) fetches and decompresses the grid in the browser.
The returned object exposes `height(x, z)` for bilinear elevation sampling
and `normal(x, z, out)` for reusable surface normals with slope in degrees.
These match the elevation and normal interfaces used by
[The Hike's terrain sampler](../hike/terrain-samples.mjs). Its procedural
color, trail and world-generation inputs are separate from these interfaces.

Local X increases east and local Z increases south at one unit per meter.
The northwestern sample is (0, 0) in local coordinates. Absolute projected
coordinates are `easting = firstSampleEasting + x`,
`northing = firstSampleNorthing - z`. Height is absolute NAVD88 meters.
Queries outside the grid clamp to its edge. The data is a 1 m grid resampled
from the native DEM and rounded to the nearest centimeter for encoding.
Terrain vertices use the same absolute elevations as ground sampling.
The loader applies a sparse centimetre adjustment to the runtime grid
after loading, so the renderer and skier see the same groomed surface.

## Piste data

The [retained OpenStreetMap extract](source/mount-snow-pistes.osm) contains
125 centerline ways, six closed piste areas and five route relations. Main
Face, North Face, Sunbrook and Carinthia are represented. The crop remains
provisional and mapped coverage can differ from the resort inventory.
The [mask and trailhead manifest](data/mount-snow-pistes.json) use the same
local coordinates as the DEM. The 2 m mask uses mapped area boundaries and
buffered centerlines. Centerlines without a mapped width use a 24 m corridor.
These widths are for visual testing and may differ from actual cleared runs.

Run `python projects/ski/bake-pistes.py` with Rasterio, NumPy and Shapely
to rebake from the retained snapshot. To refresh it, download the
[OSM map extract](https://api.openstreetmap.org/api/0.6/map?bbox=-72.940,42.945,-72.875,42.980)
and pass its path with `--osm-map`. The baker samples the high endpoint of
each centerline against the DEM and generates the starting position and
downhill heading. Big Dipper and Cloud Nine tie at the same OSM node.

Piste data and mask © OpenStreetMap contributors, licensed under the
[Open Database License](https://www.openstreetmap.org/copyright).
[Mount Snow's trail maps](https://www.mountsnow.com/the-mountain/about-the-mountain/trail-maps.aspx)
are the resort coverage reference.

## Piste smoothing

The mapped piste interiors use a Gaussian-smoothed version of the 1 m
elevation grid (3 m sigma), with a 5 m inward edge taper and a maximum
vertical adjustment of 75 cm. Blue areas follow the existing piste mask,
including mapped glades. The outer boundary samples stay at their original
elevations. The original lidar crop and base heightmap are retained.

After preparing the DEM and piste assets, run
`python projects/ski/bake-piste-smoothing.py`, then
`python projects/ski/bake-shadows.py`. The first script records the sparse
adjustment asset in the elevation manifest. The second uses the same
adjusted elevations to bake ridge shadows. The browser applies the
adjustments once during loading.

## Lift destinations

The [retained OpenStreetMap lift extract](source/mount-snow-lifts.geojson)
contains 13 chairlifts, five carpets and the Voyager rope tow. The
[19 destinations](data/mount-snow-lifts.json) are grouped by resort area,
including Main Face Learning Area and Tubing Hill. Names and groupings are
based on the [resort lift listings](https://www.mountsnow.com/explore-the-resort/about-the-mountain/hours-of-operation.aspx).
Lift routes are rendered with simple static geometry. Chairlifts have posts,
cables and small chairs, carpets have teal strips, and Voyager has a low
rope line. Orange blocks mark both ends of every route. All positions are
based on mapped centerlines and terrain heights. Support spacing, cable
clearance, and chair locations are approximate. Each lift uses one culled
instanced batch.

Lift geometry is © OpenStreetMap contributors under the
[Open Database License](https://www.openstreetmap.org/copyright).

Run `python -B projects/ski/bake-lifts.py` to rebake from the retained geometry
with the same GIS environment used for pistes. Pass `--osm-map` with the
resort OSM XML to refresh the lift extract. The higher DEM endpoint is used
as the upper terminal. Each arrival is approximately 8 m from it, with at
least 2 m of clearance from mapped building footprints. These are estimated
unloading locations. The teleport keeps your facing and places your tracked
head over the destination in X/Z, with the rig floor set by the local DEM.

## Canopy data

[VCGI's 35 cm first-return DSM](https://maps.vcgi.vermont.gov/arcgis/rest/services/EGC_services/IMG_VCGI_LIDARDSM_SP_NOCACHE_V1/ImageServer)
and the bare-earth DEM come from the spring 2023 QL1 lidar survey. The native
GeoTIFF crops are retained locally in `source/mount-snow-dsm-35cm.tif` and
`source/mount-snow-35cm.tif`. They share the same extent, grid and datum, and
both are Git-ignored.

Run `python -B projects/ski/bake-canopy.py` in the same GIS environment as
the piste baker. It downloads the native DSM crop when missing and subtracts
the bare-earth elevation before testing for a difference strictly greater
than 5 m. The [canopy manifest](data/mount-snow-canopy.json) describes two
aligned 2 m grids. The uint8 asset stores the fraction of each cell above the
threshold and drives the green overlay. The little-endian uint16 asset stores
the mean height in centimeters of the qualifying pixels for future placement.

Mapped building footprints and 3 m buffers around mapped lift pylons are
excluded using the [retained structure extract](source/mount-snow-structures.geojson).
Refresh it with the OSM XML from the piste workflow and the `--osm-map`
option. Structure data © OpenStreetMap contributors under the
[Open Database License](https://www.openstreetmap.org/copyright).
Tall unmapped structures can still register as canopy candidates. Piste
corridors, including glades, are left available for visual comparison.

## Trees

[trees.mjs](trees.mjs) uses one low-poly model with three foliage tiers and a
trunk. Grid coordinates seed the position, height, crown radius, yaw and
color. A jittered 6 m grid gives each eligible cell a 50% spawn chance. The
jittered position must have at least 25% lidar canopy coverage in its 2 m
cell. Tree height is 1.5 times the lidar-derived height with ±15% variation.
Crown radius uses the unscaled height. A candidate is skipped when its crown
would overlap a mapped piste cell, including mapped glades. The distant
canopy tint still reflects the lidar survey.
The distance blend uses the same horizontal viewer position and fade range
for the trees and terrain canopy mask.

Trees are instanced in frustum-culled 96 m chunks. Chunks near the viewer
stay resident and rebuild deterministically when revisited. A world-stable
dither fades trees from 180 m to 200 m horizontally, with opaque depth writes.
No tree collision or dynamic tree shadows. A fully eligible 200 m radius
would average roughly 1,745 trees before frustum culling. Actual Quest frame
time and the visual fade still need headset testing.

## Validation

The native crop has no missing cells. The browser grid has 5,324 columns and
3,916 rows and spans about 5.32 km east–west by 3.92 km north–south. The gzip
asset is 36 MiB and decodes to about 40 MiB of unsigned 16-bit samples. The
summit-area check returned 1,092.86 m on the runtime grid and 1,092.87 m in the
native source. Node checks exercised the loader, interpolation, normals and
The Hike's near and far elevation sampling. The tile regression
(`node --test projects/ski/tests/*.mjs`) checks mixed-resolution edge vertices,
coverage and winding. Desktop Chrome loaded the real grid, rendered the
terrain, and responded to walking and turning with no shader or page errors.
The piste bake is byte-reproducible from the retained extract. The mask was
checked against representative centerlines on all four faces, and desktop
Chrome showed the blue overlay from the Big Dipper start.
Canopy checks verified the strict threshold, coverage/height agreement and
structure exclusions. Chrome displayed the green overlay and blue pistes
together at the trailhead.
Simulated XR input checks cover Y button edges, left-hand anchoring, tracked markers, trigger and
pinch selection, and ray targeting under a rotated player rig. The destination check covers all 19 lifts. Quest gesture comfort,
panel legibility, stereo seams and sustained frame rate still need headset
validation.

Focused ski checks cover gravity on uphill/downhill grades, boost, braking,
steering, stopping at the terrain boundary, 72 Hz versus 120 Hz integration,
course following during cross-slope drift and across the yaw wrap, and
crest takeoff and landing with steady-incline and low-speed controls.
