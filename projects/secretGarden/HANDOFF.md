# The Secret Garden — Milestone 1

## Status and scope

Implemented for desktop and Meta Quest 3. The garden starts empty. No persistence, wind, maintenance, collision between plants, or placement spacing is implemented. The user has tested on Quest and reports mature batching helped. A live USB-debugging capture was taken with 74–75 plants before batching; later changes have not received a complete headset acceptance pass. The user authorized committing and pushing this release on 2026-10-30.

## Preview and controls

Use the repository's `Start-VR.command` for USB Quest testing, or serve the repository with `python3 -m http.server 8080 --bind 127.0.0.1` and visit `/projects/secretGarden/`. No install or build step is required.

- Quest: left stick moves head-relative at 1 m/s; right stick turns at 45°/s. Right controller starts active. Only the active controller displays a ray and handles planting/face-button actions. Active trigger plants; A (right) / X (left) copies the targeted seed or returns to random mode elsewhere; B (right) / Y (left) returns to random mode and deletes after a continuous one-second hold on the same plant. A red fill shows progress; release before another deletion. Inactive trigger transfers control without planting, including when both controllers press in the same frame; release and press again to plant. Inactive face buttons do nothing. xr-standard indices: 0 trigger, 1 grip pointer toggle, 4 copy, 5 delete. Held inputs are absorbed on entry, reconnect and tracking resume.
- Active-hand grip toggles its ray/target off/on. When off, controller raycasting stops; either trigger reactivates its hand without planting. Clone mode persists after planting and clone size varies independently from 80–120%.
- Desktop: point/click or Space plants; B copies/returns to random; X removes. WASD walks, left/right arrows turn, pointer drag looks. A is exclusively desktop strafing, not planting.
- A ring on dirt shows placement; a gold ring at a plant's base identifies selection. All visible plant components raycast to their instance; the nearest surface wins. Only the active hand’s ray and selection are shown; inactive trigger transfers selection to that hand. Ray color indicates plant hits.
- Two overlapping rectangles inside the ground/plant target circle indicate clone mode. Random mode uses the plain circle. The wrist status label and desktop mode readout are removed.

## Architecture

- `generator.mjs`: pure seeded PRNG, correlated form parameters, shared recursive branching, attachment-based stems/leaves/flowers, explicit normalized growth timing. Numerical seeds are uint32; generation never calls unseeded randomness. Parameter profiles select recognizable flower/bush/tree proportions while sharing the same construction code. `parts` is an ordered structural graph with parent IDs, attachment fractions and timings; future growth forms can emit this representation without a new rendering framework.
- `renderer.mjs`: shared five-sided taper profiles, three reusable folded leaf shapes and six curved, faceted petal profiles, shared matte material, per-instance colors. Growing plants use per-plant instanced batches; mature plants share geometry-type batches through `mature-batches.mjs`. Detached per-plant CPU geometry retains exact plant IDs for picking. Clones produce equal instance matrices and colors. Deletion releases growing GPU instance data or compacts mature batch slots while retaining common geometry/materials for reuse.
- `manager.mjs`: unique instance IDs separate from seeds, world positions, structures, growth state and birth times. Random seed acquisition uses browser crypto outside generation. Overlap is unrestricted. Growing plants update from elapsed seconds and leave the update set at ten seconds.
- `environment.mjs`: 9.144 × 13.716 m (30 × 45 ft) dirt interior, four 3.048 m stone walls, one instanced masonry batch, daylight hemisphere and directional light, 1024 shadow map. Viewer-aware boundary correction includes physical head offsets and rig yaw. This is virtual containment, not a physical safety boundary.
- `app.mjs`: setup, shared XR locomotion/button edges/pointers/session gating, desktop adapter, action targeting, selection and clone target icon. Shadow maps update during growth and on changes, then remain cached when the garden is static.
- `tests/`: deterministic data, timing, instance lifecycle, boundary and render/raycast regressions.

Parts are capped at 600 per plant, recursion depth at three, petals at thirteen per ring and three rings at most. There is no hard plant population cap, so scene submission and raycasting costs increase with population. The initial browser sample with fifteen mature plants plus one growing plant used 57 draw calls and approximately 19k triangles (camera and shadow visibility affect counts); this is not a Quest benchmark. Mature batching is now implemented; see its validation record below.

## Validation — 2026-10-29

Run `node --test projects/secretGarden/tests/*.mjs` from the repository root. Six tests passed, including a 1,200-seed sweep, identical generation independent of call order, finite attachments and bounded components, complete growth at ten seconds, frame-rate-independent poses, clone equality, overlapping instances, deletion, mature-update removal, physical-head-offset containment and rendered geometry raycasting. All 31 shared helper tests also passed; shared runtime files were not changed.

Chrome WebGL checks covered empty startup and dimensions, direct mouse planting, rendering a varied mature garden, and removal back to an empty scene. Visual screenshots were reviewed and tree proportions refined. Final Chrome end-to-end checks passed: click planting, real ten-second growth, geometry targeting, B copy, Space clone planting, matching structures, X deletion, B return to random, zero growth updates after maturity, and a 390 px mobile layout without horizontal overflow. No page errors occurred. `git diff --check` passed. Headset validation remains pending.

## Quest acceptance still required

Verify Enter VR, stereo appearance and scale, trigger handoff and A/B/X/Y button mappings on hardware, per-hand targeting, clone target icon readability, tracking-loss recovery, comfort and boundary behavior. Test a crowded garden with simultaneous growth and mature plants and measure sustained frame cadence; desktop draw counts do not establish Quest performance. Confirm clone appearance and ten-second development in headset. Commit/push only when requested after user testing.


## Flower variety refinement — 2026-10-29

Six seeded bloom forms now vary in geometry and arrangement: daisy, buttercup, lily, nodding bell, layered rosette and pointed star. Petals use curved polygon strips with form-specific width and cup depth rather than flat leaf geometry. Each bloom has a deterministic axis based on its stem heading and a varied tilt; bells face downward. Opening animates from folded petals into the mature cupped form. Central structures follow the same bloom axis.

