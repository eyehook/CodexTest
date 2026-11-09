# The Secret Garden

An empty 30 × 45 foot walled garden for growing deterministic low-poly flowers, bushes, trees, grass patches and wall-clinging ivy. Plant a random seed, copy a plant to clone it, or remove it. Plants grow for ten seconds and then remain static, sharing mature rendering batches to reduce draw calls. Flowers use six petal-based forms: daisy, buttercup, lily, bell, rosette and star. Trees include rounded broadleaf, layered pine, rounded-tier cypress and umbrella forms, using low-poly canopy volumes.

Serve the repository root and open `projects/secretGarden/`. For Meta Quest 3 USB preview, use the root `Start-VR.command`. All dependencies are local; no build step is required.

Quest controls: left stick moves and right stick turns. Only the active controller shows a ray (right by default). Its trigger plants, A on right / X on left copies a plant seed or returns to random mode elsewhere, and B on right / Y on left returns to random mode; hold it over a plant for one second to delete. A red circle shows progress; release before deleting another plant. Pressing the inactive controller’s trigger transfers control without planting; release and press again to plant. Clone mode persists until B/Y is pressed or random mode is otherwise selected. Grip on the active hand toggles its pointer off/on. While off, the ray and target indicators disappear and no controller raycasting runs. Either trigger reactivates its controller without planting; the next press plants. Inactive face buttons do nothing. Two overlapping rectangles inside the target circle indicate clone mode.

Grass patches have irregular rounded outlines, with taller centers and shorter edge blades. A simple ellipsoid selects each patch, and grass shadows are disabled for performance.

Point at dirt for ground plants or an interior wall face for ivy (some seeds flower). Copied seeds stay remembered while aiming across surface changes. Planting on an incompatible surface uses a random seed and clears the copy; aiming back before planting restores cloning. Vine seeds reproduce their growth rules; wall height and floor shape the result, and vines continue around corners onto adjacent walls.

Desktop: click or Space plants, B copies/resets, X deletes, WASD walks, arrows turn, drag looks.

See [HANDOFF.md](HANDOFF.md) for architecture, validation, performance bounds and pending Quest checks. Run `node --test projects/secretGarden/tests/*.mjs` from the repository root.

The opening centered on the wall behind the starting player leads to a 2 foot hallway with an automatic door at its midpoint (1 foot), followed by a 12 × 12 foot room with a ceiling. Approach from either side to open it; move away to close it. The room and recess are non-plantable and kept clear of ivy for a future settings panel.

The room’s wall opposite the doorway has a Settings panel. Aim and pull the active trigger (desktop: click) on the Shadows checkbox to globally toggle shadows. Shadows default on; reenabling refreshes the cached map. The shared `VRCheckbox` uses the existing control model and the project’s single pointer; no extra raycasts or controller listeners.

Reset Garden on the room panel clears all plants and returns planting to random mode, keeping your position and Shadows setting.

The Bees selector sets the total population from 0 to 10 in whole-bee steps (default 3), independent of flower count. Click/drag or aim and hold the active trigger. Zero removes all bees and skips animation updates. Bees prefer mature flowers; if no other mature flower is available, they choose a random interior wall spot, avoiding the doorway. Growing plants create no flower landing points. Bees fly curved, gently darting paths and rest for 2–5 seconds, aligned to each surface. They may intersect objects and never cast or receive shadows. Bodies and diamond wings use two shared instanced draw calls. Removing/resetting plants preserves the selected population, with wall targets as needed.

The left-hand wall when facing Garden Settings has a Save / Load panel with three slots. Unused slots say Empty and cannot be loaded. Save replaces that slot with the current garden; Load replaces the garden with that slot. Slots show their save time. The most recently saved slot loads automatically when the page starts, even if a different slot was loaded manually last. Only plants (including cloned scale/yaw and wall vines) and growth progress are saved in garden slots; player position is preserved on manual load and starts normally on a fresh page. Reset Garden does not delete saves.

