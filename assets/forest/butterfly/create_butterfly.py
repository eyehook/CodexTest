import bpy, math
from pathlib import Path
from mathutils import Vector
OUT=Path('/Users/mm/Documents/Codex/Quest/assets/butterfly')
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
def mat(name,color):
 m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True;m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(*color,1);m.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value=.65;return m
black=mat('Velvet charcoal',(.018,.012,.009));orange=mat('Amber orange',(.95,.25,.025));gold=mat('Golden inner wing',(1,.55,.07));cream=mat('Ivory spots',(.98,.91,.66))
parts=[]
def bind(obj,bone):
 g=obj.vertex_groups.new(name=bone);g.add(list(range(len(obj.data.vertices))),1,'REPLACE');parts.append(obj)
def polygon(name,coords,material,bone):
 # Convex panel fan, explicitly triangulated for consistent GLB export.
 center=tuple(sum(v[k] for v in coords)/len(coords) for k in range(3));verts=[center]+coords
 faces=[(0,i+1,(i+1)%len(coords)+1) for i in range(len(coords))]
 mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);mesh.update();obj=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(obj);obj.data.materials.append(material);bind(obj,bone)
def ellipsoid(name,pos,scale,material,bone):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=10,ring_count=6,location=pos);o=bpy.context.object;o.name=name;o.scale=scale;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(material);bind(o,bone)
for side in [-1,1]:
 suffix='L' if side<0 else 'R'
 for label,outline in [('Fore',[(.009,.025),(.035,.066),(.098,.102),(.145,.09),(.137,.055),(.1,.015),(.045,-.01)]),('Hind',[(.009,.015),(.047,.02),(.101,-.004),(.112,-.042),(.086,-.073),(.047,-.068),(.012,-.035)])]:
  bone=label+'.'+suffix;coords=[(side*x,y,0) for x,y in outline];polygon(label+' silhouette '+suffix,coords,black,bone)
  cx=sum(x for x,y in outline)/len(outline);cy=sum(y for x,y in outline)/len(outline)
  # Separated orange cells leave dark veins and a black outer margin on both sides.
  inner=[(cx+(x-cx)*.79,cy+(y-cy)*.79) for x,y in outline]
  for i in range(len(inner)):
   a=inner[i];b=inner[(i+1)%len(inner)];tri=[(cx,cy),a,b];tx=sum(x for x,y in tri)/3;ty=sum(y for x,y in tri)/3
   for z in [-.0003,.0003]:polygon('Wing cell',[(side*(tx+(x-tx)*.88),ty+(y-ty)*.88,z) for x,y in tri],orange if i%3 else gold,bone)
  for i in range(1,len(outline)-1):
   x,y=outline[i];x=cx+(x-cx)*.91;y=cy+(y-cy)*.91
   ellipsoid('Ivory border spot',(side*x,y,0),(.0024,.0032,.0007),cream,bone)
 for dx in [0]:
  # Antennae are tapered short segments weighted to the body.
  a=Vector((side*.004,.039,.003));b=Vector((side*(.018+dx),.073,.01));d=b-a
  bpy.ops.mesh.primitive_cone_add(vertices=6,radius1=.0009,radius2=.0004,depth=d.length,location=(a+b)/2);o=bpy.context.object;o.rotation_euler=d.to_track_quat('Z','Y').to_euler();o.data.materials.append(black);bind(o,'Root')
ellipsoid('Abdomen',(0,-.017,0),(.006,.035,.006),black,'Root');ellipsoid('Thorax',(0,.014,0),(.009,.017,.009),black,'Root');ellipsoid('Head',(0,.033,.002),(.007,.007,.007),black,'Root')
bpy.ops.object.select_all(action='DESELECT')
for o in parts:o.select_set(True)
bpy.context.view_layer.objects.active=parts[0];bpy.ops.object.join();mesh=bpy.context.object;mesh.name='Butterfly_mesh'
bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
arm=bpy.data.armatures.new('Butterfly_armature');rig=bpy.data.objects.new('Butterfly_Rig',arm);bpy.context.collection.objects.link(rig);bpy.context.view_layer.objects.active=rig;bpy.ops.object.mode_set(mode='EDIT')
root=arm.edit_bones.new('Root');root.head=(0,-.03,0);root.tail=(0,.03,0)
for side in [-1,1]:
 for label,y in [('Fore',.015),('Hind',-.018)]:
  b=arm.edit_bones.new(label+('.L' if side<0 else '.R'));b.head=(side*.007,y,0);b.tail=(side*.007,y+.025,0);b.parent=root
bpy.ops.object.mode_set(mode='OBJECT');mod=mesh.modifiers.new('Wing armature','ARMATURE');mod.object=rig;mesh.parent=rig;rig.show_in_front=True
scene=bpy.context.scene;scene.render.fps=30;scene.frame_start=1;scene.frame_end=25
for frame in range(1,26):
 t=(frame-1)/24*math.tau
 for bone in rig.pose.bones:
  if bone.name=='Root':continue
  side=-1 if bone.name.endswith('L') else 1
  phase=0 if bone.name.startswith('Fore') else -.16
  bone.rotation_mode='XYZ';bone.rotation_euler.y=side*(.15+1.05*math.cos(t+phase));bone.keyframe_insert(data_path='rotation_euler',frame=frame,group=bone.name)
rig.animation_data.action.name='Wing_Flap'
# Dense baked keys match endpoints; cyclic curves also loop in Blender past frame 25.
for layer in rig.animation_data.action.layers:
 for strip in layer.strips:
  for bag in strip.channelbags:
   for fc in bag.fcurves:
    fc.modifiers.new('CYCLES')
    for key in fc.keyframe_points:key.interpolation='LINEAR'
scene.frame_set(7)
bpy.ops.object.select_all(action='DESELECT');rig.select_set(True);mesh.select_set(True);bpy.context.view_layer.objects.active=rig
bpy.ops.export_scene.gltf(filepath='/Users/mm/Documents/Codex/Quest/site/butterflies/butterfly.glb',export_format='GLB',use_selection=True,export_animations=True,export_frame_range=True,export_force_sampling=True)
# Simple studio preview, kept out of the exported asset.
scene.world.color=(.16,.16,.16)
bpy.ops.object.camera_add(location=(.30,-.36,.48));cam=bpy.context.object;cam.rotation_euler=(Vector((0,.01,0))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=.39;scene.camera=cam
bpy.ops.object.light_add(type='AREA',location=(.1,-.1,.6));bpy.context.object.data.energy=20;bpy.context.object.data.shape='DISK';bpy.context.object.data.size=.5
scene.render.engine='CYCLES';scene.cycles.samples=24;scene.render.resolution_x=1000;scene.render.resolution_y=850;scene.render.resolution_percentage=100;scene.render.film_transparent=True
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'butterfly.blend'))
scene.render.filepath='/Users/mm/Documents/Codex/2026-10-11/files-pasted-by-the-user-we/outputs/butterfly-preview.png';bpy.ops.render.render(write_still=True)
print('BUTTERFLY_COMPLETE')