About 32% of seeds choose clusters of four to eight smaller blooms at each flowering tip. Short child stems support the cluster, bloom sizes vary within a bounded range, and emergence is slightly staggered. All finish by ten seconds. Terminal stems also flower when branching probability ends recursion early. Seed output has changed with the expanded generator; clones remain identical within this version. Runtime query versions advanced to 2 for flower variety; the entry module is now version 3 for trigger planting.

Seven project tests passed, including a seed sweep checking all six bloom forms, single/cluster distributions, normalized nonvertical axes, downward blooms and complete timing. Chrome rendered all twelve single/cluster combinations without page errors; the resulting screenshot was visually reviewed. Quest appearance and performance need retesting.


## Trigger planting — 2026-10-29

Planting moved from right A to the rising edge of either xr-standard trigger (index 0). Each trigger uses its own tracked controller ray and the existing ground-only placement rule. Holding a trigger does not repeatedly plant; entry/resume suppression applies. B copy/reset and X delete remain unchanged. Desktop click/Space remains available. Project tests and JavaScript syntax checks passed; physical Quest trigger verification remains pending.


## Random planting orientation — 2026-10-29

Every planting operation, including clone placement, samples an independent uniform yaw in [0, 2π). The instance stores `rotationY`; the renderer applies it to the plant root group, preserving the planting point and growth attachments. Orientation randomness lives outside the seeded generator: clone structures, local geometry and colors remain identical while world orientation varies. Lifecycle tests verify independently assigned rotations, and renderer tests verify the root transform while retaining clone matrix/color equality. Seven project tests passed. Entry and changed module queries advanced to version 4.


## Fuller tree canopies — 2026-10-29

Tree profiles now guarantee four or five main limbs and three children per limb at each of the next two levels, giving 53–66 woody segments before optional flower stalks. Main limbs attach at staggered heights; outward limbs spread the crown and upright continuations fill its top. Outer branches retain more length and support dense leaves, with smaller foliage counts on interior branches. Flowers and bushes retain their existing branching rules.

The same shared recursive system and three-level depth remain in use. Tree flowers have a 30-bloom budget so clustered blossoms cannot crowd out the remaining crown. All components still fit below the 600-part cap without truncation. Seed output for trees changes, while cloning and independent placement rotation remain intact. Eight project tests pass, including a tree sweep checking scaffold coverage, at least 53 woody segments and 252 leaves, and no budget exhaustion. The existing 1,200-seed test checks ten-second maturity and connected geometry. Three mature trees were reviewed in Chrome (315–375 leaves, no page errors). Quest performance needs retesting with denser crowns. Runtime queries advanced to version 5.


## Clone scale variation — 2026-10-29

Clone placements now independently sample a uniform scale between 0.8 and 1.2, applied uniformly to their root group alongside random yaw. Random-seed placements remain at scale 1. Instance `scale` is separate from seed/structure; copying a scaled clone copies only its seed, so scale never compounds across generations. Growth timing remains ten seconds, with the planting point fixed. Nine project tests pass, including both scale endpoints, independent resampling, default-scale random mode and identical clone structure/local geometry. Runtime entry and manager/renderer queries advanced to version 6.


## Rectangular garden resize — 2026-10-29

Interior expanded to 30 ft wide × 45 ft deep (9.144 × 13.716 m); walls remain 10 ft tall. Separate half-width and half-depth drive ground, wall lengths/positions, consistent masonry spacing, planting limits and headset-aware containment. Sun/shadow coverage expanded for the larger footprint and controller targeting range increased to 25 m. Entry/environment query versions advanced to 7. Ten project tests passed, including rectangular ground/wall dimensions and containment at all four corners.


## Staggered brickwork — 2026-10-29

Wall masonry now uses running bond: alternating rows shift by half a brick, with clipped half-bricks at both ends. Brick spacing and mortar gaps remain consistent on each wall, and all masonry stays in one instanced batch. Entry/environment query versions advanced to 8. Existing project tests and whitespace checks passed.


## Expanded flower colors — 2026-10-29

Flower seeds now independently choose the full hue circle, 0–100% saturation, and 25–100% HSV brightness/value. Petal colors convert from HSV into sRGB before Three.js lighting, replacing the fixed 65% saturation / 69% linear HSL lightness that made blooms consistently pale. Colors remain shared within a plant and deterministic for cloning; central pollen colors remain contrasting. Lighting and shadows still affect perceived brightness. Ten project tests passed, including color range checks and clone color equality. Entry and affected module cache queries advanced to 9.


## Active-controller interaction — 2026-10-30

`controller-actions.mjs` routes sampled button edges through a single active hand, right by default each session. Inactive trigger transfers ownership and consumes all actions for that frame, avoiding order-dependent planting. Only the active tracked controller ray is cast/displayed; there is no automatic fallback when tracking is lost. Face-button edges on both controllers are always sampled so a held inactive button cannot fire when control transfers. A/X copies (or resets random mode elsewhere); B/Y deletes. Desktop controls are unchanged. Runtime entry and action-router queries advanced to 10.

Thirteen project tests passed, including active-hand mappings, transfers in both directions, simultaneous-input order independence, held-trigger suppression and inactive face-button holds. Syntax and whitespace checks passed. Physical Quest interaction retesting remains required.


## Squat shrubs — 2026-10-30

Shrubs use shorter 0.45–0.85 m primary stems, four to six stems distributed around the base, and wider length ratios. Basal stems lean outward 49–69° from vertical; secondary limbs spread 63–86° from vertical, producing low horizontal crowns rather than upright miniature trees. The shared generator, growth timing and component bound remain unchanged. A shrub seed sweep checks that basal spread exceeds rise and crowns are at least 1.5 times wider than their woody height. Runtime entry and affected imports advanced to version 11.


## Single-use cloning — 2026-10-30

A copied seed is consumed by one successful planting. PlantManager clears it after creating and initializing that instance, returning the mode indicator to RANDOM. Invalid planting targets never call planting, so they do not consume the copied seed. Clone scale and orientation still vary independently. The next successful planting obtains a fresh random seed at normal scale. Fourteen project tests passed, including automatic mode clearing and a different random seed on the next planting. Entry and manager query versions advanced to 12.


