# The Secret Garden — current handoff

Updated 2026-11-09 for Version 177 rosettes and spherical-bloom removal, following vine-leaf release `4ca165d`. This is a current-state reference; update its relevant sections as behavior changes instead of appending a development journal. Git history preserves previous implementations and release notes.

## Status and working rules

- Buildless static desktop/WebXR garden using local Three.js r180. Version 177 adds ground rosettes with optional separate flower spikes with all existing bloom types and advances garden saves to version 37. Vine leaf varieties were released in `4ca165d`. Open leaf tree removal was released in `3f2e3b5`. Panel updates were released in `cb68928`; audio was released in `ba18b7d`.
- Read [project instructions](AGENTS.md) and [repository instructions](../../AGENTS.md). Current source and Git state take precedence over documentation.
- Starts empty unless the latest valid browser garden save autoloads. Plants mature in ten seconds; overlap is allowed and population is uncapped.
- No plant maintenance, plant collision/spacing enforcement, vegetation wind, wet materials or puddles. Morels, oysters and puffballs are not implemented.
- Implement locally, validate, allow user testing, and commit/push only with current authorization. A previous push request does not authorize later changes.
- Preserve unrelated work and excluded Blender backups. Do not introduce permanent profiling loops/HUDs without a request.
- Prior user instruction: do not check GitHub Pages deployment after pushing. Distinguish a verified push from deployment status.

## Running and validation

From repository root:

```sh
python3 -m http.server 8080 --bind 127.0.0.1
node --test projects/secretGarden/tests/*.mjs
```

Open `/projects/secretGarden/`. No install or build is required. For USB Quest preview use [Start-VR.command](../../Start-VR.command), keeping its terminal and authorized USB connection active. WebXR requires trusted localhost or HTTPS.

- Current validation: **147 garden tests pass**, including rain loop/intensity/mute/retry, Sound settings persistence, recorded bee loop duration/boundary and asynchronous load/retry, positional listener tracking, flight gating, voice cleanup, rosette generation/spike-only flowers/cloning/batching/bee landings and reset-button reactivation after garden edits; `git diff --check` passes. Rain asset is mono 44.1 kHz MP3 (~21.58 seconds); bee asset is mono 48 kHz 16-bit WAV (5 seconds). Browser/headset listening and updated panel appearance remain unverified.
- Last implementation validation: **136 garden tests pass**, plus the full root suite including Weather/shared tests, and `git diff --check`.
- Isolated garden changes need relevant garden checks. Cross-project/shared runtime changes need affected consumers and the root suite per repository policy.
- Documentation-only changes need content/link checks and `git diff --check`, not runtime tests.
- If Node is missing from PATH, discover the bundled runtime using the workspace dependency tool. Do not hardcode runtime cache paths in repository scripts.
- Advance changed module queries and importing chains when browser/headset caching would hide changes. Current entry query: **177**. Individual dependency queries need not match it. The desktop header displays the loaded app module version (currently Version 177); the mushroom generator/import chain and garden-save import were refreshed for the current mushroom changes.

## Planting and selection

- Right controller starts active. Only the active hand normally displays its ray and handles planting/face buttons.
- Active trigger plants once per press. Inactive trigger transfers control without planting; release and press again to plant. Simultaneous triggers cannot also plant during handoff.
- Active A (right) / X (left) copies a targeted plant seed, or returns to random mode elsewhere.
- Active B (right) / Y (left) clears clone/spawn mode. Holding it over the same plant for one continuous second deletes that planting. A red fill shows progress; release before another deletion.
- Active grip toggles the pointer. Pointer-off stops controller raycasting; either trigger reactivates that hand without planting. Inactive face buttons do nothing.
- Held inputs are absorbed on entry, reconnect and tracking resume; tracking loss cancels interaction.
- Desktop: click/Space plants, B copies/resets, X deletes, WASD walks, arrows turn, pointer drag looks. A is strafing.
- Ground plants require dirt; ivy requires interior wall faces. Clone seeds remain remembered while aiming across surface changes, but incompatible planting uses a random seed and clears the copy.
- Cloning persists after planting. Clones independently sample 80–120% scale, without compounding copied scale. Ground placements independently sample yaw.
- A gold base ring selects an entire planting/cluster. Overlapping rectangles indicate cloning; a plus indicates spawn mode. Clone icons appear on planting targets.
- Pointers use normal depth testing and render order 0. No overlay rendering or capsule-surface clipping is retained.

