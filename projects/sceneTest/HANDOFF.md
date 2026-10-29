# Scene Test — Milestone 1

Buildless Three.js r180 / WebXR lighting laboratory for Meta Quest 3. Entry: `projects/sceneTest/index.html`. Shares the existing `shared/vendor/three-r180/three.module.js` and core; matching MIT area-light addons and VRButton live in `shared/vendor/three-r180/addons/`. All runtime requests stay local.

## Modules

- `model.js`: version 1 scene schema, validated explicit localStorage persistence, defaults and independent selection/grip ownership.
- `app.js`: renderer, global settings, lifecycle, reset/save, periodic statistics for the Scene Settings performance readout.
- `environment.js`: checkerboard floor, gray wall, four fixed PBR test objects and procedural neutral PMREM studio reflections.
- `lights.js`: four light types, unlit persistent helpers, world-space orientation/targets and shadow setup. Local -Z is the emitting direction. Light handles never cast shadows.
- `input.js`: tracked rays, right-trigger selection/UI, both-hand offset-preserving grips, locomotion/turning around headset position, desktop pointer controls. Loss of tracking/session visibility releases grabs; no stale controller input should move lights.
- `ui.js`: three world-space canvas panels and matching native desktop controls; changes use shared control descriptors. Dropdowns expand options in VR. Panels open 45 degrees right, 1.85 m away, and remain stationary until reopened.

## Controls and behavior

Left stick walks at 1.3 m/s; right stick smoothly turns at 1.1 rad/s with a 0.15 dead zone. Right trigger selects lights or edits panels. Either grip creates from a palette symbol or moves an existing handle, using near pickup within 18 cm before ray pickup. Grabs preserve position/rotation offsets. Grabbing any light immediately selects it and opens its properties, including palette-created lights. Releasing preserves the current selection without selecting again. Right B deselects; left Y toggles/repositions panels. Rays stay visible, including during grabs, whenever target-ray tracking exists. Helper colors: pale neutral, cyan hover, green selected, orange grabbed. Helpers also remain for disabled lights.

Desktop: native controls create/edit lights; click a handle to select, drag to move in the view plane, Shift-drag to rotate. WASD walks; left/right arrows turn; B/Escape deselects; Y toggles world panels. Desktop control visibility has its own header button.

Defaults match the milestone brief. No user-created lights initially; ambient white 0.3, hemisphere off, neutral gray background, Neutral tone mapping, exposure 1, shadows globally on at 512. Procedural reflection environment remains present independently of ambient/hemisphere toggles. Each shadow-capable light stores its own preference; global shadow changes do not erase it. Directional shadow volume is ±5 m, depth 0.05–20 m; point/spot depth is 0.05–40 m. Map sizes 256/512/1024/2048 dispose old maps when changed. Native area lights have no shadow control. Range zero is unlimited; decay remains 2.

Save writes only on an explicit button press to `codex.sceneTest.v1`. Startup validates before restoring, excluding selection and grip state. Reset releases grabs, clears lights/selection and restores settings without touching storage. Save failure or corrupt data is reported in the panels. Reload restores the last explicit save, including after reset.

## Validation and remaining headset checks

Run `npm run test:sceneTest` (or `node --test projects/sceneTest/tests/*.mjs`). Model tests cover defaults, immediate grab selection and exclusive grip ownership, round-trip persistence, reset/save separation and invalid input. Browser tests cover renderer startup, all four light types, live properties, shadows, helpers, save/reload/reset, selection and controller manipulation simulation. Validated on 2026-10-29: all six model tests passed; headless Chrome WebGL integration checks passed, including actual controller rays against the world panels, the 45-degree opening angle, offset-preserving manipulation, targets, shadow-map allocation and save/reset/reload behavior. The existing root repository suite also passed. Software-renderer FPS is not a Quest performance measurement.

Quest 3 hardware validation remains required: stereo readability, controller mapping, near/ray pickup comfort, panels at 45 degrees, illumination and shadows while manipulating all types, locomotion, and sustained performance. Desktop/automated checks cannot establish these. Shader variants may compile when adding lights or changing shadow counts. Multiple point-light shadow maps and high resolutions are expensive; Scene Settings reports light and shadow counts but imposes no artificial creation limit. No publication is authorized by implementation alone.

To run the optional browser integration check, serve the repository on port 8093 and run `node projects/sceneTest/tests/browser.cjs` with Playwright installed. `SCENE_TEST_URL` can override the preview URL; `PLAYWRIGHT_MODULE` and `CHROME_PATH` can point to an existing Playwright package and Chrome executable. `SCENE_SCREENSHOT` optionally writes a screenshot. No browser package is added to runtime dependencies.

