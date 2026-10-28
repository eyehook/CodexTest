# WebXR Weather Simulator
## Rain — Milestone 2: Ground Interaction

### Project Context

Milestone 1 is complete. The existing WebXR weather simulator supports snow and rain, including wind, turbulence, velocity-based rain streaks, and pooled particles.

This milestone introduces visual ground interactions for rainfall.

The application targets Meta Quest 3 using Three.js and WebXR.

Preserve all existing functionality and performance characteristics.

## 1. Objectives

Implement two independent ground-impact effects:

1. Small geometric splashes when raindrops strike the ground.
2. Expanding circular ripples that spread outward from impact points.

Both effects must:

- Use simple opaque geometry.
- Avoid transparency, textures, and additive blending.
- Use fixed-size object pools.
- Render efficiently through batched geometry.
- Have configurable density.
- Automatically expire and return to their pools.
- Work with the existing checkerboard ground.

The effects should be stylized rather than photorealistic.

## 2. Impact Detection

Reuse the existing rain particle ground-collision detection.

When a raindrop reaches the ground, determine whether to generate a splash, ripple, both, or neither.

Do not generate effects for every impact.

Use configurable probabilities for each effect.

Initial defaults:

| Parameter | Default |
|---|---|
| Splash probability | 15% |
| Ripple probability | 10% |
| Maximum active splashes | 300 |
| Maximum active ripples | 200 |

Splash and ripple selection should be independent.

A single impact may produce both effects.

Effects must originate at the raindrop's actual ground-impact position.

For drops that cross the ground between frames, interpolate the impact position along the movement segment rather than using the position below ground.

## 3. Splash Geometry

Each splash consists of several short line segments radiating upward and outward from the impact point.

Use simple geometric lines rather than actual particle physics.

Initial design:

- 3–5 line segments per splash.
- Randomized radial directions.
- Slight variation in segment lengths.
- Pale gray color.
- Initial upward movement.
- Outward expansion.
- Short lifetime.

Suggested defaults:

| Parameter | Value |
|---|---|
| Segments per splash | 4 |
| Initial segment length | 3 cm |
| Maximum splash height | 12 cm |
| Splash radius | 8 cm |
| Lifetime | 0.20 seconds |

Each splash should animate through a simple ballistic arc.

The line segments begin close to the impact point, move upward and outward, then fall back toward the ground.

A simplified ballistic calculation is sufficient.

Avoid creating independent physics objects for individual splash segments.

Store splash state in pooled data structures and calculate segment positions directly during updates.

When a splash expires, deactivate it and return its slot to the pool.

## 4. Ripple Geometry

Ripples are expanding circular outlines positioned just above the ground.

Use simple opaque line segments.

Each ripple should:

- Begin at a small radius.
- Expand smoothly outward.
- Remain parallel to the ground.
- Disappear when its lifetime expires.
- Maintain a constant color and line thickness.

Because opacity is not being used, ripples should disappear abruptly at the end of their lifetime.

Suggested defaults:

| Parameter | Value |
|---|---|
| Initial radius | 2 cm |
| Maximum radius | 25 cm |
| Lifetime | 0.45 seconds |
| Circle segments | 12 |
| Height above ground | 0.01 m |

Use 12-sided polygons rather than smooth circles.

The slightly angular appearance is acceptable for the simulator's stylized aesthetic.

Ripple radius should increase approximately linearly over its lifetime.

Use a fixed lifetime rather than dynamically allocating or removing geometry.

## 5. Rendering Architecture

Both effects must use pooled, batched geometry.

Prefer separate shared `THREE.LineSegments` geometries for splashes and ripples.

Do not create individual Three.js objects for each effect.

Each effect pool should contain:

- A fixed number of slots.
- Active/inactive state.
- Impact position.
- Age.
- Lifetime.
- Any randomized parameters needed for animation.

Allocate all geometry and typed arrays during initialization.

Update vertex positions in existing buffers each frame.

Inactive effects should not render visible geometry.

Use degenerate line segments or an equivalent efficient method to hide inactive pool slots.

