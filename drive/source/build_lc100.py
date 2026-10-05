import bpy, math
from mathutils import Vector
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
def mat(name,c,metal=0,rough=.5):
 m=bpy.data.materials.new(name);m.diffuse_color=(*c,1);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*c,1);p.inputs['Metallic'].default_value=metal;p.inputs['Roughness'].default_value=rough;return m
paint=mat('Graphite blue enamel',(.19,.255,.29),.3,.38);glass=mat('Blue black glazing',(.025,.065,.088),.08,.46);rubber=mat('All terrain rubber',(.027,.032,.038),0,.94);chrome=mat('Warm silver alloy',(.58,.63,.64),.55,.3);black=mat('Graphite trim',(.038,.049,.057),0,.65);lamp=mat('Headlamp ivory',(.91,.88,.69),.2,.25);red=mat('Tail lamp ruby',(.53,.055,.036),.15,.3);amber=mat('Amber signal',(.98,.43,.055),.1,.3);plate=mat('NJ warm plate',(.84,.65,.30),0,.6)
def empty(name,parent=None,loc=(0,0,0)):
 o=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(o);o.parent=parent;o.location=loc;return o
root=empty('LC100_Root');body=empty('Body',root)
def mesh(name,vs,fs,material,parent=body,smooth=True,bevel=0):
 me=bpy.data.meshes.new(name);me.from_pydata(vs,[],fs);me.update();o=bpy.data.objects.new(name,me);bpy.context.collection.objects.link(o);o.parent=parent;o.data.materials.append(material)
 if bevel:
  b=o.modifiers.new('Soft stamped panel edges','BEVEL');b.width=bevel;b.segments=3
 for p in me.polygons:p.use_smooth=smooth
 o.modifiers.new('Panel normals','WEIGHTED_NORMAL');return o
def cube(name,loc,size,m,parent=body,bevel=.025):
 bpy.ops.mesh.primitive_cube_add(size=1);o=bpy.context.object;o.name=name;o.dimensions=size;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.location=loc;o.parent=parent;o.data.materials.append(m)
 if bevel:b=o.modifiers.new('Soft edge','BEVEL');b.width=bevel;b.segments=3
 o.modifiers.new('Weighted normals','WEIGHTED_NORMAL');return o
def loft(name,stations,material,roof_factor=.93):
 # Stations (longitudinal Y, half-width, bottom, belt, top). Rounded octagonal cross sections.
 vs=[]
 for y,w,bot,belt,top in stations:
  vs.extend([(w*.87,y,bot),(w,y,bot+.12),(w,y,belt),(w*roof_factor,y,top-.025),(w*.72,y,top),(-w*.72,y,top),(-w*roof_factor,y,top-.025),(-w,y,belt),(-w,y,bot+.12),(-w*.87,y,bot)])
 fs=[tuple(reversed(range(10)))];n=len(stations)
 for j in range(n-1):
  for k in range(10):fs.append((j*10+k,j*10+(k+1)%10,(j+1)*10+(k+1)%10,(j+1)*10+k))
 fs.append(tuple(range((n-1)*10,n*10)));return mesh(name,vs,[tuple(reversed(f)) for f in fs],material,bevel=.028)
# 100-series sheet metal: broad curved shoulders, short nose and softened tail.
lower=loft('Continuous sculpted fenders and body',[(-2.36,.80,.70,1.27,1.37),(-2.25,.91,.67,1.35,1.43),(-1.96,.963,.67,1.39,1.44),(-.7,.966,.67,1.39,1.44),(.65,.963,.67,1.39,1.43),(1.64,.952,.67,1.30,1.36),(2.14,.92,.67,1.25,1.32),(2.34,.85,.73,1.20,1.27)],paint)
# Apply the bevel before cutting actual open wheel wells.
bpy.context.view_layer.objects.active=lower
for mod in list(lower.modifiers):bpy.ops.object.modifier_apply(modifier=mod.name)
for y in [1.42,-1.43]:
 bpy.ops.mesh.primitive_cylinder_add(vertices=64,radius=.545,depth=2.5,location=(0,y,.47),rotation=(0,math.pi/2,0));cut=bpy.context.object;bpy.context.view_layer.objects.active=lower;mod=lower.modifiers.new('Open wheel arch','BOOLEAN');mod.operation='DIFFERENCE';mod.object=cut;bpy.ops.object.modifier_apply(modifier=mod.name);bpy.data.objects.remove(cut,do_unlink=True)
