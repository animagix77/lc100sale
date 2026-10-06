"""Append a telescoping front-right fender antenna to a copy of the production LC100 GLB.
Blender uses +Y forward / +Z up. Preserve the source, body texture, and wheel rig.
Usage: blender -b --factory-startup --python model-antenna.py -- input.glb output-dir
"""
import bpy,sys,math
from pathlib import Path
from mathutils import Vector
src,out=sys.argv[sys.argv.index('--')+1:];out=Path(out);out.mkdir(parents=True,exist_ok=True)
# The factory-startup scene contains only Blender defaults.
for o in list(bpy.context.scene.objects):bpy.data.objects.remove(o,do_unlink=True)
bpy.ops.import_scene.gltf(filepath=src)
root=bpy.data.objects.get('LC100_Root');assert root
assert not bpy.data.objects.get('RadioAntenna'),'Do not duplicate an existing antenna'
def mat(name,c,metal,rough):
 m=bpy.data.materials.new(name);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*c,1);p.inputs['Metallic'].default_value=metal;p.inputs['Roughness'].default_value=rough;return m
chrome=mat('Antenna brushed chrome',(.62,.68,.73),.92,.23);rubber=mat('Antenna rubber gasket',(.018,.023,.025),0,.82)
def group(name,loc,parent):
 o=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(o);o.parent=parent;o.location=loc;return o
antenna=group('RadioAntenna',(.855,.88,1.36),root)
def cylinder(name,radius,depth,z,parent,material):
 bpy.ops.mesh.primitive_cylinder_add(vertices=16,radius=radius,depth=depth);o=bpy.context.object;o.name=name;o.parent=parent;o.location=(0,0,z);o.data.materials.append(material)
 for p in o.data.polygons:p.use_smooth=True
 return o
cylinder('Antenna seal',.040,.025,0,antenna,rubber);cylinder('Antenna bezel',.031,.026,.018,antenna,chrome)
parent=antenna
for i,r in enumerate([.012,.009,.0065]):
 stage=group('Antenna_'+str(i+1),(0,0,-.29 if i==0 else 0),parent)
 cylinder('Chrome mast '+str(i+1),r,.30,.15,stage,chrome)
 cylinder('Mast collar '+str(i+1),r*1.17,.016,.293,stage,chrome)
 parent=stage
bpy.ops.mesh.primitive_uv_sphere_add(segments=12,ring_count=6,radius=.011);cap=bpy.context.object;cap.name='Antenna tip';cap.parent=parent;cap.location=(0,0,.308);cap.data.materials.append(chrome)
antenna['travel_m']=.83;antenna['reference']='100-series power antenna: right front fender, telescoping metal mast'
# Export only the truck, before creating the review scene.
bpy.ops.object.select_all(action='SELECT')
bpy.ops.wm.save_as_mainfile(filepath=str(out/'lc100-radio.blend'),compress=True)
bpy.ops.export_scene.gltf(filepath=str(out/'lc100-radio.glb'),export_format='GLB',use_selection=True,export_apply=True,export_yup=True,export_image_format='AUTO')
for i in range(3):bpy.data.objects['Antenna_'+str(i+1)].location.z=0 if i==0 else .27
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=24;scene.render.resolution_x=1100;scene.render.resolution_y=900;scene.render.resolution_percentage=100;scene.world.color=(.3,.3,.3)
bpy.ops.object.light_add(type='AREA',location=(3,4,7));bpy.context.object.data.energy=1100;bpy.context.object.data.shape='DISK';bpy.context.object.data.size=6
bpy.ops.object.camera_add(location=(5.5,6.5,3.6));cam=bpy.context.object;cam.rotation_euler=(Vector((.15,.25,1.3))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=6.5;scene.camera=cam;scene.render.filepath=str(out/'antenna-review.png');bpy.ops.render.render(write_still=True)
