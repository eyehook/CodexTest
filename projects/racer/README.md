# Racer — Milestone 1

A minimal, seated WebXR driving prototype for Meta Quest 3 and desktop browsers. The long-term direction is a low-poly arcade racer; this milestone is only a straight-road technical prototype. All vehicle and scenery geometry is original, built from primitives. There are no copyrighted game assets, music, logos, or imported vehicle models.

## Run and build

Prerequisites for editing: Node.js 22.12+ and npm, plus pnpm if using the commands below (`npm install -g pnpm`). You can instead use the npm equivalents listed below. The included build needs only Python to preview.

Run from the **CodexTest repository root**:

```sh
pnpm install
pnpm dev:racer
```

Open http://127.0.0.1:5173/ for Vite development with hot reload. The isolated development server contains Racer only, so the “All projects” link is hidden there. Use the built version below to test project navigation.

```sh
pnpm build:racer
pnpm test:racer
pnpm test
```

`npm install`, `npm run dev:racer`, `npm run build:racer`, `npm run test:racer`, and `npm test` are equivalent if npm is your preferred package manager. The checked-in lockfile uses pnpm. The only npm development dependency is Vite; runtime Three.js r180 comes from the repository's existing licensed `projects/forest/vendor/` modules and is bundled by Vite. No runtime CDN requests are required.

