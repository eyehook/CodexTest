"""Taper/recess the upper neck beneath the jaw without changing rig or weights.
Saves the active combined avatar and exports its GLB. Existing backups preserved.
"""
import json
import math
import runpy
from pathlib import Path
import bpy
from mathutils import Vector

folder = Path(__file__).resolve().parent
source = folder / 'ManLP-articulated.blend'
bpy.ops.wm.open_mainfile(filepath=str(source))
if bpy.context.object and bpy.context.object.mode != 'OBJECT':
    bpy.ops.object.mode_set(mode='OBJECT')
neck = next(obj for obj in bpy.context.scene.objects
    if obj.type == 'MESH' and obj.name.startswith('GEO-neck_'))
key = 'jaw_refit_original_vertices_v1'
if key not in neck:
    neck[key] = json.dumps([list(vertex.co) for vertex in neck.data.vertices])
original = json.loads(neck[key])
if len(original) != len(neck.data.vertices):
    raise RuntimeError('Neck topology changed; refusing to use an incompatible original shape')
weights_before = [[(group.group, group.weight) for group in vertex.groups]
    for vertex in neck.data.vertices]
world = neck.matrix_world.copy()
inverse = world.inverted()
changed, collar_error = 0, 0.0
for vertex, coordinates in zip(neck.data.vertices, original):
    start = world @ Vector(coordinates)
    point = start.copy()
    # The collar remains fixed. Above it, remove the lateral flare under the
    # ears and recess the neck so the jaw, rather than the neck, defines the edge.
    t = max(0.0, min(1.0, (point.z - 0.64) / 0.09))
    t = t * t * (3.0 - 2.0 * t)
    point.x *= 1.0 - 0.40 * t
    point.y = (point.y - 0.01) * (1.0 - 0.12 * t) + 0.01 + 0.01 * t
    if not all(math.isfinite(value) for value in point):
        raise RuntimeError('Invalid neck vertex; source was not saved')
    vertex.co = inverse @ point
    if t == 0:
        collar_error = max(collar_error, (point - start).length)
    if (point - start).length > 0.000001:
        changed += 1
weights_after = [[(group.group, group.weight) for group in vertex.groups]
    for vertex in neck.data.vertices]
if weights_after != weights_before or collar_error > 0.000001:
    raise RuntimeError('Skin weights or collar anchors changed; source was not saved')
neck.data.update()
neck['jaw_refit'] = 'Smooth upper-neck taper/recession from world Z 0.64 to 0.73 m; collar/weights preserved'
bpy.context.preferences.filepaths.save_version = 0
bpy.context.scene.tool_settings.use_keyframe_insert_auto = False
bpy.ops.wm.save_as_mainfile(filepath=str(source))
print('NECK REFIT', changed, 'vertices adjusted; collar drift', collar_error, '; skin weights unchanged', flush=True)
runpy.run_path(str(folder / 'export.py'), run_name='__main__')
print('NECK SOURCE AND GLB COMPLETE', flush=True)
