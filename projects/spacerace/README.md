# Space Race — Milestone 1

A minimal straight-line speed experiment for desktop and Meta Quest 3. The world is black, with white particle quads and pale blue rings. No install or build is required. All runtime code is local, including the existing Three.js r180 bundle in `../forest/vendor/` (MIT; its LICENSE is retained).

## Run locally

From the CodexTest repository root:

```sh
python3 -m http.server 8080 --bind 127.0.0.1
```

Open `http://localhost:8080/projects/spacerace/`, or choose Space Race from the project directory. The existing `Start-Quest-VR.command` launcher also serves this path through USB/ADB reverse forwarding. Keep its terminal and USB connection active.

Desktop controls: hold Up to accelerate, Down to brake; drag the background to look around. Releasing both keys coasts. The overlay displays feet/second, miles/hour, particle density, and FPS.

Quest: face the intended flight direction, choose Enter VR, then use the right trigger to accelerate and left trigger to brake. Analog pressure scales the rates. Both triggers combine their acceleration/deceleration contributions; full pressure on both produces net braking of 40 ft/s². Trigger release retains speed. No controller rays or meshes are needed. Natural headset translation and rotation remain active; looking away does not redirect flight.

`CONFIG.targetFrameRate` is 120 (set `null` to use the browser default). After rendering its first visible tracked frame, each VR session requests 120 Hz without awaiting the result. Rendering continues even if that optional request never settles. The request is made only when listed in `session.supportedFrameRates`. Unsupported or rejected requests retain the browser default and still enter VR. `CONFIG.targetFrameRate` controls the request; actual FPS depends on rendering performance and device/browser policy.

Each VR session starts at rest. The flight path is anchored once at the initial eye position and horizontal heading. Physical leaning can move the eyes away from its exact center, as expected with positional tracking. No subsequent artificial camera movement occurs. Simulation pauses while the page is hidden or XR is not visible/tracked. Long frame gaps are capped at 50 ms with no catch-up burst.

## HTTPS deployment

Serve the repository root on an HTTPS static host. Relative imports work with the GitHub Pages `/CodexTest/` prefix. This repository already publishes root files from `main`; once publication is authorized, committing/pushing the project and directory changes makes `/CodexTest/projects/spacerace/` available. No CDN, build artifacts, or server runtime are needed. WebXR requires HTTPS or a browser-trusted localhost context; a plain HTTP LAN address does not provide WebXR.

The maximum speed is now 300 mph (440 ft/s or 134.112 m/s), reached in about 7.33 seconds at full acceleration. Density and streak length scale to this new maximum.

## Configuration and implementation

`config.mjs` holds all movement, particle and ring parameters. Feet are multiplied by `FT = 0.3048`; simulation values are metres, seconds and metres/second. Defaults: 0–300 mph (440 ft/s), acceleration 60 ft/s², braking 100 ft/s²; 3,000 pooled particles, 10–200-foot radial range, 500-foot forward reach and a 20-foot rear boundary; eight 20-foot-radius rings every 200 feet, initially reaching 1,600 feet ahead. `ringCount` controls this range independently of the particle distance; camera far clipping includes the full ring sequence. Particle minimum width is 0.3 feet and maximum streak length is 10 feet. Ring outline thickness is 0.25 feet to keep the small distant outlines readable without bloom.

