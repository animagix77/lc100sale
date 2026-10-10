import {canyonRockMask} from './canyon.mjs';
import {inRoadsideClearing as roadsideClearing} from './roadside-spots.mjs';
import {sceneryFade,stageSceneryArrival,syncSceneryFade,disposeSceneryFade} from './scenery-fade.mjs';
import {GrassTracks} from './grass-tracks.mjs';
import {routeSample,riverMask,riverZ,riverGreenery,riverApproach,CAMP} from './expedition.mjs';
import {riverRocksNear} from './river-rocks.mjs';
import {grassWindStrength} from './coastal-wind.mjs';
import * as THREE from 'three/webgpu';
import {positionLocal,attribute,uniform,sin,cos,vec3,float} from 'three/tsl';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {baseHeight,shore,noise,smooth,surfaceAt} from './terrain.mjs';
import {oceanHeight} from './ocean-height.mjs';
// Static procedural placement only; live grass crushing stays in GrassTracks.
const remembered=(cache,key,create,limit)=>{let value=cache.get(key);if(value!==undefined)return value;value=create();const fifo=cache.fifo??=[];if(cache.size>=limit){const at=cache.cursor??0;cache.delete(fifo[at]);fifo[at]=key;cache.cursor=(at+1)%limit}else fifo.push(key);cache.set(key,value);return value};
const inRoadsideClearing=(x,z,pad=0)=>roadsideClearing(x,z,pad)||Math.hypot(x-CAMP.x,z-CAMP.z)<CAMP.radius+pad;
const rand=(a,b=0)=>{const v=Math.sin(a*127.1+b*311.7)*43758.5453;return v-Math.floor(v)};
const paint=(g,hex)=>{const c=new THREE.Color(hex),a=new Float32Array(g.attributes.position.count*3);for(let i=0;i<a.length;i+=3){a[i]=c.r;a[i+1]=c.g;a[i+2]=c.b}g.setAttribute('color',new THREE.BufferAttribute(a,3));return g};
const combine=gs=>{const clean=gs.map(g=>{const a=g.index?g.toNonIndexed():g;for(const k of Object.keys(a.attributes))if(!['position','normal','color'].includes(k))a.deleteAttribute(k);return a});const out=mergeGeometries(clean);for(const g of new Set([...gs,...clean]))g.dispose();return out};
function beam(a,b,r,hex,segments=6,openEnded=false){const p=new THREE.Vector3(...a),q=new THREE.Vector3(...b),g=new THREE.CylinderGeometry(r*.72,r,p.distanceTo(q),segments,1,openEnded);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),q.clone().sub(p).normalize()));g.translate(...p.add(q).multiplyScalar(.5).toArray());return paint(g,hex)}
function box(x,y,z,w,h,d,hex){return paint(new THREE.BoxGeometry(w,h,d).translate(x,y,z),hex)}
function grassGeometry(){const positions=[],indices=[];for(let i=0;i<15;i++){const angle=i*2.399,height=.50+rand(i,8)*.65,lean=.18+rand(i,2)*.42,width=.065+rand(i,3)*.05,dx=Math.cos(angle),dz=Math.sin(angle),base=positions.length/3;for(let j=0;j<=4;j++){const t=j/4,w=width*(1-t)*.5;for(const side of [-1,1])positions.push(dx*(.10+lean*t*t)-dz*w*side,height*t,dz*(.10+lean*t*t)+dx*w*side);if(j<4){const a=base+j*2;indices.push(a,a+1,a+2,a+1,a+3,a+2)}}}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();return g}
function logGeometry(){return combine([beam([-1,.07,0],[.05,.16,.06],.15,'#a8957b'),beam([.05,.16,.06],[1.1,.11,-.12],.12,'#a8957b'),beam([-.12,.14,.05],[.55,.30,.70],.065,'#95816b'),beam([-.73,.10,.04],[-.93,.23,-.45],.05,'#95816b'),beam([.55,.30,.70],[.78,.24,.91],.035,'#95816b')])}
function wrackGeometry(){const gs=[];for(let i=0;i<8;i++){const g=new THREE.IcosahedronGeometry(.12+rand(i,19)*.10,0);g.scale(1,.25,.55);g.translate((rand(i,20)-.5)*.65,.025,(rand(i,21)-.5)*.4);gs.push(paint(g,i%3===0?'#b5ab91':'#665e42'))}return combine(gs)}

