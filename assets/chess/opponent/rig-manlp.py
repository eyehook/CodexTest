"""Run with Blender --background --python rig-manlp.py. Keeps original untouched."""
import bpy
import math
from pathlib import Path
from mathutils import Vector, Matrix

source = Path(__file__).resolve().with_name('ManLP.blend')
output = source.with_name('ManLP-rigged.blend')
if output.exists():
    raise RuntimeError(f'Refusing to overwrite existing rig: {output}')
bpy.ops.wm.open_mainfile(filepath=str(source))
if any(o.type == 'ARMATURE' for o in bpy.context.scene.objects):
    raise RuntimeError('Source already contains an armature; inspect it before adding another.')
meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
def find(part, side=None):
    prefix = 'GEO-' + part + '_male_primitive_realistic'
    matches = [o for o in meshes if o.name.startswith(prefix) and (side is None or f'.{side}.' in o.name)]
    if len(matches) != 1:
        raise RuntimeError(f'Expected exactly one {part} {side}: {[o.name for o in matches]}')
    return matches[0]
def origin(obj):
    return obj.matrix_world.translation.copy()
# Capture evaluated rest positions to verify that binding does not change the model.
bpy.context.view_layer.update()
def evaluated_points(obj):
    evaluated = obj.evaluated_get(bpy.context.evaluated_depsgraph_get())
    mesh = evaluated.to_mesh()
    points = [evaluated.matrix_world @ v.co for v in mesh.vertices]
    evaluated.to_mesh_clear()
    return points
rest_points = {o.name: evaluated_points(o) for o in meshes}
armature = bpy.data.armatures.new('ManLP_Skeleton')
rig = bpy.data.objects.new('ManLP_Rig', armature)
bpy.context.scene.collection.objects.link(rig)
rig.show_in_front = True
armature.display_type = 'OCTAHEDRAL'
bpy.ops.object.select_all(action='DESELECT')
rig.select_set(True)
bpy.context.view_layer.objects.active = rig
bpy.ops.object.mode_set(mode='EDIT')
bindings = {}
def bone(name, head, tail, parent=None, deform=True):
    result = armature.edit_bones.new(name)
    result.head, result.tail = Vector(head), Vector(tail)
    if (result.tail - result.head).length < .001:
        raise RuntimeError(f'Degenerate bone: {name}')
    if parent:
        result.parent = armature.edit_bones[parent]
    result.use_deform = deform
    return result
bone('ROOT', (0,0,0), (0,0,.1), deform=False)
bone('pelvis', (0,0,.1), (0,0,.25), 'ROOT')
bone('spine', (0,0,.25), (0,0,.46), 'pelvis')
bone('chest', (0,0,.46), (0,.008,.60), 'spine')
bone('neck', (0,.008,.60), (0,-.024,.71), 'chest')
bone('head', (0,-.024,.71), (0,-.024,.895), 'neck')
for part, name in [('belly','spine'),('chest','chest'),('neck','neck'),('head','head')]:
    bindings[find(part).name] = name
joints = {}
for side in ['L','R']:
    shoulder = origin(find('shoulder',side))
    elbow = origin(find('arm_lower',side))
    wrist = origin(find('hand',side))
    fingers = [find(p,side) for p in ['finger_index','finger_middle','finger_ring','finger_pinky','thumb']]
    hand_end = sum((origin(o) for o in fingers[:4]), Vector()) / 4
    bone(f'clavicle.{side}', (0,.02,.54), shoulder, 'chest')
    bone(f'upper_arm.{side}', shoulder, elbow, f'clavicle.{side}')
    bone(f'forearm.{side}', elbow, wrist, f'upper_arm.{side}')
    bone(f'hand.{side}', wrist, hand_end, f'forearm.{side}')
    # Independent hand controllers sit exactly at wrists in the rest pose.
    bone(f'CTRL_hand.{side}', wrist, hand_end, 'ROOT', deform=False)
    direction = (wrist - shoulder).normalized()
    perpendicular = elbow - shoulder - direction * (elbow - shoulder).dot(direction)
    if perpendicular.length < .001:
        perpendicular = Vector((0,-1,0))
    pole = elbow + perpendicular.normalized() * .25
    bone(f'CTRL_elbow.{side}', pole, pole+Vector((0,0,.07)), 'ROOT', deform=False)
    joints[side] = (shoulder, elbow, wrist)
    for part,name in [('shoulder','clavicle'),('arm_upper','upper_arm'),('arm_lower','forearm'),('hand','hand')]:
        bindings[find(part,side).name] = f'{name}.{side}'
    bindings[find('ear',side).name] = 'head'
    for obj in fingers:
        start = origin(obj)
        points = [obj.matrix_world @ v.co for v in obj.data.vertices]
        tip = max(points, key=lambda p: (p-start).length_squared)
        name = obj.name.split('_male_')[0].removeprefix('GEO-') + '.' + side
        bone(name, start, tip, f'hand.{side}')
        bindings[obj.name] = name
