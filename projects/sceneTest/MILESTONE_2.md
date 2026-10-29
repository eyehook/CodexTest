# Scene Test
## Milestone 2 — Objects and Materials

### 1. Project Overview

Extend the existing **Scene Test** WebXR application with placeable primitive objects and editable materials.

Milestone 1 implemented an interactive lighting laboratory with configurable lights, VR manipulation, scene settings, and persistence.

Milestone 2 adds:

- Four primitive object types.
- Object creation through the existing VR palette interaction.
- Material color, metalness, and roughness controls.
- Uniform and independent axis scaling.
- A tabbed interface for switching between lights and objects.
- Context-sensitive property panels.
- Updated scene persistence.

**Preserve all existing Milestone 1 functionality.**

Reuse the existing selection, grabbing, UI, and persistence systems wherever possible.

The application continues to target Meta Quest 3 using Three.js and WebXR.

---

### 2. Primitive Objects

Add four object types:

| Object | Three.js Geometry | Default Dimensions |
|---|---|---|
| Sphere | `SphereGeometry` | 0.5 m diameter |
| Cube | `BoxGeometry` | 0.5 × 0.5 × 0.5 m |
| Cylinder | `CylinderGeometry` | 0.5 m diameter, 0.5 m height |
| Pyramid | `ConeGeometry` | 0.5 m base width, 0.5 m height, 4 sides |

Use reasonable geometry subdivisions for smooth spheres and cylinders without excessive polygon counts.

The pyramid should have a square base aligned with the X/Z axes. A four-sided cone rotated appropriately around its vertical axis is acceptable.

All primitives should initially use `THREE.MeshStandardMaterial`.

Default material properties:

- Color: White (`#FFFFFF`)
- Metalness: 0
- Roughness: 0.5
- Opacity: 1 (fixed, not exposed)

All objects should cast and receive shadows by default.

Objects may freely intersect:

- Other objects.
- Lights and their helpers.
- The floor.
- Walls.
- Fixed test geometry.

Do not implement collision detection, physics, snapping, or placement restrictions.

---

### 3. Object Creation

Extend the existing creation palette with an Objects tab.

The Objects tab contains four grabbable prototypes:

- Sphere
- Cube
- Cylinder
- Pyramid

Use the same creation behavior currently implemented for lights.

When the user grips a palette prototype:

1. Create a new instance of the corresponding primitive.
2. Leave the original palette prototype in place.
3. Attach the new object to the controller using the existing grabbing system.
4. Immediately select the newly created object.
5. Open the Object Settings panel.
6. Update the object's position and rotation continuously while grabbed.
7. Release the grip to place the object in the scene.

Preserve the initial transform offset relative to the controller to avoid unexpected snapping.

Objects should be visible and respond to scene lighting immediately while being dragged.

There is no limit on the number of objects beyond practical performance considerations.

---

### 4. Selection and Manipulation

Reuse the existing selection system.

#### Trigger

- Selects a light or object for editing.
- Displays its corresponding properties.
- Highlights the selected item.
- Selecting a different item replaces the current selection.
- Trigger interactions with UI controls must not change selection.

#### Grip

- Grabs and manipulates objects or lights.
- Controls both position and rotation using the controller's 6DOF tracking.
- Grabbing the currently selected item preserves selection.
- Grabbing a different existing item deselects the previous selection.
- Grabbing an unselected existing item does not automatically select it.
- Grabbing a palette prototype creates and selects a new instance.

#### B Button

- Deselects the current item.
- Clears selection highlighting.
- Clears the contextual settings panel.

#### Selection Ray

Preserve the existing always-visible selection ray.

It should interact with both lights and objects.

For objects, use raycasting against their actual geometry rather than a separate selection helper.

Maintain visually distinct hover, selected, and grabbed states.

Do not allow highlighting to permanently modify an object's material properties.

---

### 5. Material Settings

When a primitive object is selected, display its material properties in the Object Settings panel.

For Milestone 2, support only `THREE.MeshStandardMaterial`.

Expose the following controls:

| Property | Control | Range | Default |
|---|---|---|---|
| Red | Slider | 0–255 | 255 |
| Green | Slider | 0–255 | 255 |
| Blue | Slider | 0–255 | 255 |
| Metalness | Slider | 0–1 | 0 |
| Roughness | Slider | 0–1 | 0.5 |

