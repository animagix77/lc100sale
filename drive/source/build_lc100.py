import bpy, math, os
from mathutils import Vector
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
def mat(name,color,metal=0,rough=.4):
 m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1);p.inputs['Metallic'].default_value=metal;p.inputs['Roughness'].default_value=rough;return m
paint=mat('Graphite metallic',(.24,.28,.29),.72,.27);glass=mat('Deep blue tinted glass',(.035,.085,.11),.65,.15);rubber=mat('KM3 rubber',(.022,.025,.026),0,.8);chrome=mat('Satin alloy',(.55,.59,.58),.85,.25);black=mat('Black trim',(.045,.05,.05),.1,.48);lamp=mat('Headlamp',(.92,.91,.73),.35,.16);red=mat('Tail lamp red',(.55,.035,.016),.25,.22);amber=mat('Amber signal',(.94,.38,.045),.3,.23);plate=mat('New Jersey plate',(.85,.65,.25),.1,.6)
def empty(name,parent=None,loc=(0,0,0)):
 o=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(o);o.parent=parent;o.location=loc;return o
root=empty('LC100_Root');body=empty('Body',root)
def cube(name,loc,size,material,parent=body,bevel=.04):
 bpy.ops.mesh.primitive_cube_add(size=1);o=bpy.context.object;o.name=name;o.dimensions=size;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.location=loc;o.parent=parent;o.data.materials.append(material)
 if bevel:
  b=o.modifiers.new('Rounded stamped edges','BEVEL');b.width=bevel;b.segments=3;bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=b.name)
 for p in o.data.polygons:p.use_smooth=True
 o.modifiers.new('Weighted corner normals','WEIGHTED_NORMAL');return o
# Real-world LC100 proportions: broad upright cabin, short hood, 2.85m wheelbase.
lower=cube('Lower body',(0,0,1.04),(1.91,4.78,.61),paint,bevel=.15)
for y in [1.42,-1.43]:
 bpy.ops.mesh.primitive_cylinder_add(vertices=48,radius=.55,depth=2.3,location=(0,y,.53),rotation=(0,math.pi/2,0));cut=bpy.context.object;bpy.context.view_layer.objects.active=lower;mod=lower.modifiers.new('Wheel arch','BOOLEAN');mod.operation='DIFFERENCE';mod.object=cut;bpy.ops.object.modifier_apply(modifier=mod.name);bpy.data.objects.remove(cut,do_unlink=True)
cube('Hood',(0,1.62,1.46),(1.84,1.48,.25),paint,bevel=.08)
cube('Cabin',(0,-.61,1.72),(1.85,3.38,1.03),paint,bevel=.16)
cube('Roof',(0,-.61,2.25),(1.72,3.14,.13),paint,bevel=.09)
# Front windscreen leans back towards roof.
w=cube('Windscreen',(0,1.052,1.89),(1.63,.038,.72),glass,bevel=.05);w.rotation_euler.x=math.radians(-17)
cube('Rear glass',(0,-2.313,1.9),(1.6,.04,.66),glass,bevel=.06)
for side in [-1,1]:
 for label,y,length in [('Front door',.43,.91),('Rear door',-.56,.91),('Cargo window',-1.57,.85)]:
  cube(label+' glass '+str(side),(side*.928,y,1.91),(.027,length,.59),glass,bevel=.045)
  if 'door' in label:
   cube(label+' seam '+str(side),(side*.963,y-length/2-.04,1.35),(.015,.014,.82),black,bevel=0)
   cube(label+' handle '+str(side),(side*.983,y-.25,1.52),(.065,.18,.045),chrome,bevel=.017)
 cube('Mirror '+str(side),(side*1.052,.94,1.73),(.28,.30,.18),paint,bevel=.045)
 cube('Body side moulding '+str(side),(side*.963,-.15,1.11),(.035,4.13,.095),paint,bevel=.025)
 cube('Roof rail '+str(side),(side*.64,-.45,2.38),(.065,2.68,.07),black,bevel=.028)