`src/racer/` is editable source. `projects/racer/index.html` and `projects/racer/build/` are generated deployment files. Rebuild after source changes; do not edit generated files manually. The output directory is not emptied because it also contains this README, the milestone specification, and Vite config. `base: './'` in `vite.config.mjs` makes asset paths relative so the same build works at both local and GitHub Pages subpaths. See [Vite base documentation](https://vite.dev/config/shared-options.html#base).

To preview the built site with project navigation:

```sh
python3 -m http.server 8080 --bind 127.0.0.1
```

Open http://localhost:8080/projects/racer/. No Node/Vite installation is needed merely to run the included build. `pnpm preview:racer` is another way to preview just the build on port 4173.

## Quest Browser testing

1. Rebuild if source has changed: `pnpm build:racer`.
2. Connect and unlock Quest 3 over USB. Accept USB debugging if prompted.
3. Double-click `Documents/Start-Quest-VR.command`. It serves the whole checkout on port 8080 and uses ADB reverse forwarding.
4. In Meta Quest Browser, open **http://localhost:8080/projects/racer/** or choose Racer from the project index.
5. Sit comfortably and face the intended driving direction before choosing **Enter VR**.

The cockpit and road anchors are aligned once to the initial headset position and horizontal orientation. No automatic camera movement, banking, shake, or recentering is applied while driving. Looking or leaning remains natural tracked movement. Cockpit geometry is placed relative to the initial eye pose; the simulated road is 1.15 m below it. To choose a new initial seated position, end VR with the headset's normal system controls and re-enter.

The USB-forwarded `localhost` origin permits WebXR development. A plain LAN HTTP address does not provide the secure context needed by WebXR. For wireless testing, use the HTTPS Pages site after publishing. Keep the USB cable and launcher window active for the local approach.

If port 8080 is occupied, stop the old server first or reuse the matching checkout server. The current launcher prints the Forest URL; choose Racer through its project index or type the Racer URL above.

## Controls and simulation

- Automatic acceleration from rest to cruise over five seconds, then constant speed.
- Quest: **left controller thumbstick**, horizontal axis, to move across the road.
- Desktop: **A/D** or **left/right arrows**.
- Returning the stick/key to neutral stops lateral motion and preserves the current position.
- No throttle, brake, score, HUD, sound, traffic, collisions, curves, hills, or branching in this milestone.

Steering changes a separate simulated lateral position. The complete environment shifts in the opposite direction while the cockpit and camera reference remain stationary. Lateral position clamps at the configured limits. Missing/disconnected controllers produce neutral input. Simulation pauses when the browser is hidden or XR is not visible/tracked. Entering/exiting VR resets driving state so acceleration can be experienced from rest.

## Architecture

| Module in `src/racer/` | Responsibility |
| --- | --- |
| `main.js` | Renderer, animation loop, delta time, desktop/XR integration and resize handling |
| `xr.mjs` | Immersive session lifecycle and initial seated alignment of scene anchors |
| `cockpit.mjs` | Primitive dashboard, steering wheel, side panels and hood; cosmetic wheel rotation |
| `world.mjs` | Nine instanced road/scenery batches; fixed-size segment ring and common lateral offset |
| `input.mjs` | Left thumbstick mapping, deadzone and desktop keyboard fallback |
| `simulation.mjs` | Independent forward distance, speed and lateral position; segment recycling math |
| `config.mjs` | All primary tuning values |

Road segments and props are allocated once. Every frame updates instance matrices; there is no per-frame geometry creation. The 640 m ring extends beyond the 260 m fog cutoff both ahead and behind, hiding recycling even when the driver looks backward. The whole renderer uses Three.js's WebXR animation loop, simple Lambert materials and inexpensive lights, without shadows or postprocessing. No headset frame rate is guaranteed.

## Tuning

Edit `src/racer/config.mjs` and rebuild:

| Parameter | Default | Meaning |
| --- | --- | --- |
| `cruiseSpeed` | 28 m/s | Final speed, approximately 101 km/h |
| `accelerationTime` | 5 s | Time from rest to cruise |
| `steeringSpeed` | 3.8 m/s | Lateral speed at full input |
| `deadZone` | 0.15 | Ignored thumbstick deflection |
| `lateralLimit` | ±3.5 m | Maximum simulated car offset |
| `roadWidth` / `shoulderWidth` | 9 m / 1.1 m | Road cross-section |
| `segmentLength` / `segmentCount` | 20 m / 32 | Recycled strip dimensions; preserve lane-dash spacing if changing length |
| `behindDistance` | 300 m | Ring extent behind the driver; keep both ends outside fog |
| `fogNear` / `fogFar` | 90 m / 260 m | Scenery fade distance |
| `farPlane` | 420 m | Camera far clipping |
| `pixelRatioCap` | 1.5 | Desktop drawing-buffer resolution cap |
| `seatedEyeHeight` | 1.15 m | Eye-to-road distance for initial seated alignment |

## GitHub Pages deployment

The existing repository uses **main → /(root)** as the publishing source, with HTTPS. Preserve that setup; no additional workflow is needed.

1. Run `pnpm build:racer` and `pnpm test`.
2. Commit the source, configuration, root index card, package/lockfile updates, and **generated Racer files** together.
3. Push to `main` when publication is approved. Pages deploys automatically.
4. Open https://eyehook.github.io/CodexTest/projects/racer/ in Quest Browser after deployment.

Building does not publish automatically; commit and push separately when approved. Existing Forest remains independently served.

## Milestone acceptance report

Validation performed during implementation: dependency installation; production build; Vite development-page load; built-page load under a `/CodexTest/` URL prefix; desktop browser inspection at narrow and desktop sizes; left/right keyboard steering; project-index navigation; browser console checks; Node simulation/scene tests; existing Forest regression suite. No errors were observed in the browser console. Testing used the desktop in-app browser, not a Quest headset.

| # | Criterion | Verification |
| --- | --- | --- |
| 1 | Installs and runs locally | **Verified**: pnpm installation, Vite development server, production build and static preview |
| 2 | Desktop cockpit, straight road, moving scenery | **Verified** visually in browser |
| 3 | Enter VR works on secure Quest Browser | **Implemented; Quest verification pending**. Desktop unsupported-device message checked |
| 4 | Natural tracking and stable cockpit | **Partly verified**: initial anchor/unchanged-camera scene tests; physical tracking and comfort pending on Quest |
| 5 | Scrolling and five-second acceleration | **Verified**: browser motion plus exact distance/speed tests at 30/72/90/120 simulation steps per second |
| 6 | Left stick steers opposite environment, cockpit fixed | **Partly verified**: input mapping and scene tests; actual left stick pending on Quest |
| 7 | Neutral input retains lateral position and respects limits | **Verified** in simulation tests and desktop steering checks |
| 8 | Desktop keyboard fallback | **Verified** in browser with left/right steering |
| 9 | Continuous bounded recycling | **Verified**: browser observation and 3,000 simulation/world updates; unchanged object identities/count, finite matrices, contiguous segments at wrap boundaries and long distances. Not a heap-profiler or headset endurance benchmark |
| 10 | Setup, tuning and Pages documentation | **Complete**; relative-path build served under simulated repository prefix. Live Pages publication not performed |

### Remaining checks and limitations

- Quest 3: verify session entry/exit, initial seated scale and facing direction, lean/look tracking, left thumbstick, controller disconnect/reconnect, system-menu pause/resume, and comfort/performance.
- No formal GPU timing, refresh-rate measurement or long-running heap profile was performed.
- The road is deliberately straight and flat. Steering has no collision or crash state. The simple fixed cockpit is original prototype geometry.
- Generated output uses stable filenames; reload after rebuilding. If a deployed browser shows an old build, refresh or clear its cached page data.
- Sources reuse the existing Forest vendor library, so preserve that directory/license or update the imports before reorganizing it.
