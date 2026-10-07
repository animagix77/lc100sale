import assert from 'node:assert/strict';
import * as THREE from 'three/webgpu';
import {uniform} from 'three/tsl';
import {BeachLife} from './beach-life.mjs';
import {MountainDetails} from './mountain-details.mjs';
import {sceneryFade,stageSceneryArrival} from './scenery-fade.mjs';
import {LANDMARKS} from './expedition.mjs';
const zero={x:0,z:0},shift={x:512,z:-512};
const configs=[
 {View:BeachLife,names:['grass','logs','wrack','rocks','trunks','crowns','shrubs'],cell:32},
 {View:MountainDetails,names:['rocks','scree'],cell:16}
];
const id=(x,z)=>`${Math.round(x*100)},${Math.round(z*100)}`;
function instances(mesh,origin=zero){
 const result=new Map(),m=mesh.instanceMatrix.array,birth=mesh.geometry.attributes.sceneryBirth;
 for(let i=0;i<mesh.count;i++){const x=m[i*16+12]+origin.x,z=m[i*16+14]+origin.z;result.set(id(x,z),{x,z,birth:birth?.getX(i)})}
 return result;
}
const close=(map,p,radius=30)=>new Map([...map].filter(([,v])=>Math.hypot(v.x-p.x,v.z-p.z)<radius));
const clock=(view,time)=>{if(view.time)view.time.value=time;if(view.clock)view.clock.value=time};
const nearCases=[{x:128,z:-224},{x:248,z:-336},{x:273,z:-405},{x:365,z:-489},{x:447,z:-658},{x:527,z:-680}];
for(const mobile of [false,true])for(const {View,names,cell} of configs){
 const scene=new THREE.Scene(),view=new View(scene,{mobile});let time=1;
 for(const location of nearCases)for(const axis of ['x','z']){
  const before={...location,[axis]:Math.round(location[axis]/cell)*cell-.01},after={...before,[axis]:before[axis]+.02};
  clock(view,time++);view.refresh(before,zero);
  const old=Object.fromEntries(names.map(name=>[name,instances(view[name])]));
  clock(view,time++);view.refresh(after,zero);
  for(const name of names){
   const mesh=view[name],next=instances(mesh),label=`${View.name}.${name} mobile=${mobile}, ${axis}=${after[axis]} near ${location.x},${location.z}`;
   const visibleRadius=name==='scree'?mesh.userData.fadeRange.far-.05:30;
   assert.deepEqual([...close(next,after,visibleRadius).keys()].sort(),[...close(old[name],after,visibleRadius).keys()].sort(),`${label}: crossing a streaming boundary preserves every nearby visible object`);
   assert.deepEqual([...close(next,after,14).keys()].sort(),[...close(old[name],after,14).keys()].sort(),`${label}: the opaque foreground is stable`);
   if(mesh.geometry.attributes.sceneryBirth)for(const [key,instance] of next){
    if(old[name].has(key))assert.equal(instance.birth,old[name].get(key).birth,`${label}: a retained object must not fade in again`);
    else assert.equal(instance.birth,time-1,`${label}: only new scenery receives the current arrival time`);
   }
   const range=mesh.userData.fadeRange;assert(Number.isFinite(range.near)&&Number.isFinite(range.far)&&range.near>=0&&range.far>range.near,`${label}: distance fade has a finite ordered range`);
   if(name==='trunks'||name==='crowns'){const ghost=mesh.userData.sceneryGhost;assert(ghost&&!mesh.material.alphaHash&&mesh.material.depthWrite&&!mesh.material.transparent,'Near trees remain solid without stippling');assert(ghost.material.transparent&&!ghost.material.alphaHash&&!ghost.material.depthWrite&&!ghost.castShadow,'Distant trees fade smoothly without double shadows');assert.equal(ghost.count,mesh.count);assert.equal(ghost.geometry,mesh.geometry);assert.equal(ghost.instanceMatrix,mesh.instanceMatrix);assert.equal(ghost.instanceColor,mesh.instanceColor);}else assert(mesh.material.alphaHash&&mesh.material.opacityNode,`${label}: small vegetation retains hashed depth coverage`);
   assert(mesh.count<=mesh.instanceMatrix.count,`${label}: fixed instance capacity is respected`);
  }
 }
 const position=nearCases[1];view.refresh(position,zero);
 const retained=Object.fromEntries(names.map(name=>[name,{count:view[name].count,matrix:view[name].instanceMatrix.array.slice(),birth:view[name].geometry.attributes.sceneryBirth?.array.slice()}]));
 view.refresh(position,shift);
 for(const name of names){
  const mesh=view[name],prior=retained[name],rebased=mesh.instanceMatrix.array;
  assert.equal(mesh.count,prior.count,'Same-cell origin shifts retain instance order');
  for(let i=0;i<mesh.count;i++){
   assert(Math.abs(rebased[i*16+12]+shift.x-prior.matrix[i*16+12])<.001&&Math.abs(rebased[i*16+14]+shift.z-prior.matrix[i*16+14])<.001,`${View.name}.${name}: rebasing preserves world positions to float32 precision`);
   if(prior.birth)assert.equal(mesh.geometry.attributes.sceneryBirth.getX(i),prior.birth[i],'Rebasing never restarts a retained arrival');
  }
 }
 view.dispose();assert.equal(scene.children.length,0);
}
console.log('Scenery fade: near-field membership across streaming cells, stable retained birth times, fixed capacities and origin rebase passed.');

