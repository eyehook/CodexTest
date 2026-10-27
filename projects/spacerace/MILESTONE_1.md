# Project: WebXR Space Speed Experiment
## Milestone 1 — Particle Flow and Rings

### Overview

Create a minimal WebXR experience for Meta Quest 3 that explores the sensation of speed while traveling through space.

The player travels forward along a straight path through a field of particles and evenly spaced circular rings.

As speed increases, particles become more numerous and stretch into elongated streaks.

The environment should provide a convincing sensation of acceleration and high-speed travel while maintaining comfortable VR rendering and performance.

This is an experimental prototype, not a complete game.

### Technology

- WebXR
- Three.js
- JavaScript
- Meta Quest 3 browser
- WebGL-compatible rendering
- No external assets required

Prioritize efficient rendering and stable VR frame rates.

### 1. Player and Camera

The player travels along a fixed forward axis.

There is no steering, turning, or lateral movement.

Keep the player's virtual position stationary while moving environmental objects backward to simulate forward travel.

The headset must retain normal positional and rotational tracking.

Do not introduce artificial camera rotation, camera shake, motion blur, or field-of-view manipulation.

The experience should begin in a completely black environment.

### 2. Controller Input

Use the standard WebXR controller input system.

**Right controller trigger:**
- Accelerates while held.
- Acceleration should be smooth.
- Releasing the trigger maintains the current speed.

**Left controller trigger:**
- Decelerates while held.
- Deceleration should be smooth.
- Speed cannot become negative.

Initial movement parameters:

| Parameter | Value |
|---|---|
| Initial speed | 0 ft/s |
| Maximum speed | 300 ft/s |
| Acceleration | 60 ft/s² |
| Deceleration | 100 ft/s² |

Store these parameters as easily adjustable constants.

Use frame-time-independent movement calculations.

For desktop testing, provide keyboard equivalents:
- Up arrow: Accelerate
- Down arrow: Decelerate

### 3. Particle System

Implement a custom particle system using GPU-friendly geometry.

Each particle should be represented by a quad consisting of two triangles.

Use a shared geometry and custom shader, or another efficient GPU-based implementation that avoids individual draw calls per particle.

Do not use standard `THREE.Points`, since particles must support independent stretching along their direction of travel.

#### Particle distribution

Particles occupy a cylindrical volume centered on the player's flight path.

Initial parameters:

| Parameter | Value |
|---|---|
| Maximum particle count | 3,000 |
| Maximum forward distance | 500 ft |
| Particle field radius | 100 ft |
| Rear recycling boundary | 20 ft behind player |

Particle positions should be randomly distributed throughout the volume.

Maintain sufficient particles near the player to produce strong peripheral motion.

Avoid excessive clustering or obvious repeating patterns.

#### Particle movement

Particles move backward relative to the stationary player.

Movement speed is determined by the player's current velocity.

When a particle passes behind the recycling boundary, reposition it randomly ahead of the player.

Recycling should be visually seamless.

At zero speed, particles remain stationary.

#### Particle appearance

Particles should initially appear as small white points of light.

As speed increases, particles stretch into elongated streaks aligned with the direction of travel.

Streak length should increase smoothly with speed.

Use actual geometry deformation rather than screen-space motion blur.

Streaks must render correctly in stereoscopic VR.

Particle brightness may increase slightly with speed.

Particles should fade in near the far boundary and fade out as they approach the rear recycling boundary to avoid obvious popping.

#### Particle density

Visible particle density increases with speed.

Use a fixed maximum particle pool rather than continually allocating and destroying particles.

Suggested initial density:

| Speed | Visible particles |
|---|---|
| 0% | 200 |
| 25% | 400 |
| 50% | 800 |
| 75% | 1,500 |
| 100% | 3,000 |

Interpolate smoothly between these values.

Use a nonlinear curve if it improves the visual result.

Avoid abrupt changes in visible particle count.

### 4. Circular Rings