## Persistent cloning and held deletion — 2026-10-30

Supersedes single-use cloning: copied seeds remain active after planting. Active-hand B/Y immediately returns to random mode, regardless of target. Holding that press on one plant for one second fills its base selection circle with a red sector, then removes it. The hold locks to the initial plant and hand; release, target change/miss, tracking loss, session change or handoff cancels it. After completion or cancellation, a new press is required; continued holding never starts deletion on another plant. Desktop B copy/reset and X immediate deletion are unchanged. Entry/manager and deletion-helper query versions advanced to 13.

Seventeen project tests passed, including persistent clone reuse, exact one-second deletion, no repeat while held, early release, target changes, misses, handoff and explicit cancellation. JavaScript syntax and whitespace checks passed. Physical Quest timing and progress-display verification remain pending.


## Five tree families — 2026-10-30

Tree seeds now choose rounded broadleaf, open broadleaf, layered pine, columnar or umbrella with equal probability. All use the existing recursive stem/attachment representation with family-specific branch lengths, angles, crown depth and foliage distributions.

- Rounded broadleaf: spreading branches and overlapping faceted ellipsoids at terminal twigs, varied in size, rotation and related green shades.
- Open broadleaf: the dense individual-leaf crown from the previous tree implementation.
- Pine: five to seven tapered, offset-by-trunk foliage tiers using shared seven-sided cone geometry, with short supporting branches and no blossoms.
- Columnar: short upright branches supporting vertically elongated ellipsoids around the trunk.
- Umbrella: branches concentrated near the top, spreading outward into shallow horizontal ellipsoids above a relatively bare trunk.

New `foliage` parts store parent attachments, scale, orientation, color and growth timing. Clusters expand after their supporting branches; pine tiers emerge progressively up the trunk. Both new geometry types are shared/instanced and selectable by ray. Mature-update removal, persistent cloning, per-instance yaw/clone scale and hold deletion apply unchanged. Flowers and shrubs retain their existing profiles. Tree outputs change for a given seed in this generator version.

Nineteen project tests passed: all five families sampled across 1,500 seeds, finite and bounded components, distinct foliage proportions, tapered pine tiers, ten-second maturity, clone matrix/color equality, volume raycasting and existing interaction regressions. Chrome rendered all five families without page errors and the screenshot was visually reviewed. The five sampled trees used 13–389 structural parts each. This is not a sustained Quest benchmark; headset scale, appearance and crowded-garden performance need testing. Entry and affected module queries advanced to version 14.


## Clockwise deletion meter — 2026-10-30

The red deletion sector now sweeps clockwise, using a negative angular span from the same starting point. One-second timing and deletion behavior are unchanged. Entry query version advanced to 15; JavaScript syntax and whitespace checks passed.


## Dark soil — 2026-10-30

Ground material changed to rich dark brown (`#352015`), retaining the matte dirt finish. Entry/environment query versions advanced to 16. Syntax and whitespace checks passed.


## Mature-plant batching — 2026-10-30

At ten seconds, plants migrate from separate rendering groups into shared instanced pools keyed by the existing geometry type (up to fifteen mature plant draw calls per render pass, plus environment/UI and any growing plants). Growth remains per plant and static plants receive no growth updates. Geometry, local colors, yaw, clone scale and planting positions are preserved by baking the original world transforms into pooled instance matrices. Shadows use the same pooled meshes.

`mature-batches.mjs` grows pool capacity geometrically, copies existing instances on expansion and updates GPU buffers/bounds only when membership changes. Manager flushes changed pools once after growth updates. Deleting a mature plant removes its slots by moving the last occupied slot into each hole and updating that slot's handle. Empty pools dispose their GPU buffers. Deleting one plant never rebuilds the whole garden or regenerates survivors.

Original mature geometry/matrices remain in detached CPU-side groups for exact raycasting, with GPU instance buffers disposed during migration. These groups retain their fixed world transforms and plant IDs, so nearest-part selection, seed copying, overlap and timed deletion use the same targets as before. Mature proxies are not traversed or rendered with the scene. Shared render batches are not added to the picking target list, preventing duplicate hits.

There is a culling tradeoff: one pool covers all plants of that geometry type, so more off-screen instances can be submitted. Shared geometry/materials and opaque rendering remain unchanged. Spatial batch subdivision may be useful if headset GPU measurements show this tradeoff matters. The constructor's `batchMature:false` option is a developer comparison hook, not an exposed product control.

Validation: 22 project tests passed, including migration exactly at maturity, preserved world matrices and colors with clone scaling/yaw, frozen proxy picking, capacity growth, swap-compaction correctness for survivors, deletion to an empty garden and repopulation. Chrome compared the same 80 planted seeds and placements: 266 → 21 total draw calls, 349,924 → 350,952 submitted triangles, and 0.8 → 0.3 ms median CPU render duration on this Mac. Batch migration of all 80 plants in one test update took 14.4 ms including final growth; normal plants migrate individually. Screenshots were visually reviewed; mean absolute image difference was below 0.004 per 8-bit channel. No page errors occurred. These are local Chrome measurements, not Quest timings. The existing Quest garden was not reloaded or altered by this work.

Entry and manager/renderer/new pool module query versions advanced to 17. Quest regression/performance capture with the new version remains pending. No commit or push was requested.


## Clone target icon — 2026-10-30

Removed the controller-mounted RANDOM/CLONE status box and desktop mode readout/reset button. Clone mode is now indicated by two overlapping rectangle outlines inside the visible target circle, scaled to fit either the small dirt marker or larger plant selection ring. Random mode uses the plain circle. The icon hides on misses, tracking loss and handoff without a valid target; B/Y clearing clone mode also hides it before deletion progress. Icon geometry is created once with no canvas texture or per-frame geometry rebuilding. Entry query advanced to 18.

Chrome checks passed for removed status elements, hidden icon in random mode, visible icon in clone mode (including seed zero), persistent icon after clone planting and clearing on return to random. No page errors occurred. Syntax and whitespace checks passed; Quest icon readability remains to be checked. The user reports mature batching helped on Quest; this is user feedback rather than a new timed benchmark.


## Grip pointer toggle — 2026-10-30

