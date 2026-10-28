# Weather Lab — Snowfall

Buildless Three.js/WebXR experiment for Meta Quest 3. From the repository root, serve with `python3 -m http.server 8080 --bind 127.0.0.1`, then open `/projects/weather/`. Uses the existing local Three.js bundle and MIT license in `projects/forest/vendor/`. No downloads or build required.

Desktop: WASD moves at 2 m/s; drag the scene to look; left/right arrows turn. HTML sliders control snowfall. Quest: left stick moves relative to horizontal head direction; right stick turns at up to 90°/s; B or Y toggles the world-fixed panel; point either controller and hold trigger on a slider to drag. A 15% stick dead zone is rescaled smoothly.

Use the repository Quest launcher for trusted localhost testing or HTTPS for WebXR. The app requests floor-relative tracking and 90 Hz when supported. It does not establish a 90/120 Hz performance guarantee.

Run `node --test projects/weather/tests/*.mjs` or `npm run test:weather`. See [HANDOFF.md](HANDOFF.md) for architecture, exact parameters and pending headset checks.

Snow count supports 0–50,000 with a 5,000 default. The VR panel displays live FPS, averaged over approximately half a second; the desktop readout uses the same measurement.

Snowflake size adjusts from 0.1× to 10×, with 1× retaining the original size distribution. Both panels update the rendering immediately.
