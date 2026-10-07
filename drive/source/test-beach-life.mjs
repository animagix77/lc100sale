import assert from 'node:assert/strict';
import * as THREE from 'three/webgpu';
import {BeachLife} from './beach-life.mjs';
import {shore} from './terrain.mjs';
import {oceanHeight} from './ocean-height.mjs';
for(const mobile of [false,true]){
 const scene=new THREE.Scene(),life=new BeachLife(scene,{mobile}),p={x:shore(0)+22,z:0},origin={x:0,z:0};life.update(p,0,origin);
 console.log({mobile,...life.stats});assert(life.stats.grass>100);assert(life.stats.logs>0&&life.stats.wrack>0);assert.equal(life.boats.length,5);
 const samples=JSON.stringify(life.samples),mat=life.logs.instanceMatrix.array.slice();life.update({x:p.x+1,z:1},1,origin);assert.equal(JSON.stringify(life.samples),samples,'No reshuffling within a world cell');assert.deepEqual(life.logs.instanceMatrix.array,mat);assert.equal(life.time.value,1,'Wind clock advances');
 for(const s of life.samples){const d=s.x-shore(s.z);assert(d<16||d>29,'Main driving strip stays clear of debris')}
 const boat=life.boats[0],before=boat.mesh.position.clone();life.update(p,5,origin);assert(boat.mesh.position.distanceTo(before)>.05,'Fishing boats move with the swell');assert(Math.abs(boat.mesh.position.y-oceanHeight(boat.x,boat.z,5)+.13)<1e-6);for(const b of life.boats)assert(b.x<shore(b.z)-70,'Fleet stays offshore');
 const world=life.boats.map(b=>b.mesh.position.clone());life.update(p,5,{x:512,z:-512});life.boats.forEach((b,i)=>{assert(Math.abs(b.mesh.position.x+512-world[i].x)<1e-6);assert(Math.abs(b.mesh.position.z-512-world[i].z)<1e-6)});
 for(const z of [-2000,4000,10000]){life.update({x:shore(z)+22,z},8,{x:0,z});for(const m of [life.grass,life.logs,life.wrack,life.rocks]){assert(m.count<=m.instanceMatrix.count);assert([...m.instanceMatrix.array].every(Number.isFinite))}assert.equal(scene.children.length,12,'Streaming keeps object count fixed')}
 life.dispose();assert.equal(scene.children.length,0);
}
const calm=new BeachLife(new THREE.Scene(),{reduced:true});calm.update({x:-14,z:0},5,{x:0,z:0});assert.equal(calm.time.value,0);calm.dispose();console.log('Scenery: placement, wind, boat flotation, world anchoring, bounded streaming and disposal passed');

const meadow=new BeachLife(new THREE.Scene());meadow.update({x:190,z:-278},0,{x:0,z:0});const blade=meadow.grassData.find(g=>Math.hypot(g.x-190,g.z+278)<10);assert(blade,'Meadow has grass beside the route');
const at={x:blade.x+.4,z:blade.z};for(let i=1;i<=60;i++)meadow.update(at,i/60,{x:0,z:0},{wind:8},0);
assert(blade.by>.8&&Math.hypot(blade.bx,blade.bz)>.5,'Truck parts and flattens nearby grass');
for(let i=61;i<=660;i++)meadow.update({x:at.x-12,z:at.z},i/60,{x:0,z:0},{wind:8},0);assert(blade.by>.75,'Crushed grass remains flat behind the vehicle');
const tracked={x:blade.x,z:blade.z};meadow.update({x:400,z:-460},12,{x:0,z:0});meadow.update({x:at.x-12,z:at.z},13,{x:512,z:-512});const restored=meadow.grassData.find(g=>g.x===tracked.x&&g.z===tracked.z);assert(restored?.by>.75,'Flattened trail survives streaming and origin rebasing');
for(let i=0;i<120;i++)meadow.update({x:at.x-12,z:at.z},360+i/60,{x:512,z:-512});assert(restored.by<.025,'Flattened grass gradually recovers after several minutes');meadow.dispose();
console.log('Interactive meadow: physical footprint bends, parts, and regrows grass.');

