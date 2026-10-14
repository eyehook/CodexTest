# WebXR Arcade Driver — Milestone 1

## Objective
Build a minimal, playable, seated VR driving prototype inspired by the feel of classic 1980s arcade road racers. Target Meta Quest 3 using the Quest Browser. This is a technical prototype, not a complete game.

## Technology and delivery
- Use Three.js and the browser WebXR API with `immersive-vr` support.
- Use JavaScript or TypeScript with Vite; favor a simple, maintainable project structure.
- Run locally for development and support deployment to GitHub Pages over HTTPS. Ensure asset paths work when hosted at a repository subpath (configure Vite `base` appropriately and document it).
- Include a README with setup, local testing, deployment, Quest Browser launch instructions, and controls.
- Do not use copyrighted OutRun assets, music, logos, or vehicle models.

## Scope
### 1. VR session and viewpoint
- Present a simple desktop preview and a clear **Enter VR** button when immersive VR is supported.
- Use seated VR, with a cockpit centered around the player's initial headset pose and at a comfortable seated scale.
- Keep the cockpit and player's reference frame stationary in world space; head movement and rotation must remain natural and fully tracked.
- Never programmatically animate, bank, shake, or recenter the headset camera while driving.
- The environment scrolls relative to the stationary cockpit to create the sensation of driving.

### 2. Low-poly cockpit
- Construct a basic, recognizable car interior from primitive geometry: dashboard, steering wheel, windshield frame (optional if it obscures visibility), and visible hood.
- Use simple flat-shaded colors and low geometry counts. No textures are required.
- Keep the road clearly visible and the cockpit appropriately sized for a seated driver.
- The steering wheel may visually rotate in response to steering input, but this is cosmetic.

### 3. Road and scenery
- Start with a straight, flat, endless road with visible shoulders and repeating dashed lane markings.
- Use a simple ground plane, sky color, and sparse low-poly roadside objects such as trees or geometric signs to communicate motion and speed.
- Recycle or reposition road segments and scenery as they pass behind the player; avoid unbounded object creation.
- Provide enough visible distance to avoid distracting pop-in; fog is acceptable.
- No curves, hills, intersections, traffic, collisions, or branching roads in this milestone.

### 4. Driving and input
- Accelerate automatically from rest to a configurable cruising speed over approximately five seconds, then hold that speed constant.
- Use the **left Quest controller thumbstick horizontal axis** to steer. Map stick deflection smoothly and apply a small dead zone.
- Because the cockpit and headset remain fixed, simulate lateral car position by shifting the road and roadside environment sideways relative to the cockpit. Do not translate the XR camera rig for steering.
- Steering should change the apparent lateral position on the road progressively, not instantly teleport the road.
- Clamp the simulated lateral position so the car cannot travel indefinitely beyond the road edges. No collision or crash state is needed.
- Returning the stick to center should stop lateral motion, not automatically recenter the car in its lane.
- Make speed, acceleration time, steering sensitivity, lateral limits, and dead zone easy to tune in a configuration module.
- Provide keyboard fallback in desktop preview (A/D and left/right arrows), so steering can be tested without a headset.
- Handle controller disconnects or absent gamepad axes gracefully.

### 5. Rendering and performance
- Prioritize smooth Quest 3 performance; aim for the headset's normal refresh rate without claiming a specific guaranteed frame rate.
- Use basic materials, simple lighting, and low polygon counts.
- Avoid per-frame geometry allocation and expensive effects. Use delta time for frame-rate-independent animation and input.
- Resize the non-XR canvas correctly and use the renderer's WebXR animation loop.

## Explicitly out of scope
Music and sound; accelerator or brake controls; gear shifting; opponent vehicles or traffic; collisions; score, timer, HUD, or menus beyond Enter VR; procedural curves and hills; realistic vehicle physics; detailed environment assets; saving or networking.

## Implementation guidance
Maintain separate logical state for forward distance, forward speed, and lateral road position. Use forward distance to advance/recycle road markings and scenery. Apply a common lateral offset to the road and environment, while leaving the cockpit and XR camera reference frame unchanged. Ensure roadside props remain consistently positioned relative to the road as it shifts. Favor readable modules for VR setup, cockpit creation, world generation, input, and simulation. Avoid overengineering.

## Acceptance criteria
1. Project installs and runs locally using documented commands.
2. Desktop preview shows the cockpit, straight road, and moving low-poly scenery.
3. Enter VR starts an immersive session in Quest Browser on Quest 3 when served from a secure origin.
4. Head tracking works naturally; the cockpit remains stable as the player looks around.
5. The road and scenery move backward, with speed increasing over about five seconds to a steady cruise.
6. Left thumbstick steers left/right smoothly; the cockpit remains stationary, and the road shifts laterally in the opposite direction.
7. Releasing the stick preserves the current lateral road position; steering respects defined road limits.
8. Desktop keyboard steering works.
9. Road and scenery recycle continuously without visible gaps or runaway memory growth.
10. Code and README are sufficient to run, adjust key tuning values, and deploy to GitHub Pages.

## Completion report
When finished, provide: a brief architecture summary; commands to run and build; instructions for deploying to GitHub Pages; a list of tuning parameters; any known issues; and a checklist indicating which acceptance criteria were verified. Clearly distinguish desktop-tested behavior from Quest 3 headset behavior that was not physically tested.

## Scope discipline
Implement only Milestone 1. Do not add later-game features without asking. Favor a reliable, comfortable, minimal prototype over polish.