# A separate tapered greenhouse. The A-pillar slopes into the hood; D-pillars sweep inward.
cabin=loft('Raked and rounded greenhouse',[(-2.30,.83,1.34,1.44,1.60),(-2.19,.885,1.34,1.44,1.87),(-2.03,.895,1.34,1.44,2.015),(-1.80,.90,1.34,1.44,2.06),(-.60,.90,1.34,1.44,2.08),(.40,.898,1.34,1.44,2.055),(.61,.91,1.34,1.44,1.94),(1.04,.92,1.34,1.44,1.44)],paint,roof_factor=.88)
# Side glass follows the tuck from belt line to roof rather than flat box faces.
def project_glass(o):
 # Project a dense glass patch outward along its own viewing axis, so curved D-pillars cannot clip it.
 bpy.context.view_layer.update();bpy.context.view_layer.objects.active=o
 for m in list(o.modifiers):o.modifiers.remove(m)
 tri=o.modifiers.new('Glass tessellation','TRIANGULATE');bpy.ops.object.modifier_apply(modifier=tri.name)
 sub=o.modifiers.new('Glass grid','SUBSURF');sub.subdivision_type='SIMPLE';sub.levels=3;bpy.ops.object.modifier_apply(modifier=sub.name)
 target=cabin.evaluated_get(bpy.context.evaluated_depsgraph_get())
 rear='rear glass' in o.name;front='windshield' in o.name
 for v in o.data.vertices:
  x,y,z=v.co
  if rear:origin=Vector((x,-5,z));direction=Vector((0,1,0));offset=Vector((0,-.025,0))
  elif front:origin=Vector((x,5,z));direction=Vector((0,-1,0));offset=Vector((0,.025,0))
  else:
   sign=1 if x>0 else -1;origin=Vector((sign*5,y,z));direction=Vector((-sign,0,0));offset=Vector((sign*.025,0,0))
  hit,pos,normal,index=target.ray_cast(origin,direction)
  if hit:v.co=pos+offset
 o.data.update()
 for f in o.data.polygons:f.use_smooth=True

def sidepatch(name,points,m,offset=.006):
 for s in [-1,1]:
  vs=[]
  for y,z in points:
   w=.922-(z-1.43)*.20
   if y<-1.95:w-=(-1.95-y)*.11
   vs.append((s*(w+offset),y,z))
  o=mesh(name+str(s),vs,[tuple(range(len(vs))) if s>0 else tuple(reversed(range(len(vs))))],m,bevel=0);project_glass(o)
sidepatch('Front door window',[(.94,1.47),(.48,1.98),(-.25,1.997),(-.28,1.47)],glass)
sidepatch('Rear door window',[(-.35,1.47),(-.33,1.995),(-1.18,1.99),(-1.30,1.475)],glass)
sidepatch('Rounded quarter glass',[(-1.38,1.48),(-1.27,1.978),(-1.91,1.952),(-2.025,1.88),(-2.17,1.52),(-2.10,1.48)],glass)
# Slightly bowed front and rear glass surfaces, with real rake.
def glazing(name,front=True):
 vs=[];fs=[];nx=12;ny=8
 for j in range(ny+1):
  v=j/ny
  for i in range(nx+1):
   u=-1+2*i/nx
   if front:z=1.47+v*.51;y=1.060-v*.43+.018*(1-u*u);w=.81-v*.045
   else:z=1.47+v*.45;y=-2.345+v*.18-.012*(1-u*u);w=.77-v*.05
   vs.append((u*w,y,z))
 for j in range(ny):
  for i in range(nx):a=j*(nx+1)+i;fs.append((a,a+1,a+nx+2,a+nx+1))
 o=mesh(name,vs,[tuple(reversed(f)) for f in fs] if front else fs,glass);project_glass(o)
glazing('Bowed windshield');glazing('Swept rear glass',False)
# Hood ridge and centre crown.
loft('Crowned hood',[ (.98,.87,1.34,1.40,1.465),(1.3,.9,1.30,1.40,1.46),(2.05,.875,1.26,1.33,1.38),(2.32,.79,1.23,1.26,1.29)],paint)
def curve(name,points,m,r=.012,parent=body):
 c=bpy.data.curves.new(name,'CURVE');c.dimensions='3D';c.bevel_depth=r;c.bevel_resolution=2;s=c.splines.new('POLY');s.points.add(len(points)-1)
 for p,v in zip(s.points,points):p.co=(*v,1)
 o=bpy.data.objects.new(name,c);bpy.context.collection.objects.link(o);o.parent=parent;c.materials.append(m);return o