Display a live color swatch.

All controls should update the selected object's material immediately.

Use RGB sliders only. Do not add color presets.

#### Material Architecture

Although only Standard materials are supported in this milestone, structure material serialization and editing to allow additional material types later.

For example, store a material type identifier alongside its properties.

Future material types may include:

- Basic
- Lambert
- Phong
- Physical
- Normal
- Custom shader materials

Do not implement these additional types now.

Each created object should have independently editable material properties.

Editing one object's material must not change another object's appearance.

---

### 6. Scale Controls

Provide four sliders in the Object Settings panel:

| Property | Range | Default |
|---|---|---|
| All | 0.1–10.0 | 1.0 |
| X | 0.1–10.0 | 1.0 |
| Y | 0.1–10.0 | 1.0 |
| Z | 0.1–10.0 | 1.0 |

#### All Slider

The All slider sets all three scale components to the same absolute value.

For example:

Moving All to 2.5 results in:

- X = 2.5
- Y = 2.5
- Z = 2.5

The X, Y, and Z sliders must update continuously as All moves.

The object should resize immediately.

#### Individual Axis Sliders

Moving X, Y, or Z changes only the corresponding axis.

For example:

- X = 2.0
- Y = 1.0
- Z = 0.5

The object should stretch independently along those axes.

#### All Slider State

The All slider is a convenience control, not a persistent scale multiplier.

After independent axis adjustments, retain the All slider's last value.

Moving All again overrides all three axis values.

Do not automatically normalize or modify the individual scales when switching selection.

The selected object's current X, Y, and Z scales must always be reflected accurately in the controls.

---

### 7. Object Settings Panel

When an object is selected, display:

**Object Information**
- Primitive type.

**Material**
- Red.
- Green.
- Blue.
- Metalness.
- Roughness.

**Scale**
- All.
- X.
- Y.
- Z.

**Shadows**
- Cast shadows toggle.
- Receive shadows toggle.

**Actions**
- Delete object.

Deleting an object should:

1. Remove it from the scene.
2. Dispose of object-specific resources as appropriate.
3. Remove it from the scene data model.
4. Clear the selection.
5. Return the settings panel to its empty state.

No confirmation is required.

---

### 8. Updated Control Panel Organization

Modify the existing VR interface to use a tabbed creation palette.

#### Main Panel

Provide two tabs:

**Lights | Objects**

The Lights tab displays the existing light creation palette.

The Objects tab displays the four primitive object prototypes.

Switching tabs changes the available creation tools without changing the currently selected item.

#### Contextual Settings Panel

Display a separate settings panel immediately to the right of the main panel.

Its contents depend on the current selection.

| Selected Item | Settings Panel |
|---|---|
| Point light | Point Light Settings |
| Spotlight | Spot Light Settings |
| Directional light | Directional Light Settings |
| Rectangular area light | Area Light Settings |
| Primitive object | Object Settings |
| Nothing | Empty state |

Selecting a light automatically activates the Lights tab.

Selecting an object automatically activates the Objects tab.

Grabbing a new item from either palette selects that item and displays its corresponding settings.

Manually switching tabs does not change the current selection.

#### Automatic Panel Opening

Selecting an object or light must automatically open the control panels if they are currently hidden.

Use the existing hybrid positioning behavior:

- Panels appear approximately 45° to the player's right.
- They face the player when opened.
- They remain fixed in world space while open.
- Closing and reopening repositions them relative to the player's current viewpoint.

Automatic opening should follow the same positioning rules.

#### Scene Settings

Keep global Scene Settings accessible independently of the Lights and Objects tabs.

Preserve all existing controls for:

- Background.
- Ambient light.
- Hemisphere light.
- Global shadows.
- Shadow resolution.
- Tone mapping.
- Exposure.
- Save Scene.
- Reset Scene.

Do not remove or simplify existing lighting controls.

---

### 9. Shadows

All newly created primitives should:

- Cast shadows by default.
- Receive shadows by default.

Expose independent toggles for both properties.

Objects should respond to all existing supported light types.

