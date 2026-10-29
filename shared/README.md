# Shared library guide

This is the reference for first-party shared module interfaces, usage rules and
current consumers. [Repository guidance](../AGENTS.md) covers reuse and validation
policy; project handoffs record project-specific controls and test feedback.

```text
shared/
  xr/             # Locomotion, controller input/pointers and XR frame helpers
  performance/    # Application frame cadence
  ui/             # Bound control definitions, native web and canvas VR renderers
  vendor/         # Bundled third-party dependencies and licenses
```

## Third-party dependencies

`vendor/three-r180/` is the canonical bundled Three.js r180 runtime for the repository's static projects, tests and Racer/Terrain/Fishing source builds. Core modules and their MIT license live at that root; supporting modules live in `addons/`. No network downloads are required at runtime.

Use relative imports to keep GitHub Pages subpaths and local serving working. A project in `projects/<name>/` imports `../../shared/vendor/three-r180/three.module.js`. Deeper source files need the corresponding additional parent segment. Scene Test maps the bare `three` specifier to the same shared module.

Keep addons and core on the same Three.js revision. When upgrading, retain licenses, check every affected consumer, run the full root test suite and Cloud tests, and rebuild Racer, Terrain and Fishing. Swarm also consumes the shared Three.js runtime and needs its separate Node tests and browser checks when affected. Project-specific assets and application behavior remain in their projects.

Swarm uses the canonical Three.js runtime and native HTML desktop controls. It
requires no GUI library, package installation or bundler. See the
[Swarm handoff](../projects/swarm/HANDOFF.md).

## Shared XR functionality

First-party XR browser ES modules live in `shared/xr/`; cadence sampling lives in
`shared/performance/`. Surface and Scene Test use shared locomotion. The consumer
table below lists adoption of the other helpers; migration remains incremental.

- `input.mjs`: `deadzone(value, threshold, rescale = true)` filters invalid input
  and optionally rescales the remaining analog range. `readMovementAxes(sources,
  output)` reads xr-standard left-stick X/Z and right-stick turn into a reused
  `{x, z, turn}` buffer, clearing disconnected inputs each call.
- `locomotion.mjs`: `new Locomotion(rig, settings)` accepts `moveSpeed` (m/s),
  `turnSpeed` (rad/s), `deadzone`, `rescaleDeadzone` and `maxDelta` (seconds).
  Defaults are 1.5, PI/3, 0.15, true and 0.05. `update(dt, sources, viewer)`
  reads XR axes; `move(dt, x, z, turn, viewer, enabled = true)` also supports
  keyboard or project-specific input adapters. The viewer has `position` and
  `orientation` in the rig's local reference space, never the renderer's internal
  XR camera world transform. Use a root-level, unscaled rig with yaw rotation.

Turning preserves the headset's world position, walking follows its horizontal
heading after turning, and diagonal speed is capped. Callers gate hidden/untracked
sessions; a missing viewer or disabled `move` also prevents navigation. Reuse the
instance across frames. Project settings, flight, momentum, collision, UI and XR
lifecycle remain with the project. Button edges and pointers are described below.

Buildless projects import `../../shared/xr/locomotion.mjs`; built projects can
import the same source through their bundler. Keep relative imports for Pages.
Run `npm run test:shared` and affected project checks; shared runtime changes
require the full root suite and affected consumer checks. Retest affected
movement and interaction on Quest after runtime changes.

## Controller, session and performance helpers

These browser ES modules have no build step. Three.js-dependent helpers use the
canonical r180 vendor module. Input, session and cadence helpers do not depend on
Three.js or browser globals and can be tested directly in Node.

| Module | Interface | Current consumers |
| --- | --- | --- |
| `xr/locomotion.mjs` | `Locomotion` | Surface, Scene Test |
| `xr/input.mjs` | `buttonValue(source, index = 0)`; `ButtonEdges` | Surface and Scene Test edges; Space Race trigger pressure; Surface locomotion axes |
| `xr/pointer.mjs` | `createPointerLine(options)`; `ControllerPointer` | Surface and Scene Test; Swarm and Weather through shared VR UI |
| `xr/session.mjs` | `XRFrameState` | Surface and Scene Test |
| `performance/frame-rate.mjs` | `FrameRateCounter` (also exported as `FrameRate`) | Scene Test, Space Race, Weather, Clouds |
| `xr/frame-rate.mjs` | `requestFrameRate(session, target)` | Space Race |