// Test arrival identity directly, including buffer reordering and a simultaneous
// cell/origin change rather than only the cheap same-cell rebase path.
const makeMesh=()=>{const mesh=new THREE.InstancedMesh(new THREE.BoxGeometry(),new THREE.MeshStandardNodeMaterial(),3);sceneryFade(mesh,{anchor:uniform(new THREE.Vector2()),clock:uniform(0),near:20,far:45});return mesh};
const old=makeMesh(),staged=makeMesh();old.count=2;staged.count=3;
const matrix=new THREE.Matrix4();
for(const [index,x,z,born] of [[0,105.975,-20,1],[1,30,-40,3]]){old.setMatrixAt(index,matrix.makeTranslation(x,0,z));old.geometry.attributes.sceneryBirth.setX(index,born)}
for(const [index,x,z] of [[0,30,-40],[1,105.975,-20],[2,45,-50]])staged.setMatrixAt(index,matrix.makeTranslation(x-shift.x,0,z-shift.z));
assert.notEqual(Math.round(old.instanceMatrix.array[12]*100),Math.round((staged.instanceMatrix.array[16+12]+shift.x)*100),'Fixture exercises a rounding-bucket boundary during origin rebase');
stageSceneryArrival(old,staged,7.5,zero,shift);
assert.deepEqual([...staged.geometry.attributes.sceneryBirth.array],[3,1,7.5],'Reordered survivors retain birthdays across origin changes');
stageSceneryArrival(old,staged,20,zero,shift,true);assert([...staged.geometry.attributes.sceneryBirth.array].every(n=>n===-2),'Initial scenery is immediately resolved');
for(const mesh of [old,staged]){mesh.geometry.dispose();mesh.material.dispose();mesh.dispose()}

for(const {View,names} of configs){
 const scene=new THREE.Scene(),view=new View(scene,{mobile:true,reduced:true});
 if(View===BeachLife)view.update({x:248,z:-336},10,zero);else{view.refresh({x:248,z:-336},zero);view.update({x:248,z:-336},zero,10)}
 if(View===BeachLife)view.update({x:447,z:-658},20,zero);else{view.update({x:447,z:-658},zero,20);view.refresh({x:447,z:-658},zero)}
 for(const name of names){const mesh=view[name],birth=mesh.geometry.attributes.sceneryBirth;if(birth)for(let i=0;i<mesh.count;i++)assert(birth.getX(i)<=-1,`${View.name}.${name}: reduced motion resolves new scenery without a timed reveal`)}
 view.dispose();
}
console.log('Scenery fade: direct arrival identity and reduced-motion reveal behavior passed.');

