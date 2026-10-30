# The Secret Garden

An empty 30 × 45 foot walled garden for growing deterministic low-poly flowers, bushes, trees, grass patches and wall-clinging ivy. Plant a random seed, copy a plant to clone it, or remove it. Plants grow for ten seconds and then remain static, sharing mature rendering batches to reduce draw calls. Flowers include petal-based forms and hydrangea-style single faceted spheres. Trees include rounded broadleaf, open broadleaf, layered pine, rounded-tier cypress and umbrella forms, using either individual leaves or low-poly canopy volumes.

Serve the repository root and open `projects/secretGarden/`. For Meta Quest 3 USB preview, use the root `Start-VR.command`. All dependencies are local; no build step is required.

Quest controls: left stick moves and right stick turns. Only the active controller shows a ray (right by default). Its trigger plants, A on right / X on left copies a plant seed or returns to random mode elsewhere, and B on right / Y on left returns to random mode; hold it over a plant for one second to delete. A red circle shows progress; release before deleting another plant. Pressing the inactive controller’s trigger transfers control without planting; release and press again to plant. Clone mode persists until B/Y is pressed or random mode is otherwise selected. Grip on the active hand toggles its pointer off/on. While off, the ray and target indicators disappear and no controller raycasting runs. Either trigger reactivates its controller without planting; the next press plants. Inactive face buttons do nothing. Two overlapping rectangles inside the target circle indicate clone mode.

Grass patches have irregular rounded outlines, with taller centers and shorter edge blades. A simple ellipsoid selects each patch, and grass shadows are disabled for performance.

Point at dirt for ground plants or an interior wall face for ivy (some seeds flower). Copied seeds stay remembered while aiming across surface changes. Planting on an incompatible surface uses a random seed and clears the copy; aiming back before planting restores cloning. Vine seeds reproduce their growth rules; wall height and floor shape the result, and vines continue around corners onto adjacent walls.

Desktop: click or Space plants, B copies/resets, X deletes, WASD walks, arrows turn, drag looks.

See [HANDOFF.md](HANDOFF.md) for architecture, validation, performance bounds and pending Quest checks. Run `node --test projects/secretGarden/tests/*.mjs` from the repository root.
