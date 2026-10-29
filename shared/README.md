# Shared library guide

This is the reference for first-party shared module interfaces, usage rules and
current consumers. [Repository guidance](../AGENTS.md) covers reuse and validation
policy; project handoffs record project-specific controls and test feedback.

```text
shared/
  xr/             # Locomotion, controller input/pointers and XR frame helpers
  performance/    # Application frame cadence
  vendor/         # Bundled third-party dependencies and licenses
```

## Third-party dependencies

`vendor/three-r180/` is the canonical bundled Three.js r180 runtime for the repository's static projects, tests and Racer/Terrain/Fishing source builds. Core modules and their MIT license live at that root; supporting modules live in `addons/`. No network downloads are required at runtime.

Use relative imports to keep GitHub Pages subpaths and local serving working. A project in `projects/<name>/` imports `../../shared/vendor/three-r180/three.module.js`. Deeper source files need the corresponding additional parent segment. Scene Test maps the bare `three` specifier to the same shared module.

Keep addons and core on the same Three.js revision. When upgrading, retain licenses, check every affected consumer, run the full root test suite and Cloud tests, and rebuild Racer, Terrain and Fishing. Swarm retains its independent npm-managed dependencies. Project-specific assets and application behavior remain in their projects.

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
| `xr/pointer.mjs` | `createPointerLine(options)`; `ControllerPointer` | Surface and Scene Test |
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