for y in [-1.25,.35]:cube('Malone crossbar',(0,y,2.43),(1.91,.09,.055),black,bevel=.02)
for y in [-2.39,2.39]:cube('Bumper '+str(y),(0,y,.91),(1.99,.22,.3),paint,bevel=.09)
cube('Grille surround',(0,2.395,1.37),(1.17,.07,.4),chrome,bevel=.045)
cube('Grille inset',(0,2.439,1.37),(1.08,.035,.32),black,bevel=.025)
for z in [1.26,1.35,1.44]:cube('Grille slat',(0,2.46,z),(1.03,.025,.018),chrome,bevel=.008)
for side in [-1,1]:
 cube('Headlight '+str(side),(side*.77,2.39,1.37),(.35,.075,.36),lamp,bevel=.045)
 cube('Indicator '+str(side),(side*.964,2.34,1.37),(.035,.20,.30),amber,bevel=.02)
 cube('Fog light '+str(side),(side*.71,2.51,.88),(.22,.04,.12),lamp,bevel=.025)
 cube('Tail light '+str(side),(side*.88,-2.34,1.30),(.20,.08,.49),red,bevel=.04)
 cube('Reverse lamp '+str(side),(side*.88,-2.387,1.35),(.17,.018,.085),lamp,bevel=.008)
cube('Rear plate',(0,-2.429,1.16),(.43,.018,.22),plate,bevel=.015)
cube('Front plate',(0,2.52,.91),(.41,.015,.21),plate,bevel=.015)
cube('Receiver hitch',(0,-2.58,.62),(.16,.26,.13),black,bevel=.02)
cube('Chassis',(0,0,.58),(1.15,4.3,.18),black,bevel=.04)
# Wheel rig: suspension translation, steer yaw, then independent X-axis roll.
for side,x in [('L',-.94),('R',.94)]:
 for end,y in [('F',1.42),('R',-1.43)]:
  s=empty('Susp_'+end+side,root,(x,y,.53));st=empty('Steer_'+end+side,s);roll=empty('Roll_'+end+side,st)
  bpy.ops.mesh.primitive_torus_add(major_radius=.35,minor_radius=.13,major_segments=40,minor_segments=12,location=(0,0,0),rotation=(0,math.pi/2,0));o=bpy.context.object;o.name='KM3_tire_'+end+side;o.parent=roll;o.data.materials.append(rubber)
  for p in o.data.polygons:p.use_smooth=True
  for i in range(24):
   a=i*math.tau/24
   for lane in [-1,1]:
    b=cube('Tread lug',(lane*.075,math.sin(a)*.465,math.cos(a)*.465),(.11,.105,.048),rubber,roll,bevel=.01);b.rotation_euler.x=-a
  for out in [-1,1]:
   bpy.ops.mesh.primitive_cylinder_add(vertices=32,radius=.255,depth=.022,location=(out*.12,0,0),rotation=(0,math.pi/2,0));o=bpy.context.object;o.parent=roll;o.name='Alloy hub';o.data.materials.append(chrome)
   bpy.ops.mesh.primitive_cylinder_add(vertices=32,radius=.207,depth=.024,location=(out*.135,0,0),rotation=(0,math.pi/2,0));o=bpy.context.object;o.parent=roll;o.data.materials.append(black)
   for i in range(5):
    a=i*math.tau/5;b=cube('Five spoke',(out*.152,math.sin(a)*.13,math.cos(a)*.13),(.035,.07,.20),chrome,roll,.015);b.rotation_euler.x=-a
   bpy.ops.mesh.primitive_cylinder_add(vertices=20,radius=.066,depth=.04,location=(out*.16,0,0),rotation=(0,math.pi/2,0));o=bpy.context.object;o.parent=roll;o.data.materials.append(chrome)
# Labels add the recognizable rear badge without textures.
def text(name,string,loc,size,rot,material):
 c=bpy.data.curves.new(name,'FONT');c.body=string;c.align_x='CENTER';c.size=size;c.extrude=.001;o=bpy.data.objects.new(name,c);bpy.context.collection.objects.link(o);o.location=loc;o.rotation_euler=rot;o.parent=body;c.materials.append(material)
text('Rear badge','LAND CRUISER',(0,-2.429,1.52),.09,(math.pi/2,0,0),chrome)
# Bake modifiers, convert text, export with named rigid pivots intact.
bpy.ops.object.select_all(action='DESELECT')
for o in list(bpy.data.objects):
 if o.type=='FONT':o.select_set(True);bpy.context.view_layer.objects.active=o;bpy.ops.object.convert(target='MESH');o.select_set(False)
bpy.ops.wm.save_as_mainfile(filepath='/tmp/lc100-beach-rig.blend',compress=True)
bpy.ops.export_scene.gltf(filepath='/tmp/lc100-beach-rig.glb',export_format='GLB',export_apply=True,export_yup=True)
print('LC100 rig exported')
