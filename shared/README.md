# Shared dependencies

`vendor/three-r180/` is the canonical bundled Three.js r180 runtime for the repository's static projects, tests and Racer/Terrain/Fishing source builds. Core modules and their MIT license live at that root; supporting modules live in `addons/`. No network downloads are required at runtime.

Use relative imports to keep GitHub Pages subpaths and local serving working. A project in `projects/<name>/` imports `../../shared/vendor/three-r180/three.module.js`. Deeper source files need the corresponding additional parent segment. Scene Test maps the bare `three` specifier to the same shared module.

Keep addons and core on the same Three.js revision. When upgrading, retain licenses, check every affected consumer, run the full root test suite and Cloud tests, and rebuild Racer, Terrain and Fishing. Swarm retains its independent npm-managed dependencies. Project-specific assets and application behavior remain in their projects.