## Spawn menu

Rotate the left palm upward to show the menu; use the right ray/trigger to select. Turning the palm away hides it, retaining its current submenu.

| Root item | Choices |
| --- | --- |
| Flowers | Fresh flower seed per placement |
| Shrubs | Fresh shrub seed per placement |
| Grass > | Grass, Seeded grass |
| Ferns | Fresh fern seed per placement |
| Rosettes | Fresh rosette seed per placement |
| Ivy | Wall-only placement |
| Mushrooms > | Bolete, Fly agaric, Chanterelle |
| Trees > | Rounded, Pine, Cypress, Umbrella |

- Every submenu ends with **< Back**. No Random option appears; normal controls return to random planting.
- [spawn-plant-types.mjs](spawn-plant-types.mjs) defines generic nested `children` arrays and derives flattened selectable types for seed matching and validation.
- [spawn-menu.mjs](spawn-menu.mjs) supports arbitrary nesting, parent navigation, panel resizing and disposal of superseded textures/geometries. Its lower edge stays one inch above the controller pill top.
- Navigation does not spawn or change selection. Selecting a type produces a fresh matching seed on each placement.
- Incompatible surfaces preserve spawn selection without planting. Copying a plant switches to clone mode.
- Menu interaction takes priority over world actions, locomotion and teleport, then restores normal pointer behavior.

## Movement, controllers and teleport

- Defaults: Teleport on, Snap turn on, snap angle 30°, height offset 0 m, remembered smooth move speed 1 m/s, turn speed 45°/s.
- Teleport on: either stick's up gesture aims with that hand; release teleports to a valid floor. Initiating hand owns the gesture. Either stick's horizontal input turns; equal simultaneous inputs do not double turns, opposite equal inputs cancel.
- Teleport off: left stick moves head-relative, right stick turns. Movement speed is disabled in the panel during teleport mode but retains its value. Desktop walking remains available.
- Snap angles: 15°, 30°, 45°. Another snap requires horizontal neutral, including after entry/reconnect/tracking resume/turn-setting changes. Desktop arrow turning stays smooth.
- Destination column: 2.5 ft diameter, 6 ft high, green/red for valid/invalid, alpha fading from 100% at the base to 0% at the top. This visual does not add collision-clearance requirements.
- Plants do not block teleport aiming; walls/panels do. Door/handle targeting selects the hallway midpoint and opens the door fully on teleport.
- Teleport preserves facing and seated offset; invalid targets/tracking loss/suspension cancel. Height offset affects VR head/controllers together, not desktop height.
- Viewer containment includes physical head offset and rig yaw. It is virtual containment, not a physical safety boundary.
- Tracked controller grips display muted green `#69895b` capsules, 14 cm long and 6 cm diameter, with no shadows.

## Garden, room and settings

- Dirt interior: 9.144 × 13.716 m (30 × 45 ft); stone walls 3.048 m high, with instanced running-bond masonry.
- Entrance is behind the starting viewer on the +Z wall. A 1.8288 m hallway leads to a roofed 3.6576 × 3.6576 m settings room.
- Automatic double-action door sits at hallway midpoint `(0,0,7.7724)`, opens away from approach from either side, and closes when the viewer leaves.
- Room/hall floors are non-plantable; doorway exclusions keep ivy clear. [garden-layout.mjs](garden-layout.mjs) owns layout/containment constants.
- All three control-room panel boards are vertically centered on the 2.6 m walls (board center 1.3 m); headers show titles only, without subheads. `room-panel-layout.mjs` sizes each board to its rows with .125 m outer padding on every side and .04 m clear vertical gaps between all rows, including headers; controls remain 1.65 m wide within 1.9 m boards. Snap/smooth turn sliders share one row. All three panels and their control skin use `room-panel-theme.mjs` for background, control fill, text, muted text, gold accents, track/border colors and disabled opacity. Save/Load buttons match the other controls’ dark green fill, gold active text and 40% disabled opacity, with muted borders for separation. Save/Load has no footer; save/load feedback is sent to the desktop page status area.
- Facing Garden Settings: Save/Load is on the left wall, VR Settings on the right.
- Garden Settings: Shadows, Sound, Bees, Rain, Reset Garden. Sound defaults on and persists independently of garden saves. Reset clears plants and returns to random mode, preserving position, preferences and garden slots. After activation the button reads Garden Reset and is disabled until a planting, deletion or load changes the garden revision; settings, movement and growth do not re-enable it.
- Room UI reuses shared ControlModel/checkbox/slider mapping and the existing pointer. Hover highlights change material tint without canvas uploads.
- Shadows default on, use a 1024-pixel map and refresh during shadow-casting growth, scene/door changes or reenable. Static scenes retain cached maps.
- No explicit foveation control is installed; bundled Three.js keeps its default runtime request.

