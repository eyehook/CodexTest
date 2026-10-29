# Scene Test

An interactive Three.js / WebXR lighting laboratory for Meta Quest 3.

Open `projects/sceneTest/` from the repository preview server, then choose Enter VR. Runtime modules and the procedural reflection environment work without external requests. HTTPS or trusted localhost is required for WebXR; the repository’s Quest USB launcher supports localhost testing.

Use the left stick to walk, right stick to turn, right trigger to select/edit, either grip to create or move lights, B to deselect, and Y to open or close the panels. On desktop, use the native control panel, WASD and arrow keys; click/drag helpers to select/move, Shift-drag to rotate.

Save Scene explicitly saves to this browser’s localStorage. Reset changes the live scene while keeping the saved configuration; reload restores the last explicit save.

Run `npm run test:sceneTest` for model tests. See [HANDOFF.md](HANDOFF.md) for architecture, browser tests, settings, performance considerations and outstanding Quest hardware validation.
