"""Adapt the owner-supplied Meshy LC100 for the beach game's rigid wheel rig.
Usage: blender -b --python adapt_meshy.py -- source.glb existing-rig.blend output-dir
The source file is read only. The exported .blend contains the final editable rig.
"""
import bpy,bmesh,math,json,sys
from mathutils import Vector,Matrix
from pathlib import Path
args=sys.argv[sys.argv.index('--')+1:];src,rig,out=args;out=Path(out);out.mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=src)
bodymesh=next(o for o in bpy.context.scene.objects if o.type=='MESH');bodymesh.name='Adapted Meshy LC100 shell';bpy.context.view_layer.objects.active=bodymesh
bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
original_tris=len(bodymesh.data.polygons)
# Cut the generated wheels and running boards before simplifying. Coordinates are
# the imported Blender frame: X longitudinal, Y across the truck, Z vertical.
bm=bmesh.new();bm.from_mesh(bodymesh.data)
remove=[]
for v in bm.verts:
 x,y,z=v.co;wheel=any(((x-c)/.196)**2+((z+.217)/.192)**2<1 for c in [-.587,.518]) and abs(y)>.212
 board=-.435<x<.367 and abs(y)>.262 and z<-.204
 flap=abs(y)>.255 and z<-.27
 if wheel or board or flap:remove.append(v)
bmesh.ops.delete(bm,geom=remove,context='VERTS')
bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.000003)
bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(bodymesh.data);bm.free()
# Progressive collapse retains the broad curved body and its UV-mapped details.
mod=bodymesh.modifiers.new('Game topology / approximately 60k triangles','DECIMATE');mod.ratio=min(1,60000/max(1,len(bodymesh.data.polygons)));mod.use_collapse_triangulate=True;bpy.ops.object.modifier_apply(modifier=mod.name)
# Soften scan noise without flattening the recognisable wheel arches and pillars.
sm=bodymesh.modifiers.new('Subtle surface cleanup','SMOOTH');sm.factor=.32;sm.iterations=2;bpy.ops.object.modifier_apply(modifier=sm.name)
for poly in bodymesh.data.polygons:poly.use_smooth=True
# Use restrained materials: imported roughness/specular maps exaggerate broken
# reflections. Keep the albedo for lamps, badges, panel lines and cabin detail.
mat=bodymesh.data.materials[0];mat.name='LC100 owner texture / enamel finish';nodes=mat.node_tree.nodes;links=mat.node_tree.links;bs=nodes.get('Principled BSDF')
for key,val in [('Metallic',.3),('Roughness',.38)]:
 for link in list(bs.inputs[key].links):links.remove(link)
 bs.inputs[key].default_value=val
for link in list(bs.inputs['Normal'].links):links.remove(link)
# Match the existing 2.85m wheelbase and +Y forward Blender rig.
scale=2.85/(.518+.587);center=(-.587+.518)/2
for v in bodymesh.data.vertices:
 x,y,z=v.co;v.co=(y*scale,(center-x)*scale-.005,(z+.393434)*scale+.025)
bodymesh.data.update()
# Append the proven mud-terrain wheel assemblies; keep the original body out.
with bpy.data.libraries.load(rig,link=False) as (a,b):b.objects=a.objects
keep=[]
for o in b.objects:
 if o is None:continue
 p=o;iswheel=False
 while p:
  if p.name.startswith(('Susp_','Steer_','Roll_')):iswheel=True;break
  p=p.parent
 if iswheel or o.name=='LC100_Root':keep.append(o)
for o in keep:bpy.context.collection.objects.link(o)
for o in b.objects:
 if o is not None and o not in keep:bpy.data.objects.remove(o,do_unlink=True)
root=next(o for o in keep if o.name=='LC100_Root')
body=bpy.data.objects.new('Body',None);bpy.context.collection.objects.link(body);body.parent=root;bodymesh.parent=body
# Apply economical one-segment bevels and combine each rigid wheel by material.
for roll in [o for o in keep if o.name.startswith('Roll_')]:
 meshes=[o for o in roll.children if o.type=='MESH']
 for ob in meshes:
  bpy.context.view_layer.objects.active=ob
  for m in list(ob.modifiers):
   if m.type=='BEVEL':m.segments=1
   if m.type=='WEIGHTED_NORMAL':ob.modifiers.remove(m)
   else:bpy.ops.object.modifier_apply(modifier=m.name)
 bymat={}
 for ob in meshes:bymat.setdefault(ob.data.materials[0].name,[]).append(ob)
 for name,group in bymat.items():
  bpy.ops.object.select_all(action='DESELECT')
  for ob in group:ob.select_set(True)
  bpy.context.view_layer.objects.active=group[0];bpy.ops.object.join();ob=bpy.context.object;ob.name=roll.name+' / '+name
