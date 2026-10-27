# Swarm handoff

Read [repository guidance](../../AGENTS.md), then this document and the project README if present. Inspect Git status and relevant source before editing. These project notes were moved from root AGENTS.md; they are preserved context, not a fresh implementation audit. Current code and Git state are authoritative, especially for historical validation and publication claims. Paths below are repository-relative unless their context says otherwise.

## Swarm 3D

Ground: subtle gray checkerboard, generated once as a repeating canvas texture, with 3-foot (0.9144 m) squares, mipmaps and up to 4× anisotropic filtering.

Source and independent Vite package: `projects/swarm/src/`. Run `npm install`, `npm run dev`, `npm test`, and `npm run build` from `projects/swarm`. Build writes `projects/swarm/index.html` and `build/`; retain these for branch-based Pages. Uses Three.js r180 and lil-gui from npm, bundled locally. Wasp uses sliding Catmull–Rom segments with arc-length traversal; Swarm computes all steering before integration and uses bounded time substeps. Standard Three.js VRButton. `locomotion.js` implements head-directed left-stick walking at 1.5 m/s and right-stick smooth turning at 60°/s about the tracked headset, with 15% deadzone. A/X edge presses toggle the VR panel; simultaneous presses toggle once. Motion pauses without a visible, tracked XR frame. Desktop and VR start halfway horizontally from their former overview positions toward the captured wasp spawn, retaining ground-level viewing; the desktop GUI overview reset still frames the full flight box. XR rig compensates initial headset position/yaw once and uses the halfway spawn. `VRPanel.js` places a player-following tuning panel 3 m away, 45 degrees right of rig forward (independent of head-look yaw); either controller points and trigger-clicks minus/plus controls. Desktop mouse drag and wheel; desktop GUI hides during XR. Headset performance and appearance require physical Quest testing.

## Maintaining this handoff

Keep project behavior, architecture, commands, validation and pending work current here. Follow the shared local-test-then-publish workflow in root AGENTS.md and preserve unrelated work.