- `simulation.mjs`: exact capped acceleration distance, analog input, uniform-area annular particle distribution, fixed arrays and ring spacing. Every object uses the same integrated distance. Recycled particles retain depth overshoot and randomize their cross-sectional position; this preserves even longitudinal density without a synchronized spawn plane.
- `particles.js`: one instanced quad batch with a custom shader. Camera-facing width is calculated independently for each eye; length extends along the fixed flight axis in 3D. Small billboard height retains point appearance at rest and prevents degenerate quads when looking along the axis. Density fades across a 48-particle rank band and eases toward the configured density curve over approximately 0.18 seconds. Far/rear alpha fades mask recycling. The HUD count is the rounded effective density setting, not an occlusion/frustum census: edge fades, offscreen particles and fractional opacity affect how many lights are perceptible. All 3,000 lightweight instances remain in the fixed GPU pool.
- `main.js`: one instanced unlit annulus batch plus particles, standard WebXR session/input sources, and a canvas HUD about 1.7 metres ahead and 0.38 metres below the eyes. HUD position/orientation follow with exponential smoothing; texture updates are limited to 10 Hz. Desktop uses HTML stats. There are two scene draw calls on desktop and three per eye in XR, before any browser/driver implementation costs. No lights, shadows, postprocessing, textures from external sources, or per-frame geometry creation.

FPS measures animation-loop cadence over half-second windows using uncapped elapsed time, so slow frames are included. Sampling resets on hidden/untracked periods and session transitions. In VR it counts app frames once per stereo frame, not each eye or compositor reprojection. It is a useful live cadence indicator, not a GPU timing measurement.

## Ring audio

Each ring produces a generated filtered-noise whoosh while nearby and moving. Two opposite rim emitters provide stereo spatialization without a source passing directly through the listener's head. Pitch follows radial velocity using a 343 m/s sound-speed model: higher on approach, neutral at closest passage, lower behind. The effect becomes stronger at greater speed; low-speed volume eases down to silence at rest. This is an intentional cinematic sound in a space scene.

Web Audio starts from Enter VR, a desktop arrow-key press, or a background click/drag. Sound: On/Off can be selected before entering VR. `whooshReach` (65 ft), `whooshFrequency` (350 Hz), `whooshLowpass` (1,200 Hz), and `whooshVolume` (0.325) are adjustable in `config.mjs`. A broad 350 Hz band gives a much lower-pitched whoosh, with a gentle 1,200 Hz low-pass to soften the highs. Doppler still shifts the band on approach and recession. Master gain is half the original value. One generated two-second noise buffer and two looping voices per pooled ring are created once (16 voices for eight rings). HRTF panners follow the real headset position/orientation in the fixed flight frame; explicit playback/filter shifts provide Doppler, which Web Audio panners do not calculate automatically. The volume envelope fades to zero before the rear recycling boundary. Hidden/untracked frames, session transitions and muting silence the output. Audio startup is never awaited by XR setup, and unavailable audio leaves the visual prototype functional.

Automated coverage checks approach/recession pitch, speed scaling, zero-speed silence, crossing continuity, recycling fades, fixed voice allocation and inactive/mute/disposal behavior. Quest sound quality, loudness, spatial feel and the performance impact on the previously observed 120 FPS still need headset checking.

## Validation

```sh
npm run test:spacerace
npm test
git diff --check
```

Eleven automated tests cover unit conversion, density interpolation, acceleration/braking at 30/72/90/120 Hz, coasting, stationary fields, recycling, annular bounds/distribution, ring spacing, shared travel, analog triggers, FPS sampling, nonblocking refresh negotiation and audio behavior.

The full root suite passed during implementation. Earlier desktop browser checks at the original 300 ft/s cap verified initial rest, visible particles/rings, acceleration to 300 ft/s / 204.5 mph / 3,000 density, coasting after release, braking to zero, mouse orientation, and no browser warnings/errors. These are desktop checks only.

Physical Quest 3 acceptance remains pending. Test Enter VR and re-entry, natural stereo/head tracking, stationary field stability, trigger pressure/coasting/braking, ring centering at initial pose, HUD readability during head motion, recycling while looking around, and sustained frame rate at maximum density. The user reported 120 FPS with the refresh request enabled, as noted below. Formal sustained performance and comfort validation remain pending. Publication of this release was authorized by the user.

Original requirements: `MILESTONE_1.md`.

User headset comparison: the default session ran at 90 FPS; enabling the 120 Hz request produced 120 FPS. The request is retained. This confirms the reported cadence for that test, not a formal sustained performance benchmark.
