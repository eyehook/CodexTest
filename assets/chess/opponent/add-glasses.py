"""Add one head-skinned, frames-only wire glasses object to the active avatar.
Run from any directory with Blender --background --python /path/to/add-glasses.py.
Preserves existing Blender backup files; saves the active source and exports GLB.
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
name = 'GEO-wire_rim_glasses'
previous = bpy.data.objects.get(name)
if previous:
    if previous.get('codex_accessory') != 'wire_rim_frames_v1':
        raise RuntimeError('Refusing to replace an unrelated glasses object')
    bpy.data.objects.remove(previous, do_unlink=True)

def bounds(obj):
    points = [obj.matrix_world @ Vector(v) for v in obj.bound_box]
    return [min(p[i] for p in points) for i in range(3)], [max(p[i] for p in points) for i in range(3)]

eyes = [obj for obj in bpy.context.scene.objects if obj.type == 'MESH' and obj.name.startswith('GEO-eye_')]
assert len(eyes) == 2, 'Expected both original HeadLP eyes'
eyes.sort(key=lambda obj: (bounds(obj)[0][0] + bounds(obj)[1][0]) / 2)
eye_bounds = [bounds(obj) for obj in eyes]
z_center = sum((low[2] + high[2]) / 2 for low, high in eye_bounds) / 2
x_center = sum(abs((low[0] + high[0]) / 2) for low, high in eye_bounds) / 2 + 0.008
front = min(low[1] for low, high in eye_bounds)
rim_y = front - 0.010  # Move the rims 15 mm closer to the face.
rx, rz = 0.0275, 0.0235
radius = 0.0008
vertices, faces = [], []

def tube(points, wire_radius=radius, closed=False, sides=8):
    points = [Vector(point) for point in points]
    start = len(vertices)
    for i, point in enumerate(points):
        before = points[(i - 1) % len(points)] if closed or i else points[0]
        after = points[(i + 1) % len(points)] if closed or i + 1 < len(points) else points[-1]
        tangent = (after - before).normalized()
        reference = Vector((0, 0, 1)) if abs(tangent.z) < 0.9 else Vector((0, 1, 0))
        normal = tangent.cross(reference).normalized()
        binormal = tangent.cross(normal).normalized()
        for side in range(sides):
            theta = side * math.tau / sides
            v = point + wire_radius * (math.cos(theta) * normal + math.sin(theta) * binormal)
            vertices.append(tuple(v))
    links = len(points) if closed else len(points) - 1
    for i in range(links):
        j = (i + 1) % len(points)
        for side in range(sides):
            a = start + i * sides + side
            b = start + i * sides + (side + 1) % sides
            c = start + j * sides + (side + 1) % sides
            d = start + j * sides + side
            faces.append((a, b, c, d))
    if not closed:
        faces.append(tuple(start + side for side in reversed(range(sides))))
        faces.append(tuple(start + (len(points) - 1) * sides + side for side in range(sides)))

def smooth_path(control, steps=6):
    control = [Vector(v) for v in control]
    result = []
    for i in range(len(control) - 1):
        p0, p1 = control[max(0, i - 1)], control[i]
        p2, p3 = control[i + 1], control[min(len(control) - 1, i + 2)]
        for step in range(steps):
            t = step / steps
            result.append(tuple(0.5 * ((2 * p1) + (-p0 + p2) * t +
                (2 * p0 - 5 * p1 + 4 * p2 - p3) * t*t +
                (-p0 + 3 * p1 - 3 * p2 + p3) * t*t*t)))
    result.append(tuple(control[-1]))
    return result

# Oval rims, gently swept back toward the outside of the face.
for sign in [-1, 1]:
    points = []
    for i in range(64):
        theta = math.tau * i / 64
        x = sign * x_center + rx * math.cos(theta)
        y = rim_y + 0.008 * (abs(x) / (x_center + rx)) ** 2
        points.append((x, y, z_center + rz * math.sin(theta)))
    tube(points, closed=True)

# Arched bridge joins the upper inner parts of the two rims.
inner_x = x_center - rx * math.cos(0.32)
inner_z = z_center + rz * math.sin(0.32)
inner_y = rim_y + 0.008 * (inner_x / (x_center + rx)) ** 2
# Seat the bridge against the actual front surface of the nose bridge.
# Blender forward is -Y; put the back of the wire on the skin surface.
nose_bridge = next(obj for obj in bpy.context.scene.objects
    if obj.type == 'MESH' and obj.name.startswith('GEO-nose_bridge_'))
nose_bridge.data.calc_loop_triangles()
origin, direction = Vector((0, -1, inner_z + 0.005)), Vector((0, 1, 0))
hits = []
for triangle in nose_bridge.data.loop_triangles:
    a, b, c = [nose_bridge.matrix_world @ nose_bridge.data.vertices[i].co
        for i in triangle.vertices]
    hit = intersect_ray_tri(a, b, c, direction, origin, True)
    if hit is not None and hit.y >= origin.y:
        hits.append(hit.y)
if not hits:
    raise RuntimeError('Could not locate the nose bridge surface; source was not saved')
bridge_y = min(hits) - radius
tube(smooth_path([(-inner_x, inner_y, inner_z),
    (-inner_x * 0.55, bridge_y, inner_z + 0.005),
    (inner_x * 0.55, bridge_y, inner_z + 0.005),
    (inner_x, inner_y, inner_z)]))

# Temple wires extend along both sides and curl down behind the ears.
for sign in [-1, 1]:
    tube(smooth_path([(sign * (x_center + rx), rim_y + 0.008, z_center),
        (sign * 0.071, rim_y + 0.020, z_center + 0.002),
        (sign * 0.084, -0.090, z_center + 0.005),
        (sign * 0.0845, -0.037, z_center + 0.007),
        (sign * 0.0835, -0.010, z_center + 0.004),
        (sign * 0.0815, 0.009, z_center - 0.009),
        (sign * 0.080, 0.012, z_center - 0.023)]))

mesh = bpy.data.meshes.new('WireRimGlassesMesh')
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
obj['codex_accessory'] = 'wire_rim_frames_v1'
obj['description'] = 'Separate wire-rim glasses: two rims, bridge and temples; no lenses'
material = bpy.data.materials.get('Wire rim brushed silver') or bpy.data.materials.new('Wire rim brushed silver')
material.use_nodes = True
material.diffuse_color = (0.23, 0.27, 0.30, 1)
shader = material.node_tree.nodes.get('Principled BSDF')
shader.inputs['Base Color'].default_value = (0.23, 0.27, 0.30, 1)
shader.inputs['Metallic'].default_value = 0.65
shader.inputs['Roughness'].default_value = 0.32
obj.data.materials.append(material)
for polygon in mesh.polygons:
    polygon.use_smooth = True
# Keep Blender's existing .blend1 and user .blend2.blend backups untouched.
bpy.context.preferences.filepaths.save_version = 0
bpy.context.scene.tool_settings.use_keyframe_insert_auto = False
bpy.ops.object.select_all(action='DESELECT')
obj.select_set(True)
bpy.context.view_layer.objects.active = obj
bpy.ops.wm.save_as_mainfile(filepath=str(source))
print('SAVED FRAMES', name, len(vertices), 'vertices', len(faces), 'faces', flush=True)
runpy.run_path(str(folder / 'export.py'), run_name='__main__')
print('GLASSES SOURCE AND GLB COMPLETE', flush=True)