Active-hand grip (xr-standard index 1, rising edge) toggles its pointer enabled state. Disabled state gates the controller cast entirely, hiding its ray, ground/plant target, clone icon and deletion fill; pending deletion cancels. Locomotion and plant growth continue. Grip on the retained hand can toggle it back on. Either trigger can also reactivate its own hand without planting, requiring release/another press to plant. Other inactive-hand grip presses have no effect. Right hand starts enabled on session entry. Entry/router queries advanced to 19.


## Drifting low-poly clouds — 2026-10-30

Five opaque clouds drift across the sky at 0.22–0.32 m/s, 12–15 m above the garden. Each uses a shared faceted cluster of ellipsoidal lobes; all five render in one instanced batch. Clouds wrap at ±52 m, beyond the camera’s 35 m far plane even from the garden edge, so recycling occurs out of view. Motion uses elapsed active seconds and stops while hidden/untracked. Clouds are decorative, excluded from interaction targets and shadow casting; movement does not invalidate the cached garden shadow map. Entry/environment/cloud module queries advanced to 20.

Cloud facets use baked cool white/gray vertex shading with an opaque unlit material, avoiding brown ground-light tint and additional lighting/shadow cost. All 24 existing project tests passed. Chrome checked five opaque instances, expected drift over ten seconds, bounded positions after a long wrap interval and error-free rendering; the sky screenshot was visually reviewed.


## Taller cypress-style trees — 2026-10-30

Columnar trees now receive a seeded vertical multiplier of 1.5–2 while crown width stays narrow and gradually decreases toward the top. A new shared faceted `spire` geometry tapers individual foliage volumes upward, replacing the round-ended ellipsoids for this family. Parent attachments are recomputed after shaping so branches remain connected during growth. Other tree families retain their profiles. Mature batching supports the additional geometry key automatically. All 24 project tests passed, including the 1,200-seed connectivity/maturity sweep, cypress proportions and foliage raycasting. Chrome rendered the family comparison without page errors; the silhouette was reviewed and adjusted to retain canopy volume. Entry and affected imports advanced to version 21.


## Darker sky — 2026-10-30

Sky background darkened to muted blue-gray (`#788f9c`). Daylight illumination remains unchanged. Entry/environment query versions advanced to 22. Syntax and whitespace checks passed.


## Cypress trees disabled — 2026-10-30

Removed columnar/cypress from the active seeded tree family list. New generation now selects rounded broadleaf, open broadleaf, pine or umbrella. The dormant columnar shaping/geometry code is retained for possible future revision but is unreachable through generation. Existing in-memory plants are not automatically removed; the new generator applies after page reload. Seed-to-family mappings change with the four-family list. Updated family-coverage and foliage-ray tests passed with the full 24-test project suite. Entry and affected imports advanced to 23.


## Release review — 2026-10-30

User authorized push to GitHub after the cypress family was disabled. Release includes the full Secret Garden project, tests, project-directory card, root routing and shared-helper consumer documentation. Active tree families are rounded/open broadleaf, pine and umbrella. The final local entry query is version 23. Only project files and their directory/documentation entries are included; no shared runtime or dependency changes are part of this release. Final project/shared tests, module/documentation links, Chrome startup and whitespace checks are recorded with release execution. Prior user Quest feedback is preserved above; the newest visual/interaction changes are not claimed as a complete headset benchmark.

Final release validation: all 24 Secret Garden and 31 shared-helper tests passed (55 total). Chrome startup/clone-indicator smoke checks, local module imports, documentation links and whitespace checks passed.


## Wall-clinging ivy — 2026-10-30

Interior wall faces now accept planting, producing seeded vines instead of ground plants. `vine-generator.mjs` uses the existing pure PRNG and stem/leaf/flower graph, emitting three meandering shoots, side branches, lobed ivy leaves and occasional small outward-facing blossoms. Ten-second timing, mature batching, exact picking, active-hand controls and one-second deletion apply to vines too.

Vine generation depends on seed plus support-relative bounds. Shoots redirect downward/sideways at the top, upward at the floor and inward at wall ends. Thus identical seeds and bounds produce identical structures, while the same copied seed at a different height/wall extent can take a different path. Vines stay on the selected face rather than wrapping corners or spilling onto the ground. Wall top/edge faces are not planting targets. Inner masonry clearance prevents the geometry being hidden by the brickwork.

PlantManager remembers copied surface type separately from seed. `canClone(surface)` decides whether to use that seed: copied vines clone only on walls; copied ground plants clone only on dirt. Incompatible targets use a fresh random seed without clearing the remembered copy. The clone icon temporarily disappears and returns when aiming at a compatible surface, including appropriate plant targets. B/Y explicitly clears both remembered seed and surface. Vine clones use 80–120% scale with inversely scaled local bounds, keeping their stems on the wall. Vine orientation follows the wall, rather than random world yaw; ground rotation/scale rules are unchanged.

Target rings, clone icons and deletion fill now align with wall normals for wall planting/selection. Detached mature vine proxies preserve these support-relative poses and instance IDs.

Validation: 29 project tests passed, including 500 vine seeds, complete timing and valid parent attachments, top/floor/end response, remembered clone state through incompatible planting in both directions, all four walls with scaled clones near top and bottom, mature ivy batching, picking and deletion. Chrome verified actual wall-click planting, hidden clone icon on dirt and restoration on wall, and error-free rendering of mature vines at different heights. The resulting ivy wall screenshot was reviewed. Physical Quest testing remains pending. Entry and changed runtime modules use query version 24. This work remains local and is not covered by the previous release's push authorization.


## Ivy wrapping around corners — 2026-10-30

Supersedes reflecting at wall ends: garden wall supports now include adjacent wall dimensions. Vines grow in an unfolded perimeter coordinate and fold onto the four inset interior faces. Crossing a corner splits the stem at the exact seam so no segment cuts diagonally through the garden. Leaves use the adjoining face orientation/offset and blossoms face outward from their current wall. Top/floor redirection stays unchanged. The single vine retains its original instance ID, copied seed, support root, growth timeline and mature-batch lifecycle across wall transitions.

