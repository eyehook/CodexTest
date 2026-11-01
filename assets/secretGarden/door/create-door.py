"""Run: Blender --background --python create-door.py -- /absolute/output.blend [preview.png]."""
import bpy, math, sys
from pathlib import Path
from mathutils import Vector, Quaternion
args=sys.argv[sys.argv.index('--')+1:]
output=Path(args[0]).resolve()
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
for c in list(bpy.data.collections):
    if c.name!='Collection':bpy.data.collections.remove(c)
scene=bpy.context.scene
scene.unit_settings.system='METRIC';scene.unit_settings.length_unit='METERS'
main=bpy.data.collections.get('Collection');main.name='Door — editable assembly'
trim=bpy.data.collections.new('Entrance trim — optional context');scene.collection.children.link(trim)
studio=bpy.data.collections.new('Preview — camera and lights');scene.collection.children.link(studio)
def move(obj,collection):
    for c in list(obj.users_collection):c.objects.unlink(obj)
    collection.objects.link(obj)
def material(name,hexcolor,roughness):
    m=bpy.data.materials.new(name);m.diffuse_color=(*hexcolor,1);m.use_nodes=True
    def linear(c):return c/12.92 if c<=.04045 else ((c+.055)/1.055)**2.4
    shader=m.node_tree.nodes.get('Principled BSDF');shader.inputs['Base Color'].default_value=(*(linear(c) for c in hexcolor),1);shader.inputs['Roughness'].default_value=roughness
    return m
def rgb(h):return tuple(int(h[i:i+2],16)/255 for i in (0,2,4))
wood=material('Door brown — #48392B',rgb('48392b'),.9)
brass=material('Handles — #B6A16C',rgb('b6a16c'),.5)
stone=material('Trim stone — #737B70',rgb('737b70'),1)
sillmat=material('Sill — #777469',rgb('777469'),1)
def box(name,dimensions,position,mat,collection=main,parent=None):
    bpy.ops.mesh.primitive_cube_add(size=1,location=position);o=bpy.context.object;o.name=name;o.dimensions=dimensions
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);move(o,collection);o.data.materials.append(mat)
    if parent:
        world=o.matrix_world.copy();o.parent=parent;o.matrix_world=world
    return o
width,height=1.09,2.22
bpy.ops.object.empty_add(type='PLAIN_AXES',location=(-width/2,0,0));hinge=bpy.context.object;hinge.name='Door hinge — rotate local Z to swing';move(hinge,main);hinge.empty_display_size=.15
hinge['Instructions']='Rotate Z by ±90 degrees to open. Leaf and handles are children. Fixed hinge stile is separate.'
leaf=box('Door leaf', (width,.055,height),(0,0,height/2),wood,parent=hinge)
leaf['Runtime dimensions']='1.09 m wide × 2.22 m tall × 0.055 m thick'
for sign,label in [(-1,'Garden side'),(1,'Room side')]:
    # Blender Y = -Three.js Z. Runtime handles are relative to the left hinge.
    box('Handle — '+label,(.05,.05,.05),(-width/2+width-.17,-sign*.0525,1.02),brass,parent=hinge)
bpy.ops.mesh.primitive_cylinder_add(vertices=12,radius=.032,depth=height,location=(-width/2,0,height/2))
stile=bpy.context.object;stile.name='Fixed round hinge stile';move(stile,main);stile.data.materials.append(wood)
# Entrance frame is at the garden facade, .9469 m in front of the actual door.
frame_y=.9469
for sign,label in [(-1,'Left'),(1,'Right')]:box('Entrance trim — '+label,(.14,.06,2.37),(sign*(1.15/2+.07),frame_y,(2.25-.12)/2),stone,trim)
box('Entrance trim — lintel',(1.43,.06,.14),(0,frame_y,2.32),stone,trim)
box('Entrance sill',(1.43,.12,.04),(0,frame_y+.006,-.008),sillmat,trim)
for o in trim.objects:o.hide_set(True);o.hide_render=True
notes=bpy.data.texts.new('READ ME — door editing')
notes.write('''Editable copy of Secret Garden procedural door, from garden-room.mjs and garden-layout.mjs.
Units: meters. Blender coordinates: X = Three.js X; Y = -Three.js Z; Z = Three.js Y.
Doorway midpoint at floor is (0,0,0); runtime position is (0,0,7.7724).
Leaf: 1.09 m wide, 2.22 m tall, 0.055 m thick. No bevels or topology changes added.
Rotate the Door hinge empty around Z to swing. Leaf and both handles follow it.
The round hinge stile stays fixed, matching the game.
Entrance trim context objects are hidden initially, individually unhide them in the Outliner if needed.
They are .9469 m in front of the door, matching the garden facade rather than a door-mounted frame.
Preview collection contains only camera and lights; exclude it from asset exports.
This file is an editable source asset. Saving it does not change the game; the runtime still builds its procedural door.
''')
# Camera and lighting for a quick review; not part of the model.
bpy.ops.object.camera_add(location=(2.7,4.1,2.7));camera=bpy.context.object;camera.name='Preview camera';move(camera,studio)
camera.rotation_euler=(Vector((0,0,1.1))-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.type='ORTHO';camera.data.ortho_scale=3.05;scene.camera=camera
for name,position,energy,size in [('Key',(1,3,4),450,4),('Fill',(-3,-2,3),300,3)]:
    bpy.ops.object.light_add(type='AREA',location=position);o=bpy.context.object;o.name=name;move(o,studio);o.data.energy=energy;o.data.shape='DISK';o.data.size=size;o.rotation_euler=(Vector((0,0,1))-o.location).to_track_quat('-Z','Y').to_euler()
scene.world.color=(.13,.13,.13)
scene.render.engine='CYCLES';scene.cycles.samples=24
scene.render.resolution_x=800;scene.render.resolution_y=800;scene.render.resolution_percentage=100
scene.view_settings.view_transform='Standard'
bpy.ops.object.select_all(action='DESELECT');leaf.select_set(True);bpy.context.view_layer.objects.active=leaf
for screen in bpy.data.screens:
    for area in screen.areas:
        if area.type=='VIEW_3D':
            area.spaces.active.region_3d.view_location=(0,0,1.1);area.spaces.active.region_3d.view_distance=3.6
            area.spaces.active.region_3d.view_rotation=camera.rotation_euler.to_quaternion();area.spaces.active.clip_start=.01
            area.spaces.active.shading.color_type='MATERIAL'
bpy.context.preferences.filepaths.save_version=0
output.parent.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=str(output))
assert leaf.parent==hinge and all(abs(a-b)<1e-5 for a,b in zip(leaf.dimensions,(width,.055,height)))
if len(args)>1:
    scene.render.filepath=str(Path(args[1]).resolve());bpy.ops.render.render(write_still=True)
print('DOOR_ASSET_OK',output)
