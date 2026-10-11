// Judge Dean LLC — planted island groves and a weathered, grounded coastal wreck.
import * as THREE from 'three/webgpu';
import {attribute,uniform,positionLocal,positionWorld,vec3,sin,float,smoothstep,texture,uv,vec2,mix,cameraPosition,mx_noise_float} from 'three/tsl';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {baseHeight} from './terrain.mjs';
import {ISLANDS,COASTAL_CAMP,BARGE_SITE,islandProfile,coastalRouteDistance} from './coastal-islands.mjs';
import {applyStoneSurface,groundNormal} from './ground-materials.mjs';

const rand=(a,b=0)=>{const v=Math.sin(a*127.1+b*311.7+7.3)*43758.5453;return v-Math.floor(v)};
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const color=new THREE.Color(),up=new THREE.Vector3(0,1,0);
const paint=(g,hex)=>{color.set(hex);const a=new Float32Array(g.attributes.position.count*3);for(let i=0;i<a.length;i+=3){a[i]=color.r;a[i+1]=color.g;a[i+2]=color.b}g.setAttribute('color',new THREE.BufferAttribute(a,3));return g};
function combine(parts,{flex=false}={}){
 const clean=parts.map(g=>{
  const item=g.index?g.toNonIndexed():g;
  for(const key of Object.keys(item.attributes))if(!['position','normal','color','uv',...(flex?['islandFlex']:[])].includes(key))item.deleteAttribute(key);
  if(!item.attributes.uv)item.setAttribute('uv',new THREE.Float32BufferAttribute(new Float32Array(item.attributes.position.count*2),2));
  if(flex&&!item.attributes.islandFlex)item.setAttribute('islandFlex',new THREE.Float32BufferAttribute(new Float32Array(item.attributes.position.count),1));
  return item;
 });
 const result=mergeGeometries(clean);for(const g of new Set([...parts,...clean]))g.dispose();
 result.computeBoundingSphere();result.computeBoundingBox();return result;
}
function beam(a,b,r,hex,segments=7,ratio=.86){
 const p=new THREE.Vector3(...a),q=new THREE.Vector3(...b),g=new THREE.CylinderGeometry(r*ratio,r,p.distanceTo(q),segments,1);
 g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(up,q.clone().sub(p).normalize()));g.translate(...p.add(q).multiplyScalar(.5).toArray());return paint(g,hex);
}
const box=(x,y,z,w,h,d,hex)=>paint(new THREE.BoxGeometry(w,h,d).translate(x,y,z),hex);
function strip(points,widths,hex,{fold=.1,flex=0}={}){
 const positions=[],colors=[],uvs=[],indices=[],weights=[],c=new THREE.Color(hex);
 for(let j=0;j<points.length;j++){
  const p=points[j],before=points[Math.max(0,j-1)],after=points[Math.min(points.length-1,j+1)],dx=after[0]-before[0],dz=after[2]-before[2],n=Math.hypot(dx,dz)||1;
  for(let k=-1;k<=1;k++){
   const w=widths[j]*k,shade=k===0?1.1:.89;
   positions.push(p[0]-dz/n*w,p[1]+(k===0?widths[j]*fold:0),p[2]+dx/n*w);
   colors.push(c.r*shade,c.g*shade,c.b*shade);uvs.push((k+1)*.5,j/(points.length-1));weights.push(flex*(j/(points.length-1)));
  }
  if(j<points.length-1){const a=j*3;indices.push(a,a+3,a+1,a+1,a+3,a+4,a+1,a+4,a+2,a+2,a+4,a+5)}
 }
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));g.setAttribute('islandFlex',new THREE.Float32BufferAttribute(weights,1));g.setIndex(indices);g.computeVertexNormals();return g;
}

