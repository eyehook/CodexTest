# WebXR Volumetric Cloud Simulator
## Milestone 1 — Volumetric Rendering Laboratory

### 1. Project Overview

Create a new, standalone WebXR application targeting Meta Quest 3, using Three.js and WebXR.

This project is an experimental volumetric cloud renderer intended to explore the visual quality and performance limitations of ray-marched clouds on standalone VR hardware.

It is separate from the existing weather simulator.

The initial implementation should prioritize:

- Correct stereoscopic rendering.
- Correct depth relationships with opaque geometry.
- Adjustable rendering quality.
- Accurate performance measurements.
- Simple procedural cloud density.
- Interactive experimentation within VR.

Photorealism is not a goal for this milestone.

The primary objective is to determine how efficiently volumetric clouds can be rendered on Quest 3 and identify which quality settings have the greatest performance impact.

### 2. Test Environment

Create a minimal 3D environment consisting of:

**Ground**
- Flat gray checkerboard extending beyond the test area.
- Ground elevation at Y = 0.

**Sky**
- Uniform gray background contrasting with the cloud.
- No atmospheric scattering or sky simulation.

**Cloud**
- One isolated, approximately cumulus-shaped volumetric cloud.
- Initial dimensions: 20 × 10 × 20 meters.
- Initial center: (0, 7, -20).
- Cloud base approximately 2 meters above ground.
- Cloud must be a genuine 3D density volume, not a billboard or collection of opaque meshes.

**Reference Columns**

Create six opaque vertical columns with distinct colors:

- Red
- Green
- Blue
- Yellow
- Cyan
- Magenta

Each column should be approximately 1 meter wide and 15 meters tall.

Arrange them around the cloud so that:

- Some are entirely outside the volume.
- Some intersect the volume.
- At least one is directly behind the cloud from the initial viewpoint.
- At least one is in front of the cloud.

These columns serve as visual references for evaluating transparency, depth compositing, stereo consistency, and rendering artifacts.

### 3. Player Movement

Implement standard WebXR controller locomotion.

- Left thumbstick: Smooth horizontal movement.
- Right thumbstick: Smooth turning.
- Movement speed: Approximately 3 m/s.
- Turning speed: Approximately 90 degrees/second.
- No teleportation required.

The player should be able to walk around, underneath, and through the cloud.

Use headset tracking for the camera position and orientation.

No collision restrictions are necessary for the cloud or columns.

### 4. Volumetric Cloud Rendering

Implement the cloud using GPU-based ray marching in a fragment shader.

Use a bounded 3D volume.

For each viewing ray:

1. Calculate intersection with the cloud's bounding volume.
2. Determine the entry and exit distances.
3. March through the volume using configurable sampling.
4. Evaluate procedural cloud density at each sample.
5. Accumulate optical depth and transmittance.
6. Stop when the ray exits the volume or reaches the early-termination threshold.
7. Composite the resulting cloud contribution with the scene.

Use a physically motivated exponential attenuation model:

`transmittance *= exp(-density * stepLength * extinctionCoefficient)`

Accumulate cloud color using the corresponding loss of transmittance.

Use simple white or light-gray cloud coloring.

Do not implement realistic atmospheric scattering or complex lighting.

### 5. Ray-Marching Quality

Expose a configurable maximum ray-march step count.

Default: 16 steps.

Range: 4–128 steps.

The step count should determine sampling resolution along the ray's actual segment inside the volume.

Use approximately uniform spacing for the initial implementation.

Avoid creating large gaps or sampling outside the volume.

Use early termination when accumulated transmittance becomes sufficiently low.

Default termination threshold: 0.02.

Configurable range: 0.001–0.1.

Both settings must be adjustable live in VR.

### 6. Cloud Density Generation

Use a precomputed 3D noise texture to define cloud structure.

Prefer `THREE.Data3DTexture` or an equivalent supported implementation.

Initial texture resolution: 64 × 64 × 64.

Support configurable resolutions:

- 32³
- 64³
- 128³

Generate the texture during initialization or when explicitly changing its resolution.

Do not regenerate it every frame.

Use deterministic procedural noise with a fixed seed.

Generate an isolated, irregular cumulus-like density distribution by combining:

- A broad ellipsoidal or similarly rounded density envelope.
- Low-frequency procedural noise.
- Multiple noise octaves.
- A configurable density threshold.

The density field should contain irregular edges, internal variations, and regions of empty space.

Expose:

| Parameter | Default | Range |
|---|---|---|
| Cloud density | 1.0 | 0.1–5.0 |
| Density threshold | 0.4 | 0–1 |
| Noise octaves | 2 | 1–6 |
| Noise texture resolution | 64³ | 32³, 64³, 128³ |
| Cloud scale | 1.0 | 0.25–4.0 |

Density and threshold adjustments should update immediately.

Noise octave or texture-resolution changes may require regenerating the texture. Keep regeneration outside the render loop.

Preserve deterministic results when changing settings.

### 7. Cloud Appearance

Use a deliberately simple visual model.

- White to light-gray cloud coloring.
- No shadows.
- No secondary lighting rays.
- No atmospheric scattering.
- No temporal accumulation.
- No screen-space dithering.
- No animated noise initially.

Cloud appearance should be determined primarily by density and accumulated transmittance.

Thin regions should allow the background and columns to remain visible.

Dense regions should progressively obscure objects behind them.

Avoid treating the entire cloud volume as a uniformly translucent solid.

### 8. Depth Handling

Correct depth relationships are a major requirement.

The cloud must interact properly with opaque scene geometry.

Expected behavior:

- Columns in front of the cloud remain unobscured.
- Columns behind the cloud become obscured according to intervening cloud density.
- Columns intersecting the cloud show correct partial occlusion.
- The ground remains visible through sufficiently thin cloud regions.
- The cloud does not incorrectly render over closer opaque geometry.

Implement depth-aware ray marching or another appropriate compositing technique.

For the initial version, prefer full-resolution rendering to establish correct depth behavior.

A suitable approach is:

1. Render opaque geometry to a color/depth target.
2. Render the cloud using the appropriate per-eye camera.
3. Use scene depth to limit the cloud ray's traversal.
4. Composite the cloud contribution with the opaque scene.

If a different rendering architecture is more appropriate for Three.js WebXR, use it.

Do not assume that conventional alpha blending of a transparent bounding-box mesh will correctly handle intersecting geometry.

### 9. Stereoscopic Rendering

The cloud must render correctly for both eyes.

Requirements:

- Each eye uses its own camera position and projection.
- Ray directions are calculated independently for each eye.
- Cloud position and scale remain consistent in world space.
- No monoscopic cloud texture shared between eyes.
- No screen-space effects that introduce obvious stereo disagreement.

Pay particular attention to cloud boundaries and intersections with reference columns.

Prioritize correct stereo rendering over rendering optimizations.

### 10. Rendering Resolution

Support adjustable cloud-rendering resolution.

Target settings:

| Scale | Approximate Pixel Workload |
|---|---|
| 100% | 100% |
| 75% | 56% |
| 50% | 25% |
| 35% | 12% |
| 25% | 6% |

Default: 100% for the initial correctness baseline.

The resolution control should affect the cloud pass rather than the entire VR scene.

Opaque geometry and UI should remain at normal resolution.

If implementing a separate low-resolution cloud pass, preserve correct stereo rendering and account for full-resolution scene depth when compositing.

Avoid visible halos around columns and other depth boundaries.

**Implementation priority:** Establish a working full-resolution cloud renderer first.

If reduced-resolution rendering introduces significant architectural complexity, implement it as a clearly separated second stage of this milestone.

Do not compromise stereo or depth correctness to support resolution scaling.

### 11. Foveated Rendering

Expose the supported Three.js WebXR foveation setting.

Range: 0–1.

Default: 0.

Allow adjustment from the VR control panel if supported by the active WebXR session.

Foveation affects overall XR rendering and should remain independent of cloud-specific resolution scaling.

If unsupported, disable the control rather than silently ignoring changes.

### 12. VR Control Panel

Implement an interactive VR control panel using the established control conventions from the weather simulator.

**Opening and closing**

- B or Y button toggles the panel.
- When opened, position it approximately 45 degrees to the player's right.
- Place it at a comfortable viewing distance.
- The panel remains stationary in world space while open.
- Reopening the panel repositions it relative to the player's current headset position and orientation.

**Interaction**

Use controller rays for interacting with sliders, toggles, and selectors.

Changes should take effect immediately wherever practical.

Organize the panel into four sections.

#### Cloud

| Control | Default |
|---|---|
| Density | 1.0 |
| Threshold | 0.4 |
| Noise octaves | 2 |
| Noise texture resolution | 64³ |
| Cloud scale | 1.0 |

#### Rendering

| Control | Default |
|---|---|
| Ray-march steps | 16 |
| Cloud resolution | 100% |
| Early termination | 0.02 |
| Foveation | 0 |

#### Diagnostics

| Control | Default |
|---|---|
| Rendering mode | Normal |
| Cloud visibility | On |
| Reference columns | On |

Rendering modes:

**Normal:** Standard cloud appearance with density accumulation and compositing.

**Density:** Grayscale visualization of accumulated cloud density or optical depth.

**Sample Count:** False-color visualization of the number of ray-march samples executed per pixel.

Diagnostic views should remain stereoscopically correct.

#### Performance

Display:

- Current FPS.
- Frame time in milliseconds.
- Current ray-march step setting.
- Current cloud-resolution scale.
- Cloud rendering enabled/disabled.

Performance information should update continuously without excessive overhead.

### 13. Performance Measurement

The primary purpose of this project is performance experimentation.

Target hardware: Meta Quest 3.

Relevant frame budgets:

- 72 Hz: 13.89 ms.
- 90 Hz: 11.11 ms.
- 120 Hz: 8.33 ms.

These are total application frame budgets, not cloud-rendering budgets.

Include a cloud-rendering toggle to compare baseline performance against the volumetric renderer.

Avoid allocating JavaScript objects during the render loop.

Reuse render targets, buffers, and other GPU resources.

Reallocate resources only when necessary, such as when changing rendering resolution.

Display measured FPS and frame time rather than estimating performance from shader complexity.

If practical, distinguish CPU frame time from GPU rendering time.

Do not label CPU timing measurements as GPU time.

### 14. Performance Optimizations

Implement initially:

- Tight cloud-volume ray intersection.
- Configurable maximum sample count.
- Early ray termination.
- Precomputed 3D noise texture.
- Minimal density calculations.
- Simple cloud coloring.
- No secondary lighting rays.

Defer:

- Adaptive ray-march step sizes.
- Hierarchical empty-space skipping.
- Temporal reprojection.
- Complex atmospheric scattering.
- Multiple cloud volumes.
- Cloud shadows.
- Dynamic cloud formation.
- Animated procedural noise.

Keep the implementation modular enough to experiment with these techniques later.

### 15. Acceptance Criteria

Milestone 1 is complete when:

1. The application launches successfully in Quest 3 WebXR.
2. The player can move freely around and through the cloud.
3. One isolated cloud is rendered using volumetric ray marching.
4. The cloud has a recognizable irregular shape.
5. Cloud density varies throughout its volume.
6. Thin cloud regions reveal objects behind them.
7. Dense regions progressively obscure background objects.
8. Six colored reference columns are visible in the environment.
9. Columns intersecting the cloud exhibit correct depth relationships.
10. The cloud renders correctly in stereo.
11. Ray-march steps can be adjusted in VR.
12. Cloud density and threshold can be adjusted in VR.
13. Noise complexity and texture resolution are configurable.
14. Early termination can be adjusted in VR.
15. The control panel opens and closes using B/Y.
16. Diagnostic rendering modes are available.
17. FPS and frame time are displayed.
18. Cloud rendering can be disabled for baseline comparisons.
19. Full-resolution rendering works correctly.
20. Reduced-resolution cloud rendering is implemented if feasible without compromising depth or stereo correctness.

### 16. Implementation Priorities

Implement in the following order:

**Phase A — Foundation**
- WebXR environment.
- Player movement.
- Checkerboard ground.
- Reference columns.
- VR control panel.

**Phase B — Volumetric Rendering**
- Single cloud volume.
- Ray-box intersection.
- Procedural density.
- Ray marching.
- Basic transmittance accumulation.

**Phase C — Correctness**
- Stereoscopic rendering.
- Depth-aware compositing.
- Correct column intersections.
- Stable rendering during head movement.

**Phase D — Experimentation**
- Adjustable quality settings.
- Diagnostic rendering modes.
- Performance measurements.
- Cloud visibility toggle.

**Phase E — Optimization**
- Reduced-resolution rendering, if feasible.
- Foveation support.
- Resource reuse and performance tuning.

### 17. Scope Limitations

Do not implement:

- Multiple clouds.
- Cloud movement.
- Wind.
- Precipitation.
- Realistic lighting.
- Cloud shadows.
- Atmospheric scattering.
- Weather simulation.
- Dynamic cloud generation.
- Complex user interfaces outside the VR control panel.

Keep the project focused on evaluating volumetric rendering performance and visual correctness.

### Final Objective

Deliver a standalone WebXR volumetric cloud laboratory that allows the user to walk around and through an isolated cloud while adjusting rendering quality and observing the performance consequences.

The project should make it easy to experiment with low sample counts, reduced rendering resolution, noise complexity, and early termination.

Correct stereo rendering and depth relationships are essential.

The implementation should favor straightforward, inspectable code over premature optimization.

This is an experimental rendering project, not a production cloud system.