for s in [-1,1]:
 for y in [1.42,-1.43]:
  pts=[(s*.972,y+math.cos(a)*.55,.47+math.sin(a)*.55) for a in [math.pi*i/32 for i in range(33)]];curve('Rolled arch lip',pts,paint,.025)
 for y in [-.30,-1.33]:curve('Door shutline',[(s*.929,y,1.47),(s*.97,y,1.29),(s*.968,y,.86)],black,.006)
 for y in [.03,-1.05]:
  cube('Handle recess',(s*.971,y,1.36),(.035,.25,.065),black,bevel=.028);cube('Rounded handle',(s*.99,y,1.372),(.038,.20,.031),paint,bevel=.014)
 cube('Side moulding',(s*.974,-.10,.87),(.035,2.38,.08),chrome,bevel=.027)
 cube('Rounded mirror',(s*1.055,.82,1.53),(.25,.26,.19),paint,bevel=.07)
 cube('Mirror glass',(s*1.06,.681,1.54),(.19,.015,.12),glass,bevel=.035)
 cube('Roof rail',(s*.655,-.59,2.105),(.045,2.33,.045),black,bevel=.019)
 # Rear D-pillar vent, an LC100 signature.
 for j in range(3):cube('D pillar vent',(s*.885,-2.14,1.61+j*.037),(.028,.17,.015),black,bevel=.008)
for y in [-1.37,.26]:cube('Malone crossbar',(0,y,2.16),(1.89,.075,.05),black,bevel=.019)
for y in [-2.30,2.31]:cube('Sculpted bumper',(0,y,.80),(1.95,.30,.31),paint,bevel=.12)
cube('Front lower intake',(0,2.463,.83),(.98,.017,.105),black,bevel=.027)
cube('Grille chrome surround',(0,2.361,1.165),(1.04,.07,.33),chrome,bevel=.055)
cube('Grille black',(0,2.406,1.168),(.965,.018,.261),black,bevel=.039)
for z in [1.08,1.17,1.25]:cube('Horizontal grille',(0,2.426,z),(.89,.022,.014),chrome,bevel=.006)
for s in [-1,1]:
 cube('Wraparound headlamp',(s*.721,2.333,1.174),(.405,.15,.303),lamp,bevel=.065)
 cube('Amber corner',(s*.919,2.25,1.186),(.065,.22,.235),amber,bevel=.024)
 cube('Fog lamp',(s*.716,2.474,.792),(.217,.032,.109),lamp,bevel=.036)
 # Tail lamps wrap the corners and use the characteristic stacked lenses.
 for z,h,m in [(1.055,.15,red),(1.205,.085,lamp),(1.315,.085,red),(1.40,.055,lamp)]:
  cube('Rear stacked lens',(s*.826,-2.287,z),(.226,.13,h),m,bevel=.026)