/** A continuous bent trunk, with integrated root flare and individual leaf scars. */
export function islandPalmTrunkGeometry({mobile=false}={}){
 const positions=[],uvs=[],colors=[],indices=[],rings=mobile?22:32,sides=mobile?9:12,c=new THREE.Color();
 for(let j=0;j<=rings;j++){
  const t=j/rings,y=t*7.2,cx=.85*t*t,cz=.22*Math.sin(t*2.1),radius=.145+.105*(1-t)+.19*Math.exp(-t*18),scar=(j%2===0?1.045:.975);
  for(let i=0;i<=sides;i++){
   const a=i/sides*Math.PI*2,r=radius*scar*(1+.045*Math.sin(i*2.4+j*.5));
   positions.push(cx+Math.cos(a)*r,y,cz+Math.sin(a)*r);uvs.push(i/sides,t*3);
   c.set(j%2===0?'#88765b':'#655b47').multiplyScalar(.90+rand(j,i)*.15);colors.push(c.r,c.g,c.b);
   if(j<rings&&i<sides){const at=j*(sides+1)+i;indices.push(at,at+sides+1,at+1,at+1,at+sides+1,at+sides+2)}
  }
 }
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.setIndex(indices);g.computeVertexNormals();g.computeBoundingSphere();g.computeBoundingBox();return g;
}

/** Separate folded leaflets follow curved rachises, leaving the crown porous. */
export function islandPalmCrownGeometry({mobile=false}={}){
 const parts=[],fronds=mobile?8:10,pairs=mobile?8:11,root=[.85,7.18,.19],greens=['#61783b','#789148','#526d36','#8c9c51','#687e3d'];
 for(let f=0;f<fronds;f++){
  const angle=f*2.399+.12,dx=Math.cos(angle),dz=Math.sin(angle),length=2.45+rand(f,3)*1.35,lift=.45+rand(f,4)*.7,droop=.85+rand(f,5)*1.1;
  const point=t=>[root[0]+dx*length*t,root[1]+lift*Math.sin(t*Math.PI*.88)-droop*t*t,root[2]+dz*length*t];
  const rachis=Array.from({length:mobile?6:8},(_,i)=>point(i/(mobile?5:7)));
  parts.push(strip(rachis,rachis.map((_,i)=>.035*(1-i/9)),f%4===0?'#b29d55':'#8e9b50',{fold:.65,flex:.15}));
  for(let j=0;j<pairs;j++){
   const t=.11+j/(pairs-1)*.84,p=point(t),lengthLeaf=(.33+Math.sin(t*Math.PI)*.62)*(1-.22*t),sweep=.10+.20*t;
   for(const side of [-1,1]){
    const leaf=[];
    for(let k=0;k<3;k++){const u=k/2,reach=lengthLeaf*u;leaf.push([p[0]-dz*side*reach+dx*sweep*u,p[1]+Math.sin(u*Math.PI)*.06-reach*.34,p[2]+dx*side*reach+dz*sweep*u]);}
    parts.push(strip(leaf,[.0357,.1309*(1-t*.32),.001],greens[(f+j)%greens.length],{fold:.28,flex:.28+t*.3}));
   }
  }
 }
 // Spear leaves, coconut stems and a few old fibres give the crown a readable heart.
 for(let i=0;i<3;i++){const a=i*2.6,dx=Math.cos(a),dz=Math.sin(a);parts.push(strip([root,[root[0]+dx*.18,7.85,root[2]+dz*.18],[root[0]+dx*.55,8.58,root[2]+dz*.55]],[.045,.09,.003],'#8d9e51',{flex:.2}));}
 for(let i=0;i<5;i++){
  const a=i*2.399,g=paint(new THREE.IcosahedronGeometry(.145,0),i%2?'#897244':'#687341');g.scale(.9,1.25,.85);g.translate(root[0]+Math.cos(a)*.28,6.98-rand(i,6)*.22,root[2]+Math.sin(a)*.28);parts.push(g);
 }
 return combine(parts,{flex:true});
}