Preserve the existing global shadow toggle and per-light shadow controls.

Scaling or rotating an object should update its shadow appearance immediately.

Do not implement transparent or colored shadows in this milestone.

---

### 10. Scene Persistence

Extend the existing Save Scene functionality to include user-created objects.

Persist each object's:

- Unique identifier.
- Primitive type.
- Position.
- Rotation.
- Scale X/Y/Z.
- Material type.
- RGB color.
- Metalness.
- Roughness.
- Cast shadows.
- Receive shadows.

Continue saving all existing light and global scene properties.

Use a versioned JSON structure.

#### Compatibility

Existing Milestone 1 saved scenes must remain loadable.

If a saved scene contains lights but no objects, restore the lights normally and initialize an empty user-object collection.

Avoid breaking or discarding existing saved lighting arrangements.

#### Save Scene

Continue using the existing explicit Save Scene button.

Do not automatically persist edits.

Saving should replace the previously saved scene configuration.

#### Reset Scene

Reset should:

- Remove all user-created objects.
- Remove all user-created lights.
- Restore default global scene settings.
- Clear selection.
- Restore the default fixed test environment.

Reset must not overwrite or delete the saved scene.

Reloading the application should restore the last explicitly saved configuration.

---

### 11. Performance and Resource Management

Preserve the existing performance HUD.

Created objects should contribute to the existing triangle and draw-call statistics.

Use shared geometry resources where practical.

Materials must remain independently editable.

Avoid unnecessary geometry reconstruction when changing scale. Use object transforms.

Dispose of unused resources appropriately when objects are deleted.

Keep raycasting and selection efficient.

Maintain smooth performance on Quest 3.

---

### 12. Architecture

Extend the existing application rather than replacing working systems.

Prefer a shared abstraction for selectable and manipulable scene entities.

Both lights and primitive objects should support:

- Unique IDs.
- Selection.
- Hover feedback.
- Grabbing.
- Position.
- Rotation.
- Serialization.
- Deletion.

Object-specific properties should remain separate from light-specific properties.

Keep geometry creation, material management, UI editing, and persistence logically separated.

The architecture should allow future milestones to introduce additional primitive shapes, material models, and rendering effects.

---

### 13. Scope Exclusions

Do not implement:

- Additional primitive types.
- Material models other than Standard.
- Opacity or transparency controls.
- Textures.
- Normal maps.
- Bump maps.
- Environment-map editing.
- Physics.
- Collision detection.
- Object snapping.
- Object grouping.
- Object duplication.
- Geometry editing.
- Mesh deformation.
- Undo/redo.
- Automatic saving.

These can be considered in future milestones.

---

### 14. Acceptance Criteria

Milestone 2 is complete when:

1. Existing Milestone 1 lighting functionality continues working.
2. The main palette provides Lights and Objects tabs.
3. The Objects tab contains sphere, cube, cylinder, and pyramid prototypes.
4. Grabbing a prototype creates a new object.
5. The new object is automatically selected.
6. The object follows controller position and rotation while grabbed.
7. Releasing the grip places the object.
8. Trigger selection works on existing objects.
9. Grabbing a different existing object clears the previous selection.
10. Selecting a light activates the Lights tab and displays its settings.
11. Selecting an object activates the Objects tab and displays its settings.
12. Selecting an item automatically opens hidden panels.
13. The contextual settings panel appears to the right of the main palette.
14. RGB controls update object color immediately.
15. Metalness and roughness update immediately.
16. The All scale slider updates X, Y, and Z simultaneously.
17. Individual scale sliders modify only their corresponding axes.
18. All scale sliders support values from 0.1 to 10.0.
19. Objects can freely intersect other geometry.
20. Cast and receive shadow toggles work.
21. Objects can be deleted.
22. Save Scene persists objects and their properties.
23. Previously saved Milestone 1 scenes remain compatible.
24. Reset Scene removes created objects without deleting the saved configuration.
25. Performance remains suitable for Quest 3.

### Implementation Priority

Prioritize integration with the existing working application.

Avoid rewriting established lighting, selection, manipulation, or UI systems unless necessary.

The goal is a simple, responsive VR environment where users can create primitives, position them, change their appearance, and observe how they interact with the existing lighting system.