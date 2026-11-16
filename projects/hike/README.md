# The Hike

A buildless Three.js/WebXR mountain hike for desktop and Meta Quest 3. Each seed
creates a 3.84 × 3.84 km landscape, a trail from a low bench to the summit,
woodland, grass, rocks and a circling raptor. Trail length varies around a
1.6 km target. Walk, teleport or glide through the landscape.

## Preview

Serve the repository root and open `/projects/hike/`. Startup chooses a random
seed; use `/projects/hike/?seed=41729` for a repeatable world. For USB Quest
preview, run the root `Start-VR.command` and keep its terminal and cable connected.
See [repository guidance](../../AGENTS.md) for setup and publishing rules.

## Controls

| Context | Controls |
| --- | --- |
| Desktop | Start walking; WASD/up/down to move, mouse look, left/right arrows to turn; Space to glide; R to reset; P for diagnostics; Esc to release mouse |
| Quest ground | Either stick forward aims teleport; release to travel. Either stick sideways snaps the view. A/X launches glide |
| Quest flight | Right stick steers; headset pitch controls climb/dive |
| Quest settings | B/Y opens settings or saves and closes; controller laser and trigger select |

VR settings offer smooth walking and turning instead of teleport/snap movement,
plus height offset and movement speed. Smooth VR walking defaults to 2 m/s;
desktop uses 14 m/s for testing. Slopes above 35° cause sliding.

## Landscape and lighting

One snapped terrain mesh supplies near detail and progressively coarser distant
terrain. Gameplay grounding uses a separate authoritative walking surface. The summit is
cut down to a flat area at least 3 m across, with a rounded rim rather than a
raised landing platform.
Terrain shadows are precomputed at world generation for a fixed sun currently
at **30° elevation**, and also shade grass, trees and rocks. The saved Shadows
setting controls optional nearby tree-cast shadows; terrain shadows stay active.
Atmospheric perspective and a gradient sky blend into visibility fog at 650–950 m.
Sound controls the local stereo forest ambience.

Run `npm run test:hike` from the repository root. See [HANDOFF.md](HANDOFF.md) for
architecture, budgets, validation and known limits, [PROFILING.md](PROFILING.md)
for performance captures, and [AUDIO.md](AUDIO.md) for ambience details.