Clone scale is included in the perimeter dimensions, preserving physical support clearance. Identical seed/support geometry remains deterministic. Generic supports without perimeter metadata retain bounded-wall behavior; all four garden walls supply wrapping metadata. Existing rooted selection/deletion indicators stay at the vine's planting point.

All 30 project tests passed, including 150 repeated corner seeds, left/right and opposite-wall traversal, exact attachment/maturity checks, no diagonal corner shortcuts, and scaled clones on all four walls. Chrome wall planting/mode-switch checks passed; a mature corner-spanning vine screenshot was visually reviewed with no page errors. Entry/environment/manager/vine imports advanced to 25. Quest retesting remains pending. Changes remain local and unpushed.


## Incompatible planting clears clone — 2026-10-30

A successful random planting on an incompatible surface now clears both the remembered seed and surface. Merely pointing at the other surface still preserves them, so aiming back restores clone eligibility until a random plant is actually placed. Compatible clone planting remains persistent. Clearing occurs after successful creation; rejected wall placements leave clone state intact. All 30 project tests and whitespace checks passed. Entry/manager query versions advanced to 26.


## Vine flower clearance — 2026-10-30

Vine flowers now develop on seeded 12–18 cm stalks projecting outward from their current wall face. Stalks extend before blossoms open, keeping the bloom ahead of the ivy foliage while preserving ten-second maturity, corner orientation, batching and selection. Clone scaling also scales the stalk naturally. Stalks are explicitly tagged so support-boundary tests distinguish intentional outward growth from wall-clinging stems. All 31 project tests passed, including outward direction, length, attachment and maturity checks. Entry/manager/vine query versions advanced to 27.


## Shorter vine flower stalks — 2026-10-30

Reduced outward flower stalk length to 6–9 cm (from 12–18 cm). Growth and face alignment are unchanged. Length/direction assertions updated; all 31 project tests passed. Entry/manager/vine query versions advanced to 28.


## Rounded-tier cypress redesign — 2026-10-30

Cypress/columnar trees are active again with a new silhouette: one tall trunk supporting five to seven overlapping rounded foliage tiers. The lowest tier is a sphere. Each successive tier is narrower horizontally and taller vertically, forming a rounded taper resembling the pine's stacked construction. Foliage now attaches directly along the trunk rather than to many short branches; the previous post-generation spire stretching is removed. Existing taller 1.5–2× seeded height variation remains. Cypress has no blossoms, and shares the existing faceted crown geometry and mature batches, adding no new foliage geometry type.

All 32 project tests passed, including spherical base proportions, strictly decreasing widths/increasing vertical radii, ascending attachment/emergence times, all five family coverage and unchanged vine/batching/interaction regressions. Chrome rendered all five families without errors and the redesigned silhouette was visually reviewed. The sampled cypress used one trunk and five foliage volumes. Entry/generator/renderer/manager/vine helper imports advanced to 29. Quest appearance remains to be checked; changes are local and unpushed.


## Pointed conifer trunks — 2026-10-30

Pine and cypress primary trunks now specify zero tip radius and render with a shared five-sided cone segment, tapering continuously from the base to a point. Other stems keep their existing taper profiles. The pointed trunk geometry participates in mature batching and exact picking like other stems. All 32 project tests passed, including family-specific trunk metadata and actual zero-radius rendered geometry. Entry and affected module queries advanced to 30.


## Remove hidden pine branches — 2026-10-30

Pine branching depth is now zero. Its foliage tiers already attach directly to the primary trunk, so hidden lateral stems served no structural or animation purpose. Pines now contain only one tapered trunk plus five to seven foliage volumes. All 32 project tests passed, including the single-trunk assertion and existing growth/picking/batching coverage. Entry and affected imports advanced to 31.


## Large arcing clouds — 2026-10-30

Cloud instance dimensions are now eight times their original sizes. Their base heights are raised to 36–45 m so the larger volumes remain overhead rather than intersecting the garden; spacing is widened. A smooth gentle rise and lateral bend carries each cloud over the garden, centered on the garden footprint. Drift speeds remain slow and cloud geometry/instance count stays unchanged.

The camera far range is now 250 m. At startup, cloud geometry bounds, maximum instance scale, actual garden half-width/depth and a conservative full-frustum visibility radius determine recycling distance. Both the outgoing and incoming cloud are fully beyond that radius for every garden position before wrapping. The bound includes the cloud's entire extent, rather than testing only its center. Arc span is calculated separately from recycling distance, so the gentle curve stays centered over the garden even with conservative distant recycling. Clouds remain one opaque unlit batch with no shadow-map invalidation.

All 35 project tests passed, including eightfold scales, overhead curved motion, frame-rate-independent updates, large elapsed-time wrapping, and complete endpoint clearance from every corner for two different garden sizes. Chrome startup, drift/recycling and opaque rendering checks passed; the enlarged sky view was reviewed. Quest appearance remains pending. Entry/environment/cloud queries advanced to 32. Changes remain local and unpushed.


## Grass patches — 2026-10-30

Grass is now a fourth ground generation form, alongside flowers, bushes and trees. Each seed defines an irregular rounded footprint using low-amplitude three/five-lobed radial variation and mild axis stretch. 320–460 blades cover the footprint with a golden-angle distribution. Blade height falls smoothly from the center to 18% near the outline, with small per-blade variation; the outer region is consistently shorter. Patch radius, height, blade width, bend orientation and related green shades vary by seed.

Grass emits root-attached leaf components in the shared structure graph, with one reusable curved low-poly blade geometry (`leaf4`). Blades emerge in overlapping stages and reach maturity within ten seconds. Entire patches are selectable, cloneable, scalable, removable and migrate into one shared mature grass batch. Wall compatibility rules apply exactly as for other ground plants. No wind or maintenance is simulated. The fourth random category changes seed-to-form mappings in this generator version.

All 37 project tests passed. Grass checks cover deterministic output, irregular outline variation, center/edge height ratios, component bounds and timing, whole-patch raycasting, clone structure/scale, batching and deletion. Chrome rendered four mature seed variants without errors; their outline and height gradients were visually reviewed. Quest appearance/performance remains pending. Entry and affected module queries advanced to 33. Changes remain local and unpushed.


