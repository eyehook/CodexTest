# Editable chess knight

`chess-knight.blend` is the user-edited source. Keep the base at world origin and dimensions in metres. Blender Z-up is converted to game Y-up using (x, z, -y). All visible-for-render mesh objects and evaluated modifiers are baked into one shared triangle geometry. Game materials supply White/Black colors.

After saving edits in this folder, run from the repository root:

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --python assets/chess/knight/export.py
```

This regenerates `projects/chess/src/KnightGeometry.mjs`. Refresh the browser after export; increment module/entry query versions if needed for cached devices. The game loads no Blender runtime or external assets. Source/application license: GPL-3.0-or-later.

The game applies a 90-degree rotation around its vertical Y axis in `ChessBoard.mjs` after loading this geometry. Blender edits retain their original source orientation.