unknown = [o.name for o in meshes if o.name not in bindings]
if unknown:
    raise RuntimeError(f'Unrecognized meshes (not bound): {unknown}')
bpy.ops.object.mode_set(mode='POSE')
constraints = {}
for side in ['L','R']:
    upper, lower = rig.pose.bones[f'upper_arm.{side}'], rig.pose.bones[f'forearm.{side}']
    upper.ik_stretch = lower.ik_stretch = 0
    ik = lower.constraints.new('IK')
    ik.name = 'Hand reach — fixed arm lengths'
    ik.target = rig
    ik.subtarget = f'CTRL_hand.{side}'
    ik.pole_target = rig
    ik.pole_subtarget = f'CTRL_elbow.{side}'
    ik.chain_count = 2
    ik.use_stretch = False
    constraints[side] = ik
    hand_rotation = rig.pose.bones[f'hand.{side}'].constraints.new('COPY_ROTATION')
    hand_rotation.name = 'Hand orientation'
    hand_rotation.target = rig
    hand_rotation.subtarget = f'CTRL_hand.{side}'
    hand_rotation.target_space = 'POSE'
    hand_rotation.owner_space = 'POSE'
# Calibrate each pole angle against the original rest elbow, avoiding a twist on binding.
for side, ik in constraints.items():
    expected = joints[side][1]
    def error(angle):
        ik.pole_angle = angle
        bpy.context.view_layer.update()
        evaluated = rig.evaluated_get(bpy.context.evaluated_depsgraph_get())
        return (evaluated.pose.bones[f'forearm.{side}'].head-expected).length_squared
    best = min((2*math.pi*i/144-math.pi for i in range(144)), key=error)
    for step in [.01,.001,.0001,.00001]:
        best = min((max(-math.pi,min(math.pi,best+i*step)) for i in range(-5,6)), key=error)
    ik.pole_angle = best
bpy.ops.object.mode_set(mode='OBJECT')
for obj in meshes:
    world = obj.matrix_world.copy()
    obj.parent = rig
    obj.matrix_world = world
    group = obj.vertex_groups.new(name=bindings[obj.name])
    group.add(list(range(len(obj.data.vertices))), 1.0, 'REPLACE')
    modifier = obj.modifiers.new('ManLP Armature', 'ARMATURE')
    modifier.object = rig
    modifier.use_vertex_groups = True
bpy.context.view_layer.update()
max_error = 0
for obj in meshes:
    after = evaluated_points(obj)
    before = rest_points[obj.name]
    if len(after) != len(before):
        raise RuntimeError(f'Vertex count changed: {obj.name}')
    max_error = max(max_error, max(((a-b).length for a,b in zip(after,before)), default=0))
if max_error > .003:
    raise RuntimeError(f'Rest pose moved {max_error:.6f} m; not saving. Pole/weights require inspection.')
# Organize controls and deform bones for convenient editing.
for name in ['Controls','Deform']:
    if name not in armature.collections:
        armature.collections.new(name)
for b in armature.bones:
    control = b.name.startswith('CTRL_') or b.name == 'ROOT'
    armature.collections['Controls' if control else 'Deform'].assign(b)
    try:
        b.color.palette = 'THEME04' if control else 'DEFAULT'
    except Exception:
        pass
for b in armature.bones:
    rig.pose.bones[b.name].lock_scale = (True,True,True)
armature.bones.active = armature.bones['CTRL_hand.L']
notes = bpy.data.texts.new('ManLP RIG — READ ME')
notes.write('Pose Mode: move CTRL_hand.L / CTRL_hand.R to reach; rotate them to orient palms. Move CTRL_elbow.L / R to adjust elbow direction. Rotate spine/chest to lean, neck/head to look. ROOT moves the complete character. Arm IK uses two bones and disables stretching. Fingers have individually weighted bones. Each separate primitive is rigidly weighted to preserve its low-poly shape. No animations are baked. Source ManLP.blend is untouched. Runtime export/integration is a separate step.\n')
rig['source_file'] = str(source)
rig['rest_pose_max_error_m'] = max_error
rig['binding'] = 'One rigid deform bone per separate mesh part; two-bone arm IK, no stretch.'
# Open ready to pose, without adding keyframes or altering mesh geometry.
bpy.ops.object.mode_set(mode='POSE')
# Blender 5.2 moved pose selection from Bone to PoseBone.
for pose_bone in rig.pose.bones:
    selected = pose_bone.name.startswith('CTRL_hand')
    if hasattr(pose_bone, 'select'):
        pose_bone.select = selected
    elif hasattr(pose_bone.bone, 'select'):
        pose_bone.bone.select = selected
bpy.ops.wm.save_as_mainfile(filepath=str(output))
print(f'RIG SAVED: {output}')
print(f'VERIFIED: {len(meshes)} meshes bound, {len(armature.bones)} bones, rest drift {max_error:.8f} m')
for side,(shoulder,elbow,wrist) in joints.items():
    print(f'{side}: upper arm {(elbow-shoulder).length:.3f} m; forearm {(wrist-elbow).length:.3f} m')