## Grass targeting and shadow optimization — 2026-10-30

`grass-picker.mjs` installs an analytic ray/ellipsoid test on each grass root group. Rays transform into a unit sphere, intersect once and return the world-space hit and patch instance ID. Returning false from the group's raycast suppresses recursive blade tests on both hits and misses. The ellipsoid follows the patch's seeded footprint, height during growth, world position, yaw and clone scale. Tiny/invisible shoots do not select until they have height; mature detached proxies retain their final matrices. This deliberately selects the approximate whole patch volume, including spaces between blades, rather than exact leaf triangles. Other plant targeting remains unchanged.

Grass growing and mature meshes neither cast nor receive shadows. Mature `leaf4` pools preserve those flags. PlantManager separately tracks shadow-affecting revisions and growing plants; grass planting, growth, maturity or removal no longer invalidates the cached shadow map. Other plants retain their existing shadows. Grass remains normally lit by daylight, but no longer receives shadows from walls or other plants.

All 39 project tests passed, including ellipsoid hits/misses and range filtering with blade raycasts set to throw, mature picking/deletion, shadow flags before/after batching and independent shadow invalidation. Chrome grass rendering smoke checks passed without page errors. Quest performance improvement has not been measured yet. Entry/manager/renderer/new picker/mature batch module queries advanced to 34. Changes remain local and unpushed.


## Smaller grass selection volume — 2026-10-30

Grass selection ellipsoid radii reduced to 80% on all three axes, retaining its center and growth/clone transforms. Visible grass geometry is unchanged. All 39 project tests passed. Entry/renderer/picker query versions advanced to 35.


## Clone icon only on planting targets — 2026-10-30

The clone icon now requires a compatible ground/wall planting marker. Selecting an existing plant hides it, since trigger planting does nothing on plants. Selection rings and remembered clone state remain unchanged. Entry query advanced to 36. JavaScript syntax and whitespace checks passed.


## Hydrangea-style bloom volumes — 2026-10-30

Added a seventh seeded bloom form, hydrangea: rounded heads assembled from twelve small faceted spheres around a central filler sphere. The entire head is a single shared geometry (260 triangles), instanced per flower and merged into mature `hydrangea` pools. No individual sphere scene objects or extra per-sphere draw calls are created. This volume form replaces petals/central pollen geometry for the selected seed and appears on flower plants or other flowering ground forms.

Heads inherit the full seeded HSV color range, tilt, scale and parent growth timing, expanding into a sphere cluster as they mature. Existing single/multiple-bloom arrangements still apply. Seeded structure and instance colors remain identical for clones; placement rotation and clone scale remain independent. Other petal flower forms remain available.

All 40 project tests passed, including seven-form coverage, ten-second growth, hydrangea geometry bounds, clone matrices/colors, exact volume picking, mature batching and deletion. Chrome rendered four color/structure variants without page errors and the resulting screenshot was visually reviewed. Entry and affected generator/renderer/manager/vine imports advanced to 37. Quest appearance/performance remains pending. Changes remain local and unpushed.


## Single-sphere hydrangea heads — 2026-10-30

Replaced each hydrangea head’s cluster of small spheres with one larger faceted sphere, preserving its overall head size, bloom anchor, color and growth. Shared head geometry is now 80 triangles instead of 260. Multiple-head plant arrangements remain possible; each head itself is one sphere. All 40 project tests passed with the new geometry budget. Entry/renderer query versions advanced to 38.


## Sphere blooms on vines — 2026-10-30

Flowering vine seeds now select one of four bloom styles: daisy, buttercup, lily or the shared hydrangea single sphere. A vine keeps one style throughout its flowers. Spheres use the same seeded HSV palette, outward-facing 6–9 cm stalks, growth timing, mature batching and selection as other vine blooms. All 41 project tests passed, including sampled vine sphere/petal coverage and stalk/maturity checks. Entry/manager/vine queries advanced to 39.


## Release review — vine and ground-cover update, 2026-10-30

User approved the current appearance and authorized pushing this update. Release includes corner-wrapping wall vines, surface-aware cloning with incompatible planting clearing the copy, short outward flower stalks, rounded-tier cypress and tapered conifer trunks, branch-free pines, larger arcing clouds, grass patches with analytic ellipsoid targeting and no shadows, planting-only clone icons, and single-sphere hydrangea blooms on ground plants and flowering vines. Final entry query is 39.

All 41 project tests passed. Local module imports, project whitespace and final Chrome wall-planting/clone-indicator checks passed. Changes are confined to Secret Garden; shared runtime/dependencies are unchanged. Prior user feedback and test limits remain in the feature records above. No new comprehensive Quest benchmark is claimed. As requested, do not check GitHub Pages deployment after this push.


## Targeting hierarchy optimization — 2026-10-30

Non-grass plants now install `plant-picker.mjs`. A per-plant local box rejects complete misses during growth. At maturity, a static hierarchy of per-component geometry bounds is built once, then cached alongside the detached picking group. Rays visit only intersected nodes/components, and original Three.js triangle tests run through a reusable probe mesh for those candidates. Returned hits retain the source plant ID, component instance index, world point and distance. This preserves exact geometry selection, gaps, overlap ordering and near/far clipping rather than making foliage gaps solid.

Grass's existing 80% ellipsoid remains unchanged. Growing plants use their original exact mesh tests only after whole-plant bounds pass. No shadows, rendering resolution, foveation or visual geometry settings were changed. Hierarchies are static after maturity; new/deleted plants keep independent lifecycles and the existing mature render pools.

All 43 project tests passed. New coverage compares nearest IDs/distances against original targeting for 250 rays across mixed, overlapping plants and a corner-wrapping vine, checks near/far ranges, and proves misses/grown hierarchy hits skip whole instanced-mesh traversal. Chrome wall planting and clone-mode target feedback checks passed without page errors.

A local Node comparison with 100 mature plants and 600 identical rays measured median 157.45 ms before and 50.06 ms after (3.15× faster), with the same 560 hit rays. This is a Mac CPU microbenchmark, not a Quest frame-rate result. Building final growth, render batches and hierarchies for all 100 plants at once took 49.2 ms in that artificial setup; normal planting staggers maturity. Quest capture with the new version remains pending. Entry/renderer/new picker queries advanced to 40. Changes are local and unpushed.


