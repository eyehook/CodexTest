# The Hike

A buildless WebXR hike through a unified, seeded mountain landscape for desktop
and Meta Quest 3. See [HANDOFF.md](HANDOFF.md) for architecture and validation.

Serve the repository root and open `/projects/hike/`. The full landscape spans
3.84 km; the default trail connects its lowest valley to its highest central summit.
Dense terrain meshes follow the hiking route; distant terrain samples the same
field at lower resolution. Fog fades from 650 m to 1 km.

The default route is about 1.57 km / 18.7 minutes at 1.4 m/s. The current test
speed remains 14 m/s (10×). Route length varies with terrain. The destination may
be hidden from the trailhead by nearer ridges.

Desktop: Start walking, WASD, mouse look, R reset, P diagnostics. Quest: left stick
walks, right stick turns, B/Y toggles diagnostics. Slopes above 35° cause sliding
while steering/turning remain active. Seed controls remain available after errors.

Run `npm run test:hike` from the repository root. Bridges remain deferred.

The walking surface now uses a 0.5–1 m mesh with explicit tread edges and a narrow
transition into existing terrain. Its displayed slopes are validated below 30°;
grounding samples the same surface. Some sharp summit approaches still require
pronounced cut/fill. No extra terrain draw calls are added.