## Navigation correction — 2026-10-29

Quest feedback identified wrong walking headings and turning that translated the player. The original navigation read `renderer.xr.getCamera()` with normal world-transform getters. Three.js's internal XR ArrayCamera has no rig parent, so those getters can replace its renderer-composed world matrix with its reference-space pose, dropping the accumulated rig translation/yaw.

`app.js` now copies the current frame's center-eye `XRViewerPose` into a dedicated camera attached to the player rig before controller processing. All view-relative consumers (walking, turn pivot and reopening panels) use that parented pose. Heading reads after turning therefore include the new rig yaw, while the turn pivot includes physical room-scale headset offsets. Rendering continues to use the renderer's XR cameras normally. Entry and changed input module query versions are advanced to `v=2` for cached Quest reloads.

Browser regressions simulate a translated/yawed rig, four walking directions, 120 consecutive turn frames with an offset headset, changing physical head orientation/position, simultaneous diagonal movement/turning, and panel reopening after locomotion. They also prohibit navigation reads of the renderer's internal XR camera. These checks complement, rather than replace, retesting movement on the Quest.

## Controller grip markers — 2026-10-29

Each tracked controller grip has an unlit sphere with a 3.5 cm radius at its exact pickup/attachment origin: cyan for the left hand, warm orange for the right. Markers follow grip tracking, remain during grabs, and disappear with the grip when tracking is lost or the controller disconnects. They cast no shadows and are excluded from interaction ray targets. Entry/input query versions advance to `v=3`.

## Straight test-object row — 2026-10-29

The four test objects now share depth `z = -3`, parallel to the wall, with evenly spaced centers at `x = -2.1, -0.7, 0.7, 2.1`. Their labels retain the same offset in front, placing all labels in a matching straight row at `z = -2.22`. Objects retain their floor-resting heights. Entry/environment module versions advance to `v=4`.

## Richer reflection environment — 2026-10-29

The procedural PMREM studio now contains a bright six-pane front window, two vertical light strips, an overhead softbox, dark flags and a darker floor. The window faces the initial viewpoint for visible structured reflections on the metal sphere. Cards use neutral colors with HDR brightness; reflection intensity remains 0.35. These features exist only during the one-time environment bake, so visible scene geometry and ongoing draw calls are unchanged. Entry/environment versions advance to `v=5`.

## Performance readout placement — 2026-10-29

FPS, active lights, shadow-casting lights, draw calls and triangles now appear at the bottom of Scene Settings in both VR and desktop controls, still updating twice per second. The head-attached mesh/texture HUD and fixed desktop overlay are removed. Expanded VR dropdowns temporarily cover the performance area; closing them restores the readout. Entry/UI versions advance to `v=7`.

## Select on grab — 2026-10-29

Selection now changes immediately on a successful grab, including palette creation. Releasing a light only ends the grab; it does not change selection, so deselecting or choosing another light while holding one is respected on release. Desktop retains selection on pointer-down and no longer selects on release. Rejected grabs leave selection unchanged. Model/browser checks cover the revised behavior. Entry, input, UI and application model versions advance to `v=8`.

## Release review — 2026-10-29

The user tested the project, accepted the final behavior, and authorized committing/pushing Scene Test to GitHub. Final behavior includes the corrected headset-relative navigation, controller grip spheres, straight object/label rows, richer studio reflections, performance information inside Scene Settings, and immediate selection on grab. The complete root suite (including six Scene Test model tests) and Chrome WebGL integration checks passed for this release; whitespace checks passed. User acceptance is not a formal sustained frame-rate or stereo/comfort benchmark. No shared vendor runtime was changed. The unrelated Chess backups remain excluded. See Git history for the release commit and deployment status.

## Shared Three.js relocation — 2026-10-29

Three.js r180 now lives at repository-level `shared/vendor/three-r180/`, with GLTFLoader, BufferGeometryUtils, VRButton and area-light modules in its `addons/` directory. Former Forest/Scene Test vendor directories are removed. Imports, tests, documentation and the knight exporter use the canonical shared paths. Core/license bytes are unchanged; addon code changes only adjust imports. Buildless entry/module queries use `shared-r180-1` to refresh cached module graphs. Racer, Terrain and Fishing static outputs were rebuilt from their updated sources; Swarm retains independent npm dependencies.

Validation: the complete root suite, all ten Cloud tests, three Vite builds, Scene Test browser integration and browser startup of all ten affected projects under `/CodexTest/` passed. All 525 inspected local module references resolve. No new Quest hardware benchmark is implied. The user authorized committing and pushing this relocation. See Git history for the release commit; Pages checks were not requested.
