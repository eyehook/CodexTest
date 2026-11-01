# Editable Secret Garden door

Open [secret-garden-door.blend](secret-garden-door.blend) in Blender. It matches the current procedural door in `projects/secretGarden/garden-room.mjs` and `garden-layout.mjs`.

- **Door leaf:** 1.09 m wide × 2.22 m tall × 0.055 m thick; separate cube handles on both sides.
- **Door hinge — rotate local Z to swing:** empty at the left jamb; leaf and handles are children. Rotate Z ±90° to open.
- **Fixed round hinge stile:** separate 12-sided cylinder, stationary as in the game.
- **Entrance trim — optional context:** hidden objects for frame legs, lintel and sill. Unhide them in the Outliner if wanted. They sit 0.9469 m in front of the door, matching the garden entrance rather than a frame attached to the leaf.
- **Preview — camera and lights:** presentation only; exclude from asset exports.

Units are meters, Z is up. Blender coordinates map to game coordinates as `(X, Y, Z) → (X, Z, −Y)`. The Blender origin is the doorway floor midpoint; its game position is `(0, 0, 7.7724)`.

Saving the Blender source alone does not update the game. Re-export it with the command below to regenerate the runtime geometry module.

`create-door.py` reproduces the initial file and overwrites its output. Do not run it over your edited model. Usage:

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --python create-door.py -- /absolute/path/new-door.blend
```

## Use the edited door in the game

The runtime now uses `door-model.mjs`, exported from the edited Blender file, including the light brown heart. The heart is parented to the leaf and follows the hinge. Materials and evaluated triangle geometry are exported; preview lights, camera and optional entrance trim are excluded. The existing procedural entrance trim remains part of the control room.

To refresh the game asset after editing, save the door in its closed pose and run from this directory:

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background secret-garden-door.blend --python export-door.py -- /absolute/path/to/assets/secretGarden/door/door-model.mjs
```

The exporter preserves the heart's world placement while parenting it to the leaf, saves the Blender source, and writes the runtime module. It creates a one-time `secret-garden-door-before-parenting.blend` backup if one does not exist. Blender backup files are excluded from Git. Keep the leaf/heart/hinge names and both Handle-prefixed objects for the exporter. Re-export rather than hand-editing the generated module. Advance the asset import cache version and its dependency chain after updates for headset/browser reloads.
