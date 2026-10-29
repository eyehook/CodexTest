# CodexTest repository guidance

## Start here

This repository contains independent static browser/WebXR experiments for Meta Quest 3. The root `index.html` is the project directory; projects are served from `projects/<name>/`.

Read this file, inspect `git status`, then read the target project's handoff and relevant modules before editing. Read root `README.md` when working on repository setup or the project directory. Focus on the selected project; read other projects only when a shared dependency or cross-project change requires it. Current code and Git state take precedence over documentation snapshots.

## Project handoffs

| Project | Start here | Source/build overview |
| --- | --- | --- |
| Scene Test | [Handoff](projects/sceneTest/HANDOFF.md) | Buildless `projects/sceneTest/`; interactive WebXR lighting lab |
| Clouds | [Handoff](projects/clouds/HANDOFF.md) | Buildless `projects/clouds/`; per-eye depth-aware ray marching |
| Weather / Snow and Rain | [Handoff](projects/weather/HANDOFF.md) | Buildless `projects/weather/`; shared Three.js vendor bundle |
| Forest / Endless Grove | [Handoff](projects/forest/HANDOFF.md) | Buildless `projects/forest/`; uses shared Three.js |
| Racer | [Handoff](projects/racer/HANDOFF.md) | `src/racer/`; Vite output in `projects/racer/` |
| Swarm 3D | [Handoff](projects/swarm/HANDOFF.md) | Independent package in `projects/swarm/` |
| Surface | [Handoff](projects/surface/HANDOFF.md) | Buildless `projects/surface/` |
| Terrain | [Handoff](projects/terrain/HANDOFF.md) | `src/terrain/`; Vite output in `projects/terrain/` |
| Fishing | [Handoff](projects/fishing/HANDOFF.md) | `src/fishing/`; Vite output in `projects/fishing/` |
| Chess | [Handoff](projects/chess/HANDOFF.md) | Buildless `projects/chess/src/`; editable assets in `assets/chess/` |
| Space Race | [Handoff](projects/spacerace/HANDOFF.md) | Buildless `projects/spacerace/` |

Keep detailed behavior, architecture, controls, asset workflows and project validation in each handoff and its linked documents. Update the relevant handoff as changes are made; review and update the Space Race handoff before every push, as explicitly requested by the user. Keep this root file limited to shared guidance and project routing.

## Shared functionality

Before implementing locomotion, controller input/pointers, XR frame/session handling or performance reporting, check [shared modules](shared/README.md) and reuse or extend the existing helpers. First-party modules live in `shared/xr/` and `shared/performance/`; third-party dependencies live in `shared/vendor/`. Keep module interfaces, usage rules and current consumers in that shared README; keep project-specific controls, tuning, interaction policies and validation in project handoffs. Update the consumer list and affected handoffs when migrating a project. Terrain and Fishing are separate branches of the same project; similarities between them alone are not a reason to extract shared code.

Shared regression tests live in `tests/shared/` (`npm run test:shared`) and are included in the full root suite. For shared runtime edits, run that suite plus affected consumer checks, including Cloud tests when Clouds is affected. Documentation-only edits follow the link/content checks below.

## Repository and publishing

- Checkout: `/Users/mm/Documents/GitHub/CodexTest`; public remote: https://github.com/eyehook/CodexTest.
- Development/publishing branch: `main`; live directory: https://eyehook.github.io/CodexTest/.
- GitHub Pages publishes `main`, `/(root)`, with HTTPS. Pushing to main triggers publication.
- Implement locally, validate, let the user test on Quest, then commit/push when requested. A prior release authorization does not authorize later publication. Report whether work is local, committed or pushed.
- Before committing, review the diff and preserve unrelated user work. Existing Chess `.blend1` and `.blend2.blend` backups are unrelated and must remain excluded unless the user specifically requests them.
- Keep generated static outputs with their corresponding source for projects using a build, because Pages serves the repository root.
- Shared Three.js r180 lives in `shared/vendor/three-r180/`, with supporting modules in `addons/`; keep core/addon versions and MIT notices together. Swarm retains its independent npm dependencies.
- Bundle runtime assets locally and use relative URLs for the `/CodexTest/` prefix. Preserve `.nojekyll`, vendor licenses and project-specific notices.
- New projects belong in `projects/<name>/` with an `index.html`, a root index card and a handoff linked above.

## Release checklist

1. Review Git status and the scoped diff; exclude unrelated work and backups.
2. Update the project's handoff with final behavior, settings, validation and pending work. Include changed source/assets and required static build outputs together.
3. Run the affected project's tests/build checks. Expand to the full suite for shared code/tooling or cross-project changes. For documentation-only work, check content/links instead. Run `git diff --check`.
4. Publish only with current user authorization. Stage named files, commit and push; verify the push and report the commit. Check deployment status before claiming the site is deployed.

## Local preview and Quest testing

From the repository root, use `python3 -m http.server 8080 --bind 127.0.0.1` for desktop preview. Open `/` for the directory or `/projects/<name>/` for one project.

For Quest, double-click `/Users/mm/Documents/Start-Quest-VR.command` with a USB-connected, authorized headset. It serves this checkout on loopback port 8080 and uses Meta Quest Developer Hub's ADB to reverse-forward that port. Keep its terminal and USB connection active; rerun after reconnecting. An old server may need stopping first. The launcher is outside the repository and is not published/versioned here.

Original experiments in `/Users/mm/Documents/Codex/Quest` are backups; edit this GitHub checkout. WebXR needs HTTPS or a trusted localhost context. When stale browser caches affect testing, advance the entry/import/asset query versions for the changed project.

## Validation and performance

Use root `package.json` as the authoritative script list. For changes isolated to one project, run that project's relevant tests and build checks, including before publishing; a push alone does not require the full repository suite. Run the complete root `npm test` / `pnpm test` suite when shared runtime code, dependencies, root test/build tooling, or changes spanning projects could affect multiple projects. Check affected consumers of shared code even when the file lives inside one project's directory (for example, the shared Three.js vendor bundle). Documentation-only changes need link/content checks and `git diff --check`, not runtime tests. Always run `git diff --check` for edits. Swarm has its own package and tests; see its handoff.

If Node/npm is absent from PATH in the desktop environment, locate the bundled runtime with the workspace dependency tool and use its Node executable to run the package scripts/tests. Do not hardcode an app cache path into repository scripts.

Automated and desktop checks do not establish headset appearance, stereo correctness, controller mapping, comfort or sustained frame rate. State which checks actually ran and distinguish user headset feedback from formal benchmarks. Keep standalone Quest costs low: prefer shared geometry/instancing, bounded updates and simple contact volumes; avoid unnecessary allocations, draw calls and dynamic lights.

## Future CI

There is currently no repository CI workflow. If CI is introduced, use changed paths to select project tests/builds; documentation-only changes should run documentation checks. Shared runtime/dependency/tooling changes must run all affected projects (the full root suite when impacts are broad), including every shared-runtime consumer. Swarm's independent tests/build must be included when its own or applicable shared inputs change. Keep this policy consistent with local validation; do not make every project-only push run the full suite.