## Plants and generation

- Spherical hydrangea blooms and their specialized rendering/bee-target code are removed. Six petal-based bloom forms remain across generators. Save version 37 invalidates obsolete garden saves under development policy.


- `rosette-generator.mjs` adds seeded ground rosettes; `rosette-geometry.mjs` supplies a shared broad, arched, ribbed leaf mesh. Flower spikes and blooms reuse the normal renderer and bee landing components. Save version 37 invalidates obsolete saves under development policy.


- Vine leaf varieties use shared low-polygon geometry in `vine-leaf-geometry.mjs` and the renderer; shape selection is seeded and independent of wall bounds. Heart-shaped and oval leaf geometry are each scaled to 80% of their original size; other silhouettes are unchanged. Save version 31 invalidates obsolete saves under the explicitly authorized development policy.


- Open leaf trees are removed from generation and the menu. Save version 30 invalidates obsolete garden saves under the explicitly authorized development policy.


[generator.mjs](generator.mjs) uses a pure uint32 seeded PRNG. Seed acquisition, placement yaw and clone scale live outside generation. Parts have ordered parent IDs, attachment fractions and normalized growth timings. No generator uses unseeded randomness.

Random ground placement equally selects flowers, shrubs, trees, grass, ferns, mushrooms or rosettes; wall placement uses ivy. All complete growth within ten seconds. Parts are capped at 600 per planting; woody recursion is bounded to three levels.

| Family | Current behavior |
| --- | --- |
| Flowers | Daisy, buttercup, lily, bell, rosette and star. Single/clustered blooms; terminal stalks flower. Bloom axes and bee landing normals follow supporting stems. |
| Shrubs | 1–5 overlapping ellipsoids, visible trunks/branches/flower stalks, no individual leaves. Initial stalk 2–6 inches; foliage may intersect ground. Branch azimuths differ by at least 30° and rise 0–30° above horizontal. |
| Trees | Rounded/umbrella ellipsoids, layered pine and stacked rounded-tier cypress. Cypress trunks and ellipsoids have zero tilt. Pine/cypress do not flower. |
| Grass | Irregular rounded 320–460-blade patches with taller centers. Half add 6–12 seeded stalks .65–1.05 m tall. No grass components cast/receive shadows. |
| Ferns | 7–11 radial arching fronds, one shared 120-triangle mesh each with twelve leaflet pairs. Fixed orientation throughout growth; stalk ends at the last pair. No curled-fiddlehead simulation. |
| Mushrooms | Bolete, spotted fly agaric, wavy-funnel chanterelle. Single (45%) or 2–5 specimen cluster (55%). Cluster spacing increases with planting height, using radial distance `sqrt(i) * (height * .95 + .06) * .5`; individual stalk heights and cap widths vary. Pale stalks rise before caps expand. Entire planting is one selectable/cloneable unit. |
| Rosettes | 10–16 broad hosta-like leaves; 40% flower with 1–3 separate central spikes carrying all existing bloom types (bell/lily 30% each; daisy, buttercup, rosette and star 10% each). No flowers attach to broad leaves. Spikes terminate at the highest flowering branch without a bare stem above it. Flowering branches turn progressively upward from 75° off vertical at the bottom to 20° at the top; bloom axes and bee landing normals align with their supporting flowering stems. One planting for selection/cloning/deletion; standard ten-second growth and bee landing support. |
| Ivy | Seeded ivy, heart-shaped, oval or five-lobed leaves; one consistent form per planting and clone. Surface-constrained vines wrap wall corners, respecting floor/top/doorway exclusions. Clones retain growth rules while adapting to placement. Some flower with petal blooms. |

