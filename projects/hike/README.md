# The Hike

A buildless procedural mountain hike for desktop and Meta Quest 3.
See [HANDOFF.md](HANDOFF.md) for architecture, controls, tuning and validation.

Serve the repository root and open `/projects/hike/`. Default route: approximately
1.60 km / 19 minutes at normal 1.4 m/s walking speed. The current testing
default is 14 m/s (10×), roughly 1.9 minutes for the route. Desktop: Start walking, WASD, mouse look, R reset,
P diagnostics. Quest: left stick walk, right stick turn, B/Y diagnostic panel.

Run focused regressions from the repository root with `npm run test:hike`.

Slopes above 35° cause automatic downhill sliding while walking and turning remain
active. Adjust the threshold with **Slide above (degrees)** in diagnostics.

Each seed generates one mountain with a different footprint, summit, ridges and
eroded gullies. The trail follows the generated terrain. Bridges are deferred.