# Four instances share each wheel material mesh instead of exporting duplicate geometry.
canonical={}
for roll in sorted([o for o in bpy.context.scene.objects if o.name.startswith('Roll_') and o.type=='EMPTY'],key=lambda o:o.name):
 for ob in roll.children:
  if ob.type!='MESH':continue
  key=ob.data.materials[0].name
  if key not in canonical:canonical[key]=ob
  else:ob.data=canonical[key].data;ob.matrix_basis=canonical[key].matrix_basis.copy()
# A dark underbody and inner wheel tubs close the spaces exposed by removing
# the source wheels and boards. They move with the chassis, never the wheels.
def material(name,c):
 m=bpy.data.materials.new(name);m.diffuse_color=(*c,1);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*c,1);p.inputs['Roughness'].default_value=.86;return m
trim=material('Underbody and arch liners',(.025,.034,.04))
def box(name,loc,size):
 bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.name=name;o.dimensions=size;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.parent=body;o.data.materials.append(trim);return o
box('Chassis behind open arches',(0,0,.55),(1.27,3.95,.20))
for cy in [1.42,-1.43]:
 box('Axle',(0,cy,.48),(1.82,.095,.10))
 for side in [-1,1]:
  vs=[];fs=[];n=24
  for x in [side*.71,side*.91]:
   for i in range(n+1):
    a=i*math.pi/n;vs.append((x,cy+math.cos(a)*.56,.48+math.sin(a)*.56))
  for i in range(n):fs.append((i,i+1,n+2+i,n+1+i))
  me=bpy.data.meshes.new('Arch liner');me.from_pydata(vs,[],fs);me.update();o=bpy.data.objects.new('Inner arch liner',me);bpy.context.collection.objects.link(o);o.parent=body;o.data.materials.append(trim)
# Only the adapted rig is part of the saved/exported scene.
bpy.ops.object.select_all(action='DESELECT')
for o in bpy.context.scene.objects:o.select_set(True)
root['source']='Owner-supplied Meshy Coastal Cruiser GLB';root['wheelbase_m']=2.85;root['wheel_radius_m']=.45;root['extra_spacer_per_side_m']=.032

# Keep only connected shader nodes and purge unused imported data from the .blend.
for m in bpy.data.materials:
 if not m.use_nodes:continue
 keep_nodes=set()
 def visit(node):
  if node in keep_nodes:return
  keep_nodes.add(node)
  for socket in node.inputs:
   for link in socket.links:visit(link.from_node)
 for node in m.node_tree.nodes:
  if node.type=='OUTPUT_MATERIAL':visit(node)
 for node in list(m.node_tree.nodes):
  if node not in keep_nodes:m.node_tree.nodes.remove(node)
bpy.ops.outliner.orphans_purge(do_recursive=True)
bpy.ops.wm.save_as_mainfile(filepath=str(out/'lc100-meshy-adapted.blend'),compress=True)
bpy.ops.export_scene.gltf(filepath=str(out/'lc100-meshy-adapted.glb'),export_format='GLB',use_selection=True,export_apply=True,export_yup=True,export_image_format='JPEG',export_jpeg_quality=88)
report={'source_triangles':original_tris,'body_triangles':sum(len(p.vertices)-2 for p in bodymesh.data.polygons),'scene_triangles':sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in bpy.context.scene.objects if o.type=='MESH'),'objects':len(bpy.context.scene.objects),'glb_bytes':(out/'lc100-meshy-adapted.glb').stat().st_size};(out/'report.json').write_text(json.dumps(report,indent=2));print(report)
# Review renders are not included in the export.
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=24;scene.cycles.use_denoising=True;scene.render.resolution_x=1280;scene.render.resolution_y=900;scene.render.resolution_percentage=100;scene.world.color=(.16,.16,.16);scene.view_settings.view_transform='AgX'
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.025));bpy.context.object.data.materials.append(material('Studio floor',(.08,.10,.11)))
for loc,power,size in [((3,4,7),1100,5),((-4,-2,5),800,4),((2,-5,6),1000,4)]:
 bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.data.energy=power;o.data.shape='DISK';o.data.size=size;o.rotation_euler=(Vector((0,0,1))-o.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add();cam=bpy.context.object;scene.camera=cam;cam.data.type='ORTHO';cam.data.ortho_scale=6.8
for name,loc in [('front',(6,7,4)),('rear',(6,-7,3.5)),('side',(7,0,2.3))]:
 cam.location=loc;cam.rotation_euler=(Vector((0,0,1))-cam.location).to_track_quat('-Z','Y').to_euler();scene.render.filepath=str(out/(name+'.png'));bpy.ops.render.render(write_still=True)
