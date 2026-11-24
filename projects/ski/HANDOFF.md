# Mount Snow — terrain viewer

Buildless Three.js r180 terrain viewer for desktop and Quest, with mapped
downhill pistes in pale blue, likely tree canopy in green, simple lift models,
instanced pine trees, and ground-following skiing.

## Start here

- Current version **v0.1.40**. Start with [app.mjs](app.mjs) for the runtime,
  [ski-motion.mjs](ski-motion.mjs) for controls and physics, and
  [terrain.mjs](terrain.mjs) for terrain, lighting and tile updates.
- The newest rendering change is the **2048² PCFSoft pine-shadow filter**.
  Chrome verified both shadow settings. Quest appearance and frame time
  remain open. If skiing still snags, compare the same route with Shadows
  on and off before changing the filter, tree range or tile budget.
- The repository contains the generated browser assets. GIS tools and the
  native lidar crops are needed only to rebuild data.

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
- Quest settings: press **B** on the right controller to open or save and
  close. The landscape is hidden against black. The panel stays upright to
  the floor and faces your horizontal heading at opening. Point and pull
  the trigger to choose a tab or change a setting. **Graphics → Trees**
  toggles individual pine models. With Trees off, the green canopy tint
  is visible at every distance. **Graphics →
  Shadows** enables local pine and ski shadows. **VR → Height
  Offset** raises the tracked view and hands by 0–2 m in 0.05 m steps for
  seated play. Preferences load on startup and apply when the menu closes.
- Quest lift map: press **Y** on the left controller to open or close the
  panel. It follows the tracked left hand and faces the viewer.
  Aim with the right controller and pull the trigger to choose a resort area
  and then a lift. The panel closes on teleport. A tracked right hand can
  point and pinch to select an open menu. Gray pills mark tracked hand or
  controller positions. Locomotion pauses while the panel is open.
- Full stick or keyboard input walks at 10 m/s and turns at 90°/s. Travel is
  clamped to the dataset extent.
- Quest ski mode: press the right trigger to push off along the skis. Steer
  with either thumbstick and squeeze the left trigger to brake. Hold the right trigger to tuck, and release to stand.
  Press **A** to push with your poles, including from walk mode.
- Desktop ski mode: Space pushes off, hold Space to tuck, A/D or left/right
  arrows steer, E pole-pushes, and Shift brakes. A full stop automatically
  resumes walking in both modes.

## Settings

[settings.mjs](settings.mjs) uses the shared control model and VR slider
panel, with inline Trees and Shadows checkboxes and the Height Offset slider.
Defaults are Trees on, Shadows off and 0 m height offset. The browser saves
on B close and when leaving XR with the settings open. While the menu is visible,
walking, skiing and the lift map are suspended. The VR offset lives on a
child rig containing the camera, hands and menus, so terrain contact and
teleport elevations stay in terrain coordinates. When trees are off, the
renderer skips tree batch updates and uses the canopy tint at all distances.

## Ski motion

[The ski simulation](ski-motion.mjs) projects gravity onto the local slope.
Either stick rotates the skis at 1–45°/s, based on how far it is deflected
past the dead zone. Ski angle is limited to 45° from the rig.
Snow contact resists sideways motion across the skis, so actual travel
depends on momentum, slope and edge grip. The rig slowly turns toward
the skis at up to 40°/s. Neutral input brings the skis back to center at
45°/s, then the rig holds its heading. Airborne steering turns the skis and
rig while horizontal flight momentum carries through. Head tracking remains
independent of rig yaw.

Ski steering has a 5% stick dead zone. The first stick outside it owns
steering until it returns to neutral. If both engage on the same frame,
the stronger input wins, with left taking an exact tie. The visible 1.70 m skis
follow the tracked horizontal footprint and pitch to match the snow.
The player can look down to see them while skiing.

The right-trigger launch is 5.5 m/s. A pole push from walk mode starts at
5 m/s. While skiing on snow, each fresh press adds 5 m/s along the current
course at any speed. Pole pushes have no effect in the air. Sliding
resistance and air drag slow the skier.
Holding the right trigger while skiing eases the head toward 1 m above
the ski stance, including when a seated offset is set, and reduces
aerodynamic drag to 48% at full tuck. Releasing an engaged tuck on snow
immediately adds a 2.5 m/s upward impulse, including on flat terrain. Brake
pressure controls deceleration. The map, lift teleports, and tracking loss
stop the run. Skiing also ends at the terrain
edge or when speed reaches the standing threshold.

The skier leaves the snow when terrain curvature at the current speed
would require the surface to pull the skier downward, and a ballistic step
clears the next surface sample. Takeoff uses the surface grade over the
previous 1.5 m and has no fixed speed threshold. The drag model assumes a
165 lb skier. Mass cancels out of the gravity and contact equations. In the
air, gravity acts vertically and horizontal momentum carries through.
Steering, braking and drag from the tuck apply on snow contact. The XR rig follows
the airborne height without adding camera pitch or roll.

## Terrain rendering

