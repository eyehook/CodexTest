# Terrain — Milestone 1

A single GPU-displaced radial mesh represents a deterministic landscape, with a flat blue water surface forming lakes. No textures, streaming, shadows, vegetation, or postprocessing. Runtime dependencies are local, licensed Three.js r180 from `projects/forest/vendor/`; Vite is the only development dependency.

## Run and build

From the repository root:

```sh
pnpm install
pnpm dev:terrain
pnpm test:terrain
pnpm build:terrain
```

npm equivalents are `npm install`, `npm run dev:terrain`, `npm run test:terrain`, and `npm run build:terrain`. Development runs at http://localhost:5174/. The isolated Vite server serves Terrain; use the root static server to test the project directory link.

The build writes `projects/terrain/index.html` and `projects/terrain/build/`. Keep these generated files alongside `src/terrain/` when publishing. Relative asset paths work under GitHub Pages' `/CodexTest/` prefix. No installation is needed to run the checked-in static build:

```sh
python3 -m http.server 8080 --bind 127.0.0.1
```

Open http://localhost:8080/projects/terrain/. The existing USB Quest launcher also serves this URL.

## Desktop and Quest

Desktop: click the landscape for pointer-lock mouse look, WASD to walk, Escape to release. Eye height is 1.7 m. Diagonal movement is normalized. Debug inputs do not trigger walking.

Quest 3: serve on HTTPS (GitHub Pages) or use the existing USB/ADB localhost forwarding setup; open in Meta Quest Browser and choose **Enter VR**. `local-floor` tracking preserves physical headset height. The left thumbstick moves relative to horizontal headset facing with a radial 15% deadzone. The right thumbstick turns smoothly about the tracked headset at up to 60°/s with a 15% horizontal deadzone. Physical turning also works. Movement pauses during hidden/untracked XR frames. Room-scale horizontal tracking also samples the corresponding world ground. Exit VR restores desktop controls.

Publishing follows this repository's existing workflow: test locally/on Quest, then commit and push to `main` when requested. Pages serves the root of `main`. Published path will be `https://eyehook.github.io/CodexTest/projects/terrain/` after deployment.

## Controls and parameters

Expand **Terrain controls**. Apply explicitly to change parameters. Radius/rings/angular segments rebuild geometry only when their values change; movement never rebuilds or uploads geometry. Wireframe toggles immediately. Reset returns the logical offset to the origin (which may be underwater). The initial viewpoint starts on nearby dry terrain when available. Settings last for this page session.


Controls expose radius, rings, angular segments, amplitude, frequency, octave count (1–8), persistence, lacunarity, seed, walking speed, turning speed, fog distances, and fog/sky colors. Fog end is clamped inside the terrain radius, with start below end. Matching fog/sky colors best conceal the horizon. Initial defaults are in `src/terrain/height.mjs`: 2,000 m radius, 128 rings, up to 256 angular segments, seed 12345, 65 m amplitude, frequency 0.002, five octaves, persistence 0.48, lacunarity 2, 6 m/s walking speed and 60°/s smooth turning.

Water is a static, opaque blue disk at 10% of the configured terrain amplitude: 6.5 m by default. This uses the nominal amplitude, not the highest sampled hill or the sum of noise octave amplitudes. Its world level changes only when amplitude changes. The disk is translated by the same ground-height adjustment as the terrain; no water vertices or topology are updated during movement. Fog matches the terrain. There are no waves, reflections, swimming, buoyancy or collision changes; walking still follows the ground, including beneath lakes.

Terrain colors follow absolute world elevation, so they remain fixed as you walk. Relative to terrain amplitude, sand extends from the waterline (10%) to 14%; green bands begin at 14%, 25%, and 35%; cool white snow starts at 43%, and bright white summits at 53%. Narrow 1.5% transitions soften jagged boundaries while retaining visible bands. Thresholds scale with amplitude and do not sample changing local peaks. Coloring adds no geometry or draw calls.

## Implementation

- `mesh.mjs`: one indexed mesh with a dense eight-sector central fan and exponentially expanding rings. Ring populations grow in multiples of eight up to the angular cap, avoiding needle-like central triangles. Unequal ring populations are joined with a seam-closing zipper. Topology stays static during movement.
- `height.mjs`: matching JS/GLSL seeded eight-direction gradient noise with quintic interpolation, layered into rolling hills. JS logical coordinates use doubles. Every octave splits the offset into a fractional cell position and unsigned 32-bit lattice coordinates **before** upload. Integer hashing wraps at 2^32 lattice cells; no small permutation-table repetition. This is effectively infinite, not mathematically aperiodic. ±1 billion meter positions are covered by tests; arbitrary double limits are not promised.
- `material.js`: static X/Z vertices, GPU height displacement, direct subtraction of CPU ground height, four extra height samples for smooth finite-difference normals, inexpensive ambient/sun lighting, distinct elevation bands (sand near the water, three greens for hills, cool white snow and bright white summits), and atmospheric haze. Octaves fade smoothly as frequency × local vertex spacing grows. This changes rendered distant geometry, never the underlying world definition. Near-center detail remains unfiltered. Culling is disabled because CPU bounds do not describe displaced terrain.
- `water.mjs`: fixed world water level, matching local elevation adjustment, and deterministic search for a nearby dry initial viewpoint. One additional static 128-triangle disk and one additional draw call per eye.
- `player.mjs`: shared head-relative movement and Quest controller axes; `main.js`: initialization, XR/desktop lifecycle, debug controls, and frame loop.
- `check.js`: actual GPU vertex shader evaluation rendered to an RGBA8 target and read back. Packed height quantization is approximately 0.00012 m; comparison tolerance is 0.003 m. Startup and the check button compare JS and GPU at positive/negative and ±1 billion meter coordinates. Checks run outside immersive rendering.

Default geometry uses fewer than the nominal 65,536 triangles because inner rings adapt their sector count. Exact counts appear in diagnostics. One terrain draw call per eye, static position/index buffers, no per-frame topology changes. GPU cost includes five noise evaluations per vertex for displacement/normals; profile this on-device before increasing complexity. Far geometry can still morph under movement; filtering reduces this but does not eliminate radial resampling artifacts. Direct ground following can be uncomfortable on slopes and needs headset evaluation.

## Validation and remaining acceptance work

`pnpm test:terrain` covers winding, nondegenerate faces, manifold interior edges/closed seams across four configurations, deterministic/continuous signed-coordinate heights, large-coordinate fractions, head-relative movement, frame independence, deadzone, controller selection, and frame-independent turning about an offset tracked head. Browser startup performs CPU/GPU comparisons. `pnpm test` also runs the existing project tests.

Desktop browser rendering and height readback have been checked. **Physical Quest 3 input, stereo appearance, terrain-following comfort, distant stability, and the aspirational 72 FPS target remain unverified.** Do not treat desktop FPS as a headset benchmark.

On Quest, walk uphill/downhill, return to previous coordinates, move physically around the center, look straight up/down while moving, hide/resume the session, and re-enter VR. Inspect seams/wireframe from desktop. For performance, use Meta Quest Browser remote DevTools over USB and inspect `#stats` while in VR: the hidden DOM diagnostics update every half-second with XR FPS, frame interval, mesh counts, position, elevation and speed. The panel is hidden in the headset and does not render as an XR overlay. These metrics measure animation callback intervals, not GPU time or compositor missed frames; record headset/browser versions, settings, sustained FPS and frame timing alongside device profiling tools before claiming acceptance. No on-device measurements have been recorded.
