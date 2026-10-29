# Scene Test

A buildless Three.js / WebXR objects, materials and lighting laboratory for Meta Quest 3.

Serve the repository root and open `projects/sceneTest/`, then choose Enter VR. Runtime dependencies and the procedural reflection environment are bundled locally. WebXR needs HTTPS or trusted localhost; the repository's `Start-VR.command` supports Quest USB testing.

Use the left stick to walk, right stick to turn, right trigger to select/edit, either grip to create/move, B to deselect, and Y to toggle panels. Point at an existing entity and hold right-controller A to duplicate and move/rotate the selected copy; release A to place it. Lights and Objects palette tabs expose four types each. New palette entities select immediately; existing unselected grabs clear selection, as specified in Milestone 2. Object Settings edits RGB, metalness, roughness, uniform/axis scale and shadow preferences. Desktop supports native controls, WASD/arrows and click/drag with Shift-drag rotation.

New scenes start with the checkerboard floor and no sample objects or wall. Save Scene explicitly saves lighting and objects to localStorage. Milestone 1 saves remain compatible. Reset changes the live scene while preserving the last explicit save; reload restores it.

Run `npm run test:sceneTest`. See [HANDOFF.md](HANDOFF.md) for architecture, integration checks and remaining Quest validation; [MILESTONE_2.md](MILESTONE_2.md) preserves the requested scope.