[terrain.mjs](terrain.mjs) uses 256 m frustum-culled tiles, with 2, 4, 8, 16
and 32 m vertex spacing in distance bands. Like The Hike, it chooses detail
by player position on a snapped grid and stitches geometry across detail
boundaries. Spacing changes are queued nearest-first, with at most two
tiles processed per animation frame and a 2 ms soft CPU budget. A tile and
its neighbors are re-stitched together, so intermediate LODs remain closed.
Edge-only changes reuse geometry and upload the active index range. Tiles
coarsen 24 m beyond their refinement thresholds to avoid oscillation.
A 12 MiB cache holds inactive vertex data for revisits. After a teleport,
near detail can refine over several frames. The same 1 m elevation grid
remains available for ground queries.

The shader grades elevation from blue-gray low terrain to bright snow at
high elevations. DEM normals shade slopes, and a 4 m baked visibility texture
adds ridge shadows from a fixed winter-noon sun due south at 35° elevation.
The [sunlight manifest](data/mount-snow-sun.json) supplies the direction for
the terrain, pine and ski shaders. The trail mask blends pale blue
(`#B8DDEB`) into the snow before lighting, so trails inherit slope shading
and distance haze across all LODs. Near the viewer, forest ground uses the snow palette.
From 380 m to 400 m, the shader blends in the green canopy mask, which
represents distant forest after the individual trees fade out.

## Sky and atmospheric perspective

Mount Snow uses [The Hike's atmosphere module](../hike/atmosphere.mjs) for its
horizon-to-zenith sky and distance haze on terrain, trees and lifts.
The full-screen triangle uses each render eye's inverse projection.
Mount Snow uses the same sky palette and 90–950 m atmospheric blend,
with a height scale adjusted for the DEM's absolute elevations and a
1,900–4,800 m final visibility fade suited to the larger terrain footprint.
Settings hide the sky with the landscape. Hands, skis and menus are outside
the atmosphere hook.

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

The browser preview is buildless. To regenerate data, use Python with
Rasterio, NumPy and Shapely and run the scripts under `projects/ski/`:

1. `prepare_dem.py` produces the base height grid. It reads public GeoTIFF
   windows the first time and reuses the native crop on later runs.
2. `bake-pistes.py` produces the piste mask and starting trailhead.
3. `bake-piste-smoothing.py` then `bake-shadows.py` produce the piste
   adjustments and aligned sunlight assets. Rerun both after rebuilding
   the base grid or piste mask.
4. `bake-canopy.py` and `bake-lifts.py` rebuild their respective assets from
   the source inputs described below.

The cached native crops correspond to the current footprint. Use a fresh
crop when changing the footprint.

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
the mean height in centimeters of the qualifying pixels for tree placement.

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
Crown radius ranges from 15% to 36% of the unscaled height. A candidate is
skipped when its crown would overlap a mapped piste cell, including
mapped glades. The distant
canopy tint still reflects the lidar survey.
The distance blend uses the same horizontal viewer position and fade range
for the trees and terrain canopy mask.

Trees are instanced in frustum-culled 96 m chunks. Chunks near the viewer
stay resident and rebuild deterministically when revisited. A world-stable
dither fades trees from 380 m to 400 m horizontally, with opaque depth writes.
No tree collision. A fully eligible 400 m radius
would average roughly 6,980 trees before frustum culling. Actual Quest frame
time and the visual fade still need headset testing.

## Pine-cast shadows

[pine-shadows.mjs](pine-shadows.mjs) reuses the streamed pine batches in one
orthographic depth map aligned with the same winter-noon sun as the terrain
bake. The 2048² map is allocated on first use and refreshes after 8 m of
horizontal movement. Both eyes share the result. Terrain's direct light
receives pine shadows using the same PCFSoft filter weights as The Hike,
fully through 180 m and fading out at 200 m.
The pass is skipped when either Shadows or Trees is off, or when settings
hide the landscape. Baked ridge shadows are present in either mode.
Quest frame time and refresh visibility still need headset testing.

## Ski shadows

The terrain shader projects a soft capsule for each ski along the same
sun direction. Ski position and pitch update every frame. The footprint
shifts, softens and fades with height during a jump. It shades the direct
light near the skis using uniforms, with no extra draw calls, texture
reads or shadow-map refreshes. Ski shadows follow the Shadows setting
even when Trees is off.

## Validation and next headset checks

- Run `node --test projects/ski/tests/*.mjs` for the focused Ski suite and
  the complete root suite before pushing. Ski tests cover terrain seams
  and buffer reuse, deterministic tree placement and piste clearance,
  shadow refresh and render-state restoration, settings, lift destinations,
  steering, braking, pole pushes, tuck height, and takeoff and landing.
- Desktop Chrome rendered the real terrain, trees, ski and pine shadows,
  and the sky. It exercised walking and skiing. The 2048² PCFSoft pass was
  checked with Shadows on and off.
- A desktop CPU replay reduced the worst terrain tile update on one route
  from 17.0 ms to 5.1 ms after incremental tile updates. That measured
  CPU tile work before rendering.
- On Quest, verify stereo sky and terrain seams, seated tuck and pop feel,
  menu legibility and lift arrivals. Compare Shadows off and on on the
  same run if there are hitches. Sustained headset frame time is unmeasured.