// Traverse representative route cells with budgeted generation. The current
// visible cell stays complete until a replacement commits; no additional meshes
// or instance storage are allocated per destination.
for(const {View,names} of configs){
 const scene=new THREE.Scene(),view=new View(scene,{mobile:true}),timings=[];view.refresh(LANDMARKS[0],zero);
 const capacity=names.map(n=>view[n].instanceMatrix.count),objects=scene.children.length;let maxSlices=0;
 for(const point of LANDMARKS.slice(1,-1)){
  const oldKey=view.key;let slices=0;
  do{const start=performance.now();const complete=view.stream(point,zero,.5);timings.push(performance.now()-start);slices++;
   assert(slices<5000,`${View.name}: streaming must complete in bounded batches`);
   if(complete||!view._pending)break;
   assert.equal(view.key,oldKey,'A partial scenery batch never changes the visible cell identity');
  }while(true);
  maxSlices=Math.max(maxSlices,slices);assert.deepEqual(names.map(n=>view[n].instanceMatrix.count),capacity);assert.equal(scene.children.length,objects);
  for(const [name,cache] of Object.entries(view.placementCaches)){const limit=View===MountainDetails?4000:name==='grass'?40000:name==='woodland'?4000:2400;assert(cache.size<=limit&&cache.fifo.length<=limit,'Static placement cache and eviction ring both stay bounded');}
  for(const name of names){const mesh=view[name];assert(mesh.count<=mesh.instanceMatrix.count);for(let i=0;i<mesh.count;i++)assert(Number.isFinite(mesh.instanceMatrix.array[i*16+12])&&Number.isFinite(mesh.instanceMatrix.array[i*16+14]))}
 }
 timings.sort((a,b)=>a-b);const pick=p=>timings[Math.min(timings.length-1,Math.floor(timings.length*p))].toFixed(2);
 console.log(`${View.name}: ${timings.length} bounded slices across 23 route stops; median ${pick(.5)}ms, p95 ${pick(.95)}ms, maximum ${pick(1)}ms; most slices per stop ${maxSlices}.`);
 view.dispose();assert.equal(scene.children.length,0);
}


// An uninterrupted drive can cross another cell while a staged build is still
// running. Repeated near-boundary retargets must not throw away partial work.
for(const {View,cell} of configs){
 const scene=new THREE.Scene(),view=new View(scene,{mobile:true});view.refresh(LANDMARKS[0],zero);
 const target={x:Math.round(128/cell)*cell-.01,z:-224};view.stream(target,zero,0);
 const pending=view._pending;assert(pending,'Fixture starts a multi-slice scenery build');let slices=0,completed=false;
 while(!completed){
  const p={...target,x:target.x+(slices%2===0?.02:0)};completed=view.stream(p,zero,0);slices++;
  assert(slices<5000,`${View.name}: crossing adjacent cells cannot starve a generation job`);
  if(!completed)assert.equal(view._pending,pending,`${View.name}: relevant staged work survives another nearby cell crossing`);
 }
 assert.equal(view.key,pending.key,'Completed scenery commits the original intact batch');
 assert(slices>20,'Fixture crosses the boundary repeatedly before the batch completes');view.dispose();assert.equal(scene.children.length,0);
}
console.log('Continuous driving: adjacent cell crossings preserve in-flight generation and cannot restart/starve streaming work.');


