import bpy,json
from pathlib import Path
root=Path(__file__).resolve().parents[3]
bpy.ops.wm.open_mainfile(filepath=str(Path(__file__).with_name('chess-knight.blend')))
verts=[]; normals=[]
deps=bpy.context.evaluated_depsgraph_get()
for obj in bpy.context.scene.objects:
 if obj.type!='MESH' or obj.hide_render: continue
 ev=obj.evaluated_get(deps); mesh=ev.to_mesh(); mesh.calc_loop_triangles()
 matrix=obj.matrix_world; normalmatrix=matrix.to_3x3().inverted().transposed()
 for tri in mesh.loop_triangles:
  for vi in tri.vertices:
   v=matrix @ mesh.vertices[vi].co; n=(normalmatrix @ tri.normal).normalized()
   verts.extend([v.x,v.z,-v.y]); normals.extend([n.x,n.z,-n.y])
 ev.to_mesh_clear()
assert len(verts)>0
data={'positions':[round(v,8) for v in verts],'normals':[round(n,8) for n in normals]}
path=root/'projects/chess/src/KnightGeometry.mjs'
path.write_text('import * as THREE from "../../../shared/vendor/three-r180/three.module.js";\n// Exported from assets/chess/knight/chess-knight.blend. Metres, Y up.\nconst data = '+json.dumps(data,separators=(',',':'))+';\nexport function knightGeometry() {\n const geometry = new THREE.BufferGeometry();\n geometry.setAttribute("position", new THREE.Float32BufferAttribute(data.positions, 3));\n geometry.setAttribute("normal", new THREE.Float32BufferAttribute(data.normals, 3));\n geometry.computeBoundingBox();\n geometry.computeBoundingSphere();\n return geometry;\n}\n')
print('EXPORTED',len(verts)//9,'triangles',path)
