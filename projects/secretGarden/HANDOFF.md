# The Secret Garden — Milestone 1

## Status and scope

Implemented for desktop and Meta Quest 3. The garden starts empty. No persistence, vines, grasses, wind, maintenance, collision between plants, or placement spacing is implemented. The user has tested on Quest and reports mature batching helped. A live USB-debugging capture was taken with 74–75 plants before batching; later changes have not received a complete headset acceptance pass. The user authorized committing and pushing this release on 2026-10-30.

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
