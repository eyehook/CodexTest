# Editable chess opponent

## Active source and export

**Edit `ManLP-articulated.blend`.** It contains the complete current body, finger rig, replacement HeadLP face and blended neck weights. The game uses its exported `projects/chess/assets/opponent/manlp.glb`; Blender files are not loaded by the browser.

From the repository root, after saving Blender edits:

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --python assets/chess/opponent/export.py
```

`export.py` opens the active file and overwrites the runtime GLB with skins/deform bones, Y-up conversion and no animation clips. Update the GLB URL query in `RiggedAvatar.mjs` and relevant module/entry query versions, refresh the browser and run `npm run test:chess`. Keep editable source and export together in an authorized commit.

## Source files

| File                      | Role                                                                                                                                                                  |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ManLP-articulated.blend` | **Authoritative combined editable character.** 46 authoring bones; 34 runtime skinned meshes / 41 deform bones.                                                       |
| `ManLP.blend`             | Original user-supplied body; preserved.                                                                                                                               |
| `ManLP-rigged.blend`      | Earlier bound rig with one bone per finger; preserved, no longer exported.                                                                                            |
| `HeadLP.blend`            | Unmodified user-supplied eleven-part head/ears/eyes/eyelids/nose source. Not exported directly.                                                                       |
| `rig-manlp.py`            | Initial rig generator from the original body. Refuses to overwrite the initial rig.                                                                                   |
| `upgrade-fingers.py`      | Adds finger joints/knuckle cross sections to the initial rig. Refuses to overwrite the articulated file. Does **not** recreate the later HeadLP or neck-weight edits. |
| `export.py`               | Portable exporter for the current combined file.                                                                                                                      |

Do not use similarly named `.blend1` or `.blend2.blend` backups as the active source without inspecting them. Preserve user backups and exclude them from unrelated commits.

## Rig and materials

Body parts mostly use rigid weights. Each finger has three phalanges and each thumb has two, with blended weights at added knuckle cross sections. Keep bone names, rest orientations, native scale, armature modifiers and skin weights when editing. Arm lengths are approximately 0.273 m upper / 0.237 m forearm; no stretch is used.

The eleven visible HeadLP parts were translated −0.8 m in Blender Z to align their head origin with the body. All head parts follow the existing `head` bone. Their materials are unassigned in the active source, so the browser supplies the existing skin palette, including eyes; the temporary charcoal sphere eyes are removed. The existing upper/lower eyelids blink at runtime; there are no mouth animation overlays or evaluation-driven facial expressions.

The separate neck mesh blends chest→head weights with smoothstep between Blender Z 0.60 and 0.71 m. Vertices below/above are fully chest/head weighted. The 2026-10-26 jaw refit tapers/recesses the upper neck from Blender Z 0.64–0.73 m, removing the lateral flare under the ears. `refit-neck.py` preserves the lower collar and all chest/head weights, stores the original neck vertices for idempotent reruns, saves the active source and exports GLB. Verification against the prior release found 116 changed neck vertices, 76 unchanged collar vertices, identical skin weights and unchanged geometry in the other 33 meshes. The collar stays with the chest during head turns. Preserve these groups when sculpting/editing.

## Separate wire-rim glasses

`GEO-wire_rim_glasses` is a separate mesh in the active combined Blender file: two oval wire rims, an arched bridge and temple wires curling behind the ears. No lenses are present. The rims are spaced 6 mm farther outward per side and sit 15 mm closer to the face than the initial accessory; the bridge is fitted against the nose-bridge mesh surface. Its `head` vertex group has full weight, with the same armature modifier as the head assembly, so it follows all head/torso motion. The named **Wire rim brushed silver** material is retained by the runtime (metalness 0.65, roughness 0.32). The export adds one skinned mesh and 3,524 triangles; existing bones and head/neck meshes are unchanged.

`add-glasses.py` creates/recreates only its tagged accessory object, saves the active file and invokes `export.py`. Ordinary manual edits should be made directly in the active `.blend`, followed by the normal exporter. The generator disables automatic `.blend1` replacement to preserve existing user backups. If sandboxed Blender crashes, use the same command manually in Terminal as requested by the user.

## Separate handlebar mustache

The separate `mustache` mesh is a thick dark-brown handlebar shape with tapered curled tips, bound 100% to the existing head bone. Its named **Mustache dark brown hair** material remains distinct from skin and glasses. It adds one skinned mesh and 2,632 triangles. `add-mustache.py` creates/replaces only its tagged mustache object, fits the body below the actual nose (explicitly excluding the nose-bridge object), saves the active document and runs the normal exporter. Face and glasses geometry remain unchanged. As with the glasses generator, run manually in Terminal if sandboxed Blender crashes; user backups are preserved.

## Runtime eyelid blinking

The existing upper/lower eyelid objects blink together at randomized 2.5–6.5-second intervals. Closing takes 55–85 ms, holds for 15–35 ms, then reopens over 90–140 ms. `EyelidBlink.mjs` measures the matching eyeball center and rotates each lid's rest geometry around that pivot (upper +0.50 rad, lower −0.16 rad around model X); head skinning then applies normally. It does not scale the eyes, add meshes, alter Blender geometry or add bones. Lid normals rotate with the vertices, idle frames do not upload geometry, and reopening/reset restores exact rest arrays. `RiggedAvatar.update()` advances blinks alongside gaze, so hidden/untracked XR and Options pause both without catch-up.

## Browser animation

`RiggedAvatar.mjs` drives deform bones dynamically; Blender hand IK/elbow controls are authoring aids, not constraints executed in WebGL. No baked clips are required. Arms use native-length analytic IK, palm roll, slight wrist flexion and bounded torso lean/forward shift. `repairMirroredWinding` fixes exported mirrored triangle orientation once at load while keeping surfaces opaque.

The upright piece attachment follows a virtual pinch anchor rather than the wrist. Thumb contact was visually accepted. The first index bone extends along the hand, with the other two reaching forward/down toward a nearby lower contact; unused fingers curl in separate lanes. Close/open is driven by the move sequence. Preserve the current contact conventions when changing geometry, then verify both hands at different piece heights.

The head smoothly watches opponent moves or player-held pieces, with bounded yaw/pitch and reset/cancellation handling. Runtime head movement depends on consistent head rest orientation and world/local transforms. `tests/chess/rigged-avatar.mjs` parses the actual GLB and validates reach, skinning, materials, pinch, gaze and neck anchoring.

Asset provenance: supplied by the user; original author/license information was not supplied. Retain source attribution if provided later. See [Chess handoff](../../../projects/chess/HANDOFF.md) for current publication state and validation limits.