function islandShrubGeometry(mobile){
 const parts=[],branches=mobile?5:7,tones=['#586a39','#748449','#839157','#476239'];
 for(let i=0;i<branches;i++){
  const a=i*2.399,dx=Math.cos(a),dz=Math.sin(a),tip=[dx*(.42+rand(i,10)*.25),.33+rand(i,12)*.52,dz*(.42+rand(i,11)*.25)];
  parts.push(beam([0,.03,0],tip,.025,'#807351',4));
  for(let j=0;j<(mobile?3:4);j++){
   const t=.32+j*.20,origin=[tip[0]*t,tip[1]*t,tip[2]*t],side=j%2?1:-1;
   const end=[origin[0]+dx*.13-dz*.26*side,origin[1]+.10,origin[2]+dz*.13+dx*.26*side];
   parts.push(strip([origin,[(origin[0]+end[0])*.5,origin[1]+.1,(origin[2]+end[2])*.5],end],[.005,.115,.003],tones[(i+j)%tones.length],{fold:.2,flex:.05}));
  }
 }
 return combine(parts,{flex:true});
}
function islandGrassGeometry(mobile){
 const parts=[];
 for(let i=0;i<(mobile?8:11);i++){
  const a=i*2.399,dx=Math.cos(a),dz=Math.sin(a),root=.03+rand(i,8)*.12,h=.30+rand(i,9)*.43,reach=.17+rand(i,10)*.32;
  parts.push(strip([[dx*root,0,dz*root],[dx*(root+reach*.25),h*.6,dz*(root+reach*.25)],[dx*(root+reach*.67),h,dz*(root+reach*.67)],[dx*(root+reach),h*.83,dz*(root+reach)]],[.018,.029,.020,.001],i%4===0?'#b8ac73':'#879559',{fold:.32,flex:.05}));
 }
 return combine(parts,{flex:true});
}
function islandRockGeometry(){
 const g=new THREE.IcosahedronGeometry(1,2),a=g.attributes.position;
 for(let i=0;i<a.count;i++){
  const x=a.getX(i),y=a.getY(i),z=a.getZ(i),fracture=1+.075*Math.sin(x*5+z*8)+.055*Math.cos(y*12-x*4);
  a.setXYZ(i,x*fracture,y*.55+.25+.05*Math.sin(z*8+x*4),z*(.80+.05*Math.cos(x*8)));
 }
 g.computeVertexNormals();paint(g,'#c2b7a0');g.computeBoundingSphere();g.computeBoundingBox();return g;
}
function islandLogGeometry(){
 return combine([
  beam([-1.7,.15,0],[-.4,.24,.14],.19,'#a99e83'),beam([-.4,.24,.14],[1.9,.14,-.18],.14,'#b1a78e'),
  beam([-.65,.19,.10],[-1.25,.65,.90],.08,'#8d826d'),beam([-.35,.21,.10],[.4,.46,.75],.08,'#a3967a'),
  beam([.55,.18,-.02],[.82,.22,-.55],.07,'#b9ae93'),beam([1.25,.15,-.11],[1.85,.36,.42],.05,'#9c917a')
 ]);
}