function woodlandCrownGeometry(mobile){
 const branch=(a,b,r,hex)=>beam(a,b,r,hex,4,true);
 const parts=[branch([0,4.3,0],[.12,6.7,.12],.16,'#685b43')];
 const foliage=['#6e854d','#88a25b','#567545','#94a765','#668348'];
 // Individual branch forks and overlapping leaf shelves give the trees open silhouettes.
 const count=mobile?9:12;
 for(let i=0;i<count;i++){
  const tier=Math.floor(i/3),angle=i*2.399+.5,radius=1.05+rand(i,36)*.7-tier*.13;
  const x=Math.cos(angle)*radius,z=Math.sin(angle)*radius,y=4.65+tier*.58+rand(i,38)*.32;
  const fork=[x*.56,y-.48,z*.56],tip=[x,y,z];
  parts.push(branch([.02,3.6+tier*.65,.03],fork,.075-tier*.009,'#655b44'));
  parts.push(branch(fork,tip,.047-tier*.005,'#746344'));
  const leaf=paint(new THREE.IcosahedronGeometry(.94+rand(i,40)*.24,0),foliage[i%foliage.length]);
  leaf.scale(1.1,.60+rand(i,41)*.18,.91);leaf.rotateY(angle);leaf.translate(x,y+.30,z);parts.push(leaf);
 }
 for(let i=0;i<3;i++){
  const leaf=paint(new THREE.IcosahedronGeometry(1.02-i*.10,1),foliage[(i+1)%foliage.length]);
  leaf.scale(1,.74,1);leaf.translate(i===1?.42:-.25,6.30+i*.48,i===2?.38:-.10);parts.push(leaf);
 }
 return combine(parts);
}
function fernGeometry(mobile){
 const positions=[],colors=[],indices=[],greens=['#527848','#81a55c','#668a4b'];
 const add=(v,c)=>{positions.push(...v);colors.push(c.r,c.g,c.b);return positions.length/3-1};
 const quad=(a,b,c,d,color)=>{const at=add(a,color);add(b,color);add(c,color);add(d,color);indices.push(at,at+1,at+2,at,at+2,at+3)};
 for(let f=0;f<(mobile?6:8);f++){
  const angle=f*2.399,length=.72+rand(f,45)*.38,height=.42+rand(f,46)*.38,dx=Math.cos(angle),dz=Math.sin(angle),color=new THREE.Color(greens[f%greens.length]);
  const point=t=>[dx*(.035+length*t),.035+height*Math.sin(t*Math.PI*.78),dz*(.035+length*t)];
  for(let j=0;j<5;j++){
   const a=point(j/5),b=point((j+1)/5),w=.012*(1-j*.12);
   quad([a[0]-dz*w,a[1],a[2]+dx*w],[a[0]+dz*w,a[1],a[2]-dx*w],[b[0]+dz*w*.7,b[1],b[2]-dx*w*.7],[b[0]-dz*w*.7,b[1],b[2]+dx*w*.7],color);
  }
  for(let j=0;j<5;j++){
   const t=.20+j*.16,root=point(t),width=Math.sin(t*Math.PI)*(.19+length*.13),reach=.06+length*.07;
   for(const side of [-1,1]){
    const tip=[root[0]-dz*width*side+dx*reach,root[1]-.025,root[2]+dx*width*side+dz*reach];
    const mid=[(root[0]+tip[0])*.5,(root[1]+tip[1])*.5+.025,(root[2]+tip[2])*.5],thickness=.065*(1-t*.65);
    quad(root,[mid[0]-dx*thickness,mid[1],mid[2]-dz*thickness],tip,[mid[0]+dx*thickness,mid[1],mid[2]+dz*thickness],color);
   }
  }
 }
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.setIndex(indices);g.computeVertexNormals();return g;
}