Saves are local to this browser profile, device and site address (local preview and GitHub Pages have separate storage). They remain across page reloads and browser restarts unless browser storage is cleared; they do not sync between devices. Storage errors appear on the panel and leave previous slot data intact.

Facing Settings, the right-hand wall has VR Settings: Height offset (0–1 m in 0.05 m steps, default 0), Movement speed (0.25–3 m/s in 0.25 m/s steps, default 1), and Turn speed (15–120°/s in 15°/s steps, default 45). Click/drag or aim and hold the active trigger. Height offset lifts the tracked head and controllers together in VR for seated play; it does not change desktop eye height. Movement and turn speeds apply through the shared locomotion controls.

Settings (Shadows and total bee count) and VR Settings save automatically together in a separate browser settings record. Changes are saved after a short pause while dragging and flushed on page exit. They restore independently of garden slots; saving/loading/resetting a garden never changes them. Only the current save versions are supported. Garden slots with a different version are deleted and shown as Empty; mismatched settings saves are deleted and defaults are used. Settings storage failures show feedback on the Save / Load panel.

Above the turn slider, Snap turn switches between smooth turning and snap turning (on by default). When enabled, the slider is labeled Snap with 15°, 30° (default), and 45° stops. A right-thumbstick horizontal deflection turns once by the chosen angle about the headset; holding or reversing the stick cannot repeat a snap until the thumbstick returns to neutral. Entering VR, reconnecting/resuming tracking, or changing turn settings also requires neutral first. Smooth turn speed is remembered while Snap is enabled. These choices autosave with the other independent settings. Desktop arrow turning retains smooth speed.

VR teleport: push up on either thumbstick to aim with that controller. The initiating hand owns the gesture until release; the other hand cannot take it over. A 50%-transparent cylinder shows the destination (green for valid floor, red for invalid). Release the upward stick deflection to teleport; invalid/missing targets leave you in place. Turning remains available while aiming. With Teleport enabled, either thumbstick turns horizontally using the selected smooth/snap mode; center that stick horizontally before another snap. The original pointer hand/visibility returns afterward. Teleport preserves facing and seated height offset; floor destinations respect garden/room/passage boundaries. Plants do not obstruct aiming, while walls and panels do. Pointing at the door (including its handles) instead selects the hallway midpoint: the cylinder appears at that destination, and releasing teleports you there and opens the door fully. Tracking loss or suspension cancels rather than teleports.

The Teleport checkbox above Movement speed selects the VR movement mode (on by default). On enables either-stick teleport aiming and disables left-stick smooth movement; Movement speed is grayed out and cannot be adjusted. Off disables teleport gestures and restores smooth movement at the previously chosen speed. Smooth/snap turning remains available in both modes. Desktop walking is unchanged. The mode autosaves with the independent VR settings.

With Teleport enabled, both hands behave identically: up initiates teleport with that hand and horizontal input turns. Each stick has its own snap latch, rearmed by horizontal neutral even while held up. Simultaneous same-direction turns do not double speed/angle; opposite equal inputs cancel. With Teleport off, left-stick smooth movement and right-stick turning retain their normal roles.

Flowering rounded and umbrella trees place blossoms on exposed ellipsoid canopy surfaces, facing outward, rather than hiding them at branch tips inside foliage. Overlapping crowns are considered so blossoms remain outside neighboring canopies. Open-leaf trees retain branch-tip flowers.

Shrubs have a single upright trunk and one continuous foliage mesh, seeded as either a sphere or a rounded teardrop with a broad base and softly tapered top. Flowering shrubs place 8–14 outward-facing blossoms on that surface with supporting flower stalks. The 30% flowering chance, deterministic seeds, ten-second growth and clone behavior remain. Mature heights are 2–3 ft for spheres and 2.5–3.5 ft for teardrops, before the existing ±20% clone scaling. Shrub trunks and flower stalks are brown. Garden save version 40 clears obsolete saves under the development policy.

