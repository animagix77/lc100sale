import assert from 'node:assert/strict';
import * as THREE from 'three/webgpu';
import {DrivePhysics,RAPIER,wheelLayout} from './physics.mjs';
import {SandField} from './terrain.mjs';
import {TerrainView} from './terrain-view.mjs';
import {LANDMARKS} from './expedition.mjs';
const field=new SandField(),p=await DrivePhysics.create(field),view=new TerrainView(new THREE.Scene(),p,field);
const geometry=view.geometry.bind(view),infrastructureColliders=p.world.colliders.len();
view.update(-14,0);view.geometry=()=>{throw new Error('Driving must not synchronously generate full visual tiles');};
const samples=[{x:0,z:0},...wheelLayout,{x:4.8,z:4.8},{x:-4.8,z:-4.8}];
let probes=0,guardFrames=0,largestPool=0,farChanges=0,farMesh=view.far;
function checkGround(x,z){
 if(view.far!==farMesh){farChanges++;farMesh=view.far;}
 p.world.step();
 for(const offset of samples){const wx=x+offset.x,wz=z+offset.z,y=field.height(wx,wz),hit=p.world.castRay(new RAPIER.Ray({x:wx-p.origin.x,y:y+3,z:wz-p.origin.z},{x:0,y:-1,z:0}),5,true,RAPIER.QueryFilterFlags.EXCLUDE_DYNAMIC,undefined,undefined,undefined,c=>!p.bridge.has(c));
  assert(hit,`No invisible hole at ${wx.toFixed(2)}, ${wz.toFixed(2)}`);assert(Math.abs(hit.timeOfImpact-3)<.18,`Collision matches the half-metre terrain at ${wx}, ${wz}`);probes++;
 }
 assert(view.tiles.size<=25,'Old tiles retire without waiting for the whole new ring');assert(view.tiles.size+view.cache.size<=49,'Resident terrain remains bounded');assert(p.world.colliders.len()<=infrastructureColliders+26,'Terrain adds only local tiles and one temporary support patch to the vehicle/bridge infrastructure');largestPool=Math.max(largestPool,view.tiles.size+view.cache.size);if(view.safetyGround)guardFrames++;
}
// Reproduce the real game update cadence: no prewarming, 50 mph at 20 FPS.
// Previous tests streamed once per 120-Hz physics step and hid this starvation.
for(let segment=0;segment<LANDMARKS.length-1;segment++){
 const a=LANDMARKS[segment],b=LANDMARKS[segment+1],frames=Math.ceil(Math.hypot(b.x-a.x,b.z-a.z)/(22.35/20));
 for(let i=0;i<=frames;i++){
  const x=a.x+(b.x-a.x)*i/frames,z=a.z+(b.z-a.z)*i/frames;view.update(x,z);
  if(Math.abs(x-p.origin.x)>512||Math.abs(z-p.origin.z)>512){p.rebase(Math.round((x-p.origin.x)/32)*32,Math.round((z-p.origin.z)/32)*32);view.rebase();}
  if(i%5===0)checkGround(x,z);
 }
}
assert(farChanges>=2,'The far horizon advances during continuous driving, without waiting for every prefetched tile');
// Simulate a fully occupied rendering budget across the exact first problem
// corridor, then the homeward grass. Collision must not depend on visual jobs.
view.budget=0;
for(const segment of [3,4,...['Last puddle','Homeward meadow','Back to grass'].map(name=>LANDMARKS.findIndex(p=>p.name===name))]){
 const a=LANDMARKS[segment],b=LANDMARKS[segment+1];
 // An explicit teleport can build the initial neighbourhood; subsequent drive cannot.
 view.geometry=(...args)=>args[4]?new THREE.PlaneGeometry(1,1):geometry(...args);view.update(a.x,a.z,true);view.geometry=()=>{throw new Error('No synchronous visual generation in starved driving');};
 const frames=Math.ceil(Math.hypot(b.x-a.x,b.z-a.z)/(22.35/20));
 for(let i=0;i<=frames;i++){const x=a.x+(b.x-a.x)*i/frames,z=a.z+(b.z-a.z)*i/frames;view.update(x,z);checkGround(x,z);}
}
assert(guardFrames>0,'The temporary support patch is exercised under renderer starvation');
// Ruts and origin shifts still use exactly the same terrain under a temporary patch.
let pos={x:192,z:-288};view.geometry=(...args)=>args[4]?new THREE.PlaneGeometry(1,1):geometry(...args);view.update(64,-164,true);view.geometry=()=>{throw new Error('No visual generation');};
for(let t=0;t<=1;t+=.02)view.update(64+(pos.x-64)*t,-164+(pos.z+164)*t);view.update(pos.x,pos.z);
assert(view.safetyGround);for(let i=0;i<30;i++)field.stamp(pos.x,pos.z,1,.17,2);view.refresh();checkGround(pos.x,pos.z);
p.rebase(96,-224);view.rebase();checkGround(pos.x,pos.z);p.rebase(-192,320);view.rebase();checkGround(pos.x,pos.z);
// A nearby recovery rests on the physical patch; no reset is needed to stop falling.
p.reset(pos.x,pos.z,field.height(pos.x,pos.z));
for(let i=0;i<240;i++){const at=p.position();view.update(at.x,at.z);p.step(1/120,{brake:true});if(i%16===0)view.refresh();assert(p.position().y>field.height(p.position().x,p.position().z)-.5,'The full chassis stays on streamed physical ground');}
view.budget=3;for(let i=0;i<650&&(view.pending.size||view.safetyGround);i++)view.update(pos.x,pos.z);
assert.equal(view.safetyGround,null,'Temporary collider retires when detailed tiles catch up');checkGround(pos.x,pos.z);
view.dispose();assert.equal(p.world.colliders.len(),infrastructureColliders,'Disposal releases both detailed and temporary terrain while retaining bridge infrastructure');p.dispose();
console.log({probes,guardFrames,largestPool,farChanges});console.log('Terrain coverage: full-route 50-mph/20-FPS streaming, starved grass corridors, ruts, origin shifts, rigid-body support and bounded cleanup passed.');
