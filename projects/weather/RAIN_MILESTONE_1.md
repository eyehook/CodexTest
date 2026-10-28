# WebXR Weather Simulator
## Rain — Milestone 1: Basic Rainfall

### Project Context

This project is an existing WebXR weather simulator targeting Meta Quest 3, using Three.js and WebXR.

Snowfall is already implemented and working. This milestone adds rain as a second precipitation mode.

Reuse existing architecture wherever practical, particularly the particle management, wind, turbulence, player movement, and VR control panel systems.

Do not break or replace the existing snow simulation.

### 1. Rain Mode

Add rain as a selectable weather mode alongside snow.

Only one precipitation mode needs to be active at a time.

Preserve the existing environment:

- Gray checkerboard ground.
- Contrasting gray sky.
- Smooth thumbstick locomotion and turning.
- Player-centered simulation volume.
- VR control panel opened using the B/Y buttons.
- Control panel positioned approximately 45 degrees to the player's right.

### 2. Rain Geometry

Render raindrops as simple, thin, opaque line segments.

Requirements:

- Use a single efficient batched geometry where practical.
- No transparency, opacity effects, or additive blending.
- No motion blur or persistent trails.
- Use a light gray color that contrasts with the environment.
- Each streak represents the recent trajectory of one raindrop.
- Streaks must be visible stereoscopically in VR.
- Avoid individual meshes or draw calls for each drop.

Prefer `THREE.LineSegments` with a dynamically updated `BufferGeometry`, or an equivalent efficient implementation.

Each raindrop occupies two vertices in the shared geometry.

### 3. Rain Velocity and Orientation

Each raindrop has a 3D velocity vector consisting of:

- Downward falling velocity.
- Horizontal wind velocity.
- Local turbulence.

Calculate streak direction from the normalized velocity vector.

```javascript
const direction = velocity.clone().normalize();
```

The streak must align with its actual direction of movement.

Wind should therefore cause rain to fall diagonally.

Turbulence should produce localized variations in falling direction.

Avoid allocating temporary vectors in the per-particle update loop.

### 4. Streak Length

Streak length is proportional to the magnitude of the raindrop's velocity.

Use:

```javascript
streakLength = speed * trailDuration;
```

Default:

`trailDuration = 0.015 seconds`

Examples:

- 4 m/s → 6 cm
- 8 m/s → 12 cm
- 12 m/s → 18 cm

Each streak extends backward from the raindrop's current position, opposite its velocity vector.

The current position represents the leading end of the streak.

Do not implement actual motion trails or historical position buffers.

### 5. Rainfall Physics

Use simplified terminal velocities rather than simulating gravitational acceleration.

Defaults:

| Parameter | Value |
|---|---|
| Active raindrops | 2,000 |
| Minimum fall speed | 4 m/s |
| Maximum fall speed | 9 m/s |
| Wind speed | 0 m/s |
| Turbulence | 0 |
| Trail duration | 15 ms |
| Simulation radius | 15 m |
| Spawn height | 12 m |
| Player exclusion radius | 0.5 m |

Assign each raindrop a randomized terminal falling speed within the specified range.

Use delta-time-based movement to ensure consistent behavior at different frame rates.

Wind and turbulence should affect horizontal velocity.

Do not introduce gravity acceleration, collision physics, or aerodynamic drag calculations.

### 6. Wind and Turbulence

Reuse the existing wind and turbulence systems where practical.

Wind should:

- Affect the horizontal movement of raindrops.
- Change the orientation of their streaks.
- Increase total velocity and therefore streak length.

Turbulence should:

- Introduce smooth, spatially correlated variations in horizontal velocity.
- Vary over time.
- Affect nearby drops similarly.
- Avoid independent random jitter for each particle.

The resulting rain should form coherent diagonal patterns and respond visibly to changing wind conditions.

### 7. Simulation Volume

Use a cylindrical simulation volume centered on the player's horizontal position.

Default radius: 15 meters.

Default spawn height: 12 meters above the ground.

Raindrops must be recycled when:

1. They reach the ground.
2. They leave the simulation radius.
3. They otherwise leave the active simulation volume.

Recycled drops should be repositioned without creating new objects.

Ensure that strong horizontal winds do not create noticeable gaps in rainfall.

Account for wind direction when choosing spawn positions. Drops may enter through the top or upwind boundary of the simulation volume.

When the player moves, maintain a consistent distribution of rainfall around the player.

### 8. Player Exclusion Zone

Implement a spherical exclusion zone centered on the player's headset position.

Radius: 0.5 meters.

Rain streaks must not enter this zone.

Since opacity is not being used, do not fade nearby drops.

Instead, recycle or reposition drops before their streak geometry intersects the exclusion zone.

The exclusion zone must follow the headset as the player moves or changes height.

Avoid introducing a conspicuous empty region around the player.

### 9. Particle Pooling and Performance

All rain particles must be pooled.

Requirements:

- Allocate particle data and rendering buffers during initialization or explicit pool resizing.
- Reuse particles when they reach the ground or leave the simulation volume.
- Do not create or destroy particle objects during normal simulation.
- Do not allocate temporary vectors, arrays, or geometry during per-frame particle updates.
- Use batched rendering with minimal draw calls.
- Update existing geometry buffers rather than rebuilding geometry each frame.
- Avoid unnecessary garbage collection.

If the rain density changes, resize the pool deliberately rather than continually allocating and destroying particles.

The implementation should remain suitable for Quest 3 at high refresh rates, ideally 90–120 Hz.

### 10. VR Control Panel

Extend the existing weather control panel with rain-specific controls.

| Control | Default |
|---|---|
| Weather mode | Existing selection |
| Rain density | 2,000 |
| Wind speed | 0 m/s |
| Turbulence | 0 |
| Fall speed multiplier | 1.0 |
| Trail duration | 15 ms |

Reuse existing wind and turbulence controls if they are shared between weather modes.

The trail duration control determines streak length relative to velocity.

The fall speed multiplier scales individual raindrop terminal velocities.

Changing controls should update the simulation immediately without requiring a restart.

Preserve existing snow controls and behavior.

### 11. Ground Interaction

For this milestone, raindrops simply disappear and recycle when they reach the ground.

Do not implement:

- Splashes.
- Ripples.
- Puddles.
- Wet surfaces.
- Ground reflections.
- Mist or fog.
- Lightning.
- Audio.

These are potential future milestones.

### 12. Acceptance Criteria

Milestone 1 is complete when:

1. The user can switch between snow and rain without restarting the application.
2. Rain appears as thin, opaque streaks falling through the environment.
3. Individual drops have varied falling speeds.
4. Faster drops produce longer streaks.
5. Wind tilts the rain naturally in the direction of movement.
6. Turbulence introduces smooth, coherent variations.
7. Rain remains distributed around the player during locomotion.
8. Rain does not intersect the 50 cm headset exclusion zone.
9. All rain particles are pooled and recycled.
10. Rain density, wind, turbulence, falling speed, and streak duration can be adjusted in VR.
11. The existing snow simulation remains functional.
12. Performance remains suitable for standalone Quest 3.

### Implementation Guidance

Prioritize simplicity, efficient rendering, and clean integration with the existing codebase.

Inspect the current snow implementation before introducing new systems.

Reuse shared weather infrastructure, but keep precipitation-specific rendering and behavior modular.

Avoid unnecessary abstractions or premature implementation of future weather effects.

The goal of this milestone is convincing, stylized rainfall with responsive wind behavior and minimal rendering overhead.