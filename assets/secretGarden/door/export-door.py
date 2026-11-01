"""Blender --background edited.blend --python export-door.py -- /absolute/door-model.mjs
Parents the Heart to the leaf, saves the source, and exports the editable door only.
"""
import bpy,json,sys
from pathlib import Path
from mathutils import Matrix
leaf=bpy.data.objects['Door leaf'];heart=bpy.data.objects['Heart'];hinge=bpy.data.objects['Door hinge — rotate local Z to swing'];stile=bpy.data.objects['Fixed round hinge stile']
world=heart.matrix_world.copy();heart.parent=leaf;heart.matrix_world=world
roles={hinge:'hinge',leaf:'leaf',heart:'heart',stile:'hingeStile'}
for o in hinge.children:
    if o.name.startswith('Handle'):roles[o]='handle'
for o,role in roles.items():o['garden_door_role']=role
bpy.context.view_layer.update()
# Keep an explicit backup; do not overwrite an existing backup.
source=Path(bpy.data.filepath)
backup=source.with_name(source.stem+'-before-parenting.blend')
if not backup.exists():backup.write_bytes(source.read_bytes())
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(source))
# Blender Z-up -> Three Y-up, determinant +1 (preserves triangle winding).
C=Matrix(((1,0,0,0),(0,0,1,0),(0,-1,0,0),(0,0,0,1)))
Ci=C.inverted()
objects=[hinge,leaf,heart]+[o for o in hinge.children if roles.get(o)=='handle']+[stile]
index={o:i for i,o in enumerate(objects)}
materials=[];mat_ids={}
def material_id(mat):
    if mat.name in mat_ids:return mat_ids[mat.name]
    shader=next((n for n in mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED'),None) if mat.use_nodes else None
    color=list(shader.inputs['Base Color'].default_value) if shader else list(mat.diffuse_color)
    roughness=shader.inputs['Roughness'].default_value if shader else mat.roughness
    metallic=shader.inputs['Metallic'].default_value if shader else mat.metallic
    m={'name':mat.name,'color':color[:3],'opacity':color[3],'roughness':roughness,'metalness':metallic}
    if shader and 'Emission Color' in shader.inputs:
        m['emissive']=list(shader.inputs['Emission Color'].default_value)[:3];m['emissiveIntensity']=shader.inputs['Emission Strength'].default_value
    mat_ids[mat.name]=len(materials);materials.append(m);return mat_ids[mat.name]
nodes=[];deps=bpy.context.evaluated_depsgraph_get()
for obj in objects:
    parent=obj.parent if obj.parent in index else None
    matrix=parent.matrix_world.inverted()@obj.matrix_world if parent else obj.matrix_world
    matrix=C@matrix@Ci
    node={'name':obj.name,'role':roles[obj],'parent':index.get(parent),'matrix':[round(matrix[r][c],9) for c in range(4) for r in range(4)]}
    if obj.type=='MESH':
        evaluated=obj.evaluated_get(deps);mesh=evaluated.to_mesh();mesh.calc_loop_triangles()
        positions=[];normals=[];groups=[];ids=[material_id(m) for m in mesh.materials]
        for mat_index in sorted(set(t.material_index for t in mesh.loop_triangles)):
            start=len(positions)//3
            for triangle in mesh.loop_triangles:
                if triangle.material_index!=mat_index:continue
                for vertex_id,loop_id in zip(triangle.vertices,triangle.loops):
                    v=C.to_3x3()@mesh.vertices[vertex_id].co;n=C.to_3x3()@mesh.corner_normals[loop_id].vector
                    positions.extend(round(x,7) for x in v);normals.extend(round(x,7) for x in n)
            groups.append([start,len(positions)//3-start,mat_index])
        node.update(positions=positions,normals=normals,groups=groups,materials=ids)
        evaluated.to_mesh_clear()
    nodes.append(node)
output=Path(sys.argv[sys.argv.index('--')+1]);output.write_text('// Generated from secret-garden-door.blend by export-door.py. Do not edit by hand.\nexport const doorModel='+json.dumps({'materials':materials,'nodes':nodes},separators=(',',':'))+';\n')
print('EXPORTED_DOOR',len(nodes),'nodes',sum(len(n.get('positions',[]))//9 for n in nodes),'triangles')