for(const mobile of [false,true]){
 const scene=new THREE.Scene(),life=new BeachLife(scene,{mobile}),p={x:248,z:-336};life.update(p,1,{x:0,z:0},{wind:16});
 assert(life.stats.trees>35&&life.stats.shrubs>60,'Riverbank keeps dense canopy and fern cover');
 const matrix=new THREE.Matrix4();
 for(const mesh of [life.crowns,life.shrubs]){
  const geometry=mesh.geometry,triangles=(geometry.index?.count??geometry.attributes.position.count)/3;
  assert(triangles<700,'Detailed vegetation keeps a bounded per-instance geometry budget');
  assert(mesh.count<=mesh.instanceMatrix.count);
  for(const key of ['position','normal','color'])assert([...geometry.attributes[key].array].every(Number.isFinite),'Vegetation attributes stay finite');
  for(let i=0;i<mesh.count;i++){mesh.getMatrixAt(i,matrix);assert(matrix.determinant()>0,'Canopies and ferns retain valid instance transforms')}
 }
 assert(life.shrubs.geometry.attributes.fernPhase.count===life.shrubs.instanceMatrix.count,'Every streamed fern has a wind phase');
 const before=life.shrubs.instanceMatrix.array.slice();life.update(p,3,{x:0,z:0},{wind:16});assert.deepEqual(life.shrubs.instanceMatrix.array,before,'Wind animation does not reshuffle the riverbank');
 assert.equal(scene.children.length,12,'Detail adds no scene objects');life.dispose();assert.equal(scene.children.length,0);
}
const stillForest=new BeachLife(new THREE.Scene(),{reduced:true});stillForest.update({x:248,z:-336},20,{x:0,z:0},{wind:45});assert.equal(stillForest.windStrength.value,0,'Reduced motion disables fern sway');stillForest.dispose();
console.log('Woodland detail: bounded canopy and fern geometry, stable placement, wind attributes, reduced motion and cleanup passed.');

// Streaming preserves the old visible/collidable cell until the entire replacement
// is ready; no partially rewritten world may be rendered between budget slices.
const streamed=new BeachLife(new THREE.Scene(),{mobile:true}),reference=new BeachLife(new THREE.Scene(),{mobile:true}),zero={x:0,z:0};
streamed.refresh({x:-14,z:0},zero);const startKey=streamed.key,startMatrices=streamed.grass.instanceMatrix.array.slice();
const destination={x:248,z:-336};reference.refresh(destination,zero);let slices=0;
while(streamed.key===startKey){const complete=streamed.stream(destination,zero,0);slices++;if(!complete)assert.deepEqual(streamed.grass.instanceMatrix.array,startMatrices,'Incomplete stream stays off the visible buffers');assert(slices<10000)}
assert(slices>20,'Scenery generation yields between bounded batches');
assert.deepEqual(streamed.stats,reference.stats);assert.deepEqual(streamed.grass.instanceMatrix.array,reference.grass.instanceMatrix.array,'Streaming retains all full-detail grass placement');assert.deepEqual(streamed.crowns.instanceMatrix.array,reference.crowns.instanceMatrix.array);
const stable=streamed.key;streamed.stream({x:447,z:-658},zero,0);assert(streamed._pending);streamed.stream(destination,zero,0);assert.equal(streamed._pending,null,'Returning to current cell cancels obsolete work');assert.equal(streamed.key,stable);
const worldMatrix=streamed.grass.instanceMatrix.array.slice();streamed.refresh(destination,{x:512,z:-512});for(let i=0;i<streamed.grass.count;i++){assert(Math.abs(streamed.grass.instanceMatrix.array[i*16+12]+512-worldMatrix[i*16+12])<.001);assert(Math.abs(streamed.grass.instanceMatrix.array[i*16+14]-512-worldMatrix[i*16+14])<.001)}
assert.equal(streamed._pending,null,'Rebasing existing scenery does not rebuild its generation queue');streamed.dispose();reference.dispose();
console.log('Budgeted scenery streaming: atomic visibility, unchanged placement, cancellation, and cheap origin shift passed.');