### Input

`ButtonEdges.sample(source, index, seed = false)` returns a reused
`{down, pressed, released, value}` state. Sample each source/button once per frame.
Use `seed = true` when held buttons should be absorbed on entry/resume; subsequent
release/press edges work normally. Projects choose their own entry behavior.
`reset(source)` removes a disconnected source, `reset()` clears a session,
and `retain(sources)` prunes disconnected sources. Preserve XRInputSource identity;
handedness alone is not a unique connection identifier. Aggregate multiple edge
presses before performing a single panel toggle.

`buttonValue` clamps finite analog pressure to [0,1], falls back to `pressed` when
value is absent, and returns zero for missing/nonfinite values. It does not choose
which mappings, handedness or tracked controllers a project accepts.

### Pointers

`createPointerLine({color, length, depthTest, renderOrder})` creates a local -Z
ray visual. The project attaches it to its controller and owns visibility, hover
color, hit distance, removal and geometry/material disposal.
`new ControllerPointer({near, far})` owns a reusable raycaster and hit buffer.
`setFromController(controller)` refreshes the controller/parent transforms and
returns the raycaster; `cast(controller, objectOrArray, recursive = false)` returns
the nearest hit or null. Hit storage is reused; consume it before the next cast.
Update target world matrices before casting. Gate casts/actions with current
tracking; UI coordinates, dragging, selection and grab ownership remain local.

### Session frames

Call `state.update(session, frame, referenceSpace, document.hidden)` once per app
frame. `pose` is null outside visible, tracked XR; `active` also allows visible
desktop frames. `firstTracked` is true only once per session (not after tracking
recovery), `resumed` marks an inactive-to-active transition, and `changed` marks
session identity changes. `isTracked(space)` gates controller rays/grips using the
same current frame and reference space. `reset()` drops stored frame/session state.
Do not retain an XRFrame beyond its animation callback or inspect poses after it.

The caller still owns session requests, reference-space choice, renderer attachment,
end/visibility listeners and cleanup of interactions. These helpers do not impose
a shared Enter VR button, panel policy, rendering loop or reference-space type.

### Performance

`new FrameRateCounter(interval = 0.5)` samples uncapped positive elapsed seconds
once per application frame. `sample(seconds)` returns a new FPS reading or null;
`value` retains the last completed reading. `reset()` clears timing and value on
session changes or inactivity. A project's simulation delta cap must not affect
FPS measurement. Displays, renderer draw-call statistics and CPU submission timing
remain project-owned; app FPS is not GPU time or compositor frame rate.

`requestFrameRate(session, target)` returns a promise resolving to a support/request
result. Unsupported or rejected requests resolve false. Fire it without awaiting,
after rendering the first tracked frame, so an indefinitely pending runtime request
cannot block startup or the animation loop. Space Race retains its 120 Hz request.

Weather/Cloud FPS files and Space Race's former timing files are compatibility
re-exports, containing no duplicate implementations. Other project migrations can
reuse these modules incrementally; Terrain/Fishing deduplication is outside scope.

## Validation record — 2026-10-29

The full root suite, including 12 shared regressions, and all ten Cloud tests passed
for this extraction. Scene Test Chrome WebGL integration passed; Surface, Space
Race, Weather and Clouds also passed startup/module-loading checks, with live FPS
reporting checked in the latter three.

The user subsequently reported that Quest works correctly after the shared-helper
changes. This records user headset feedback for this change, without claiming a
project-by-project test matrix or a formal sustained frame-rate benchmark. Affected
project handoffs retain the same feedback alongside their module adoption details.
The user authorized committing and pushing this shared-library release on
2026-10-29. See Git history for the release commit; deployment status is verified
separately after pushing.

