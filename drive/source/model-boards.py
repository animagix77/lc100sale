"""Original recovery-board game prop. Dimensions referenced from MAXTRAX MKII product page.
Blender axes: X width, Y length, Z up. Export converts to glTF Y up.
"""
import bpy, math, os, sys
from mathutils import Vector
OUT=sys.argv[sys.argv.index('--')+1] if '--' in sys.argv else os.path.dirname(os.path.abspath(__file__))
os.makedirs(OUT,exist_ok=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
mat=bpy.data.materials.new('Recovery orange');mat.diffuse_color=(1,.205,.014,1);mat.use_nodes=True
bs=mat.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(1,.205,.014,1);bs.inputs['Roughness'].default_value=.48
parts=[]
def box(name,loc,scale,bevel=.008):
 bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.name=name;o.dimensions=scale;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 if bevel:
  m=o.modifiers.new('Moulded edges','BEVEL');m.width=bevel;m.segments=2;bpy.ops.object.modifier_apply(modifier=m.name)
 o.data.materials.append(mat);parts.append(o);return o
# Tapered, shallow channel with thin shovel ramps at either end.
verts=[]
sections=[(-.575,.125,.003),(-.48,.165,.024),(.48,.165,.024),(.575,.125,.003)]
for y,w,h in sections:verts.extend([(-w,y,0),(w,y,0),(-w,y,h),(w,y,h)])
faces=[(0,2,3,1),(12,13,15,14)]
for n in range(3):
 a=n*4;b=a+4;faces.extend([(a,b,b+1,a+1),(a+2,a+3,b+3,b+2),(a,a+2,b+2,b),(a+1,b+1,b+3,a+3)])
mesh=bpy.data.meshes.new('Mould');mesh.from_pydata(verts,[],faces);mesh.update();base=bpy.data.objects.new('Traction board',mesh);bpy.context.collection.objects.link(base);base.data.materials.append(mat);parts.append(base)
# Three real hand openings down each edge, with a continuous outer grip rail.
for x in [-.135,.135]:
 for y in [-.32,0,.32]:
  bpy.ops.mesh.primitive_cube_add(size=1,location=(x,y,.02));cut=bpy.context.object;cut.dimensions=(.037,.135,.2);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
  bpy.context.view_layer.objects.active=base;m=base.modifiers.new('Handle opening','BOOLEAN');m.operation='DIFFERENCE';m.object=cut;bpy.ops.object.modifier_apply(modifier=m.name);bpy.data.objects.remove(cut,do_unlink=True)
for x in [-.095,.095]:box('Raised traction rail',(x,0,.029),(.018,.94,.025),.004)
for row in range(13):
 y=-.46+row*.076
 for col in range(3):
  x=(col-1)*.067
  bpy.ops.mesh.primitive_cone_add(vertices=4,radius1=.020,radius2=.011,depth=.024,location=(x,y,.04),rotation=(0,0,math.pi/4));o=bpy.context.object;o.name='Grip cleat';o.data.materials.append(mat);parts.append(o)
for y in [-.49,.49]:
 for x in [-.10,.10]:
  bpy.ops.mesh.primitive_torus_add(major_radius=.016,minor_radius=.004,major_segments=12,minor_segments=4,location=(x,y,.019));o=bpy.context.object;o.name='Mount eye';o.data.materials.append(mat);parts.append(o)
bpy.ops.object.select_all(action='DESELECT')
for o in parts:o.select_set(True)
bpy.context.view_layer.objects.active=base;bpy.ops.object.join();base.name='RecoveryBoard';bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
bpy.ops.wm.save_as_mainfile(filepath=OUT+'/traction-board.blend')
bpy.ops.export_scene.gltf(filepath=OUT+'/traction-board.glb',export_format='GLB',use_selection=True,export_apply=True)
print('BOARD',len(base.data.polygons),'polygons')
