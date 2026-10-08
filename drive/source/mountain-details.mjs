import {inRoadsideClearing} from './roadside-spots.mjs';
import {uniform} from 'three/tsl';
import {sceneryFade,stageSceneryArrival} from './scenery-fade.mjs';
import * as THREE from 'three/webgpu';
import {baseHeight,surfaceAt} from './terrain.mjs';
import {routeSample,riverMask} from './expedition.mjs';
// Reuse terrain queries for retained world cells; never cache live tire ruts.
const remembered=(cache,key,create)=>{let value=cache.get(key);if(value!==undefined)return value;value=create();const fifo=cache.fifo??=[];if(cache.size>=4000){const at=cache.cursor??0;cache.delete(fifo[at]);fifo[at]=key;cache.cursor=(at+1)%4000}else fifo.push(key);cache.set(key,value);return value};
const rand=(a,b)=>{const n=Math.sin(a*127.1+b*311.7)*43758.5453;return n-Math.floor(n)};
function fracturedRock(){
 const g=new THREE.IcosahedronGeometry(1,1),p=g.attributes.position,c=[],v=new THREE.Vector3(),tone=new THREE.Color();
 for(let i=0;i<p.count;i++){
  v.fromBufferAttribute(p,i);const cut=.88+Math.sin(v.x*9+v.z*5)*.09;
  v.set(v.x*cut,Math.round(v.y*5)/5*.8+.3,v.z*(.85+Math.sin(v.y*8)*.08));p.setXYZ(i,v.x,v.y,v.z);
  const seam=.75+.19*(.5+.5*Math.sin(v.y*16+v.x*.7));tone.setRGB(seam,seam*.98,seam*.98);c.push(tone.r,tone.g,tone.b);
 }g.setAttribute('color',new THREE.Float32BufferAttribute(c,3));g.computeVertexNormals();return g;
}
function stagingMesh(mesh){
 return {count:0,sceneryBirth:mesh.geometry.attributes.sceneryBirth?.clone(),instanceMatrix:{count:mesh.instanceMatrix.count,array:new Float32Array(mesh.instanceMatrix.array.length)},instanceColor:{array:new Float32Array(mesh.instanceMatrix.count*3)},
  setMatrixAt(i,m){m.toArray(this.instanceMatrix.array,i*16)},setColorAt(i,c){c.toArray(this.instanceColor.array,i*3)}};
}
export class MountainDetails{
 constructor(scene,{mobile=false,reduced=false}={}){
  Object.assign(this,{scene,mobile,reduced});this.placementCaches={rocks:new Map(),scree:new Map()};this.clock=uniform(0);this.fadeAnchor=uniform(new THREE.Vector2());this.key='';this.samples=[];this.dummy=new THREE.Object3D();
  this.rocks=new THREE.InstancedMesh(fracturedRock(),new THREE.MeshStandardNodeMaterial({vertexColors:true,roughness:.91,flatShading:true}),mobile?100:170);
  this.scree=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,0),new THREE.MeshStandardNodeMaterial({color:'#ffffff',roughness:1,flatShading:true}),mobile?550:1100);
  for(const m of [this.rocks,this.scree]){m.count=0;m.frustumCulled=false;m.receiveShadow=true;m.setColorAt(0,new THREE.Color(1,1,1));scene.add(m)}this.rocks.castShadow=true;
  sceneryFade(this.rocks,{anchor:this.fadeAnchor,clock:this.clock,near:68,far:102});sceneryFade(this.scree,{anchor:this.fadeAnchor,clock:this.clock,near:mobile?14:20,far:mobile?24:34,arrival:false});
 }
 _key(p,origin){return `${Math.floor(p.x/16)},${Math.floor(p.z/16)},${origin.x},${origin.z}`}
 _begin(p,origin,key){
  const work=this._staging??Object.create(this);if(!this._staging){work.rocks=stagingMesh(this.rocks);work.scree=stagingMesh(this.scree);this._staging=work}
  this._pending={key,work,iterator:this._build.call(work,{...p},{...origin})};
 }
 _commit(){
  const {work,key}=this._pending,old=this.key.split(',').map(Number),next=key.split(',').map(Number);for(const name of ['rocks','scree']){const mesh=this[name],staged=work[name];stageSceneryArrival(mesh,staged,this.reduced?-2:this.clock.value,{x:old[2]||0,z:old[3]||0},{x:next[2],z:next[3]},!this.key);if(staged.sceneryBirth){mesh.geometry.attributes.sceneryBirth.array.set(staged.sceneryBirth.array);mesh.geometry.attributes.sceneryBirth.needsUpdate=true;}mesh.count=staged.count;mesh.instanceMatrix.array.set(staged.instanceMatrix.array);mesh.instanceColor.array.set(staged.instanceColor.array);mesh.instanceMatrix.needsUpdate=true;mesh.instanceColor.needsUpdate=true}
  this.key=key;this.rocks.userData.detailKey=key;this.samples=work.samples;this._pending=null;
 }
 _rebase(key){
  if(!this.key)return false;const a=this.key.split(',').map(Number),b=key.split(',').map(Number);if(a[0]!==b[0]||a[1]!==b[1])return false;
  const dx=b[2]-a[2],dz=b[3]-a[3];for(const name of ['rocks','scree']){const m=this[name],v=m.instanceMatrix.array;for(let i=0;i<m.count;i++){v[i*16+12]-=dx;v[i*16+14]-=dz}m.instanceMatrix.needsUpdate=true}
  this.key=key;this._pending=null;this.rocks.userData.detailKey=key;return true;
 }
 refresh(p,origin){
  const key=this._key(p,origin);if(key===this.key){this._pending=null;return}
  if(this._rebase(key))return;
  if(this._pending?.key!==key)this._begin(p,origin,key);while(!this._pending.iterator.next().done){}this._commit();
 }
 stream(p,origin,budgetMs=.9){
  const key=this._key(p,origin);if(key===this.key){this._pending=null;return false}
  if(this._rebase(key))return true;
  // Finish nearby work even if a faster truck crosses another cell. Restarting
  // every boundary can starve a generation forever at 30 fps.
  if(this._pending?.key!==key){const queued=this._pending?.key.split(',').map(Number),target=key.split(',').map(Number);if(!queued||queued[2]!==target[2]||queued[3]!==target[3]||Math.max(Math.abs(queued[0]-target[0]),Math.abs(queued[1]-target[1]))>8)this._begin(p,origin,key);}const deadline=performance.now()+budgetMs;
  do{if(this._pending.iterator.next().done){this._commit();return true}}while(performance.now()<deadline);return false;
 }
 *_build(p,origin){
  const cx=Math.floor(p.x/16),cz=Math.floor(p.z/16);
  const centerX=cx*16+8,centerZ=cz*16+8,candidates=[];
  for(let iz=Math.floor((centerZ-145)/12);iz<=Math.ceil((centerZ+145)/12);iz++)for(let ix=Math.floor((centerX-145)/12);ix<=Math.ceil((centerX+145)/12);ix++){
   if((ix&7)===0)yield;
   const x=ix*12+rand(ix,iz)*9,z=iz*12+rand(iz,ix)*9,distance=Math.hypot(x-centerX,z-centerZ);
   if(distance>145)continue;
   const place=remembered(this.placementCaches.rocks,`${ix},${iz}`,()=>{if(inRoadsideClearing(x,z,3))return null;if(riverMask(x,z)>.05)return null;const h=baseHeight(x,z);if(h<30)return null;const route=routeSample(x,z);if(route.distance<10||route.distance>115)return null;const surface=surfaceAt(x,z);if(surface.grass>.4)return null;return {x,z,h,surface,ix,iz}});
   if(place)candidates.push({...place,distance});

  }
  candidates.sort((a,b)=>a.distance-b.distance);let ri=0,si=0;this.samples=[];const d=this.dummy,c=new THREE.Color();
  for(const r of candidates.slice(0,this.rocks.instanceMatrix.count)){
   if(ri%16===0)yield;
   const {x,z,h,surface,ix,iz}=r,scale=1.0+rand(ix+8,iz)*2.3;
   d.position.set(x-origin.x,h-.36,z-origin.z);d.rotation.set((rand(ix,iz+3)-.5)*.2,rand(ix,iz+2)*Math.PI*2,(rand(ix,iz+4)-.5)*.18);d.scale.set(scale*(1.1+rand(ix+4,iz)),scale*.7,scale);d.updateMatrix();this.rocks.setMatrixAt(ri,d.matrix);
   c.set(surface.volcanic>.3?'#696169':'#897d75').lerp(new THREE.Color('#c4ccd0'),surface.snow*.50).multiplyScalar(.85+rand(ix+6,iz)*.35);this.rocks.setColorAt(ri++,c);this.samples.push({x,z,kind:'rock'});
  }
  // Small stones make the shoulder read as broken ground. They are below tyre
  // obstacle scale; the larger outcrops share exact geometry with solid colliders.
  const pebbles=[];
  for(let iz=Math.floor((centerZ-80)/3);iz<=Math.ceil((centerZ+80)/3);iz++)for(let ix=Math.floor((centerX-80)/3);ix<=Math.ceil((centerX+80)/3);ix++){
   if((ix&15)===0)yield;
   const x=ix*3+rand(ix,iz)*2.7,z=iz*3+rand(iz,ix)*2.7;
   const place=remembered(this.placementCaches.scree,`${ix},${iz}`,()=>{if(riverMask(x,z)>.1)return null;const h=baseHeight(x,z);if(h<28)return null;const route=routeSample(x,z);if(route.distance<2.8)return null;const surface=surfaceAt(x,z);if(surface.grass>.5||surface.snow>.75)return null;return {ix,iz,x,z,h,surface}});
   if(place)pebbles.push({...place,distance:(x-centerX)**2+(z-centerZ)**2});

  }
  pebbles.sort((a,b)=>a.distance-b.distance);
  for(const {ix,iz,x,z,h,surface} of pebbles.slice(0,this.scree.instanceMatrix.count)){
   if(si%32===0)yield;
   const scale=.06+rand(ix+6,iz)*.17;d.position.set(x-origin.x,h+.035,z-origin.z);d.rotation.set(rand(ix,iz),rand(ix+2,iz)*6.28,rand(ix+3,iz));d.scale.set(scale*1.8,scale*.65,scale);d.updateMatrix();this.scree.setMatrixAt(si,d.matrix);c.set(surface.volcanic>.3?'#8f7c79':'#a19782').multiplyScalar(.75+rand(ix+4,iz)*.5);this.scree.setColorAt(si++,c);
  }
  this.rocks.count=ri;this.scree.count=si;for(const m of [this.rocks,this.scree]){m.instanceMatrix.needsUpdate=true;m.instanceColor.needsUpdate=true}
 }
 update(p,origin,time){this.clock.value=this.reduced?0:time;this.fadeAnchor.value.set(p.x-origin.x,p.z-origin.z)}
 dispose(){for(const cache of Object.values(this.placementCaches)){cache.clear();if(cache.fifo)cache.fifo.length=0;cache.cursor=0;}this._pending=null;this._staging=null;for(const m of [this.rocks,this.scree]){m.removeFromParent();m.geometry.dispose();m.material.dispose();m.dispose()}}
}