## Shared UI controls

Surface, Swarm and Weather use a single project-owned `ControlModel` instance for both
native desktop controls and a canvas VR panel. Definitions remain in
`projects/surface/controls.mjs` and `projects/swarm/src/controls.mjs`; Surface's
numeric bounds/steps continue to come from its existing `settings.mjs` table.
Weather binds its existing WeatherParameters through `src/control-model.mjs`.
Clouds retains its current UI implementation. Scene Test uses shared ControlModel bindings, ChoiceBar tabs and sliderValue mapping with its project-owned three-panel native/canvas adapters for scene entities. VR slider dragging,
segmented context selectors and section tabs are supported by `VRSliderPanel`;
native dropdown binding remains project-owned.

| Module | Interface | Consumers |
| --- | --- | --- |
| `ui/controls.mjs` | `ControlModel` | Surface, Swarm, Weather, Scene Test |
| `ui/desktop.mjs` | `DesktopControls` | Surface, Swarm, Weather |
| `ui/desktop.css` | Native layout, focus/disabled styling and numeric interaction styling | Surface, Swarm, Weather |
| `ui/vr-panel.mjs` | `VRControlPanel` | Surface, Swarm |
| `ui/vr-slider-panel.mjs` | `VRSliderPanel` | Weather |
| `ui/slider.mjs` | `sliderValue` pointer mapping | Shared VR slider panel, Scene Test |
| `ui/choice-bar.mjs` | `ChoiceBar` segmented selectors/tabs | Shared VR slider panel, Scene Test |
| `ui/theme.mjs` | `DEFAULT_THEME`, `createTheme(overrides)` | Shared VR panel; optional project palettes |

### Definitions and state

Each definition has a unique `id`, `kind` (`number`, `toggle`, `action`, `readout`)
and `label` (string or getter). Number/toggle controls bind project state through
`get()` and `set(value)`. Numbers also supply finite `min`, `max` and positive
`step`. Readouts supply `get()` and optionally `format(value)`; actions supply
`run()`. A boolean or getter `disabled` prevents edits and actions in both views.
`group` creates a collapsed desktop section; `desktop: false` or `vr: false` omits a
control from one view. `vrOrder` and `vrLabel` can preserve VR presentation without
duplicating setting definitions or step sizes. Actions appear after value rows in
VR. Dynamic labels, disabled state and readouts update on model notifications.

`new ControlModel(definitions, {onChange})` calls `onChange(id, {source, commit})`
for changed values. `set(id, value, options)` clamps/quantizes numeric values,
rejects invalid/blank input and ignores unchanged or disabled values.
`adjust(id, -1 | 1)` applies one numeric step; `activate(id)` runs an action or
flips a toggle. Readouts cannot be edited. `value(id)`, `definition(id)`,
`subscribe(listener)` and `refresh()` support adapters and project-owned state.
Use `refresh()` after external mutations; actions refresh automatically after
running, so reset/defaults can update every bound control together.

**Desktop and VR share the same step, taken from existing VR settings.** Steps
are relative to the current value so a default of 0.65 with step 0.1 becomes 0.75,
without snapping the default to a min-based grid. Bounds still clamp exactly. An optional `stepBase` sets an explicit canonical
grid (Weather uses 0 to preserve WeatherParameters quantization); it applies to
both desktop and VR. Setter bindings may canonicalize values; notifications only
fire when the bound value actually changes.
The model owns stepping/rounding. Native numeric inputs intentionally use
`step="any"` to display such values correctly; renderer keyboard handlers and
pointer quantization enforce the common increment. The shared CSS suppresses
browser number spinners that could otherwise apply different platform stepping.
Project code should not add an independent desktop or VR step policy.

`commit: true` defers desktop value changes until change/blur, while showing a
paired slider/number preview. This is used for Swarm bee count, whose updates
rebuild its instance pool. Other values update during input; VR button presses
commit immediately. Arbitrary programmatic mutations still require `refresh()`.

### Rendering and lifecycle