- Flower colors exclude greenish hues 70–170° across flowers/shrubs/trees/ivy. Mushroom colors cover the full range.
- Standalone flower leaves attach at their sharp base, point 0–60° from the supporting stem, and range .0748125–.149625 m before scaling.
- Single flower stalk lean is 0–10°. Multiple stalks use correlated lean/radial spacing. Tree flower budget is 30 blooms; petals are bounded to thirteen per ring and three layers.
- Rounded/umbrella tree and shrub flowers occupy exposed canopy surfaces, accounting for overlap. If the final ellipsoid belongs to another branch, the flower stalk adopts that branch's attachment/start/timing. Parent/canopy IDs are reordered afterward to preserve growth dependencies.
- Mushroom cluster base hue/saturation sample uniformly from [0,1] and brightness from [.20,1]; specimen variations are ±.07 hue, ±.18 saturation and ±.20 brightness. Hue wraps; saturation/brightness reflect at boundaries. Cap brightness is clamped to a minimum of 20% after specimen variation. Stalks/spots remain pale accents.
- Mushroom stalk height is nominally .10–.30 m before per-specimen size variation of .48–1.48×. Mushroom caps/spots use shared geometry; mushrooms are not bee flower targets.

## Bees and clouds

- `bee-audio.mjs` plays a five-second mono loop derived only from seconds 6–9 of DrDufus's CC0 “Bee buzzing.wav”; see `assets/secretGarden/audio/README.md` for source, license and processing. The requested excerpt is repeated with 300 ms equal-power crossfades and a crossfaded loop boundary; a 120 Hz high-pass suppresses the recurring low-frequency source thump; natural pitch/speed are retained. One decoded buffer is shared by up to ten offset loops; asynchronous loading retries after five seconds on failure. HRTF panners follow bee world positions, with linear attenuation from .5 m to silence at 6 m. Listener pose composes current XR viewer and rig after movement/teleport, or desktop camera world pose. Peak flight gain is .0675, with .35-second takeoff and .65-second approach fades (bounded for short flights), plus 25 ms smoothing. Sound checkbox, hidden/inactive muting, and removed-voice cleanup apply. Synthetic generation is removed. Listening validation is still required for the edited sample seam, loudness and headset positioning.


- Bees are an exact population of 0–10, default 3, independent of bloom count. Zero hides both batches and skips animation.
- Bees prefer mature flowers, otherwise random inward-facing wall spots outside the doorway. Flight is curved/darting, touchdown aligns to surfaces, rests last 2–5 s. Object intersection is allowed.
- Body/wing batches use two instanced draws without cast/received shadows. Plant reset/deletion preserves population and updates targets.
- Ten clouds share one instanced draw, have no shadows and traverse west to east over thirty minutes.
- Phases, tracks, sizes and heights vary. Clouds lower fully behind walls at path ends before recycling; motion continues during rain.

## Rain and lighting

- `rain-audio.mjs` loops the locally bundled CC0 Rainfall recording by colorsCrimsonTears; source/license in `assets/secretGarden/audio/README.md`. One Web Audio buffer source loops continuously; gain follows rain intensity (0–1) with 80 ms smoothing. Sound off or inactive/hidden rendering mutes it. Click, keypress or XR entry unlocks audio; failed loads retry on the next gesture. Desktop/Quest listening and loop seam review remain manual checks. Settings version 6 discards obsolete settings under development policy; garden version is 37.


Five-stop room slider, default Sometimes. Fresh default sessions start clear.

| Setting | Clear interval | Conditions |
| --- | --- | --- |
| Never | Indefinite | Immediately clears drops/effects and restores clear colors/lights. |
| Rarely | Random 10–20 minutes | Gradual random showers. |
| Sometimes | Random 5–10 minutes | Gradual random showers. |
| Often | Random 2–5 minutes | Gradual random showers. |
| Always | None | Immediately holds maximum rain/darkness continuously. |