VR spawn menu: rotate your left palm upward to reveal the floating spawn menu; rotate it away to hide it. The right-hand ray and trigger select Flowers, Shrubs, Ferns, Rosettes, or Ivy. Grass > opens Grass and Seeded grass. Trees > opens Rounded, Pine, Cypress and Umbrella. Mushrooms > opens Bolete, Fly agaric and Chanterelle. Each submenu has < Back as its bottom item; Random is the final root entry. Mushroom placements produce one specimen or a 2–5 specimen cluster with seeded colors. Generic nested children arrays support future submenus at multiple levels. Each selected type produces a fresh matching seed on every placement. A plus inside the target circle indicates spawn mode; overlapping rectangles indicate cloning. B/Y clears either mode. Ivy requires walls; other types require ground. Planting a ground selection on a wall switches to Random and creates a random vine. Random plants vines on walls and random ground plants on ground. Planting in Ivy mode on ground switches to Random and creates a random ground plant. The menu shows the current mode and opens to its selected item, including nested choices. Copying a plant enters clone mode. Menu interaction takes priority over locomotion, teleport and world actions. On reopening, the menu reveals the current selection.

Flower colors exclude greenish hues (70–170°: yellow-green through green/teal) across flowers, shrubs, trees and ivy. Reds, oranges/yellows, cyan/blues, purples and pinks remain, with the existing saturation/brightness variation. Foliage colors are unchanged.

VR Settings has no save-status footer; preferences still save automatically. Room-panel hover highlights use stronger contrast without canvas texture uploads.

On standalone flower plants, all bloom shapes open along their supporting stem direction. Bee landing normals use that same direction. Shrub/tree canopy blossoms continue to face outward from the foliage surface.

Standalone flower leaf sizes range from half the maximum to the maximum. The current maximum is .149625 m before plant scaling, following two successive 25% reductions from the original cap. Other plant types are unchanged.

Standalone flower leaves attach at the diamond’s base and point 0–60° away from their own supporting stem, with seeded variation around the stem. Their bases remain attached during growth.

The attached base is the sharpest (smallest-angle) corner of each standalone flower leaf’s diamond outline; broader corners face outward.

The sky contains 10 low-poly clouds moving west (−X) to east (+X) along shallow rising/laterally curved paths. Their phases and north/central/south track positions vary, retaining varied sizes and heights. At the far east, the entire cloud lowers below the wall top before recycling to a hidden western starting point, avoiding visible jumps. They share one instanced draw call and cast no shadows.

Cloud spacing is deliberately irregular, with clustered and open patches. Sizes vary from 0.4× to 1.7× the shared base scale, and heights from 28–64 m. Layouts include distinctly small/large and low/high clouds while retaining sky coverage.

Clouds complete one west-to-east traversal/recycle every 30 minutes.

Rain: the settings-room Rain slider offers Never, Rarely, Sometimes, Often and Always (default Sometimes). The garden starts clear, then showers gradually build to a random intensity and fade away. The sky and clouds turn gray with rainfall and recover afterward. Never immediately clears rain, splashes, rings, sky and cloud tint; Always immediately holds maximum rain and maximum overcast. Middle frequencies use random shower intensities with matching sky, cloud and lighting darkness. Rain extends four feet beyond the garden walls, with ground splashes and expanding rings on the dirt. Rain and ground effects cast no shadows. Frequency is saved with settings, independently of garden slots.

Rain also softens and cools the existing directional and hemisphere lights, restoring clear lighting as it ends. Never and Always apply their lighting changes immediately.

Rosettes form low clusters of 10–16 broad, arched hosta-like leaves. A seeded 40% produce 1–3 separate flower spikes carrying all existing bloom types, favoring bell and lily; flowers never attach to the broad leaves. Rosettes participate in random ground planting and have a top-level spawn option, with standard ten-second growth, cloning, saving and bee landing behavior.