Include `shared/ui/desktop.css` before project styles. Create
`new DesktopControls(container, model, {idPrefix, filter, numberSuffix, theme, numbers, showValues, groupMode})`.
It generates native sliders/number fields, checkboxes, buttons and readouts, with
accessible labels and keyboard controls. `sync()` refreshes values/labels,
`setVisible(boolean)` controls the container, and `dispose()` unsubscribes/removes
only generated nodes and listeners. Project headings and external controls survive.
The optional desktop `theme` sets `--controls-<key>` CSS variables; the shared
stylesheet currently consumes `accent`. Additional styling remains project CSS. `checkboxSize` sets a native checkbox
target size. Use `numbers: false, showValues: true` for formatted slider-only
controls, and `groupMode: 'headings'` for sections rather than collapsed details.
Weather uses those options to retain its desktop presentation.

Create `new VRControlPanel(scene, rig, renderer, model, options)` with optional
`title`, `subtitle`, `footer` (string/getter), palette/typography/row-spacing `theme`, placement `distance`
and `angle` (defaults: 3 m / PI/4), and `enabled`. Theme overrides include `titleFont`, `subtitleFont`, `labelFont`,
`buttonFont`, `footerFont`, `rowTop` and `rowHeight`; drawing and hit regions use
the same spacing. It uses one canvas texture and
plane, reusable shared controller pointers, numeric minus/plus buttons, toggle and
action rows, and noninteractive readouts. It redraws on model/hover changes, not
every frame. Canvas height expands if the rows need more room.

Projects call `follow(position, rigQuaternion)` or their own positioning logic,
then `update()` each frame. They own session visibility and viewer tracking:
set `enabled = false` when input is inactive, which hides rays and gates trigger
events. Hidden panels and disconnected controllers also reject trigger events.
`toggle()`, `place(distance)` and `mesh` support existing project adapters.
Controller listener/line state is private to the panel rather than stored on shared
controller userData. `dispose()` removes handlers, rays, mesh and GPU resources;
it does not remove project-owned controller objects. Both renderer disposals are
idempotent. Dispose views before clearing model listeners with `model.dispose()`.

Example inside a buildless project module (scene/rig/renderer already exist):

```js
import {ControlModel} from '../../shared/ui/controls.mjs';
import {DesktopControls} from '../../shared/ui/desktop.mjs';
import {VRControlPanel} from '../../shared/ui/vr-panel.mjs';

const settings = {speed: 1.5};
const controls = new ControlModel([{
  id: 'speed', kind: 'number', label: 'Speed (m/s)', min: 0, max: 5, step: 0.25,
  get: () => settings.speed, set: value => { settings.speed = value; },
}]);
const desktop = new DesktopControls(document.querySelector('#controls'), controls);
const vr = new VRControlPanel(scene, rig, renderer, controls, {title: 'TUNING'});
```

Shared model/ray/disposal regressions live in `tests/shared/ui.mjs`, included in
`npm run test:shared` and the full root suite. Run Swarm's separate tests and
browser checks when changing this shared UI. Project-specific reset/defaults,
population rebuilding, panel visibility and placement remain in project adapters.

### Initial Surface/Swarm UI validation — 2026-10-29

The full root suite (21 shared regressions, including nine UI tests), seven Swarm
tests and ten Cloud tests passed. Chrome checks covered every desktop/VR increment
in Surface and Swarm, synchronization, action behavior, deferred commits, blank
and out-of-range edits, controller rays, native toggles/readouts/disabled state,
disposal and desktop/mobile layouts. Custom theme spacing also has a ray-hit
regression. Physical Quest retesting of this shared UI is still required; prior
headset feedback for shared XR helpers does not validate this later change.
Publication is covered by the release review below; Quest retesting remains outstanding.

### Shared VR sliders, selectors and tabs

`new VRSliderPanel(scene, controllers, model, options)` reuses the shared panel's
canvas/mesh, shared controller-pointer implementation, resize/rebinding and
resource disposal. It renders numeric sliders and toggles from the model. It
polls gamepad trigger state for drag gestures; it does not also process selectstart
callbacks, preventing duplicate activation. Controllers must already be attached
to the project's rig. `getSource(controller)` defaults to
`controller.userData.inputSource`; source identity is used, not inputSources order.

