# Rigged chess opponent

User-provided `ManLP.blend` is preserved alongside `ManLP-rigged.blend`, the bound armature source. Body parts use rigid weights; fingers in `ManLP-articulated.blend` have blended weights across knuckle cross sections. The rig includes torso/head, mirrored arms, hands and fingers, with Blender hand IK and elbow controls and no arm stretching. `rig-manlp.py` recreates the rig only when the rigged output does not exist; it refuses to overwrite it.

The active source is `ManLP-articulated.blend`: three bones per finger, two per thumb. `upgrade-fingers.py` recreates it from the preserved initial rig. After editing the articulated file, export from the repository root:

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --python assets/chess/opponent/export.py
```

The exported `projects/chess/assets/opponent/manlp.glb` contains the skinned mesh and deform skeleton. No animation clips are required. `RiggedAvatar.mjs` solves dynamic hand targets and rotates the actual deform bones; Blender IK constraints are authoring controls and do not execute in WebGL. Preserve bone names and rest orientations when editing. The runtime keeps the mesh's native dimensions and measures its bone lengths. The existing palette is used for source meshes without materials. The added facial spheres/curve are currently disabled; the original mesh face is used.

Runtime attachment groups follow the thumb/index pinch center with an upright frame for chess pieces. Wrist IK compensates for this offset; finger bones animate close/open around transport. The model is placed relative to the existing seated/table anchor. Chest lean compensates for reach without stretching bones. No external runtime assets or services.

Asset provenance: supplied by the user. Original author/license information was not supplied; retain any source attribution when adding it.
