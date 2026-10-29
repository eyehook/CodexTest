# Scene Test — Milestone 2: Objects and Materials

Buildless Three.js r180 / WebXR scene laboratory for Meta Quest 3. Entry: `projects/sceneTest/index.html`. Source milestone brief: [MILESTONE_2.md](MILESTONE_2.md). All runtime modules and the reflection environment work offline. Three.js and matching MIT addons come from `shared/vendor/three-r180/`.

## Current behavior

Three world-locked panels: Scene Settings, Creation Palette, and contextual Settings immediately to its right. The palette has Lights and Objects tabs. Manually changing tabs preserves selection and the contextual panel. Trigger selection activates the matching tab, shows its properties, and opens hidden panels. Opening/reopening uses the current headset pose, 1.85 m away and 45° right; the group stays stationary while open. Scene Settings and its performance readout stay independent of palette tabs.

Right trigger selects lights or actual primitive geometry and edits UI. Either grip creates from the active palette or moves an existing entity using near pickup before ray pickup. New palette instances select immediately. **Per the Milestone 2 brief, existing grabs do not auto-select:** grabbing the selected item preserves selection; grabbing a different existing item clears selection. Release only ends the grab. B deselects; Y toggles/repositions panels. Rays remain visible while tracked, including during grabs. Cyan left/orange right grip spheres show the pickup origins. Room-scale offsets and the relative grab position/rotation are preserved.

Desktop controls create/edit entities. Click a helper or primitive to select; drag moves it in the view plane, Shift-drag rotates. WASD walks; left/right arrows turn. B/Escape deselects. The header button hides native controls; selecting an entity restores them. Desktop and VR numeric bounds/steps use the same shared ControlModel.

Walking remains 1.3 m/s, turning 1.1 rad/s, raw analog magnitude after a 0.15 deadzone. Preserve shared XR/locomotion helpers and the parented current center-eye viewer pose. Never derive navigation from the renderer's parentless XR ArrayCamera world getters: that previously lost the rig transform and caused wrong headings/pivot drift.

## Objects and materials

Sphere, cube, cylinder and square-based pyramid are 0.5 m in each dimension by default. Sphere/cylinder subdivisions are bounded; the four-sided cone geometry is rotated so its square base aligns with local X/Z. Each shape shares one geometry cache entry. Each instance has its own Standard material: white, metalness 0, roughness 0.5, opacity fixed at 1. New instances cast and receive shadows; cast/receive preferences edit independently. Global shadows suppress casting without erasing those preferences.

Object Settings exposes RGB (0–255), a live swatch, metalness/roughness (0–1), All/X/Y/Z scale (0.1–10), cast/receive flags and Delete. Object color has no presets; existing light presets remain. All sets each axis to an absolute value and synchronizes the three controls immediately. Axis edits do not change the last All value. That convenience value is per object and is also saved; selection changes never normalize scales. Reapplying All at its retained value still resets all three axes.

Entities freely intersect the floor and one another. There is no physics, collision restriction, snapping, grouping, opacity editing or environment-map editing. The checkerboard floor remains uneditable. There are no built-in sample objects, labels or wall; a new scene contains no placeable entities. The richer neutral studio reflection map remains available for user-created materials.

Unlit wireframe overlays mark object hover (cyan), selection (green) and grab (orange), without modifying the Standard material. Light helpers retain the same color states and stay visible even for disabled lights. Object rays use the actual primitive mesh; proximity grabbing uses the transformed geometry bounds. Overlays are excluded from ray hits and cast no shadows.

## Modules and shared dependencies

- `model.js`: defaults, v1-to-v2 validation/migration, stable IDs, explicit persistence, selection and exclusive grab ownership. Light and object IDs share one namespace.
- `entities.js`: common entity lookup, iteration, ray targets, creation/removal and near-pickup distance. Managers keep type-specific data/rendering.
- `lights.js`: existing four light types, unlit persistent helpers, synchronized local -Z direction/targets and shadow maps.
- `objects.js`: primitive geometry factory/cache, independently materialized mesh instances, temporary overlays, transforms and lifecycle.
- `materials.js`: material-model factory/editor; only `standard` is currently supported. The serialized type leaves room for future models.
- `input.js`: shared pointer/button/locomotion adapters with project-owned selection, geometry picking, offset-preserving grips and desktop dragging. UI drags cannot retarget after a selection/tab change.
- `ui.js`: existing native/canvas panel adapters, contextual light/object rows and shared ControlModel numeric/toggle bindings, ChoiceBar tabs and sliderValue mapping. It retains every Milestone 1 global and light control. Scale synchronization and swatches update without rebuilding native controls during drag.
- `app.js`: lifecycle, generic selection/deletion, object/light restore/reset, settings and periodic renderer statistics.
- `environment.js`: checkerboard floor and a once-baked procedural PMREM studio.

Shared consumers: locomotion, ButtonEdges, ControllerPointer/line, XRFrameState, FrameRateCounter, ControlModel, ChoiceBar and sliderValue. See [shared guide](../../shared/README.md). No shared runtime implementation was changed for this milestone. Project-local modules use `m2-1`; environment uses `m2-2`; entry/input/entity registry/UI use `m2-3` for A-button duplication.

