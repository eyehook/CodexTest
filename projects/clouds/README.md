# Clouds — Volumetric laboratory

A standalone Three.js / WebXR cloud experiment for Quest 3. Serve the repository root and open `projects/clouds/`; no build/install step. Uses the existing local Three.js bundle and MIT license in `projects/forest/vendor/`.

Desktop: WASD movement, drag look, arrow-key turning. Quest: left stick walks at 3 m/s, right stick turns at 90°/s; B/Y toggles the world-fixed control panel, trigger rays adjust controls. Cloud, Rendering, Diagnostics and Performance tabs expose live settings and application cadence. Noise octave/resolution changes regenerate deterministically in a worker. Foveation is enabled only when exposed by the active session.

Cloud resolution switches live between 100/75/50/35/25%; 100% is the reference path. Reduced modes preserve full-resolution geometry/UI and use depth-boundary fallback. Quest quality and speedup require testing. FPS/frame time is measured application cadence; CPU submission time is separately labeled and is not GPU timing. Quest stereo/depth/performance acceptance remains pending.

See [handoff](HANDOFF.md) and [milestone requirements](MILESTONE_1.md). Local only; publication requires user request.
