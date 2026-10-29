# Weather Lab — Snow and Rain

Buildless Three.js/WebXR experiment for Meta Quest 3. From the repository root, serve with `python3 -m http.server 8080 --bind 127.0.0.1`, then open `/projects/weather/`. Uses the existing local Three.js bundle and MIT license in `shared/vendor/three-r180/`. No downloads or build required.

Desktop: WASD moves at 2 m/s; drag the scene to look; left/right arrows turn. Select Snow or Rain in the Weather mode menu. Quest: left stick moves relative to horizontal head direction; right stick turns at up to 90°/s; B or Y toggles the world-fixed panel. Point either controller and press trigger on a mode button, or hold trigger on a slider to drag. A 15% stick dead zone is rescaled smoothly.

Only one weather effect runs at a time. Each mode retains its settings for the page session. Switching keeps the environment, player and open panel position. Save Settings stores the selected mode and all mode controls for the next visit; without a saved configuration, startup uses defaults. The panel displays live FPS, averaged over approximately half a second; the desktop readout uses the same measurement.

Snow: 5,000 flakes by default, adjustable 0–50,000; wind −6–6 m/s; turbulence 0–100%; size 0.1×–10× (default 1×). Existing snowfall behavior is preserved.

Rain: 2,000 drops by default, adjustable 0–50,000; wind −6–6 m/s; turbulence 0–100% (default 0); fall speed multiplier 0.25×–3× (default 1×); trail duration 5–50 ms (default 15 ms). Rain occupies a 60 m diameter, 12 m tall cylinder (snow stays at 30 m diameter). Opaque light-gray line segments follow actual velocity, with random 4–9 m/s base fall speeds. A 0.5 m headset exclusion sphere keeps the entire streak away from the eyes. Optional pooled geometric splashes and expanding ripples mark ground impacts. No puddles, reflections, fog or audio.

Use the repository Quest launcher for trusted localhost testing or HTTPS for WebXR. The app requests floor-relative tracking and 90 Hz when supported. It does not establish a 90/120 Hz performance guarantee.

Run `node --test projects/weather/tests/*.mjs` or `npm run test:weather`. See [HANDOFF.md](HANDOFF.md) for architecture, extension steps and pending headset checks. [Rain specification](RAIN_MILESTONE_1.md) preserves the supplied milestone.

Rain Ground Effects: master, splash and ripple toggles are enabled by default; splash probability defaults to 15% and ripple probability to 10%. Both probabilities support 0–100%. In VR, select the Ground Effects tab with a controller trigger; select Weather to return to rainfall sliders. Desktop controls are grouped under the same heading. Splash/ripple pools are fixed at 300/200 and skip excess requests. See [ground-interaction specification](RAIN_MILESTONE_2.md).

Ripple rings remain fully visible for their first 0.225 seconds, then smoothly alpha-fade over the latter half of their 0.45-second lifetime. Splashes and falling rain stay opaque.

Use **Save settings** on desktop or the VR panel footer after adjusting controls. Saved settings stay in this browser on this device for this site address; localhost and GitHub Pages have separate storage. Later changes are not saved until you press the button again. Player position and particle animation state are not saved. A confirmation appears on success; unavailable browser storage is reported without interrupting the simulation.