- Middle showers choose 25–100% peak intensity: rise 20–40 s, hold 30–75 s, fade 25–45 s. Darkness and effect colors follow actual intensity.
- Leaving Always for a middle frequency fades from maximum over 25–45 s before resuming that schedule. Hidden/untracked frames pause weather time.
- Rain is fixed at garden center with four-foot (1.2192 m) padding and covered room/hall exclusions. Walking/teleporting never moves or repopulates its volume.
- [garden-rain.mjs](garden-rain.mjs) reuses Weather's [RainSimulation](../weather/src/rain-simulation.js) and [GroundEffects](../weather/src/ground-effects.js). `update(dt, parameters, head, center = head)` separates live head exclusion from optional fixed center; Weather's default remains viewer-following.
- Up to 6,000 drops in a 10 m high enclosing cylinder (~9.94 m radius), compacted into a fixed outdoor GPU buffer. Speeds 4–9 m/s, mild wind/coherent turbulence, whole-streak .5 m headset exclusion.
- One opaque drop batch plus fixed pools: 300 four-streak splashes, 200 twelve-segment expanding rings. Dirt impacts have independent 15%/10% spawn probabilities; lifetimes .2/.45 s.
- Drops/splashes/rings have **castShadow=false**, **receiveShadow=false** and do not invalidate cached maps.
- Cleanup occurs once per active-to-clear transition: hide, clear pools, reset draw count and upload changed ground buffers. Clear frames skip repeated cleanup and particle simulation, retaining scheduling/atmospheric updates.

| Property | Clear | Maximum rain |
| --- | --- | --- |
| Sky | `#788f9c` | `#74777b` |
| Cloud tint | White | `#64696f` |
| Directional | `#ffefcf`, 3.1 | `#c7cdd3`, .75 |
| Hemisphere sky / ground | `#e7f1ff` / `#665039`, 2.1 | `#c3c7cb` / `#514a41`, 1.7 |
| Drops | `#cbd1d5` | `#84909a` |
| Splashes | `#d5dadd` | `#8d989f` |
| Rings | `#c8d0d5` | `#808e98` |

Light changes affect uniforms only; sun pose and shadow policy stay fixed. Effect tint changes touch three materials, adding no draw calls or per-particle color calculations.

## Saves and preferences

- Current **SAVE_VERSION=37**, **SETTINGS_VERSION=6**. Sources: [garden-saves.mjs](garden-saves.mjs), [preferences.mjs](preferences.mjs).
- Support current versions only. Bump the relevant version for incompatible changes; retain stable keys, delete only mismatched records, and do not add legacy generators/deserializers/migrations.
- User authorizes development bumps and obsolete-record deletion without further approval until explicitly requesting save compatibility tracking; see AGENTS.md.
- Three slots store plant seeds, placement/surface constraints, yaw, clone scale and growth age. Latest saved valid slot autoloads. Manual Load preserves viewer position; Empty cannot load. Reset does not delete slots.
- Garden prefix `secretGarden.save.v1.`; settings key `secretGarden.settings.v1`. Payload-version bumps do not rename keys.
- Preferences independently store Shadows, Sound, Bees, Rain and VR comfort/movement. Debounce 250 ms, flush on page exit. Garden Save/Load/Reset does not change preferences.
- Defaults: shadows on, sound on, bees 3, rain Sometimes, height offset 0, move speed 1, turn speed 45, teleport on, snap on, snap angle 30.
- Storage is local to browser/device/origin; preview and Pages are separate. Errors preserve existing durable data and show panel feedback.

## Architecture and performance

| Modules | Responsibility |
| --- | --- |
| `app.mjs` | Setup, XR/desktop adapters, action routing, frame ordering, settings persistence. |
| `generator.mjs`, `shrub-generator.mjs`, `mushroom-generator.mjs`, `vine-generator.mjs`, `rosette-generator.mjs` | Pure deterministic structures and attachment timing. |
| `canopy-flowers.mjs`, `flower-colors.mjs` | Exposed flower placement/support and flower palette rules. |
| `renderer.mjs`, `mushroom-geometry.mjs`, `rosette-geometry.mjs` | Shared geometry/materials, instance colors, cached/changed-only growth poses. |
| `manager.mjs`, `mature-batches.mjs` | Lifecycle, clone/spawn modes, snapshots, pooled maturity/deletion. |
| `garden-picker.mjs`, `plant-picker.mjs`, `grass-picker.mjs` | Whole-garden bounds, exact component hierarchy, analytic grass picking. |
| `environment.mjs`, `garden-layout.mjs`, `garden-room.mjs`, `door-model.mjs` | Geometry, containment, lights, door and environment targets. |
| `rain-cycle.mjs`, `garden-rain.mjs`, `weather-lighting.mjs`, `cloud-sky.mjs` | Weather scheduling, effects, lighting, moving clouds. |
| `settings-panel.mjs`, `vr-settings.mjs`, `save-panel.mjs`, `bee-slider.mjs`, `vr-control-style.mjs` | Room UI bindings, interaction skins and feedback. |
| `spawn-menu.mjs`, `spawn-plant-types.mjs` | Generic palm navigation and specific seed selection. |
| `controller-actions.mjs`, `delete-hold.mjs`, `snap-turn.mjs`, `teleport.mjs`, `hand-pill.mjs` | Interaction state, comfort controls and feedback. |
| `bees.mjs` | Bee targets, flight/landing animation and population. |