Avoid rebuilding geometry or creating temporary objects during animation.

The target is approximately one draw call for splashes and one for ripples.

## 6. Pool Management

Use fixed-capacity pools.

Default capacities:

- 300 splashes.
- 200 ripples.

When an effect is requested:

1. Find an available pool slot.
2. Initialize its state.
3. Activate it.
4. Animate it until its lifetime expires.
5. Return the slot to the available pool.

If a pool is exhausted, skip the new effect.

Do not allocate additional objects dynamically.

Use an efficient free-list or equivalent pool-management structure.

Pool capacity should be independent of effect probability.

Changing the probability should not resize the pool.

## 7. Player Movement

Ground effects should remain stationary in world space after being generated.

They must not follow the player or move with the precipitation simulation volume.

As the player walks through the environment:

- Existing splashes and ripples remain at their original impact positions.
- New effects appear around the player's current location.
- Expired effects are recycled normally.

Avoid generating effects outside the active rain simulation area.

The existing 50 cm headset exclusion zone applies to falling rain, not ground effects.

Ground splashes and ripples may appear beneath or near the player.

## 8. Wind Interaction

Wind affects the falling raindrops, but ripple expansion should remain circular.

For this milestone:

- Splash trajectories may be influenced slightly by wind.
- Ripples expand symmetrically regardless of wind.
- Impact positions reflect the actual wind-driven raindrop trajectories.

Keep splash wind influence subtle.

Do not introduce complex fluid dynamics.

## 9. Ground Alignment

The existing simulator uses a flat checkerboard ground.

Position effects relative to the ground surface.

Use a small vertical offset to prevent z-fighting.

Suggested offsets:

- Splash origin: 0.005 m above ground.
- Ripple geometry: 0.01 m above ground.

Do not hardcode world-space Y = 0 if the existing ground system exposes a different elevation.

Use the existing ground reference where practical.

## 10. VR Control Panel

Extend the rain controls with a Ground Effects section.

Add:

| Control | Default |
|---|---|
| Ground effects | Enabled |
| Splash effects | Enabled |
| Ripple effects | Enabled |
| Splash probability | 15% |
| Ripple probability | 10% |

Changes should take effect immediately.

Disabling an effect should hide its existing instances and prevent new ones from spawning.

Re-enabling an effect should resume normal behavior.

Preserve all existing weather controls.

Ground effects should only be active in rain mode.

## 11. Performance Requirements

The implementation must remain suitable for standalone Quest 3 at 90–120 Hz.

Requirements:

- No per-frame object allocations.
- No geometry creation during simulation.
- No individual draw calls per impact.
- No transparency or blending.
- No textures or particle sprites.
- No raycasting for ground collisions.
- No dynamic physics bodies.
- Fixed pool capacities.
- Delta-time-based animation.

Use simple arithmetic for splash trajectories and ripple expansion.

When rain mode is inactive, avoid updating ground-effect animation unnecessarily.

## 12. Acceptance Criteria

Milestone 2 is complete when:

1. Rain impacts occasionally generate small geometric splashes.
2. Splashes animate upward and outward before disappearing.
3. Rain impacts occasionally generate expanding circular ripples.
4. Ripples remain aligned with the ground.
5. Splash and ripple generation probabilities are independently adjustable.
6. Ground effects can be enabled or disabled from the VR control panel.
7. Effects remain stationary as the player moves.
8. All effects use fixed-capacity pools.
9. Pool exhaustion does not trigger allocations.
10. Rendering uses batched geometry with minimal draw calls.
11. No opacity, transparency, or textures are introduced.
12. Existing rain and snow behavior remains unchanged.
13. Performance remains suitable for Quest 3.

## Implementation Notes

Inspect the existing rain implementation before making changes.

Integrate ground-effect spawning into the existing rain collision/recycling logic.

Keep splash and ripple systems independent so either can be disabled or modified without affecting the other.

Prefer straightforward code and minimal dependencies.

Do not implement puddles, wet surfaces, reflections, audio, or additional weather effects in this milestone.

The objective is a lightweight, visually readable ground-impact system that complements the existing stylized rainfall.