// A cache changes generation cost, not the generated scene. Compare an instance
// reused through several cells with a fresh uncached instance at each destination.
for(const mobile of [false,true])for(const {View,names} of configs){
 const cached=new View(new THREE.Scene(),{mobile});cached.refresh(LANDMARKS[0],zero);
 for(const [index,point] of nearCases.entries()){
  const origin=index%2===0?zero:shift,reference=new View(new THREE.Scene(),{mobile});cached.refresh(point,origin);reference.refresh(point,origin);
  for(const name of names){
   const actual=cached[name],expected=reference[name];assert.equal(actual.count,expected.count,'Cached placement never changes draw counts');
   for(let i=0;i<actual.count*16;i++)assert(Math.abs(actual.instanceMatrix.array[i]-expected.instanceMatrix.array[i])<.0001,`${View.name}.${name}: cached transforms equal fresh generation across rebase`);
   if(actual.count&&actual.instanceColor)assert.deepEqual(actual.instanceColor.array.slice(0,actual.count*3),expected.instanceColor.array.slice(0,expected.count*3),'Cached colors equal fresh generation');
   for(const attribute of ['windPhase','grassYaw','fernPhase','fernYaw'])if(actual.geometry.attributes[attribute])assert.deepEqual(actual.geometry.attributes[attribute].array.slice(0,actual.count),expected.geometry.attributes[attribute].array.slice(0,expected.count),'Wind seeds remain deterministic with cached placement');
  }
  reference.dispose();
 }
 cached.dispose();assert(Object.values(cached.placementCaches).every(cache=>cache.size===0&&cache.fifo.length===0),'Disposing scenery releases both cache entries and FIFO keys');
}
console.log('Placement caches: generated transforms, colors and wind seeds match fresh scenes across cells and rebases; memory limits and cleanup passed.');


// Distant soft tree passes add draw calls, never duplicate the collision-bearing
// instances or their buffers. Their private materials have separate ownership.
const forestScene=new THREE.Scene(),forest=new BeachLife(forestScene,{mobile:true});forest.refresh({x:248,z:-336},zero);
const treePasses=[forest.trunks,forest.crowns].map(mesh=>({mesh,ghost:mesh.userData.sceneryGhost,geometries:0,materials:0,instances:0}));
for(const record of treePasses){
 const {mesh,ghost}=record;assert(ghost&&ghost.parent===mesh&&ghost.count>0);
 assert.equal(ghost.geometry,mesh.geometry,'Far tree pass shares vertex and arrival attributes');
 assert.equal(ghost.instanceMatrix,mesh.instanceMatrix,'Far tree pass shares original collision placement buffer');
 assert.equal(ghost.instanceColor,mesh.instanceColor,'Far tree pass shares per-instance color storage');
 assert(mesh.material.alphaTest>0&&mesh.material.opacityNode&&ghost.material.opacityNode,'Opaque and transparent passes both use complementary visibility masks');
 assert(mesh.castShadow&&!ghost.castShadow,'Only opaque tree fragments cast a shadow');
 mesh.geometry.addEventListener('dispose',()=>record.geometries++);ghost.material.addEventListener('dispose',()=>record.materials++);ghost.addEventListener('dispose',()=>record.instances++);
}
forest.refresh({x:273,z:-405},shift);
for(const {mesh,ghost} of treePasses){assert.equal(ghost.count,mesh.count,'Far pass count follows an atomic scenery commit');assert.equal(ghost.instanceMatrix,mesh.instanceMatrix,'Rebasing retains a single shared placement buffer')}
forest.dispose();assert.equal(forestScene.children.length,0);
for(const record of treePasses){assert.equal(record.geometries,1,'Shared tree geometry is disposed exactly once');assert.equal(record.materials,1,'Far pass releases its private material');assert.equal(record.instances,1,'Far instancing resources are released');assert.equal(record.ghost.parent,null);assert(!record.mesh.userData.sceneryGhost)}
console.log('Tree fades: solid depth/shadow pass, smooth distant pass, shared geometry/instance buffers, synchronized counts and single-owner disposal passed.');
