"""Add a separate thick handlebar mustache, save the active source and export GLB.
Run with Blender --background --python /absolute/path/to/add-mustache.py.
Existing glasses, head geometry and Blender backup files are preserved.
"""
import math
import runpy
from pathlib import Path
import bpy
from mathutils import Matrix, Vector
from mathutils.geometry import intersect_ray_tri

folder = Path(__file__).resolve().parent
source = folder / 'ManLP-articulated.blend'
bpy.ops.wm.open_mainfile(filepath=str(source))
if bpy.context.object and bpy.context.object.mode != 'OBJECT':
    bpy.ops.object.mode_set(mode='OBJECT')
rig = next(obj for obj in bpy.context.scene.objects if obj.type == 'ARMATURE')
name = 'mustache'
previous = bpy.data.objects.get(name)
if previous:
    if previous.get('codex_accessory') != 'handlebar_mustache_v1':
        raise RuntimeError('Refusing to replace an unrelated mustache object')
    bpy.data.objects.remove(previous, do_unlink=True)
head = next(obj for obj in bpy.context.scene.objects
    if obj.type == 'MESH' and obj.name.startswith('GEO-head_'))
nose = next(obj for obj in bpy.context.scene.objects
    if obj.type == 'MESH' and obj.name.startswith('GEO-nose_')
    and not obj.name.startswith('GEO-nose_bridge_'))
nose_bottom = min((nose.matrix_world @ Vector(v)).z for v in nose.bound_box)
lip_height = nose_bottom - 0.010
head.data.calc_loop_triangles()
triangles = [[head.matrix_world @ head.data.vertices[i].co for i in triangle.vertices]
    for triangle in head.data.loop_triangles]

def face_y(x, z):
    origin, direction = Vector((x, -1, z)), Vector((0, 1, 0))
    hits = []
    for a, b, c in triangles:
        hit = intersect_ray_tri(a, b, c, direction, origin, True)
        if hit is not None and hit.y >= origin.y:
            hits.append(hit.y)
    if not hits:
        raise RuntimeError(f'Could not fit mustache to face at {x}, {z}; source was not saved')
    return min(hits)

def smooth_path(control, steps=6):
    control = [Vector(v) for v in control]
    result = []
    for i in range(len(control) - 1):
        p0, p1 = control[max(0, i - 1)], control[i]
        p2, p3 = control[i + 1], control[min(len(control) - 1, i + 2)]
        for step in range(steps):
            t = step / steps
            result.append(0.5 * ((2 * p1) + (-p0 + p2) * t +
                (2 * p0 - 5 * p1 + 4 * p2 - p3) * t*t +
                (-p0 + 3 * p1 - 3 * p2 + p3) * t*t*t))
    result.append(control[-1])
    return result

# Each half is a thick, slightly drooping body that sweeps up into a curled tip.
# Controls contain horizontal offset, vertical offset from the lip, and radius.
control = [
    (0.0015, 0.0020, 0.0070),
    (0.0110, 0.0035, 0.0100),
    (0.0260, 0.0000, 0.0105),
    (0.0410, 0.0000, 0.0085),
    (0.0540, 0.0060, 0.0065),
    (0.0610, 0.0170, 0.0050),
    (0.0580, 0.0270, 0.0043),
    (0.0490, 0.0290, 0.0032),
    (0.0430, 0.0220, 0.0017),
    (0.0470, 0.0180, 0.0006),
]
profile = smooth_path(control)
vertices, faces = [], []
sides = 12
for sign in [-1, 1]:
    points, radii = [], []
    for offset_x, offset_z, thickness in profile:
        x, z = sign * offset_x, lip_height + offset_z
        thickness = max(0.00045, thickness)
        # Slightly embed the back of the hair volume into the skin to avoid gaps.
        y = face_y(x, z) - thickness * 0.45
        points.append(Vector((x, y, z)))
        radii.append(thickness)
    start = len(vertices)
    for i, point in enumerate(points):
        tangent = (points[min(i + 1, len(points) - 1)] - points[max(i - 1, 0)]).normalized()
        forward = Vector((0, -1, 0))
        normal = (forward - tangent * forward.dot(tangent)).normalized()
        binormal = tangent.cross(normal).normalized()
        for side in range(sides):
            theta = math.tau * side / sides
            vertex = point + radii[i] * (0.62 * math.cos(theta) * normal + math.sin(theta) * binormal)
            vertices.append(tuple(vertex))
    for i in range(len(points) - 1):
        for side in range(sides):
            faces.append((start + i*sides + side,
                start + i*sides + (side + 1) % sides,
                start + (i + 1)*sides + (side + 1) % sides,
                start + (i + 1)*sides + side))
    faces.append(tuple(start + side for side in reversed(range(sides))))
    faces.append(tuple(start + (len(points) - 1)*sides + side for side in range(sides)))

mesh = bpy.data.meshes.new('HandlebarMustacheMesh')
mesh.from_pydata(vertices, [], faces)
mesh.update()
obj = bpy.data.objects.new(name, mesh)
bpy.context.scene.collection.objects.link(obj)
obj.parent = rig
obj.matrix_world = Matrix.Identity(4)
group = obj.vertex_groups.new(name='head')
group.add(list(range(len(vertices))), 1.0, 'REPLACE')
modifier = obj.modifiers.new('Follow head bone', 'ARMATURE')
modifier.object = rig
obj['codex_accessory'] = 'handlebar_mustache_v1'
obj['description'] = 'Separate thick dark-brown handlebar mustache with curled tips'
material = bpy.data.materials.get('Mustache dark brown hair') or bpy.data.materials.new('Mustache dark brown hair')
material.use_nodes = True
material.diffuse_color = (0.035, 0.020, 0.012, 1)
shader = material.node_tree.nodes.get('Principled BSDF')
shader.inputs['Base Color'].default_value = (0.035, 0.020, 0.012, 1)
shader.inputs['Metallic'].default_value = 0.0
shader.inputs['Roughness'].default_value = 0.9
mesh.materials.append(material)
for polygon in mesh.polygons:
    polygon.use_smooth = True
# Do not overwrite the user's existing .blend1 or other Blender backups.
bpy.context.preferences.filepaths.save_version = 0
bpy.context.scene.tool_settings.use_keyframe_insert_auto = False
bpy.ops.object.select_all(action='DESELECT')
obj.select_set(True)
bpy.context.view_layer.objects.active = obj
bpy.ops.wm.save_as_mainfile(filepath=str(source))
print('SAVED MUSTACHE', name, len(vertices), 'vertices', len(faces), 'faces', flush=True)
runpy.run_path(str(folder / 'export.py'), run_name='__main__')
print('MUSTACHE SOURCE AND GLB COMPLETE', flush=True)