Options include `title`, `subtitle`, `width` (0.9 m by default), `theme`,
`defaultSection`, `toggleButton` (5), `triggerButton` (0), `getSource`, and
`onOpen(mesh)` for project-owned world placement. `title` can be a getter.
`group` metadata generates section tabs and paged controls. `selection` optionally
supplies a separate context selector with `{options, getValue, onSelect}`; its
options are `{id, label, disabled?}`. Weather uses this for Snow/Rain, but it has
no weather-specific implementation in the shared module.

`footerAction: {label, run, disabled?}` adds a trigger-once action with a static or
getter status label. `readout` accepts text or a getter for formatted status such
as FPS. These are the existing action/readout concepts composed into the slider
panel's footer; saving and measuring FPS are project responsibilities. The body
currently renders number/toggle controls; the button-oriented `VRControlPanel`
also supports action/readout body rows. `ChoiceBar` can be used independently with
configurable bounds and exposes `draw`, `optionAt` and `activateAt`. It ignores
spacing gaps and disabled options. `sliderValue(definition, x, start, width)` maps
pointer position to a bounded value without adding a second stepping policy.

Call `beginSession()` when XR starts; then `update(session)` only after obtaining
a valid visible viewer pose. The panel opens once through `onOpen`, absorbing
buttons held during entry. `toggle()` calls `onOpen` only when reopening; an open
panel remains fixed unless the project moves it. Call `suspend()` on hidden or
untracked frames to hide rays/cancel drags without closing the panel. On resuming,
held trigger/toggle buttons are seeded before accepting new edges. `update(null)`
ends interaction and hides the panel.

A drag locks to a control id until release, so pointing across rows cannot retarget
an active gesture. Pointer misses pause edits; release, disconnect, invisible
controllers, disabled controls, suspension or model/page changes cancel the drag.
`setModel(model)` replaces bindings while retaining the mesh/world pose and clears
the old subscription. Rebinding or switching tabs consumes held triggers before
editing newly visible controls, including other controllers in the same frame.
Texture/geometry resizing occurs only when the layout changes, never per drag
frame. `dispose()` removes subscriptions and controller rays/resources.

Weather's adapter owns effect selection, save status, world-locked 1.2 m / 45°
placement and FPS formatting. Its simulation/persistence store remains
WeatherParameters, with one UI model shared by desktop and VR in the application.
Mode switches dispose obsolete UI bindings while preserving effect parameter
state and current panel pose. Clouds has not been migrated; Scene Test reuses the shared bindings/tabs/mapping while retaining its contextual multi-panel adapters.

### Slider/Weather validation — 2026-10-29

The complete root suite (including 31 shared regressions and 50 Weather tests),
seven Swarm tests and ten Cloud tests passed. Chrome verified Weather's native
sliders/toggles/formatted values, saved-settings reload, source-mapped controller
rays, slider endpoints, tabs, mode changes, held-trigger suppression, save action,
world pose and suspend cancellation. Surface/Swarm browser regressions also passed.
Desktop/mobile Weather screenshots were visually reviewed. Shared drag and selector
regressions live in `tests/shared/slider.mjs`; Weather binding tests live in
`projects/weather/tests/shared-ui.mjs`. Physical Quest retesting is required.
Publication is covered by the release review below; Quest retesting remains outstanding.

## Shared UI release review — 2026-10-29

The user authorized committing and pushing the shared control model, native desktop
renderer, VR button/slider renderers, segmented selectors/tabs, themes and Surface,
Swarm and Weather migrations. Desktop/VR steps use the existing VR increments.
The full root suite (31 shared regressions and 50 Weather tests), seven Swarm tests,
ten Cloud tests and browser checks for all three migrated projects passed.
Documentation/module links and whitespace checks passed. Physical Quest retesting
of this shared UI remains outstanding. Source, tests and documentation are included
together; see Git history for the release commit and check Pages status separately.