## Targeting release and profiling hooks — 2026-10-30

The user reports simplified targeting is working well and authorized updating the handoff and pushing this change. The release contains `plant-picker.mjs`, renderer integration, exact-hit equivalence tests and entry query version 40. Grass's reduced ellipsoid targeting is unchanged. All 43 project tests passed again before release; module paths and whitespace checks passed. Prior Chrome wall-planting/clone-indicator smoke checks passed. No shared runtime/dependency changes are included.

No permanent profiling HUD, checkbox, recording loop or timing instrumentation has been added. `window.secretGarden` exposes references to existing runtime objects for inspection. `batchMature:false` is an optional constructor comparison setting; normal batching stays enabled. The targeting helper's `enabled` field supports comparison tests; acceleration stays enabled normally. These hooks do not start background profiling. Temporary CPU wrappers and sampling are stopped/restored after each external capture; profiler scripts and reports remain outside the repository.

Native Quest GPU profiling was successfully tested over ADB using `ovrgpuprofiler --realtime`, without detailed driver mode or browser restart. In a pre-targeting-optimization capture with 93 plants, GPU utilization averaged 61.9% and reported fragment/vertex shading shares averaged 90.7%/9.3%; the app was near its 90 Hz target. CPU rendering submission averaged 0.74 ms/frame and instanced plant raycasts 1.12 ms/frame. Native counters cover headset-wide GPU activity, and no exact per-app GPU milliseconds were measured. This does not constitute a new benchmark of the targeting optimization; the user's positive feedback is separate from the earlier trace.

As requested, do not check GitHub Pages deployment after pushing.


## Recessed automatic door and settings room — 2026-10-30

Added a doorway centered on the far (-Z, wall ID 2) garden wall, a 0.44 m recessed passage and a room beyond it with exactly 6 × 6 ft (1.8288 × 1.8288 m) interior floor dimensions. Room ceiling height is 2.6 m. The doorway is 1.15 m wide and 2.25 m tall; its wooden door sits 0.32 m behind the garden wall face and swings inward. An inset stone surround and warm, non-shadow-casting light make the space readable. No control panel is implemented; that remains a future milestone.

`garden-layout.mjs` holds shared dimensions, doorway planting exclusions and collision rectangles. `garden-room.mjs` constructs the room, recess, hinged leaf/handle and proximity state. Door opening begins within 1.35 m of the door from either side; closing begins beyond 1.75 m, preventing threshold chatter. Opening/closing takes about 0.65 seconds. Moving door frames invalidate the cached shadow map; a stationary door does not. Static room/recess/frame geometry is merged into two material batches, with frozen CPU boxes retained for environmental ray hits.

Viewer containment projects tracked head position into the connected garden/passage/room footprint, including physical head offsets and rig yaw. Closed doors block passage until the leaf is sufficiently open. Garden walls and room side/back walls remain impassable. Ground planting is explicitly restricted to the garden footprint. All room/recess floors, walls, ceiling, frame and door report environment-only surfaces, never planting surfaces.

Vine supports carry a deterministic expanded doorway exclusion rectangle in unfolded perimeter coordinates. Shoots that would cross it redirect upward along its sides or away above it; this also applies to vines arriving from adjacent walls or on scaled clones. Clearance includes room for leaves and flowers, keeping the doorway free of foliage. Direct vine planting in the exclusion area is rejected, with no clone-state loss; compatible target markers are hidden there.

All 47 project tests passed: room interior dimensions and ceiling, closed/open doorway ray hits, opening from both sides and closing away, movement into/out of the room and around solid walls, room planting rejection, doorway seed rejection and 160 near-door/adjacent-wall vine cases. Existing fixtures were moved to valid garden positions to match the strengthened planting checks. Chrome keyboard walkthrough verified automatic opening, entering the room, back-wall containment, closing inside, no planting on room surfaces and exiting again. Door/recess, room and doorway-clear vine screenshots were reviewed without page errors. Final merged-room walkthrough passed. Physical Quest collision/door comfort and performance still need user testing. Entry and affected modules advanced to query version 41. Changes remain local, uncommitted and unpushed.


## Six-foot hallway and larger control room — 2026-10-30

Hallway length is now exactly 6 ft (1.8288 m) from the garden opening to the room. The door is centered at 3 ft (0.9144 m) along it. Control-room interior floor dimensions are now 12 × 12 ft (3.6576 × 3.6576 m); ceiling remains 2.6 m high. Existing automatic opening/closing, non-plantable interior surfaces, doorway vine exclusions and batched static geometry remain.

Hallway clear width is 1.09 m versus the garden opening's 1.15 m, with a 2.22 m ceiling versus the opening's 2.25 m height. Side/ceiling faces are inset by 3 cm and their front ends set 1.5 cm behind the facade. Garden trim sits fully in front of the facade, and room-entry reveals are offset from hallway faces. These changes remove coplanar joins responsible for z-fighting rather than relying on render-order tricks. Viewer constraints and door leaf dimensions follow the narrower hallway. The hinge opens to 90° with a small side clearance so the leaf rests along the hall rather than swinging through its side wall.

All 48 project tests passed, including exact hallway/door/room dimensions, inset geometry, automatic operation, room planting rejection and movement bounds. A prior garden-only boundary test fixture was moved near the garden corners so it does not intentionally teleport closer to the enlarged room. Chrome walkthrough verified walking to the room's far end, closing the door when away, reopening from inside, returning to the garden and no room planting. Hallway and larger-room screenshots were visually reviewed with no page errors. Final hinge adjustment also passed the room tests. Physical Quest flicker/comfort retesting remains pending. Entry and affected modules advanced to 42. Changes are local, uncommitted and unpushed.


## Larger, shallower door surround — 2026-10-30