- Growing plants have per-plant instanced batches; mature plants migrate once into shared geometry/shadow-flag pools, preserving world transforms/colors/identity.
- Pools grow geometrically; deletion swaps final slots into holes and repairs handles. Empty pools release buffers; dirty pools flush after updates.
- Detached CPU groups retain exact mature picking geometry while their source GPU instance buffers are released. Shared render pools are not picking targets.
- Cached world-space bounds reject whole plants, then mature component hierarchies narrow exact triangle tests. Grass uses one reduced ellipsoid, taller for seeded stalks.
- Conservative full-growth bounds avoid per-frame scans. Pose caches settle completed parts and invalidate when age moves backward. Static scene objects freeze local matrix composition.
- Pool bounds grow incrementally and stay conservative after deletion until empty; extensive deletion may loosen bounds. Spatial subdivision is a possible measured optimization.
- Crowded scenes can still cost growth, migration, geometry submission and targeting time. There is no hard population cap.
- `window.secretGarden` exposes objects including `plants`, `rain`, `spawnMenu`, `environment`. `batchMature:false` and picker `enabled` are comparison hooks, not product settings.
- Prior user feedback found batching/targeting helpful. Historical Mac microbenchmarks/pre-optimization captures do not establish current sustained Quest performance.
- Rain optimization candidates: reduce discarded off-rectangle simulation and upload only active/changed ground-effect ranges. Measure before increasing complexity.

## Door asset workflow

Detailed commands: [door asset README](../../assets/secretGarden/door/README.md).

- Editable source: `assets/secretGarden/door/secret-garden-door.blend`; generated data: `assets/secretGarden/door/door-model.mjs`, consumed by the project adapter.
- Preserve hinge/leaf/Handle names and Heart parenting. Leaf/handles/heart swing together; fixed stile stays stationary. Export evaluated geometry in a closed pose.
- Meters, Blender Z-up; coordinate map `(X,Y,Z)` → `(X,Z,-Y)`. Runtime model: six nodes, 204 triangles; heart `#8A7058`, door `#48392B`.
- Saving Blender alone does not update the game: run `export-door.py`, include source/generated output together, advance asset/import queries.
- `create-door.py` overwrites output; never run over edited source. Exclude presentation/context objects and retain `.blend1`, `.blend2`, before-parenting backup exclusions.
- Keep the generated mesh-data format unless a change is justified; no GLB alternative is required.

## Validation and outstanding Quest checks

The last implementation release passed 136 garden tests, the full root suite including Weather/shared regressions, and whitespace checks. Chrome previews checked plant forms, imported door, spawn navigation, rain/ground effects, atmospheric lighting/colors and panel layout without page errors.

Coverage includes deterministic bounded generation, ten-second attachment growth, clones, pooling/deletion, exact picking, save/version handling, controller gating, nested menus, teleport/snap, door hierarchy, rain timing/extremes/effects/fixed volume/colors/lighting/cleanup, upright cypress and canopy support corrections.

Remaining hardware review:

- Stereo rain/effect visibility, immediate Never/Always, overcast readability.
- Room sliders and nested palm-menu reach/readability, handoff, tracking recovery, pointer occlusion.
- Door alignment/scale, door teleport, boundaries and seated comfort.
- Fern/seeded-grass/mushroom appearance and canopy flower stalk supports.
- Sustained frame cadence with crowded gardens, simultaneous growth, maximum rain and bees. Automated/desktop checks do not establish headset performance or comfort.