const hullStations=[[-12.5,2.5],[-10.2,4.6],[-5.5,5],[5.5,5],[10.2,4.65],[12.5,3.7]];
const hullWidth=z=>{for(let i=1;i<hullStations.length;i++)if(z<=hullStations[i][0]){const a=hullStations[i-1],b=hullStations[i],t=(z-a[0])/(b[0]-a[0]);return a[1]+(b[1]-a[1])*t}return 3.7};
function hullPanel(z0,z1,side,low,high,hex,offset=0){
 const width=(z,y)=>hullWidth(z)*(.80+clamp(y/2.8,0,1)*.20),p=[];
 for(const [z,y]of[[z0,low],[z1,low],[z1,high],[z0,high]])p.push(side*(width(z,y)+offset),y,z);
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setIndex(side===1?[0,1,2,0,2,3]:[0,2,1,0,3,2]);g.computeVertexNormals();return paint(g,hex);
}
/** Salvage detail stays original geometry; steel plates and actual window openings. */
export function islandBargeGeometry(){
 const hull=[],detail=[],rust=['#754c37','#986548','#6c4533','#af7850','#66514a'];
 for(const side of [-1,1]){
  for(let j=0;j<hullStations.length-1;j++){
   const z0=hullStations[j][0],z1=hullStations[j+1][0];
   hull.push(hullPanel(z0,z1,side,0,2.8,rust[(j+(side>0?2:0))%rust.length]));
   // Salt-green waterline, welded horizontal rubbing strakes, and exposed ribs.
   detail.push(hullPanel(z0,z1,side,.25,.66,'#4d5540',.008));
   for(const y of [1.10,2.60]){
    const x0=side*hullWidth(z0)*(.80+y/2.8*.20),x1=side*hullWidth(z1)*(.80+y/2.8*.20);
    detail.push(beam([x0,y,z0],[x1,y,z1],.065,'#654836',6));
   }
  }
  for(let z=-10;z<=10;z+=2.3){const x=side*hullWidth(z);detail.push(beam([x*.84,.6,z],[x,2.8,z],.055,'#503a2d',5));}
  for(let i=0;i<30;i++){
   const z=-10.8+rand(i,side+8)*22,y=.76+rand(i,13)*1.7,w=.08+rand(i,14)*.38,h=.15+rand(i,15)*.70;
   const patch=hullPanel(z-w,z+w,side,y-h*.5,y+h*.5,i%3===0?'#bc7950':'#593f31');
   const a=patch.attributes.position;for(let j=0;j<a.count;j++)a.setX(j,a.getX(j)+side*.012);detail.push(patch);
  }
 }
 // A grounded bottom and solid end plates, with an open cargo hold in between.
 hull.push(box(0,.13,0,7.2,.28,23,'#493a31'));
 for(const z of [-12.46,12.46])hull.push(box(0,1.38,z,hullWidth(z)*2,2.72,.18,'#7c533b'));
 for(const side of [-1,1])hull.push(box(side*4.38,2.68,.3,1.05,.20,19.5,'#6c5846'));
 hull.push(box(0,2.67,-9.85,7.6,.22,4.8,'#72604d'),box(0,2.62,10.3,7.7,.24,4.2,'#625340'));
 for(let z=-6.8;z<=7;z+=2.3)detail.push(box(0,.58,z,7.3,.22,.15,'#6c4734'));
 for(const x of [-2.65,0,2.65])detail.push(box(x,.48,.6,.15,.18,15.5,'#493c32'));
 // One collapsed deck plate and cargo remnants sit down inside the hold.
 const plate=box(-1.45,1.1,2.7,3.2,.10,5.1,'#7d654c');plate.rotateZ(-.13);plate.rotateX(.09);detail.push(plate);
 for(let i=0;i<6;i++){const g=paint(new THREE.CylinderGeometry(.43,.45,.93,10),i%3?'#82523a':'#485f58');g.rotateZ(i%2===0?.14:Math.PI/2);g.translate(-1.6+(i%3)*1.4,.97,2.7+Math.floor(i/3)*2.1);detail.push(g);}
 // Cabin walls have open windows, supported by a dark interior and small mullions.
 const cabinX=.15,cabinZ=-9.40,width=5.2,depth=3.1,bottom=2.75,winBottom=3.53,winTop=4.47,top=4.86;
 detail.push(box(cabinX,bottom+.36,cabinZ,width,.72,depth,'#8c9381'),box(cabinX,4.68,cabinZ,width,.40,depth,'#b0a58a'));
 for(const side of [-1,1]){
  const x=cabinX+side*width*.5;
  for(const z of [cabinZ-depth*.5,cabinZ,cabinZ+depth*.5])detail.push(box(x,4.0,z,.14,.96,.16,'#776e54'));
 }
 for(const z of [cabinZ-depth*.5,cabinZ+depth*.5])for(const x of [-2.1,-.70,.70,2.1])detail.push(box(cabinX+x,4.0,z,.10,.96,.13,'#5c6255'));
 detail.push(box(cabinX,top+.06,cabinZ,width+.48,.18,depth+.40,'#676e61'));
 detail.push(box(cabinX+.55,bottom+.23,cabinZ-.25,1.1,.45,.48,'#393f35'));
 const hatch=box(3.85,3.2,-8.2,.12,1.2,.92,'#546d61');hatch.rotateZ(.30);detail.push(hatch);
 // Fine metal edge rails are partially collapsed, without invisible solid walls.
 for(const side of [-1,1]){
  for(let z=-7.0;z<=9;z+=2.0){if(side===1&&z>1&&z<6)continue;const x=side*4.77;detail.push(beam([x,2.76,z],[x+side*.12,3.50,z+.08],.028,'#777360',5));}
  detail.push(beam([side*4.91,3.55,-7.0],[side*4.91,3.48,.8],.030,'#79735c',5),beam([side*4.91,3.48,6.6],[side*4.62,3.25,10],.028,'#71624a',5));
  for(const z of [-11.3,10.7])detail.push(beam([side*2.8,2.73,z],[side*2.8,3.08,z],.12,'#4c4640',8),beam([side*2.45,3.04,z],[side*3.16,3.04,z],.095,'#4d4136',8));
 }
 detail.push(beam([.2,4.98,-9.3],[.75,8.6,-9.15],.062,'#716348',7),beam([-.7,7.0,-9.2],[1.75,7.0,-9.2],.037,'#75664c',6),beam([.75,8.45,-9.15],[-2.4,3.3,-10.8],.010,'#695e49',4));
 detail.push(beam([2.2,2.9,-10],[2.2,5.82,-10],.19,'#564e3f',9),box(2.22,5.87,-10,.49,.13,.5,'#6c5640'));
 return {hull:combine(hull),detail:combine(detail),cabin:{winBottom,winTop,width,depth}};
}

