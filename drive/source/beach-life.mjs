import {GrassTracks} from './grass-tracks.mjs';
import {routeSample,riverMask,riverZ,riverGreenery} from './expedition.mjs';
import {riverRocksNear} from './river-rocks.mjs';
import {coastalWind} from './coastal-wind.mjs';
import * as THREE from 'three/webgpu';
import {positionLocal,attribute,uniform,sin,cos,vec3,float} from 'three/tsl';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {baseHeight,shore,noise,smooth,surfaceAt} from './terrain.mjs';
import {oceanHeight} from './ocean-height.mjs';
const rand=(a,b=0)=>{const v=Math.sin(a*127.1+b*311.7)*43758.5453;return v-Math.floor(v)};
const paint=(g,hex)=>{const c=new THREE.Color(hex),a=new Float32Array(g.attributes.position.count*3);for(let i=0;i<a.length;i+=3){a[i]=c.r;a[i+1]=c.g;a[i+2]=c.b}g.setAttribute('color',new THREE.BufferAttribute(a,3));return g};
const combine=gs=>{const clean=gs.map(g=>{const a=g.index?g.toNonIndexed():g;for(const k of Object.keys(a.attributes))if(!['position','normal','color'].includes(k))a.deleteAttribute(k);return a});const out=mergeGeometries(clean);for(const g of new Set([...gs,...clean]))g.dispose();return out};
function beam(a,b,r,hex){const p=new THREE.Vector3(...a),q=new THREE.Vector3(...b),g=new THREE.CylinderGeometry(r*.72,r,p.distanceTo(q),6);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),q.clone().sub(p).normalize()));g.translate(...p.add(q).multiplyScalar(.5).toArray());return paint(g,hex)}
function box(x,y,z,w,h,d,hex){return paint(new THREE.BoxGeometry(w,h,d).translate(x,y,z),hex)}
function grassGeometry(){const positions=[],indices=[];for(let i=0;i<15;i++){const angle=i*2.399,height=.50+rand(i,8)*.65,lean=.18+rand(i,2)*.42,width=.065+rand(i,3)*.05,dx=Math.cos(angle),dz=Math.sin(angle),base=positions.length/3;for(let j=0;j<=4;j++){const t=j/4,w=width*(1-t)*.5;for(const side of [-1,1])positions.push(dx*(.10+lean*t*t)-dz*w*side,height*t,dz*(.10+lean*t*t)+dx*w*side);if(j<4){const a=base+j*2;indices.push(a,a+1,a+2,a+1,a+3,a+2)}}}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();return g}
function logGeometry(){return combine([beam([-1,.07,0],[.05,.16,.06],.15,'#a8957b'),beam([.05,.16,.06],[1.1,.11,-.12],.12,'#a8957b'),beam([-.12,.14,.05],[.55,.30,.70],.065,'#95816b'),beam([-.73,.10,.04],[-.93,.23,-.45],.05,'#95816b'),beam([.55,.30,.70],[.78,.24,.91],.035,'#95816b')])}
function wrackGeometry(){const gs=[];for(let i=0;i<8;i++){const g=new THREE.IcosahedronGeometry(.12+rand(i,19)*.10,0);g.scale(1,.25,.55);g.translate((rand(i,20)-.5)*.65,.025,(rand(i,21)-.5)*.4);gs.push(paint(g,i%3===0?'#b5ab91':'#665e42'))}return combine(gs)}
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
export class BeachLife{
 constructor(scene,{mobile=false,reduced=false}={}){
  this.scene=scene;this.mobile=mobile;this.reduced=reduced;this.key='';this.time=uniform(0);this.windStrength=uniform(.4);this.dummy=new THREE.Object3D();this.materials=[];this.geometries=[];this.stats={grass:0,logs:0,wrack:0,rocks:0,boats:5};
  const make=(geometry,material,count)=>{this.geometries.push(geometry);this.materials.push(material);const m=new THREE.InstancedMesh(geometry,material,count);m.frustumCulled=false;m.count=0;scene.add(m);return m};
  const geometry=grassGeometry(),grassMat=new THREE.MeshStandardNodeMaterial({color:'#ffffff',side:THREE.DoubleSide,roughness:1});
  const phase=attribute('windPhase','float'),height=attribute('position','vec3').y;
  const wind=sin(this.time.mul(1.15).sub(phase)).mul(.25).add(sin(this.time.mul(.48).sub(phase.mul(.43))).mul(.18)).add(sin(this.time.mul(2.7).add(phase.mul(2.1))).mul(.045));
  const bend=attribute('grassBend','vec3');
  // Orient gusts consistently in world space despite randomly rotated tufts.
  const yaw=attribute('grassYaw','float'),standing=float(1).sub(bend.y.mul(.94)),sway=wind.mul(this.windStrength).mul(height.pow(2)).mul(standing);
  grassMat.positionNode=positionLocal.add(vec3(bend.x.mul(height),bend.y.mul(height).mul(-.92),bend.z.mul(height))).add(vec3(sway.mul(cos(yaw).sub(sin(yaw).mul(.4))),sway.abs().mul(-.12),sway.mul(sin(yaw).add(cos(yaw).mul(.4)))));
  const capacity=mobile?14000:22000;this.tracks=new GrassTracks();this.grassData=[];this.bendAttribute=new THREE.InstancedBufferAttribute(new Float32Array(capacity*3),3);geometry.setAttribute('grassBend',this.bendAttribute);geometry.setAttribute('windPhase',new THREE.InstancedBufferAttribute(new Float32Array(capacity),1));geometry.setAttribute('grassYaw',new THREE.InstancedBufferAttribute(new Float32Array(capacity),1));
  this.grass=make(geometry,grassMat,capacity);
  this.logs=make(logGeometry(),new THREE.MeshStandardMaterial({vertexColors:true,roughness:1}),180);
  this.wrack=make(wrackGeometry(),new THREE.MeshStandardMaterial({vertexColors:true,roughness:1}),300);
  const rock=paint(new THREE.IcosahedronGeometry(.4,1).scale(1.4,.7,1).translate(0,.18,0),'#8c7e7b');this.rocks=make(rock,new THREE.MeshStandardMaterial({vertexColors:true,roughness:.72,flatShading:true}),480);
  const treeCount=mobile?180:300;
  this.trunks=make(new THREE.CylinderGeometry(.16,.34,5.5,6).translate(0,2.75,0),new THREE.MeshStandardMaterial({color:'#534d3d',roughness:1}),treeCount);
  const crowns=combine([paint(new THREE.IcosahedronGeometry(2.3,1).scale(1,.85,1).translate(-.7,5.3,0),'#71854c'),paint(new THREE.IcosahedronGeometry(2,1).scale(1,1.1,1).translate(.6,6.7,.1),'#8b9958'),paint(new THREE.IcosahedronGeometry(1.8,1).translate(1.2,5.3,-.6),'#526f43')]);
  const leaves=new THREE.MeshStandardNodeMaterial({vertexColors:true,roughness:1});
  leaves.positionNode=positionLocal.add(vec3(sin(this.time.mul(.65).add(attribute('treePhase','float'))).mul(positionLocal.y.pow(2)).mul(.006).mul(this.windStrength),0,0));
  crowns.setAttribute('treePhase',new THREE.InstancedBufferAttribute(new Float32Array(treeCount),1));
  this.crowns=make(crowns,leaves,treeCount);this.crowns.castShadow=true;this.crowns.receiveShadow=true;this.trunks.castShadow=true;
  this.shrubs=make(new THREE.IcosahedronGeometry(1,0).scale(1,.7,1).translate(0,.45,0),new THREE.MeshStandardMaterial({color:'#ffffff',roughness:1,flatShading:true}),mobile?360:600);
  this.boats=[];const bg=boatGeometry(),bm=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.7});this.geometries.push(bg);this.materials.push(bm);
  for(let i=0;i<5;i++){const mesh=new THREE.Mesh(bg,bm);scene.add(mesh);this.boats.push({mesh,id:0,x:0,z:0})}
 }
 refresh(p,origin){
  const cx=Math.floor(p.x/64),cz=Math.floor(p.z/64),key=`${cx},${cz},${origin.x},${origin.z}`;if(key===this.key)return;this.key=key;
  let gi=0,li=0,wi=0,ri=0,ti=0,si=0;const d=this.dummy,c=new THREE.Color();this.samples=[];this.grassData=[];
  // Fixed world cells prevent plants and driftwood reshuffling when new terrain arrives.
  for(let tz=cz-2;tz<=cz+2;tz++)for(let tx=cx-2;tx<=cx+2;tx++){
   const seed=tx*391+tz*977;
   for(let i=0;i<(this.mobile?380:700);i++){
    const x=tx*64+rand(seed,i*3)*64,z=tz*64+rand(seed,i*3+1)*64,coast=x-shore(z),patch=noise(x*.085,z*.085);
    const surface=surfaceAt(x,z),meadow=surface.grass>.22;
    if((meadow&&Math.hypot(x-(cx*64+32),z-(cz*64+32))<76)||coast<29||riverMask(x,z)>.05||surface.snow>.3||surface.mud>.4||(!meadow&&(coast>155||patch<.42))||rand(seed,i*3+2)>smooth(28,43,coast)*.95||gi>=Math.floor(this.grass.instanceMatrix.count*.30))continue;
    d.position.set(x-origin.x,baseHeight(x,z)-.025,z-origin.z);d.rotation.set(0,rand(seed,i+900)*6.28,0);const scale=meadow?1.05+rand(seed,i+700)*.65:.5+rand(seed,i+700)*.85;d.scale.set(meadow?1.5:scale,scale*(meadow?1.15:1),meadow?1.5:scale);d.updateMatrix();this.grass.setMatrixAt(gi,d.matrix);c.set(meadow?'#718e4b':'#819366').lerp(new THREE.Color(meadow?'#b1b774':'#c4ba87'),rand(seed,i+180));this.grass.setColorAt(gi,c);this.grass.geometry.attributes.windPhase.setX(gi,x*.14+z*.09);this.grass.geometry.attributes.grassYaw.setX(gi,d.rotation.y);this.grassData.push({x,z,yaw:d.rotation.y,bx:0,by:0,bz:0,fresh:true});this.bendAttribute.setXYZ(gi,0,0,0);gi++;
   }
   for(let i=0;i<24;i++){
    const x=tx*64+rand(seed,i+1300)*64,z=tz*64+rand(seed,i+1500)*64,coast=x-shore(z);
    const surface=surfaceAt(x,z),inland=surface.river>.2||surface.mud>.5;
    if(!inland&&(coast<9||coast>48||coast>16&&coast<29))continue;
    if(surface.mud>.3&&routeSample(x,z).distance<5.5)continue;
    const log=surface.river<.2&&i%3===0,rock=surface.river>.2||(!log&&i%4===0),mesh=log?this.logs:rock?this.rocks:this.wrack,index=log?li:rock?ri:wi;if(index>=mesh.instanceMatrix.count||(rock&&ri>=100))continue;
    const h=baseHeight(x,z),normal=new THREE.Vector3(-(baseHeight(x+.4,z)-baseHeight(x-.4,z))/.8,1,-(baseHeight(x,z+.4)-baseHeight(x,z-.4))/.8).normalize();d.position.set(x-origin.x,h-.015,z-origin.z);d.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),normal);d.rotateY(rand(seed,i+1900)*6.28);const onRoute=routeSample(x,z).distance<7,scale=surface.river>.2&&onRoute?.55+rand(seed,i+2100)*.5:log?.55+rand(seed,i+2000)*1.15:.7+rand(seed,i+2100)*1.7;d.scale.setScalar(scale);d.updateMatrix();mesh.setMatrixAt(index,d.matrix);this.samples.push({kind:log?'log':rock?'rock':'wrack',x,z});if(log)li++;else if(rock){this.rocks.setColorAt(ri,new THREE.Color(1,1,1));ri++;}else wi++;
   }
  }
  // A riparian woodland with a clear driving corridor and physical trunks.
  for(let iz=Math.floor((p.z-115)/6);iz<=Math.ceil((p.z+115)/6);iz++)for(let ix=Math.floor((p.x-115)/6);ix<=Math.ceil((p.x+115)/6);ix++){
   const x=ix*6+rand(ix,iz)*4,z=iz*6+rand(iz,ix)*4,green=riverGreenery(x,z),r=routeSample(x,z);
   if(green<.18||riverMask(x,z)>.04||Math.hypot(x-p.x,z-p.z)>115)continue;
   const y=baseHeight(x,z),slope=Math.hypot(baseHeight(x+1,z)-baseHeight(x-1,z),baseHeight(x,z+1)-baseHeight(x,z-1));if(slope>1.8)continue;
   if(r.distance>8&&ti<this.trunks.instanceMatrix.count&&rand(ix+11,iz)<green*.82){
    const scale=.85+rand(ix,iz+19)*.7;d.position.set(x-origin.x,y-.05,z-origin.z);d.rotation.set(0,rand(ix+5,iz)*6.28,0);d.scale.set(scale,scale,scale);d.updateMatrix();
    this.trunks.setMatrixAt(ti,d.matrix);this.crowns.setMatrixAt(ti,d.matrix);this.crowns.geometry.attributes.treePhase.setX(ti,x*.12+z*.06);ti++;
   }
   if(r.distance>4.5&&si<this.shrubs.instanceMatrix.count){d.position.set(x+1.9-origin.x,y,z-1.5-origin.z);d.rotation.set(0,rand(ix,iz)*6.28,0);d.scale.set(1.1+rand(ix+2,iz),.65+rand(ix+3,iz),1.1+rand(ix+4,iz));d.updateMatrix();this.shrubs.setMatrixAt(si,d.matrix);c.set('#3e6546').lerp(new THREE.Color('#8eaa60'),rand(ix+6,iz));this.shrubs.setColorAt(si++,c);}
  }
  for(const [mesh,count] of [[this.trunks,ti],[this.crowns,ti],[this.shrubs,si]]){mesh.count=count;mesh.instanceMatrix.needsUpdate=true}this.crowns.geometry.attributes.treePhase.needsUpdate=true;if(this.shrubs.instanceColor)this.shrubs.instanceColor.needsUpdate=true;
  // The same stable, world-space rock bed supplies rendering and rigid collision.
  for(const rock of riverRocksNear(cx*64+32,cz*64+32,132)){
   if(ri>=this.rocks.instanceMatrix.count)break;
   d.position.set(rock.x-origin.x,rock.y,rock.z-origin.z);d.rotation.set(rock.rx,rock.yaw,rock.rz);d.scale.set(rock.sx,rock.sy,rock.sz);d.updateMatrix();this.rocks.setMatrixAt(ri,d.matrix);
   c.set(rock.wet?'#777d73':'#a19785').multiplyScalar(.83+rock.tint*.26);this.rocks.setColorAt(ri++,c);this.samples.push({kind:'rock',x:rock.x,z:rock.z,river:true});
  }
  const spacing=this.mobile?1.4:1.08;
  for(let iz=Math.floor((cz*64-48)/spacing);iz<Math.ceil((cz*64+112)/spacing);iz++)for(let ix=Math.floor((cx*64-48)/spacing);ix<Math.ceil((cx*64+112)/spacing);ix++){
   const x=(ix+rand(ix,iz)*.7)*spacing,z=(iz+rand(iz,ix)*.7)*spacing;
   if(Math.hypot(x-(cx*64+32),z-(cz*64+32))>76||gi>=this.grass.instanceMatrix.count)continue;
   const surface=surfaceAt(x,z);if(surface.grass<.30||riverMask(x,z)>.05)continue;
   d.position.set(x-origin.x,baseHeight(x,z)-.035,z-origin.z);d.rotation.set(0,rand(ix+5,iz)*6.28,0);const riparian=riverGreenery(x,z)>.3,trail=routeSample(x,z).distance<4.5;d.scale.set(1.7,riparian?(trail?.32:.72)+rand(ix,iz+2)*.3:1.45+rand(ix,iz+2)*.65,1.7);d.updateMatrix();this.grass.setMatrixAt(gi,d.matrix);
   c.set(riparian?'#426c43':'#71874b').lerp(new THREE.Color(riparian?'#87a85e':'#b2b570'),rand(ix,iz+4));this.grass.setColorAt(gi,c);this.grass.geometry.attributes.windPhase.setX(gi,x*.14+z*.09);this.grass.geometry.attributes.grassYaw.setX(gi,d.rotation.y);
   this.grassData.push({x,z,yaw:d.rotation.y,bx:0,by:0,bz:0,fresh:true});this.bendAttribute.setXYZ(gi,0,0,0);gi++;
  }
  for(const [mesh,count] of [[this.grass,gi],[this.logs,li],[this.wrack,wi],[this.rocks,ri]]){mesh.count=count;mesh.instanceMatrix.needsUpdate=true}if(this.rocks.instanceColor)this.rocks.instanceColor.needsUpdate=true;if(this.grass.instanceColor)this.grass.instanceColor.needsUpdate=true;this.grass.geometry.attributes.windPhase.needsUpdate=true;this.grass.geometry.attributes.grassYaw.needsUpdate=true;this.bendAttribute.needsUpdate=true;
  Object.assign(this.stats,{grass:gi,logs:li,wrack:wi,rocks:ri,trees:ti,shrubs:si});
 }
 update(p,time,origin,weather={wind:8},heading=0){
  this.refresh(p,origin);this.time.value=this.reduced?0:time;this.windStrength.value=this.reduced?0:coastalWind(time,weather.wind)*2.2;
  const dt=Math.min(.1,Math.max(0,time-(this.lastGrassTime??time)));this.lastGrassTime=time;
  this.tracks.update(p,time,heading);
  for(let i=0;i<this.grassData.length;i++){
   const g=this.grassData[i],track=this.tracks.sample(g.x,g.z,time),c=Math.cos(g.yaw),s=Math.sin(g.yaw),k=1-Math.exp(-dt*20);
   const bx=(track.dx*c-track.dz*s)*.95,bz=(track.dx*s+track.dz*c)*.95;
   // A fresh streamed instance immediately inherits the world-space flattened path.
   const blend=g.fresh?1:k;g.fresh=false;
   g.bx+=(bx-g.bx)*blend;g.bz+=(bz-g.bz)*blend;g.by+=(track.amount-g.by)*blend;
   this.bendAttribute.setXYZ(i,g.bx,g.by,g.bz);
  }
  this.bendAttribute.needsUpdate=true;
  const region=Math.floor(p.z/220);
  for(let i=0;i<this.boats.length;i++){
   const boat=this.boats[i],id=region+i-2,z=id*220+55+rand(id,7)*65+Math.sin(time*.012+id)*12,x=shore(z)-75-rand(id,19)*65;
   boat.id=id;boat.x=x;boat.z=z;const h=oceanHeight(x,z,time),front=oceanHeight(x,z-4,time),back=oceanHeight(x,z+4,time);
   boat.mesh.position.set(x-origin.x,h-.13,z-origin.z);boat.mesh.rotation.set(this.reduced?0:(back-front)*.08,Math.PI*.22+Math.sin(id*3.7)*.4,this.reduced?0:Math.sin(time*.7+id)*.025);boat.mesh.scale.setScalar(.85+rand(id,31)*.45);
  }
 }
 dispose(){this.tracks.clear();for(const mesh of [this.grass,this.logs,this.wrack,this.rocks,this.trunks,this.crowns,this.shrubs,...this.boats.map(b=>b.mesh)]){this.scene.remove(mesh);mesh.dispose?.()}for(const g of this.geometries)g.dispose();for(const m of this.materials)m.dispose()}
}