## Persistence and cleanup

The JSON schema is version 2. **The storage key remains `codex.sceneTest.v1`** so old scenes remain discoverable. Valid version 1 light-only saves migrate in memory to an empty object collection with all lighting/settings preserved. No startup write occurs. Explicit Save replaces the stored JSON with v2; malformed or unsupported data is reported. No selection, active grip or tab state is restored.

V2 objects save ID, primitive type, world position/quaternion, scale, last All, Standard material type/RGB/metalness/roughness, and cast/receive preferences. Light data/settings retain their existing schema. Quaternion/world transform reads include held entities. Scale saves authoritative editable components to avoid floating-point decomposition pushing a maximum scale beyond 10.

Reset releases grabs, removes all user entities, clears selection and restores global defaults, while leaving the explicit save untouched. The floor remains; sample objects, labels and wall are not recreated. Reload restores the last save. Deletion clears grip ownership and contextual state; object-specific material/overlay resources are disposed. Shared shape geometry remains cached (at most four entries) for reuse, with `ObjectManager.dispose()` available for full teardown.

## Validation

`npm run test:sceneTest` runs the dependency-free model/geometry/material checks. Optional Playwright checks, against a repository static server:

- `node projects/sceneTest/tests/browser.cjs`: existing lighting, shadow maps, navigation, panel position, controller rays/grabs and persistence regressions, updated only for the specified existing-grab policy.
- `node projects/sceneTest/tests/objects-browser.cjs`: v1 startup migration; four primitives; tab/context behavior; live independent materials; All/axis synchronization; hidden-panel opening; actual geometry rays; all four VR prototype grip paths; offset/scale updates; overlay states; deletion during grab; B; explicit v2 save/reset/reload.

Set `SCENE_TEST_URL`, `PLAYWRIGHT_MODULE` and `CHROME_PATH` as needed for an existing preview/Playwright/Chrome installation. `SCENE_SCREENSHOT` optionally writes a preview. No browser automation dependency is added to runtime.

The 15 model/object tests and both Chrome integration suites passed during implementation. Final verification and remaining headset checks are recorded below. Desktop/software-renderer FPS is not a Quest performance measurement. Quest validation remains required for stereo readability, controller feel, near pickup, scaled-object manipulation and sustained performance. Multiple shadow lights/high map resolutions remain expensive. The Milestone 2 release is authorized by the subsequent user request recorded below.

Final verification on 2026-10-29: all 15 Scene Test model/object tests, the complete root suite (including 31 shared regressions), both Scene Test Chrome integration suites, local runtime import checks and `git diff --check` passed. Desktop Object Settings and all three VR panels were visually reviewed. Primitive preview edges/spacing were adjusted for readability; all four prototype-grip paths passed again afterward. Quest hardware retesting remains outstanding.

## Empty default scene — 2026-10-29

Per subsequent user request, removed the fixed comparison objects, their labels and the wall. New/reset scenes contain only the checkerboard floor, global lighting/background and the UI. Saved user-created lights and primitives still restore normally. The off-scene PMREM studio is retained solely as a reflection map.

## A-button duplication — 2026-10-29

Subsequent user request adds duplication beyond the original milestone scope. While pointing the right-controller ray at an existing light or object, press/hold A (`xr-standard` button 4) to create one duplicate with a new ID. All per-entity settings are deep-copied, including disabled-light state, material properties, scale/last All and shadow preferences. Current world position/quaternion are captured even if the source is held. Materials and light targets are independent; primitive geometry remains shared.

The duplicate selects immediately, opens the matching settings, and attaches to the right grip without snapping. Holding A moves/rotates it; releasing A places it while preserving selection. Holding the button never repeats copies. A hold and ordinary grip ownership are distinct: releasing one button cannot drop the other's entity, and an already-busy hand cannot start a duplicate. Palette prototypes/UI/empty space are not duplicate targets; left X does not duplicate. Tracking loss, disconnection, session cleanup and deletion safely release/clear the hold. A held through tracking recovery must be released and freshly pressed before making another copy. Duplication does not save automatically; the ordinary v2 save/reset/load path includes copies.

Validation: 16 Scene Test model/object/duplication tests pass. `tests/duplicate-browser.cjs` covers all eight entity types, complete settings, independent materials/targets, immediate selection, initial offset, movement/rotation, one copy per press, independent A/grip release, tracking recovery, deletion during hold and saved-copy restoration. Physical Quest A-button testing remains required. The user subsequently authorized committing and pushing this release.

## Milestone 2 release review — 2026-10-29

The user authorized pushing Milestone 2 and subsequent floor-only defaults and A-button duplication to GitHub. The full root suite passed again before publication, including all 16 Scene Test tests and 31 shared regressions. The three Scene Test Chrome suites passed for lighting/navigation, objects/materials/scale/persistence and all eight A-duplicate types. Whitespace checks passed. No shared runtime was modified; shared consumer documentation and project-directory descriptions reflect Scene Test's expanded scope. Physical Quest validation limits remain as noted above. See Git history for the commit. Pages checks are skipped at the user's request.