Create a sequence of circular rings that the player flies through.

All rings must be perfectly centered on the player's flight path.

There is no lateral offset or steering in this milestone.

#### Ring parameters

| Parameter | Value |
|---|---|
| Ring radius | 20 ft |
| Ring spacing | 200 ft |
| Ring orientation | Perpendicular to flight direction |
| Ring color | Pale blue |
| Ring appearance | Thin luminous outline |

Use a lightweight circular mesh with an unlit material.

Do not use dynamic lighting.

The rings should be visible at a distance and grow in apparent size as the player approaches.

When a ring passes behind the player, recycle it farther ahead while preserving uniform spacing.

Maintain enough rings to populate the visible forward distance.

The player should pass directly through the center of each ring.

There is no collision detection or scoring in this milestone.

### 5. Speed HUD

Add a small, unobtrusive HUD displaying:

- Current speed in feet per second
- Current speed in miles per hour
- Number of visible particles

The HUD should be readable in VR without obstructing the central view.

Use a small world-space panel positioned comfortably in front of the player and slightly below the center of view.

The HUD should follow the player's headset orientation smoothly, without noticeable jitter.

It should not interfere with the particle system or rings.

For desktop testing, display equivalent information as a simple HTML overlay.

### 6. Rendering and Performance

Target Meta Quest 3 standalone performance.

Priorities:

1. Stable VR frame rate.
2. Minimal draw calls.
3. Efficient particle updates.
4. No unnecessary geometry allocation during rendering.
5. Correct stereoscopic rendering.

Use instancing or shared buffer geometry where appropriate.

Avoid:
- Postprocessing
- Motion blur
- Bloom
- Dynamic shadows
- Dynamic lights
- Expensive transparency effects

The visual style should remain intentionally minimal.

### 7. Desktop Testing

The application must also run in a normal desktop browser without a VR headset.

Provide:
- Mouse-controlled camera orientation.
- Keyboard acceleration and deceleration.
- A button to enter VR when WebXR is available.
- The same particle and ring simulation used in VR.

Desktop mode is primarily for development and debugging.

### 8. Configuration

Centralize the following parameters so they can be adjusted easily:

- Maximum speed
- Acceleration
- Deceleration
- Maximum particle count
- Particle field radius
- Particle draw distance
- Particle minimum size
- Particle maximum streak length
- Particle density curve
- Particle stretching curve
- Ring radius
- Ring spacing
- Ring color

Use feet as the conceptual design unit, but convert to meters internally for Three.js.

### 9. Implementation Notes

The initial implementation should favor simplicity and clarity over elaborate architecture.

Use a fixed player-centered coordinate system.

Maintain consistent movement calculations using elapsed frame time.

Particle movement and ring movement must use the same velocity.

Ensure that particles and rings remain spatially stable when the player stops moving.

Do not introduce procedural terrain, planets, stars, spacecraft, sound, steering, or gameplay mechanics.

These may be added in future milestones.

### 10. Acceptance Criteria

The milestone is complete when:

1. The application launches in a desktop browser and Meta Quest 3 WebXR.
2. The player begins stationary in a black environment.
3. A small number of white particles are visible.
4. Pale blue rings extend straight ahead.
5. Holding the right trigger smoothly accelerates the player.
6. Holding the left trigger smoothly decelerates the player.
7. Releasing either trigger maintains the current speed.
8. Particle motion increases with speed.
9. Particle density increases with speed.
10. Particles smoothly stretch into streaks as speed increases.
11. Rings approach and pass directly around the player.
12. Particles and rings recycle seamlessly.
13. The HUD displays accurate speed and particle count.
14. Head tracking remains natural and unaffected.
15. Performance remains smooth on Quest 3.

### Deliverable

Create a working WebXR prototype with a minimal project structure and clear instructions for running it locally and deploying it to an HTTPS host.

The goal of this milestone is to evaluate the visual sensation of speed, not to build a complete spaceflight game.
