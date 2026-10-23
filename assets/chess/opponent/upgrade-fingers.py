import bpy, bmesh
from pathlib import Path
from mathutils import Vector
folder=Path(__file__).resolve().parent
output=folder/'ManLP-articulated.blend'
if output.exists(): raise RuntimeError(f'Refusing to overwrite edited articulated rig: {output}')
bpy.ops.wm.open_mainfile(filepath=str(folder/'ManLP-rigged.blend'))
if bpy.context.object.mode!='OBJECT': bpy.ops.object.mode_set(mode='OBJECT')
rig=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
if any('_02' in b.name for b in rig.data.bones): raise RuntimeError('Already upgraded')
plans=[]
for b in rig.data.bones:
    if b.name.startswith(('finger_', 'thumb.')):
        mesh=next(o for o in bpy.context.scene.objects if o.type=='MESH' and o.vertex_groups.get(b.name))
        head=b.head_local.copy(); axis=(b.tail_local-head).normalized()
        length=max((rig.matrix_world.inverted()@mesh.matrix_world@v.co-head).dot(axis) for v in mesh.data.vertices)
        ratios=[0,.5,1] if b.name.startswith('thumb') else [0,.43,.76,1]
        plans.append((b.name,mesh,head,axis,length,ratios))
bpy.context.view_layer.objects.active=rig
rig.select_set(True)
bpy.ops.object.mode_set(mode='EDIT')
for name,mesh,head,axis,length,ratios in plans:
    original=rig.data.edit_bones[name]; parent=original.parent; roll=original.roll
    for i in range(len(ratios)-1):
        b=original if i==0 else rig.data.edit_bones.new(name.split('.')[0]+f'_{i+1:02d}.'+name.split('.')[1])
        b.head=head+axis*length*ratios[i]; b.tail=head+axis*length*ratios[i+1]; b.roll=roll
        b.parent=parent; b.use_connect=i>0; parent=b
bpy.ops.object.mode_set(mode='OBJECT')
for name,mesh,head,axis,length,ratios in plans:
    # Add cross sections at real knuckles; smooth weights bend the original surface.
    bm=bmesh.new(); bm.from_mesh(mesh.data)
    inv=mesh.matrix_world.inverted()@rig.matrix_world
    for ratio in ratios[1:-1]:
        bmesh.ops.bisect_plane(bm, geom=list(bm.verts)+list(bm.edges)+list(bm.faces), dist=1e-7, plane_co=inv@(head+axis*length*ratio), plane_no=(inv.to_3x3().inverted().transposed()@axis).normalized())
    bm.to_mesh(mesh.data); bm.free(); mesh.data.update()
    mesh.vertex_groups.clear()
    names=[name]+[name.split('.')[0]+f'_{i+1:02d}.'+name.split('.')[1] for i in range(1,len(ratios)-1)]
    groups=[mesh.vertex_groups.new(name=n) for n in names]
    for v in mesh.data.vertices:
        t=(rig.matrix_world.inverted()@mesh.matrix_world@v.co-head).dot(axis)/length
        weights=[0.0]*len(groups); weights[-1]=1
        for i,boundary in enumerate(ratios[1:-1]):
            width=.09
            if t<boundary+width:
                w=max(0,min(1,(t-boundary+width)/(2*width)))
                weights=[0.0]*len(groups); weights[i]=1-w; weights[i+1]=w; break
        for group,w in zip(groups,weights):
            if w>0: group.add([v.index],w,'REPLACE')
rig['finger_rig']='Three phalanges per finger, two per thumb; blended knuckle weights.'
bpy.ops.wm.save_as_mainfile(filepath=str(output))
print('ARTICULATED:',len(rig.data.bones),'bones')