Garden doorway trim widened from 12 to 14 cm, with legs extended 12 cm below floor level and a low sill covering the floor join. Its depth and outward position were both halved: the front now protrudes 6.25 cm instead of 12.5 cm, retaining a small noncoplanar clearance from the garden wall. Header and posts meet without overlapping front faces; the sill has a small vertical/depth offset to avoid floor z-fighting. Door/hallway clear dimensions are unchanged. All 48 project tests passed. Entry/environment/room queries advanced to 43.


## Threshold floor-gap coverage — 2026-10-30

Doubled threshold depth from 6 to 12 cm along the hallway direction, keeping its center so its back now extends into the hall and overlaps the floor join. The raised top remains noncoplanar with the floor. Room tests and whitespace checks passed. Entry/environment/room queries advanced to 44.


## Double-action door and two-sided handles — 2026-10-30

Door swing direction is selected from the approaching side when closed: garden approach opens toward the room, room approach opens toward the garden. Direction stays latched while the user crosses an open door. An opposite-side approach while it is closing first finishes closing, then opens away, avoiding a sudden direction flip. Both faces now have small cube handles sharing geometry/material. Existing proximity thresholds and collision gating remain. Entry/environment/room queries advanced to 45.

All 49 project tests passed, including swing direction, crossing stability, smooth reversal after partial closing and two-sided cube handle geometry. Chrome verified opening away from both approaches and closing between them without page errors. Physical Quest testing remains pending; changes are local and unpushed.


## Door complex moved behind the player — 2026-10-30

Moved the garden opening to wall ID 0 (+Z), behind the initial camera's -Z view. The initial player pose is unchanged. The previous -Z opening is filled by the original solid wall/brick pattern. Hallway, midpoint double-action door, handles, trim, threshold, ceilinged 12 × 12 ft room and its light now extend outward from the rear wall.

Layout coordinates, collision rectangle ordering, environmental target geometry, doorway planting blocks and unfolded vine exclusions are updated for the rear side. Door direction still follows the approaching side. Six-foot hallway, three-foot door midpoint, frame depth, threshold coverage, anti-flicker offsets and non-plantable room rules remain unchanged.

All 50 project tests passed, including an explicit forward-solid-wall/rear-door test, navigation, auto-door operation and rear/adjacent-wall vine exclusion checks. Vine fixtures were moved off the relocated doorway to remain valid planting tests. Chrome verified walking through the rear doorway and back with no page errors. Physical Quest retesting remains pending. Entry and changed imports advanced to 46. Changes are local and unpushed.

The room’s wall opposite the doorway has a Garden Settings panel. Aim and pull the active trigger (desktop: click) on the Shadows checkbox to globally toggle shadows. Shadows default on; reenabling refreshes the cached map. The shared `VRCheckbox` uses the existing control model and the project’s single pointer; no extra raycasts or controller listeners.

Settings panel validation: Secret Garden 52/52 tests; full root suite passed (including 32 shared tests); browser ray/click toggles global shadows off/on with no planting or page errors, panel screenshot inspected; `git diff --check` passed. Quest appearance/controller validation remains pending. Entry module cache version 47. Changes remain local.

Vines no longer cast shadows, but still receive them. Growing meshes and mature pools preserve this policy; vine pools are separated from casting ground plants that share stem/flower geometry. Vine planting, growth and deletion no longer invalidate the cached shadow map. Grass retains its existing no-cast/no-receive policy. Entry/renderer/manager/batch cache queries advanced to 48.

Vine shadow validation: all 53 Secret Garden tests passed, including growing/mature shadow flags, mixed vine/ground pools, pool expansion/deletion, and shadow-cache invalidation. `git diff --check` passed. No new headset performance measurement; changes remain local and unpushed.

Door hinge fit correction: removed the 3 cm hinge inset and undersized leaf (which left a hinge-side and top/bottom gap). The pivot now sits exactly on the hallway jamb, and the leaf fills the clear width/height when closed. A fixed round hinge stile covers the pivot seam during either swing. Only rotation changes during animation; pivot and stile remain stationary. Cache queries advanced to 49.

Door fit validation: all 54 garden tests passed, including stationary hinge/stile checks throughout both swings and closed-opening edge coverage. Chrome confirmed opening away from either side and closing between approaches without page errors; whitespace check passed. Physical Quest appearance remains to be checked. Local changes only.

Reset Garden action added below Shadows on the room panel. Active trigger / desktop click empties growing and mature plants (including vines/grass), releases pooled instance buffers, clears clone/delete/selection state, resets plant IDs and invalidates the cached shadow map. Removal flushes once for the entire garden. Player location, door and shadow preference are preserved. The action uses the existing ControlModel and single active ray. Entry/settings/manager/renderer cache queries advanced to 50.

Reset validation: 55/55 garden tests passed; Chrome real click cleared mature and growing ground plants/vines, emptying pools and clone state while preserving Shadows. Fresh planting starts at ID 1. No page errors, panel screenshot inspected, `git diff --check` passed. Quest interaction remains to be checked. Local, unpushed changes.

Umbrella trees (broad ellipsoid crowns) now have 25% taller trunks, vertically fuller ellipsoids (vertical radius 50–65% of depth rather than 34%), staggered branch origins and more upward-growing limbs, including a raised continuation. Crown radius and branch width compensate for the height multiplier to retain their broad canopy footprint. Other tree families are unchanged. Cache queries advanced to 51.

Umbrella adjustment validation: all 55 garden tests passed, including deterministic generation, crown proportions, growth, cloning, batching and targeting. `git diff --check` passed. Visual review on Quest remains pending; changes are local and unpushed.

## Release — 2026-10-30

User authorized publishing the accumulated rear doorway/hallway/12-foot control room, fixed double-action hinge and two-sided handles, vine doorway exclusion, Shadows checkbox and reusable shared VRCheckbox, Reset Garden, non-shadow-casting vines and taller/full umbrella crowns. Final entry query is 51. Validation: 55 garden tests passed; full root suite passed after adding the shared checkbox (32 shared tests); later changes are project-only and passed the garden suite. Chrome checked room traversal, both door approaches, settings and populated-garden reset; screenshot reviews and whitespace checks passed. Quest appearance/performance limits remain recorded above. Publish this release to main; do not check GitHub Pages, per user request. Earlier local/unpushed notes are historical.