function boatGeometry(){
 const g=[],v=[],idx=[],stations=[[-5.7,.05,1.35],[-3.9,1.62,1.1],[1.8,1.75,1.1],[4.7,1.4,1.05]];
 for(const [z,w,top] of stations)v.push(-w,top,z,w,top,z,-w*.65,-.48,z,w*.65,-.48,z);
 for(let i=0;i<3;i++){const a=i*4,b=a+4;idx.push(a,b,a+2,b,b+2,a+2,a+1,a+3,b+1,b+1,a+3,b+3,a+2,b+2,a+3,b+2,b+3,a+3,a,a+1,b,a+1,b+1,b)}idx.push(12,14,13,13,14,15,0,2,1,1,2,3);
 const hull=new THREE.BufferGeometry();hull.setAttribute('position',new THREE.Float32BufferAttribute(v,3));hull.setIndex(idx);hull.computeVertexNormals();g.push(paint(hull,'#ddd0af'));
 g.push(box(0,.96,2.0,2.6,.16,4.5,'#606e6b'),box(0,1.85,-1.9,2.5,1.65,2.6,'#ddd0af'),box(0,2.80,-1.9,2.8,.20,2.9,'#ac6450'));
 // Dark wheelhouse glazing reads at a distance; working deck stays open astern.
 g.push(box(0,2.12,-3.22,2.1,.73,.04,'#273e4a'),box(-1.26,2.12,-1.9,.04,.73,1.9,'#273e4a'),box(1.26,2.12,-1.9,.04,.73,1.9,'#273e4a'));
 g.push(beam([0,2.85,-1.7],[0,5.9,-1.7],.055,'#423d41'),beam([-1.3,4.7,-1.7],[1.3,4.7,-1.7],.036,'#d9cdb2'),box(0,5.0,-1.7,1.1,.18,.18,'#ddd0af'));
 for(const side of [-1,1]){g.push(beam([side*1.3,1.15,.2],[side*3.1,4.5,2.3],.047,'#635b56'),beam([side*3.1,4.5,2.3],[side*1.3,1.2,4.4],.014,'#8b806d'),beam([side*1.43,1.1,.8],[side*1.43,1.95,.8],.037,'#ddd0af'),beam([side*1.40,1.95,.8],[side*1.2,1.85,4.5],.033,'#ddd0af'));const buoy=paint(new THREE.SphereGeometry(.26,8,5),'#ed854c');buoy.translate(side*1.7,.80,2.3);g.push(buoy)}
 g.push(box(-.55,1.28,2.8,.75,.5,.8,'#587379'),box(.48,1.23,3.2,.75,.4,.8,'#967751'));
 return combine(g);
}
function stagingMesh(mesh){
 const attributes={};for(const [name,a] of Object.entries(mesh.geometry.attributes))if(a.isInstancedBufferAttribute)attributes[name]=a.clone();
 return {count:0,instanceMatrix:mesh.instanceMatrix.clone(),instanceColor:mesh.instanceColor?.clone()??null,geometry:{attributes},
  setMatrixAt(i,m){m.toArray(this.instanceMatrix.array,i*16)},
  setColorAt(i,c){if(!this.instanceColor)this.instanceColor=new THREE.InstancedBufferAttribute(new Float32Array(mesh.instanceMatrix.count*3),3);c.toArray(this.instanceColor.array,i*3)}};
}
function commitMesh(mesh,staged){
 mesh.count=staged.count;mesh.instanceMatrix.array.set(staged.instanceMatrix.array);mesh.instanceMatrix.needsUpdate=true;
 if(staged.instanceColor){if(!mesh.instanceColor)mesh.setColorAt(0,new THREE.Color());mesh.instanceColor.array.set(staged.instanceColor.array);mesh.instanceColor.needsUpdate=true}
 for(const [name,a] of Object.entries(staged.geometry.attributes)){mesh.geometry.attributes[name].array.set(a.array);mesh.geometry.attributes[name].needsUpdate=true}
 syncSceneryFade(mesh);
}
const SCENERY_MESHES=['grass','logs','wrack','rocks','trunks','crowns','shrubs'];
export class BeachLife{
 constructor(scene,{mobile=false,reduced=false}={}){
  this.scene=scene;this.mobile=mobile;this.reduced=reduced;this.key='';this.placementCaches={grass:new Map(),woodland:new Map(),debris:new Map()};this.time=uniform(0);this.fadeAnchor=uniform(new THREE.Vector2());this.windStrength=uniform(.4);this.dummy=new THREE.Object3D();this.materials=[];this.geometries=[];this.stats={grass:0,logs:0,wrack:0,rocks:0,boats:5};
  const make=(geometry,material,count)=>{this.geometries.push(geometry);this.materials.push(material);const m=new THREE.InstancedMesh(geometry,material,count);m.frustumCulled=false;m.count=0;scene.add(m);return m};
  const geometry=grassGeometry(),grassMat=new THREE.MeshStandardNodeMaterial({color:'#ffffff',side:THREE.DoubleSide,roughness:1});
  const phase=attribute('windPhase','float'),height=attribute('position','vec3').y;
  const wind=sin(this.time.mul(1.15).sub(phase)).mul(.25).add(sin(this.time.mul(.48).sub(phase.mul(.43))).mul(.18)).add(sin(this.time.mul(2.7).add(phase.mul(2.1))).mul(.045));
  const bend=attribute('grassBend','vec3');
  // Orient gusts consistently in world space despite randomly rotated tufts.
  const yaw=attribute('grassYaw','float'),standing=float(1).sub(bend.y.mul(.98)),sway=wind.mul(this.windStrength).mul(height.pow(2)).mul(standing);
  grassMat.positionNode=positionLocal.add(vec3(bend.x.mul(height),bend.y.mul(height).mul(-.98),bend.z.mul(height))).add(vec3(sway.mul(cos(yaw).sub(sin(yaw).mul(.4))),sway.abs().mul(-.12),sway.mul(sin(yaw).add(cos(yaw).mul(.4)))));
  const capacity=mobile?14000:22000;this.tracks=new GrassTracks();this.grassData=[];this.bendAttribute=new THREE.InstancedBufferAttribute(new Float32Array(capacity*3),3);geometry.setAttribute('grassBend',this.bendAttribute);geometry.setAttribute('windPhase',new THREE.InstancedBufferAttribute(new Float32Array(capacity),1));geometry.setAttribute('grassYaw',new THREE.InstancedBufferAttribute(new Float32Array(capacity),1));
  this.grass=make(geometry,grassMat,capacity);
  this.logs=make(logGeometry(),new THREE.MeshStandardNodeMaterial({vertexColors:true,roughness:1}),180);
  this.wrack=make(wrackGeometry(),new THREE.MeshStandardNodeMaterial({vertexColors:true,roughness:1}),300);
  const rock=paint(new THREE.IcosahedronGeometry(.4,1).scale(1.4,.7,1).translate(0,.18,0),'#8c7e7b');this.rocks=make(rock,new THREE.MeshStandardNodeMaterial({vertexColors:true,roughness:.87,flatShading:false}),480);
  const treeCount=mobile?180:300;
  this.trunks=make(new THREE.CylinderGeometry(.16,.34,5.5,6).translate(0,2.75,0),new THREE.MeshStandardNodeMaterial({color:'#534d3d',roughness:1}),treeCount);
  const crowns=woodlandCrownGeometry(mobile);
  const leaves=new THREE.MeshStandardNodeMaterial({vertexColors:true,roughness:1});
  this.crowns=make(crowns,leaves,treeCount);this.crowns.castShadow=true;this.crowns.receiveShadow=true;this.trunks.castShadow=true;
  const fern=fernGeometry(mobile),fernCount=mobile?360:600,fernMat=new THREE.MeshStandardNodeMaterial({vertexColors:true,side:THREE.DoubleSide,roughness:1});
  // Custom positionNode runs after instancing: positionLocal includes bank elevation.
  // Bend from intrinsic blade height so roots stay planted at every world height.
  const fernHeight=attribute('position','vec3').y.sub(.035).max(0);
  const fernPhase=attribute('fernPhase','float'),fernYaw=attribute('fernYaw','float'),flutter=sin(this.time.mul(1.4).add(fernPhase)).mul(.075).add(sin(this.time.mul(2.4).sub(fernPhase)).mul(.025)).mul(fernHeight.pow(2)).mul(this.windStrength);
  fernMat.positionNode=positionLocal.add(vec3(flutter.mul(cos(fernYaw)),flutter.abs().mul(-.30),flutter.mul(sin(fernYaw))));
  fern.setAttribute('fernPhase',new THREE.InstancedBufferAttribute(new Float32Array(fernCount),1));fern.setAttribute('fernYaw',new THREE.InstancedBufferAttribute(new Float32Array(fernCount),1));
  this.shrubs=make(fern,fernMat,fernCount);this.shrubs.receiveShadow=true;
  for(const name of SCENERY_MESHES){const grass=name==='grass',small=name==='wrack'||name==='shrubs';sceneryFade(this[name],{anchor:this.fadeAnchor,clock:this.time,near:grass?30:small?34:58,far:grass?48:small?57:94,arrival:!grass,solidNear:name==='trunks'||name==='crowns'});}
  this.boats=[];const bg=boatGeometry(),bm=new THREE.MeshStandardNodeMaterial({vertexColors:true,roughness:.7});this.geometries.push(bg);this.materials.push(bm);
  for(let i=0;i<5;i++){const mesh=new THREE.Mesh(bg,bm);scene.add(mesh);this.boats.push({mesh,id:0,x:0,z:0})}
 }
 _key(p,origin){return `${Math.floor(p.x/32)},${Math.floor(p.z/32)},${origin.x},${origin.z}`}
 _begin(p,origin,key){
  const work=this._staging??Object.create(this);
  if(!this._staging){for(const name of SCENERY_MESHES)work[name]=stagingMesh(this[name]);work.bendAttribute=work.grass.geometry.attributes.grassBend;work.stats={};this._staging=work}
  const pool=work.grassData===this.grassData?this._previousGrass:work.grassData;
  work.grassData=pool??[];work.grassPool=work.grassData;work.grassBuckets=new Map();
  this._pending={key,work,iterator:this._build.call(work,{...p},{...origin},key)};
 }
 _commit(){
  const {work,key}=this._pending,old=this.key.split(',').map(Number),next=key.split(',').map(Number);for(const name of SCENERY_MESHES){stageSceneryArrival(this[name],work[name],this.reduced?-2:this.time.value,{x:old[2]||0,z:old[3]||0},{x:next[2],z:next[3]},!this.key);commitMesh(this[name],work[name]);}
  this._previousGrass=this.grassData;this.grassData=work.grassData;this.grassBuckets=work.grassBuckets;this.samples=work.samples;Object.assign(this.stats,work.stats);this.key=key;this._pending=null;this._bendFullUpload=true;
 }
 _rebase(key){
  if(!this.key)return false;const a=this.key.split(',').map(Number),b=key.split(',').map(Number);if(a[0]!==b[0]||a[1]!==b[1])return false;
  const dx=b[2]-a[2],dz=b[3]-a[3];for(const name of SCENERY_MESHES){const m=this[name],v=m.instanceMatrix.array;for(let i=0;i<m.count;i++){v[i*16+12]-=dx;v[i*16+14]-=dz}m.instanceMatrix.needsUpdate=true}
  this.key=key;this._pending=null;return true;
 }
 refresh(p,origin){
  const key=this._key(p,origin);if(key===this.key){this._pending=null;return}
  if(this._rebase(key))return;
  if(this._pending?.key!==key)this._begin(p,origin,key);
  while(!this._pending.iterator.next().done){}this._commit();
 }
 stream(p,origin,budgetMs=2){
  const key=this._key(p,origin);if(key===this.key){this._pending=null;return false}
  if(this._rebase(key))return true;
  // Finish nearby work even if a faster truck crosses another cell. Restarting
  // every boundary can starve a generation forever at 30 fps.
  if(this._pending?.key!==key){const queued=this._pending?.key.split(',').map(Number),target=key.split(',').map(Number);if(!queued||queued[2]!==target[2]||queued[3]!==target[3]||Math.max(Math.abs(queued[0]-target[0]),Math.abs(queued[1]-target[1]))>4)this._begin(p,origin,key);}
  const deadline=performance.now()+budgetMs;do{if(this._pending.iterator.next().done){this._commit();return true}}while(performance.now()<deadline);return false;
 }
 _grass(i,x,z,yaw){
  const g=this.grassPool[i]??{};Object.assign(g,{x,z,yaw,c:Math.cos(yaw),s:Math.sin(yaw),bx:0,by:0,bz:0,fresh:true});this.grassData[i]=g;
  const key=`${Math.floor(x/8)},${Math.floor(z/8)}`,bucket=this.grassBuckets.get(key)??[];bucket.push(i);this.grassBuckets.set(key,bucket);
 }
 *_build(p,origin,key){
  const cx=Math.floor(p.x/64),cz=Math.floor(p.z/64),centerX=Math.floor(p.x/32)*32+16,centerZ=Math.floor(p.z/32)*32+16;
  let gi=0,li=0,wi=0,ri=0,ti=0,si=0;const d=this.dummy,c=new THREE.Color();this.samples=[];
  // Fixed world cells prevent plants and driftwood reshuffling when new terrain arrives.
  for(let tz=cz-2;tz<=cz+2;tz++)for(let tx=cx-2;tx<=cx+2;tx++){
   const seed=tx*391+tz*977;
   for(let i=0;i<(this.mobile?380:700);i++){
    if(i%32===0)yield;
    const x=tx*64+rand(seed,i*3)*64,z=tz*64+rand(seed,i*3+1)*64,coast=x-shore(z),patch=noise(x*.085,z*.085);
    if(Math.hypot(x-centerX,z-centerZ)>76)continue;
    const place=remembered(this.placementCaches.grass,`b${tx},${tz},${i}`,()=>{if(inRoadsideClearing(x,z)||canyonRockMask(x,z)>.08)return null;const surface=surfaceAt(x,z),meadow=surface.grass>.22;if(meadow||coast<29||surface.riverApproach>.18||riverMask(x,z)>.05||surface.snow>.3||surface.mud>.4||coast>155||patch<.42||rand(seed,i*3+2)>smooth(28,43,coast)*.95)return null;return {meadow,y:baseHeight(x,z)}},40000);
    if(!place||gi>=Math.floor(this.grass.instanceMatrix.count*.30))continue;const {meadow}=place;
    d.position.set(x-origin.x,place.y-.025,z-origin.z);d.rotation.set(0,rand(seed,i+900)*6.28,0);const scale=meadow?1.05+rand(seed,i+700)*.65:.5+rand(seed,i+700)*.85;d.scale.set(meadow?1.5:scale,scale*(meadow?1.15:1),meadow?1.5:scale);d.updateMatrix();this.grass.setMatrixAt(gi,d.matrix);c.set(meadow?'#718e4b':'#819366').lerp(new THREE.Color(meadow?'#b1b774':'#c4ba87'),rand(seed,i+180));this.grass.setColorAt(gi,c);this.grass.geometry.attributes.windPhase.setX(gi,x*.14+z*.09);this.grass.geometry.attributes.grassYaw.setX(gi,d.rotation.y);this._grass(gi,x,z,d.rotation.y);this.bendAttribute.setXYZ(gi,0,0,0);gi++;
   }
   for(let i=0;i<24;i++){
    if(i%8===0)yield;
    const x=tx*64+rand(seed,i+1300)*64,z=tz*64+rand(seed,i+1500)*64,coast=x-shore(z);
    const place=remembered(this.placementCaches.debris,`${tx},${tz},${i}`,()=>{
     if(inRoadsideClearing(x,z,2))return null;const surface=surfaceAt(x,z),inland=surface.river>.2||surface.mud>.5;
     if(!inland&&(coast<9||coast>48||coast>16&&coast<29))return null;
     const routeDistance=routeSample(x,z).distance;if(surface.mud>.3&&routeDistance<5.5)return null;
     const log=surface.river<.2&&i%3===0,rock=surface.river>.2||(!log&&i%4===0),h=baseHeight(x,z);
     const normal=new THREE.Vector3(-(baseHeight(x+.4,z)-baseHeight(x-.4,z))/.8,1,-(baseHeight(x,z+.4)-baseHeight(x,z-.4))/.8).normalize();
     return {log,rock,h,normal,scale:surface.river>.2&&routeDistance<7?.55+rand(seed,i+2100)*.5:log?.55+rand(seed,i+2000)*1.15:.7+rand(seed,i+2100)*1.7};
    },2400);
    if(!place)continue;const {log,rock,h,normal,scale}=place,mesh=log?this.logs:rock?this.rocks:this.wrack,index=log?li:rock?ri:wi;if(index>=mesh.instanceMatrix.count||(rock&&ri>=100))continue;
    d.position.set(x-origin.x,h-.015,z-origin.z);d.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),normal);d.rotateY(rand(seed,i+1900)*6.28);d.scale.setScalar(scale);d.updateMatrix();mesh.setMatrixAt(index,d.matrix);this.samples.push({kind:log?'log':rock?'rock':'wrack',x,z});if(log)li++;else if(rock){this.rocks.setColorAt(ri,new THREE.Color(1,1,1));ri++;}else wi++;

   }
  }
  // A riparian woodland with a clear driving corridor and physical trunks.
  const woodland=[];
  for(let iz=Math.floor((centerZ-132)/6);iz<=Math.ceil((centerZ+132)/6);iz++)for(let ix=Math.floor((centerX-132)/6);ix<=Math.ceil((centerX+132)/6);ix++){
   if((ix&7)===0)yield;
   const x=ix*6+rand(ix,iz)*4,z=iz*6+rand(iz,ix)*4,distance=Math.hypot(x-centerX,z-centerZ);if(distance>132)continue;
   const place=remembered(this.placementCaches.woodland,`${ix},${iz}`,()=>{
    if(inRoadsideClearing(x,z,3))return null;const green=riverGreenery(x,z);if(green<.18||riverMask(x,z)>.04)return null;
    const slope=Math.hypot(baseHeight(x+1,z)-baseHeight(x-1,z),baseHeight(x,z+1)-baseHeight(x,z-1));if(slope>1.8)return null;
    const fernX=x+1.9,fernZ=z-1.5,fern=routeSample(fernX,fernZ).distance>7&&riverApproach(fernX,fernZ)<.18&&riverMask(fernX,fernZ)<.04;
    return {ix,iz,x,z,green,y:baseHeight(x,z),routeDistance:routeSample(x,z).distance,fern,fernY:fern?baseHeight(fernX,fernZ):0};
   },4000);
   if(place)woodland.push({...place,distance});

  }
  woodland.sort((a,b)=>a.distance-b.distance);
  let woodlandBatch=0;
  for(const {ix,iz,x,z,green,y,routeDistance,fern,fernY} of woodland){
   if(woodlandBatch++%16===0)yield;
   if(routeDistance>8&&ti<this.trunks.instanceMatrix.count&&rand(ix+11,iz)<green*.82){
    const scale=.85+rand(ix,iz+19)*.7;d.position.set(x-origin.x,y-.05,z-origin.z);d.rotation.set(0,rand(ix+5,iz)*6.28,0);d.scale.set(scale,scale,scale);d.updateMatrix();
    this.trunks.setMatrixAt(ti,d.matrix);d.scale.set(scale*(.88+rand(ix+8,iz)*.25),scale,scale*(.88+rand(ix+9,iz)*.25));d.updateMatrix();this.crowns.setMatrixAt(ti,d.matrix);ti++;
   }
   const fernX=x+1.9,fernZ=z-1.5;
   // Test the actual fern position, not its offset seed cell, and leave room for its fronds.
   if(fern&&si<this.shrubs.instanceMatrix.count){d.position.set(fernX-origin.x,fernY,fernZ-origin.z);d.rotation.set(0,rand(ix,iz)*6.28,0);d.scale.set(1.1+rand(ix+2,iz),.65+rand(ix+3,iz),1.1+rand(ix+4,iz));d.updateMatrix();this.shrubs.setMatrixAt(si,d.matrix);c.set('#bdcfac').lerp(new THREE.Color('#f2e7b8'),rand(ix+6,iz));this.shrubs.setColorAt(si,c);this.shrubs.geometry.attributes.fernPhase.setX(si,x*.2+z*.11);this.shrubs.geometry.attributes.fernYaw.setX(si,d.rotation.y);si++;}
  }
  for(const [mesh,count] of [[this.trunks,ti],[this.crowns,ti],[this.shrubs,si]]){mesh.count=count;mesh.instanceMatrix.needsUpdate=true}this.shrubs.geometry.attributes.fernPhase.needsUpdate=true;this.shrubs.geometry.attributes.fernYaw.needsUpdate=true;if(this.shrubs.instanceColor)this.shrubs.instanceColor.needsUpdate=true;
  // The same stable, world-space rock bed supplies rendering and rigid collision.
  let rockBatch=0;for(const rock of riverRocksNear(cx*64+32,cz*64+32,132)){
   if(rockBatch++%16===0)yield;
   if(ri>=this.rocks.instanceMatrix.count)break;
   d.position.set(rock.x-origin.x,rock.y,rock.z-origin.z);d.rotation.set(rock.rx,rock.yaw,rock.rz);d.scale.set(rock.sx,rock.sy,rock.sz);d.updateMatrix();this.rocks.setMatrixAt(ri,d.matrix);
   c.set(rock.wet?'#777d73':'#a19785').multiplyScalar(.83+rock.tint*.26);this.rocks.setColorAt(ri++,c);this.samples.push({kind:'rock',x:rock.x,z:rock.z,river:true});
  }
  const spacing=this.mobile?1.4:1.08;
  for(let iz=Math.floor((centerZ-76)/spacing);iz<Math.ceil((centerZ+76)/spacing);iz++)for(let ix=Math.floor((centerX-76)/spacing);ix<Math.ceil((centerX+76)/spacing);ix++){
   if((ix&15)===0)yield;
   const x=(ix+rand(ix,iz)*.7)*spacing,z=(iz+rand(iz,ix)*.7)*spacing;
   if(Math.hypot(x-centerX,z-centerZ)>76||gi>=this.grass.instanceMatrix.count)continue;
   const place=remembered(this.placementCaches.grass,`g${ix},${iz}`,()=>{if(inRoadsideClearing(x,z)||canyonRockMask(x,z)>.08)return null;const surface=surfaceAt(x,z);if(surface.grass<.30||surface.riverApproach>.18||riverMask(x,z)>.05)return null;return {y:baseHeight(x,z),riparian:riverGreenery(x,z)>.3,trail:routeSample(x,z).distance<4.5}},40000);if(!place)continue;
   d.position.set(x-origin.x,place.y-.035,z-origin.z);d.rotation.set(0,rand(ix+5,iz)*6.28,0);const {riparian,trail}=place;d.scale.set(1.7,riparian?(trail?.32:.72)+rand(ix,iz+2)*.3:1.45+rand(ix,iz+2)*.65,1.7);d.updateMatrix();this.grass.setMatrixAt(gi,d.matrix);
   c.set(riparian?'#426c43':'#71874b').lerp(new THREE.Color(riparian?'#87a85e':'#b2b570'),rand(ix,iz+4));this.grass.setColorAt(gi,c);this.grass.geometry.attributes.windPhase.setX(gi,x*.14+z*.09);this.grass.geometry.attributes.grassYaw.setX(gi,d.rotation.y);
   this._grass(gi,x,z,d.rotation.y);this.bendAttribute.setXYZ(gi,0,0,0);gi++;
  }
  for(const [mesh,count] of [[this.grass,gi],[this.logs,li],[this.wrack,wi],[this.rocks,ri]]){mesh.count=count;mesh.instanceMatrix.needsUpdate=true}if(this.rocks.instanceColor)this.rocks.instanceColor.needsUpdate=true;if(this.grass.instanceColor)this.grass.instanceColor.needsUpdate=true;this.grass.geometry.attributes.windPhase.needsUpdate=true;this.grass.geometry.attributes.grassYaw.needsUpdate=true;this.bendAttribute.needsUpdate=true;
  this.grassData.length=gi;Object.assign(this.stats,{grass:gi,logs:li,wrack:wi,rocks:ri,trees:ti,shrubs:si});
 }
 update(p,time,origin,weather={wind:8},heading=0,refresh=true){
  if(refresh)this.refresh(p,origin);this.fadeAnchor.value.set(p.x-origin.x,p.z-origin.z);this.time.value=this.reduced?0:time;this.windStrength.value=this.reduced?0:grassWindStrength(time,weather.wind);
  const dt=Math.min(.1,Math.max(0,time-(this.lastGrassTime??time)));this.lastGrassTime=time;
  this.tracks.update(p,time,heading);
  const k=1-Math.exp(-dt*28),indices=this._bendIndices??=new Set();indices.clear();
  const cx=Math.floor(p.x/8),cz=Math.floor(p.z/8);
  for(let z=cz-1;z<=cz+1;z++)for(let x=cx-1;x<=cx+1;x++)for(const i of this.grassBuckets?.get(`${x},${z}`)??[])indices.add(i);
  // Distant crushed grass recovers over minutes; a rotating pass avoids walking
  // 14,000 instances and uploading the whole buffer for every animation frame.
  const sweep=Math.min(this.grassData.length,256);for(let n=0;n<sweep;n++){this._bendCursor=((this._bendCursor??-1)+1)%this.grassData.length;indices.add(this._bendCursor)}
  let dirty=false;this.bendAttribute.clearUpdateRanges();
  for(const i of indices){
   const g=this.grassData[i],track=this.tracks.sample(g.x,g.z,time),bx=(track.dx*g.c-track.dz*g.s)*1.12,bz=(track.dx*g.s+track.dz*g.c)*1.12;
   const blend=g.fresh?1:Math.hypot(g.x-p.x,g.z-p.z)>12?1:k;g.fresh=false;
   const nx=g.bx+(bx-g.bx)*blend,nz=g.bz+(bz-g.bz)*blend,ny=g.by+(track.amount-g.by)*blend;
   if(Math.abs(nx-g.bx)+Math.abs(nz-g.bz)+Math.abs(ny-g.by)<.0001)continue;
   g.bx=nx;g.bz=nz;g.by=ny;this.bendAttribute.setXYZ(i,nx,ny,nz);if(!this._bendFullUpload)this.bendAttribute.addUpdateRange(i*3,3);dirty=true;
  }
  if(dirty)this.bendAttribute.needsUpdate=true;this._bendFullUpload=false;
  const region=Math.floor(p.z/220);
  for(let i=0;i<this.boats.length;i++){
   const boat=this.boats[i],id=region+i-2,z=id*220+55+rand(id,7)*65+Math.sin(time*.012+id)*12,x=shore(z)-75-rand(id,19)*65;
   boat.id=id;boat.x=x;boat.z=z;const h=oceanHeight(x,z,time),front=oceanHeight(x,z-4,time),back=oceanHeight(x,z+4,time);
   boat.mesh.position.set(x-origin.x,h-.13,z-origin.z);boat.mesh.rotation.set(this.reduced?0:(back-front)*.08,Math.PI*.22+Math.sin(id*3.7)*.4,this.reduced?0:Math.sin(time*.7+id)*.025);boat.mesh.scale.setScalar(.85+rand(id,31)*.45);
  }
 }
 dispose(){for(const cache of Object.values(this.placementCaches)){cache.clear();if(cache.fifo)cache.fifo.length=0;cache.cursor=0;}this._pending=null;this._staging=null;this._previousGrass=null;this.grassData=[];this.grassBuckets?.clear();this._bendIndices?.clear();this.tracks.clear();for(const mesh of [this.grass,this.logs,this.wrack,this.rocks,this.trunks,this.crowns,this.shrubs,...this.boats.map(b=>b.mesh)]){disposeSceneryFade(mesh);this.scene.remove(mesh);mesh.dispose?.()}for(const g of this.geometries)g.dispose();for(const m of this.materials)m.dispose()}
}
