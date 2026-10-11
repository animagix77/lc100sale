import {uniform} from 'three/tsl';
import {sceneryFade,stageSceneryArrival} from './scenery-fade.mjs';
import * as THREE from 'three/webgpu';
import {baseHeight,surfaceAt,noise} from './terrain.mjs';
import {rockFormationGeometry} from './rock-formations.mjs';
import {rockFormationAt} from './rock-placement.mjs';
import {routeSample,riverMask} from './expedition.mjs';
// Reuse terrain queries for retained world cells; never cache live tire ruts.
const remembered=(cache,key,create)=>{let value=cache.get(key);if(value!==undefined)return value;value=create();const fifo=cache.fifo??=[];if(cache.size>=4000){const at=cache.cursor??0;cache.delete(fifo[at]);fifo[at]=key;cache.cursor=(at+1)%4000}else fifo.push(key);cache.set(key,value);return value};
const rand=(a,b)=>{const n=Math.sin(a*127.1+b*311.7)*43758.5453;return n-Math.floor(n)};
function stagingMesh(mesh){
 return {count:0,sceneryBirth:mesh.geometry.attributes.sceneryBirth?.clone(),instanceMatrix:{count:mesh.instanceMatrix.count,array:new Float32Array(mesh.instanceMatrix.array.length)},instanceColor:{array:new Float32Array(mesh.instanceMatrix.count*3)},
  setMatrixAt(i,m){m.toArray(this.instanceMatrix.array,i*16)},setColorAt(i,c){c.toArray(this.instanceColor.array,i*3)}};
}
export class MountainDetails{
 constructor(scene,{mobile=false,reduced=false}={}){
  Object.assign(this,{scene,mobile,reduced});this.placementCaches={rocks:new Map(),scree:new Map()};this.clock=uniform(0);this.fadeAnchor=uniform(new THREE.Vector2());this.key='';this.samples=[];this.dummy=new THREE.Object3D();
  this.rocks=new THREE.InstancedMesh(rockFormationGeometry(),new THREE.MeshStandardNodeMaterial({vertexColors:true,roughness:.91}),mobile?100:170);
  this.scree=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,0),new THREE.MeshStandardNodeMaterial({color:'#ffffff',roughness:1,flatShading:true}),mobile?550:1100);
  for(const m of [this.rocks,this.scree]){m.count=0;m.frustumCulled=false;m.receiveShadow=true;m.setColorAt(0,new THREE.Color(1,1,1));scene.add(m)}this.rocks.castShadow=true;
  sceneryFade(this.rocks,{anchor:this.fadeAnchor,clock:this.clock,near:68,far:102});sceneryFade(this.scree,{anchor:this.fadeAnchor,clock:this.clock,near:mobile?14:20,far:mobile?24:34,arrival:false});
 }
 _key(p,origin){return `${Math.floor(p.x/16)},${Math.floor(p.z/16)},${origin.x},${origin.z}`}
 _begin(p,origin,key){
  const work=this._staging??Object.create(this);if(!this._staging){work.rocks=stagingMesh(this.rocks);work.scree=stagingMesh(this.scree);this._staging=work}
  const buildOrigin={...origin};this._pending={key,work,origin:buildOrigin,iterator:this._build.call(work,{...p},buildOrigin)};
 }
 _commit(){
  const {work,key}=this._pending,old=this.key.split(',').map(Number),next=key.split(',').map(Number);for(const name of ['rocks','scree']){const mesh=this[name],staged=work[name];stageSceneryArrival(mesh,staged,this.reduced?-2:this.clock.value,{x:old[2]||0,z:old[3]||0},{x:next[2],z:next[3]},!this.key);if(staged.sceneryBirth){mesh.geometry.attributes.sceneryBirth.array.set(staged.sceneryBirth.array);mesh.geometry.attributes.sceneryBirth.needsUpdate=true;}mesh.count=staged.count;mesh.instanceMatrix.array.set(staged.instanceMatrix.array);mesh.instanceColor.array.set(staged.instanceColor.array);mesh.instanceMatrix.needsUpdate=true;mesh.instanceColor.needsUpdate=true}
  this.key=key;this.rocks.userData.detailKey=key;this.samples=work.samples;this._pending=null;
 }
 rebase(origin){
  if(!this.key)return false;
  const old=this.key.split(',').map(Number),dx=origin.x-old[2],dz=origin.z-old[3];if(!dx&&!dz)return false;
  const shift=(mesh,count)=>{const v=mesh.instanceMatrix.array;for(let i=0;i<count;i++){v[i*16+12]-=dx;v[i*16+14]-=dz}mesh.instanceMatrix.needsUpdate=true;};
  for(const name of ['rocks','scree'])shift(this[name],this[name].count);
  this.key=`${old[0]},${old[1]},${origin.x},${origin.z}`;this.rocks.userData.detailKey=this.key;
  if(this._pending){const job=this._pending,cell=job.key.split(',');for(const name of ['rocks','scree'])shift(job.work[name],job.work[name].instanceMatrix.count);Object.assign(job.origin,origin);job.key=`${cell[0]},${cell[1]},${origin.x},${origin.z}`;}
  return true;
 }
 _rebase(key){
  if(!this.key)return false;const a=this.key.split(',').map(Number),b=key.split(',').map(Number);if(a[0]!==b[0]||a[1]!==b[1])return false;
  this.rebase({x:b[2],z:b[3]});this._pending=null;return true;
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
   const place=remembered(this.placementCaches.rocks,`${ix},${iz}`,()=>rockFormationAt(ix,iz));
   if(place)candidates.push({...place,distance});

  }
  candidates.sort((a,b)=>a.distance-b.distance);let ri=0,si=0;this.samples=[];const d=this.dummy,c=new THREE.Color();
  for(const r of candidates.slice(0,this.rocks.instanceMatrix.count)){
   if(ri%16===0)yield;
   const {x,z,h,surface,ix,iz,scale}=r;
   d.position.set(x-origin.x,h-.24,z-origin.z);d.rotation.set((rand(ix,iz+3)-.5)*.12,noise(x*.007,z*.007)*Math.PI+(rand(ix,iz+2)-.5)*.45,(rand(ix,iz+4)-.5)*.13);d.scale.set(scale,scale*(.62+rand(ix+4,iz)*.58),scale*(.72+rand(ix+5,iz)*.28));d.updateMatrix();this.rocks.setMatrixAt(ri,d.matrix);
   c.set(surface.volcanic>.3?'#686269':surface.grass>.2?'#889185':'#9b9990').lerp(new THREE.Color('#c4ccd0'),surface.snow*.50).multiplyScalar(.85+rand(ix+6,iz)*.35);this.rocks.setColorAt(ri++,c);this.samples.push({x,z,scale,kind:'rock'});
  }
  // Small stones make the shoulder read as broken ground. They are below tyre
  // obstacle scale; the larger outcrops share exact geometry with solid colliders.
  const pebbles=[];
  for(let iz=Math.floor((centerZ-80)/3);iz<=Math.ceil((centerZ+80)/3);iz++)for(let ix=Math.floor((centerX-80)/3);ix<=Math.ceil((centerX+80)/3);ix++){
   if((ix&15)===0)yield;
   const x=ix*3+rand(ix,iz)*2.7,z=iz*3+rand(iz,ix)*2.7;
   const place=remembered(this.placementCaches.scree,`${ix},${iz}`,()=>{if(riverMask(x,z)>.1)return null;const h=baseHeight(x,z);if(h<8)return null;const route=routeSample(x,z);if(route.distance<2.8)return null;const surface=surfaceAt(x,z);if(surface.canyonRock>.1||surface.snow>.75||surface.soft>.7||route.weights.beach+route.weights.dunes>.45)return null;return {ix,iz,x,z,h,surface}});
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
