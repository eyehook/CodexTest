# The Secret Garden

An empty 30 × 45 foot walled garden for growing deterministic low-poly flowers, bushes, trees, grass patches and wall-clinging ivy. Plant a random seed, copy a plant to clone it, or remove it. Plants grow for ten seconds and then remain static, sharing mature rendering batches to reduce draw calls. Flowers include petal-based forms and hydrangea-style single faceted spheres. Trees include rounded broadleaf, open broadleaf, layered pine, rounded-tier cypress and umbrella forms, using either individual leaves or low-poly canopy volumes.

Serve the repository root and open `projects/secretGarden/`. For Meta Quest 3 USB preview, use the root `Start-VR.command`. All dependencies are local; no build step is required.

Quest controls: left stick moves and right stick turns. Only the active controller shows a ray (right by default). Its trigger plants, A on right / X on left copies a plant seed or returns to random mode elsewhere, and B on right / Y on left returns to random mode; hold it over a plant for one second to delete. A red circle shows progress; release before deleting another plant. Pressing the inactive controller’s trigger transfers control without planting; release and press again to plant. Clone mode persists until B/Y is pressed or random mode is otherwise selected. Grip on the active hand toggles its pointer off/on. While off, the ray and target indicators disappear and no controller raycasting runs. Either trigger reactivates its controller without planting; the next press plants. Inactive face buttons do nothing. Two overlapping rectangles inside the target circle indicate clone mode.

Grass patches have irregular rounded outlines, with taller centers and shorter edge blades. A simple ellipsoid selects each patch, and grass shadows are disabled for performance.

Point at dirt for ground plants or an interior wall face for ivy (some seeds flower). Copied seeds stay remembered while aiming across surface changes. Planting on an incompatible surface uses a random seed and clears the copy; aiming back before planting restores cloning. Vine seeds reproduce their growth rules; wall height and floor shape the result, and vines continue around corners onto adjacent walls.

Desktop: click or Space plants, B copies/resets, X deletes, WASD walks, arrows turn, drag looks.

See [HANDOFF.md](HANDOFF.md) for architecture, validation, performance bounds and pending Quest checks. Run `node --test projects/secretGarden/tests/*.mjs` from the repository root.

The opening centered on the wall behind the starting player leads to a 6 foot hallway with an automatic door at its midpoint (3 feet), followed by a 12 × 12 foot room with a ceiling. Approach from either side to open it; move away to close it. The room and recess are non-plantable and kept clear of ivy for a future settings panel.

The room’s wall opposite the doorway has a Garden Settings panel. Aim and pull the active trigger (desktop: click) on the Shadows checkbox to globally toggle shadows. Shadows default on; reenabling refreshes the cached map. The shared `VRCheckbox` uses the existing control model and the project’s single pointer; no extra raycasts or controller listeners.

Reset Garden on the room panel clears all plants and returns planting to random mode, keeping your position and Shadows setting.

Low-poly bees appear according to the room’s Bees slider: Off (none), Low (one per 150 blooms), Medium (one per 100 blooms, default), or High (one per 50 blooms). Only individual blooms on fully grown plants count (including flowering shrubs, trees and ivy). Landing positions and surface normals are stored only after ten-second plant growth finishes, including clone scale and rotation. Bees follow curved, gently darting flights between random blooms and rest for 2–5 seconds, aligned to each flower surface. They may pass through objects and never cast or receive shadows. Bodies and diamond wings use two shared instanced draw calls; deletion adjusts the population and Reset Garden clears all bees and landing points.

The Bees slider snaps to four positions. Click or drag with the mouse, or aim and hold the active trigger while moving along the slider. Off hides all bees and skips registry/animation updates; selecting a density refreshes the mature-flower pool and population. Reset Garden preserves the selected density.