curve('Rear wiper',[(.01,-2.332,1.495),(.44,-2.24,1.655)],black,.015)
cube('Tailgate seam',(0,-2.41,.98),(1.46,.015,.009),black,bevel=0)
cube('Tailgate plate recess',(0,-2.395,1.167),(.55,.035,.30),black,bevel=.052)
cube('Rear number plate',(0,-2.42,1.17),(.41,.018,.21),plate,bevel=.012)
cube('Front number plate',(0,2.485,.79),(.41,.013,.20),plate,bevel=.012)
cube('Chassis',(0,0,.51),(1.07,4.10,.14),black,bevel=.025)
cube('Hitch receiver',(0,-2.51,.57),(.13,.23,.13),black,bevel=.015)
# Radius .45, widened mud-terrain casing, +.032m spacer offset per side, 2.85m wheelbase. Independent rigid wheel pivots for the physics rig.
for side,x in [('L',-.962),('R',.962)]:
 for end,y in [('F',1.42),('R',-1.43)]:
  s=empty('Susp_'+end+side,root,(x,y,.48));st=empty('Steer_'+end+side,s);roll=empty('Roll_'+end+side,st)
  # Broad, square-shouldered mud-terrain casing with open tread channels.
  profile=[(-.155,.255),(-.164,.33),(-.155,.395),(-.128,.443),(.128,.443),(.155,.395),(.164,.33),(.155,.255)]
  vs=[];faces=[];segments=64
  for xx,rr in profile:
   for i in range(segments):
    a=i*math.tau/segments;vs.append((xx,math.sin(a)*rr,math.cos(a)*rr))
  for lane in range(len(profile)):
   for i in range(segments):faces.append((lane*segments+i,lane*segments+(i+1)%segments,((lane+1)%len(profile))*segments+(i+1)%segments,((lane+1)%len(profile))*segments+i))
  mesh('Wide mud-terrain casing '+end+side,vs,faces,rubber,roll)
  for i in range(28):
   for lane in [-1,0,1]:
    a=(i+(0.35 if lane==0 else .10*(i%2)))*math.tau/28
    b=cube('Staggered mud lug',(lane*.098,math.sin(a)*.448,math.cos(a)*.448),(.082,.083,.044),rubber,roll,.008);b.rotation_euler.x=-a;b.rotation_euler.z=(.23 if lane>=0 else -.23)
   for edge in [-1,1]:
    a=(i+.25)*math.tau/28;b=cube('Sidewall shoulder biter',(edge*.159,math.sin(a)*.392,math.cos(a)*.392),(.027,.059,.072),rubber,roll,.008);b.rotation_euler.x=-a
  for out in [-1,1]:
   for r,d,xoff,m in [(.255,.022,.155,chrome),(.212,.024,.17,black),(.071,.032,.19,chrome)]:
    bpy.ops.mesh.primitive_cylinder_add(vertices=32,radius=r,depth=d,location=(out*xoff,0,0),rotation=(0,math.pi/2,0));o=bpy.context.object;o.parent=roll;o.data.materials.append(m)
   for i in range(5):
    a=i*math.tau/5;b=cube('Five spoke alloy',(out*.188,math.sin(a)*.133,math.cos(a)*.133),(.036,.071,.19),chrome,roll,.016);b.rotation_euler.x=-a
# Rear lettering and oval Toyota emblems are geometry, not a generic SUV badge.
def badge(string,loc,size,rot):
 c=bpy.data.curves.new('Land Cruiser lettering','FONT');c.body=string;c.align_x='CENTER';c.size=size;c.extrude=.001
 o=bpy.data.objects.new('Land Cruiser lettering',c);bpy.context.collection.objects.link(o);o.parent=body;o.location=loc;o.rotation_euler=rot;c.materials.append(chrome)
badge('LAND CRUISER',(0,-2.413,1.355),.075,(math.pi/2,0,0))
for y,z in [(-2.367,1.47),(2.447,1.17)]:
 curve('Toyota oval',[(math.cos(a)*.095,y,z+math.sin(a)*.055) for a in [i*math.tau/32 for i in range(33)]],chrome,.009)
 curve('Toyota inner oval',[(math.cos(a)*.026,y-.002,z+math.sin(a)*.05) for a in [i*math.tau/24 for i in range(25)]],chrome,.006)
# Convert curves for a portable GLB, retain a named steering/suspension rig.
for o in list(bpy.data.objects):
 if o.type in ['CURVE','FONT']:bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o;bpy.ops.object.convert(target='MESH')
bpy.ops.wm.save_as_mainfile(filepath='/tmp/lc100-beach-rig.blend',compress=True)
bpy.ops.export_scene.gltf(filepath='/tmp/lc100-beach-rig.glb',export_format='GLB',export_apply=True,export_yup=True)
# Reference render: body proportions and all four corners are reviewable before integration.
bpy.ops.object.camera_add(location=(6,7,4));cam=bpy.context.object;cam.rotation_euler=(Vector((0,0,1.05))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=6.8;bpy.context.scene.camera=cam
bpy.ops.object.light_add(type='AREA',location=(2,4,7));bpy.context.object.data.energy=1200;bpy.context.object.data.shape='DISK';bpy.context.object.data.size=6
sc=bpy.context.scene;sc.render.engine='CYCLES';sc.cycles.samples=24;sc.world.color=(.23,.23,.23);sc.render.resolution_x=1000;sc.render.resolution_y=750;sc.render.resolution_percentage=100;sc.render.filepath='/tmp/lc100-model-v2.png';sc.render.image_settings.file_format='PNG';sc.render.film_transparent=True;bpy.ops.render.render(write_still=True)
cam.location=(6,-7,3.6);cam.rotation_euler=(Vector((0,0,1.05))-cam.location).to_track_quat('-Z','Y').to_euler();sc.render.filepath='/tmp/lc100-model-rear-v2.png';bpy.ops.render.render(write_still=True)
print('Rebuilt LC100 exported and rendered')
