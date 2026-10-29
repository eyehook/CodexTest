# Swarm 3D

A minimalist WebXR flocking simulation: a white 20 cm wasp leads 250 orange 10 cm bees through a gray environment. No external models or textures, shadows, postprocessing, or physics engine. The ground uses a subtle, locally generated gray checkerboard with 3 × 3 foot (0.9144 × 0.9144 m) squares and mipmaps to soften the distant pattern.

## Run locally

Swarm is buildless. `index.html` directly loads the editable JavaScript and CSS
from `src/`. No Node.js, npm installation or build step is needed to run it.
From the repository root:

```sh
python3 -m http.server 8080 --bind 127.0.0.1
```

Open `http://localhost:8080/projects/swarm/`. Source edits appear after reloading.
For Quest over USB, double-click [Start-VR.command](../../Start-VR.command) at the
repository root, then open that same URL in Meta Quest Browser. Keep the launcher
window and USB connection active.

Three.js r180 and VRButton come from `shared/vendor/three-r180/`. Desktop
tuning uses native HTML sliders, number inputs, collapsible groups and a button. All runtime requests are local and relative,
including under the GitHub Pages `/CodexTest/` prefix. Serve the whole repository
so these shared dependencies and the project-directory backlink are available.
Publish source files directly; there is no generated `build/` directory.
Published address after a separately authorized commit/push:
https://eyehook.github.io/CodexTest/projects/swarm/.

## Desktop and Quest

Drag the scene to look around; wheel adjusts viewing distance while preserving eye height. The tuning panel controls population, speed, steering limits, neighborhoods, behavior weights, and flight volume. Population changes respawn the bees when editing finishes; other simulation controls apply immediately. Sliders and number inputs stay paired, clamp values to their supported ranges, and reflect changes made through the VR panel. Bounds affect newly generated waypoints, so existing spline segments transition naturally rather than snapping.

In Meta Quest Browser select the standard **Enter VR** button. The viewer starts halfway horizontally between the previous overview position and the wasp’s initial position, remaining at ground level. Both desktop and VR use the captured initial wasp position, even if VR is entered later. Desktop initially looks toward the wasp’s starting position; “Frame full flight volume” restores the wider overview after looking or zooming. Initial headset position and yaw are compensated once on entry while preserving tracked height and subsequent head movement.

An in-world tuning panel sits 3 m away, 45° right of the initial viewing direction, at the player’s tracked eye height. It follows the player’s position and thumbstick turning, staying 45° to the right of the player’s forward direction. It does not follow head-look yaw, so looking toward it keeps it reachable. Point either controller at a − or + button and press the trigger to change that property. All desktop simulation parameters are available, including bee count and flight bounds. Controller rays highlight buttons. The desktop panel and instructions hide in VR and return on exit. Left thumbstick moves horizontally in the direction you look (1.5 m/s); right thumbstick turns smoothly (60°/s) about the headset. Stick input has a 15% deadzone and diagonal movement is normalized. A (right) or X (left) toggles the panel once per press; holding a button does not repeatedly toggle it. Both pressed together toggle once. The panel starts visible on each VR entry. Tracking loss or hidden XR sessions suspend locomotion. Speeds and deadzone are centralized in `config.locomotion`.

WebXR requires HTTPS, except trusted localhost. A plain LAN HTTP address is insufficient. Use GitHub Pages HTTPS, a trusted local HTTPS setup, or the repository's existing USB/ADB localhost forwarding workflow. VR availability also depends on browser/device support and user permission.

## Simulation

`config.js` centralizes defaults. `Wasp.js` slides a four-waypoint uniform Catmull–Rom spline, traversing the middle segment by arc length. Adjacent segments share tangent and position; speed has a small continuous variation. Interior waypoint margins keep the spline clear of the ground. The wasp never reads bee state.

`Swarm.js` calculates cohesion, alignment, inverse-distance separation, current-position attraction with arrival, and soft altitude/volume forces, then limits acceleration and velocity. Every bee reads the same prior frame before integration. `neighbors.js` isolates the allocation-free O(n²) neighbor search. Small speed/force variations encourage spreading and changing formations without assigned paths.

Rendering uses one shared cube geometry and one instanced bee mesh. `main.js` caps elapsed time at 50 ms and integrates with substeps no larger than 1/90 second. Reusable vectors and transforms avoid allocations in the bee update. New spline control data is allocated only when a segment completes. `scene.js` owns inexpensive lighting, flat ground, and the viewer rig; `viewer.js` calculates full-volume framing. `tuning.js` generates the native HTML desktop tuning controls, and `VRPanel.js` renders a single-texture world panel with controller ray interaction.

## Validation and limitations

Node.js is needed only for automated tests. From the repository root, run:

```sh
node --test projects/swarm/tests/*.mjs
```

Or run `npm test` inside `projects/swarm`; no package installation is needed.
The tests run a seeded two-minute simulation checking spline continuity, altitude, finite state, speed limits, pursuit distance, and live speed/population configuration. Additional tests cover full-box framing, controller panel ray hits, panel following/toggling, movement across frame rates, diagonal speed, head-directed walking, headset-pivot turning, deadzone handling, and A/X press edges. Validate browser startup, desktop tuning and local module loading after import changes. These checks do not establish visual quality, immersive session behavior, comfort, or the target 72 FPS. Physical Quest 3 testing is required; 1000-bee tuning is offered for experimentation and is not a headset performance promise.

Dependency: Three.js r180 (MIT), with its license checked in alongside the modules under `shared/vendor/`. No Vite, lil-gui or npm runtime dependencies remain.