function placementClear(x,z,radius,{soft=false}={}){
 if(Math.hypot(x-COASTAL_CAMP.x,z-COASTAL_CAMP.z)<COASTAL_CAMP.radius+8+radius)return false;
 if(coastalRouteDistance(x,z)<(soft?4.6:9)+radius)return false;
 // No trunk, shrub, log or rock may intersect the steel wreck's full footprint.
 const dx=x-BARGE_SITE.x,dz=z-BARGE_SITE.z,c=Math.cos(BARGE_SITE.yaw),s=Math.sin(BARGE_SITE.yaw),bx=dx*c-dz*s,bz=dx*s+dz*c;
 return Math.abs(bx)>BARGE_SITE.width*.5+radius+3||Math.abs(bz)>BARGE_SITE.length*.5+radius+3;
}

export class IslandScenery{
 constructor(scene,{mobile=false,reduced=false}={}){
  Object.assign(this,{scene,mobile,reduced});this.group=new THREE.Group();this.group.name='Coastal island scenery';scene.add(this.group);
  this.clock=uniform(0);this.wind=uniform(.5);this.anchor=uniform(new THREE.Vector2());this.origin=uniform(new THREE.Vector3());this.geometries=[];this.materials=[];this.meshes=[];this.placements=[];this.stats={palms:0,shrubs:0,grass:0,rocks:0,logs:0,wrecks:1};this.dummy=new THREE.Object3D();
  const standard=options=>{const m=new THREE.MeshStandardNodeMaterial(options);this.materials.push(m);return m};
  const make=(name,geometry,material,capacity,{solid=false,kind='rock'}={})=>{
   this.geometries.push(geometry);const mesh=new THREE.InstancedMesh(geometry,material,capacity);mesh.name=name;mesh.count=0;mesh.castShadow=solid;mesh.receiveShadow=true;mesh.userData.detailKey='coastal-islands-v1:'+name;mesh.userData.worldCoordinates=true;mesh.userData.obstacleKind=kind;this.group.add(mesh);this.meshes.push(mesh);return mesh;
  };
  const foliage=(geometry,near,far)=>{
   const m=standard({vertexColors:true,side:THREE.DoubleSide,roughness:.94,alphaHash:true});
   const f=attribute('islandFlex','float'),phase=attribute('islandPhase','float'),wave=sin(this.clock.mul(1.12).add(phase)).mul(.65).add(sin(this.clock.mul(2.08).add(phase.mul(1.7))).mul(.19));
   m.positionNode=positionLocal.add(vec3(wave.mul(f).mul(this.wind),wave.abs().mul(f).mul(-.07),wave.mul(f).mul(this.wind).mul(.35)));
   m.opacityNode=float(1).sub(smoothstep(near,far,positionWorld.xz.distance(this.anchor)));
   return m;
  };
  const palmCapacity=mobile?108:144,shrubCapacity=mobile?320:480,grassCapacity=mobile?780:1200;
  const trunks=islandPalmTrunkGeometry({mobile}),crown=islandPalmCrownGeometry({mobile});crown.setAttribute('islandPhase',new THREE.InstancedBufferAttribute(new Float32Array(palmCapacity),1));
  this.trunks=make('Island palm trunks',trunks,standard({vertexColors:true,roughness:.97}),palmCapacity,{solid:true,kind:'wood'});
  this.crowns=make('Island palm fronds',crown,foliage(crown,230,320),palmCapacity);this.crowns.castShadow=!mobile;
  const shrubs=islandShrubGeometry(mobile);shrubs.setAttribute('islandPhase',new THREE.InstancedBufferAttribute(new Float32Array(shrubCapacity),1));
  this.shrubs=make('Coastal broadleaf shrubs',shrubs,foliage(shrubs,80,120),shrubCapacity);
  const grass=islandGrassGeometry(mobile);grass.setAttribute('islandPhase',new THREE.InstancedBufferAttribute(new Float32Array(grassCapacity),1));
  this.grass=make('Island dune sedges',grass,foliage(grass,42,77),grassCapacity);
  this.rocks=make('Island limestone outcrops',islandRockGeometry(),standard({vertexColors:true,roughness:.90}),mobile?94:136,{solid:true});
  this.logs=make('Island driftwood',islandLogGeometry(),standard({vertexColors:true,roughness:1}),mobile?28:42,{solid:true,kind:'wood'});
  const barge=islandBargeGeometry(),steel=standard({vertexColors:true,roughness:.92,metalness:.20,side:THREE.DoubleSide});
  const steelWorld=positionWorld.add(this.origin),salt=mx_noise_float(steelWorld.mul(vec3(4.2,1.8,4.2))).mul(.5).add(.5),pitting=mx_noise_float(steelWorld.mul(25)).mul(.5).add(.5);
  steel.colorNode=mix(vec3(.74,.69,.60),vec3(1.13,1.08,.94),salt);steel.roughnessNode=salt.mul(.13).add(.84);
  steel.normalNode=groundNormal(pitting.mul(.004).mul(float(1).sub(smoothstep(8,35,cameraPosition.distance(positionWorld)))));
  this.wreckCollision=make('Stranded steel barge hull',barge.hull,steel,1,{solid:true,kind:'metal'});
  this.wreckDetail=make('Stranded steel barge fittings',barge.detail,steel,1);this.wreckDetail.castShadow=true;
  this.obstacleMeshes=[this.trunks,this.rocks,this.logs,this.wreckCollision];this.bargeCabin=barge.cabin;
  this._plant();this._placeWreck();
  for(const mesh of this.meshes){mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;mesh.computeBoundingBox();mesh.computeBoundingSphere();}
  this.group.visible=false;
 }
 _add(mesh,{x,z,y=baseHeight(x,z),yaw=0,sx=1,sy=sx,sz=sx,kind,tint,tilt=0,bank=0}){
  if(mesh.count>=mesh.instanceMatrix.count)return false;const index=mesh.count++,d=this.dummy;d.position.set(x,y,z);d.rotation.set(tilt,yaw,bank);d.scale.set(sx,sy,sz);d.updateMatrix();mesh.setMatrixAt(index,d.matrix);
  if(tint)mesh.setColorAt(index,new THREE.Color(tint));const phase=mesh.geometry.attributes.islandPhase;if(phase)phase.setX(index,x*.11+z*.17);
  if(kind)this.placements.push({kind,x,z,y,yaw,sx,sy,sz,index,mesh});return true;
 }
 _plant(){
  const palmTarget=this.trunks.instanceMatrix.count,shrubTarget=this.shrubs.instanceMatrix.count,grassTarget=this.grass.instanceMatrix.count;
  // Immutable, deterministic placement is built before driving. No vegetation
  // cells, geometry uploads or collision layouts are regenerated mid-route.
  for(let attempt=0;attempt<7000&&this.trunks.count<palmTarget;attempt++){
   const island=ISLANDS[attempt%ISLANDS.length],seed=attempt+1800,angle=rand(seed,1)*Math.PI*2,radius=Math.sqrt(rand(seed,2))*.87;
   const x=island.x+Math.cos(angle)*island.rx*radius,z=island.z+Math.sin(angle)*island.rz*radius,profile=islandProfile(x,z),y=baseHeight(x,z),scale=.78+rand(seed,3)*.56;
   if(y<1.10||profile.land<.6||profile.rock>.32||!placementClear(x,z,2.2)||this.placements.some(p=>p.kind==='palm'&&Math.hypot(p.x-x,p.z-z)<5.4))continue;
   const slope=Math.hypot(baseHeight(x+.5,z)-baseHeight(x-.5,z),baseHeight(x,z+.5)-baseHeight(x,z-.5));if(slope>.52)continue;
   // Mature groves mix several heights; leaning trunks generally follow sea wind.
   const yaw=-1.0+(rand(seed,4)-.5)*1.8,sy=scale*(.94+rand(seed,5)*.17),tint=rand(seed,6)>.7?'#e4d4aa':'#f2eee0';
   this._add(this.trunks,{x,z,y:y-.08,yaw,sx:scale,sy,kind:'palm',tint});
   // Widen only the crown, about its attachment to the curved trunk. Scaling
   // the full instance about ground level would detach it from the trunk tip.
   const spread=.90+rand(seed,7)*.34,dx=.85*scale*(1-spread),dz=.19*scale*(1-spread),c=Math.cos(yaw),s=Math.sin(yaw);
   this.placements[this.placements.length-1].crownSpread=spread;
   this._add(this.crowns,{x:x+dx*c+dz*s,z:z-dx*s+dz*c,y:y-.08,yaw,sx:scale*spread,sy,tint});
  }
  const palms=this.placements.filter(p=>p.kind==='palm');
  for(let attempt=0;attempt<3400&&(this.rocks.count<this.rocks.instanceMatrix.count||this.logs.count<this.logs.instanceMatrix.count);attempt++){
   const island=ISLANDS[attempt%ISLANDS.length],seed=attempt+41000,angle=rand(seed,1)*Math.PI*2,radius=.62+rand(seed,2)*.48;
   const x=island.x+Math.cos(angle)*island.rx*radius,z=island.z+Math.sin(angle)*island.rz*radius,y=baseHeight(x,z),profile=islandProfile(x,z),log=attempt%5===0;
   const scale=log?.65+rand(seed,4)*.50:1.35+rand(seed,4)*2.10,sz=log?scale:scale*(.75+rand(seed,6)*.60),footprint=log?scale*2.2:Math.max(scale*1.18,sz*.90);
   if(y<.12||profile.land<.14||!placementClear(x,z,log?scale*2.1:scale*1.1))continue;
   if(palms.some(p=>Math.hypot(p.x-x,p.z-z)<footprint+.90))continue;
   if(log){if(y>2.7)continue;this._add(this.logs,{x,z,y:y-.045,yaw:rand(seed,3)*Math.PI*2,sx:scale,kind:'log'});}
   else{
    // Buried, flat shoulders make outcrops grow out of the beach, rather than
    // balancing uniform pebbles on top. Lower rocks are darkened by the tide.
    const sy=scale*(.60+rand(seed,5)*.62);this._add(this.rocks,{x,z,y:y-.23*sy,yaw:rand(seed,3)*Math.PI*2,sx:scale,sy,sz,kind:'rock',tint:y<.8?'#7e8979':rand(seed,7)>.5?'#c5b89e':'#afad96'});
   }
  }
  // Populate soil around established outcrops, rather than letting dense tufts
  // grow through rock surfaces. The small exposed sand collar anchors each rock.
  const rocks=this.placements.filter(p=>p.kind==='rock');
  for(let attempt=0;attempt<14000&&(this.shrubs.count<shrubTarget||this.grass.count<grassTarget);attempt++){
   const island=ISLANDS[attempt%ISLANDS.length],seed=attempt+23000,angle=rand(seed,1)*Math.PI*2,radius=Math.sqrt(rand(seed,2))*.98;
   const x=island.x+Math.cos(angle)*island.rx*radius,z=island.z+Math.sin(angle)*island.rz*radius,y=baseHeight(x,z),profile=islandProfile(x,z);
   if(y<.73||profile.land<.37||profile.rock>.28||!placementClear(x,z,.75,{soft:true}))continue;
   const patch=Math.sin(x*.15+Math.sin(z*.07)*2)+Math.sin(z*.13+x*.04);if(patch<-.75)continue;
   if(rocks.some(p=>{const dx=x-p.x,dz=z-p.z,c=Math.cos(p.yaw),s=Math.sin(p.yaw);return ((dx*c-dz*s)/(p.sx*1.18+.65))**2+((dx*s+dz*c)/(p.sz*.90+.65))**2<1}))continue;
   const shrub=attempt%3===0&&profile.land>.60&&this.shrubs.count<shrubTarget,mesh=shrub?this.shrubs:this.grass;
   const scale=shrub?.65+rand(seed,8)*.90:.62+rand(seed,8)*.73;
   this._add(mesh,{x,z,y:y-.035,yaw:rand(seed,5)*Math.PI*2,sx:scale,sy:scale*(.74+rand(seed,6)*.46),kind:shrub?'shrub':'grass',tint:rand(seed,7)>.72?'#c4b783':'#eff0cf'});
  }
  Object.assign(this.stats,{palms:this.trunks.count,shrubs:this.shrubs.count,grass:this.grass.count,rocks:this.rocks.count,logs:this.logs.count});
 }
 _placeWreck(){
  const {x,z,yaw}=BARGE_SITE,y=baseHeight(x,z)-.38,pose={x,z,y,yaw,tilt:.045,bank:.055};
  this._add(this.wreckCollision,{...pose,kind:'wreck'});this._add(this.wreckDetail,pose);this.wreckPose=pose;
 }
 setGroundTextures(maps){
  applyStoneSurface(this.rocks.material,maps,{scale:.42,strength:.035});
  if(!maps?.bark)return;
  const m=this.trunks.material,coords=uv().mul(vec2(.9,1.6)),albedo=texture(maps.bark.color,coords).rgb,data=texture(maps.bark.surface,coords).rgb;
  m.colorNode=albedo.mul(1.48);m.roughnessNode=data.g.mul(.16).add(.82);m.aoNode=mix(float(1),data.b,.25);
  m.normalNode=groundNormal(data.r.mul(.017).mul(float(1).sub(smoothstep(10,55,cameraPosition.distance(positionWorld)))));m.needsUpdate=true;
 }
 update(position,origin={x:0,z:0},time=0,weather={}){
  this.group.position.set(-origin.x,0,-origin.z);this.origin.value.set(origin.x,0,origin.z);this.anchor.value.set(position.x-origin.x,position.z-origin.z);
  this.clock.value=this.reduced?0:time;this.wind.value=.32+clamp(weather.wind??.4,0,1)*.24;
  this.group.visible=position.x<80&&position.z<-55&&position.z>-560;
  this.group.updateMatrixWorld(true);
 }
 dispose(){
  this.group.removeFromParent();for(const g of new Set(this.geometries))g.dispose();for(const m of new Set(this.materials))m.dispose();for(const mesh of this.meshes)mesh.dispose();this.placements.length=0;
 }
}
