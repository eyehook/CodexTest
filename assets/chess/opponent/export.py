import bpy
from pathlib import Path
folder = Path(__file__).resolve().parent
repo = folder.parents[2]
bpy.ops.wm.open_mainfile(filepath=str(folder / 'ManLP-articulated.blend'))
if bpy.context.object and bpy.context.object.mode != 'OBJECT':
    bpy.ops.object.mode_set(mode='OBJECT')
output = repo / 'projects/chess/assets/opponent/manlp.glb'
bpy.ops.export_scene.gltf(filepath=str(output), export_format='GLB',
    export_animations=False, export_yup=True, export_skins=True, export_def_bones=True)
print('EXPORTED', output)
