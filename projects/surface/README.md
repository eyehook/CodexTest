# Surface

A blank WebXR space with a 64 × 64 grid of separate horizontal quads. Each 9 × 9 cm quad sits in a 10 cm grid cell, leaving 1 cm gaps. Each simulated particle moves its entire quad vertically; quads remain flat without tilting or stretching. The outer footprint is 6.39 × 6.39 m. A single InstancedMesh batches 4,096 solid quads without triangle outlines. Height maps to blue lightness: darker below rest, lighter above rest, with full contrast at ±0.03 m by default. Quads use an unlit MeshBasicMaterial so lighting cannot wash out the height colors. Lower the Height color range setting to emphasize smaller ripples.

Every three seconds of active simulation, a random point anywhere on the entire 64 × 64 grid, including the edges receives a downward velocity impulse of 8 m/s. Four-neighbor springs spread the wave, a restoring force represents equilibrium around water level, and velocity damping settles motion. A damped edge band reduces reflections. This is a height-field wave experiment, without splashes or fluid flow.

## Preview

Serve the repository root using the existing Quest launcher or `python3 -m http.server 8080 --bind 127.0.0.1`, then visit `/projects/surface/`. No install or build required. All Three.js modules load locally from `shared/vendor/three-r180/`.

Desktop: drag to orbit, scroll to zoom, Reset to clear waves and restart the timer. Quest: Enter VR; left thumbstick walks in the direction you look at up to 1.5 m/s; right thumbstick turns smoothly at up to 60°/s around the tracked headset. Both sticks use a 15% deadzone. Movement stays horizontal at the resting water level, without collision or edge clamping. The initial viewpoint is 1.4 m from the center at the default cell size. Entering VR restarts the experiment. The initial surface is flat; the first drop occurs three seconds later. Simulation pauses while hidden or XR tracking is unavailable. HTTPS or localhost is required for VR.

## Validation

Run `npm run test:surface` or the full `npm test` from the repository root. Automated tests verify timing, single-point impulses, ripple propagation, energy damping, sustained stability, reset, and independence from display refresh rate. Physical Quest appearance and performance remain to be checked.

## Peripheral rendering

XR fixed foveation is disabled (`renderer.xr.setFoveation(0)`) to avoid peripheral resolution boundaries against the dense triangle grid. The user confirmed on Quest that this fixes the lighter rectangular bands at the sides of the VR view. Full-resolution peripheral rendering can increase GPU cost.

## Live tuning

Desktop sliders and number inputs adjust damping, spring strength, restoring strength, rain strength, rain interval, height color range, cell size, and square fill fraction. All changes apply immediately. Pause freezes waves and the rain timer while you can still move around; Reset surface clears waves and restarts the timer while retaining settings. Restore defaults resets settings, unpauses, and clears the surface.

In VR, the tuning panel starts visible three meters away, 45° right of rig forward. A or X toggles it; point either controller and trigger-click minus/plus buttons or the action rows. It follows player translation and thumbstick rotation, independently of head-look yaw. Desktop and VR share the same settings. Controls require a visible, tracked XR frame.

`settings.mjs` defines `DEFAULTS` and the shared control bounds. Settings last for the current page session; reload restores defaults. Cell size defaults to 0.1 m; square fill defaults to 0.9. Changing cell size updates positions and quad sizes without resetting waves or moving the VR player; desktop framing adjusts. The grid remains 64 × 64. Spring constants describe coupling per cell, so wave speed in meters per second changes with spacing. Additional damping in the outer 12 cells remains active even with base damping set to zero.

Spring strength is bounded to 0–150 with a 120 Hz fixed timestep. Tests cover the maximum spring/restoring strengths and rain rate; headset appearance and panel usability still require Quest testing.

Current defaults: damping 0.1, spring strength 10, restoring strength 0.1, raindrop strength 8, rain interval 3 s, height color range ±0.03 m, cell size 0.1 m, square fill 0.9, running on load.
