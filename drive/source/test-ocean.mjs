import assert from 'node:assert/strict';
import * as THREE from 'three/webgpu';
import {Ocean} from './ocean.mjs';
for(const mobile of [false,true]){
 const scene=new THREE.Scene(),ocean=new Ocean(scene,{mobile});ocean.update({z:0},1,{x:0,z:0});
 const first=ocean.mesh.geometry,p=first.attributes.position;
 assert(p.count<40000,'Ocean geometry stays within the mobile/desktop budget');
 assert([...p.array].every(Number.isFinite),'All ocean positions are finite');
 assert(first.attributes.normal.getY(100)>.99,'Surface faces upward');
 ocean.update({z:1},2,{x:0,z:0});assert.equal(ocean.mesh.geometry,first,'Animation updates uniforms without rebuilding the mesh');
 const worldX=p.getX(100),worldZ=p.getZ(100);
 ocean.update({z:1},3,{x:512,z:-512});
 const rebased=ocean.mesh.geometry.attributes.position;
 assert(Math.abs(rebased.getX(100)+512-worldX)<.001&&Math.abs(rebased.getZ(100)-512-worldZ)<.001,'Floating-origin rebase preserves world-space wave phase');
 ocean.update({z:12000},4,{x:512,z:12000});assert.equal(ocean.mesh.geometry.attributes.position.count,p.count,'Endless coast keeps constant geometry size');
 assert.equal(ocean.mesh.geometry,first,'Crossing stream boundaries retains the ocean geometry');
 assert.equal(ocean.mesh.geometry.attributes.position,p,'Streaming reuses the same GPU position buffer');
 const {shore}=await import('./terrain.mjs');
 for(let j=0;j<=ocean.nz;j+=17)for(let i=0;i<=ocean.nx;i+=13){const k=j*(ocean.nx+1)+i,z=p.getZ(k)+12000,x=p.getX(k)+512;assert(Math.abs(x-shore(z)-ocean.columnOffsets[i])<.0003,'Reused grid follows the world coastline without drift')}

  const contacts=Array.from({length:4},(_,i)=>({x:-36+(i%2)*2,y:-1,z:i<2?-1.4:1.4}));
 const physics={speed:0,origin:{x:0,z:0},vehicle:{wheelContactPoint:i=>contacts[i],wheelIsInContact:()=>true}};
 for(let i=0;i<60;i++)ocean.updateWheelFoam(1/60,physics,1);
 assert(ocean.wheelFoam.every(slot=>slot.value.z>.59),'All four wet tires receive gentle foam even at rest');
 physics.speed=8;for(let i=0;i<60;i++)ocean.updateWheelFoam(1/60,physics,1);
 assert(ocean.wheelFoam.every(slot=>slot.value.z<.001),'Moving forward removes tire rings');
 physics.speed=-2;for(let i=0;i<30;i++)ocean.updateWheelFoam(1/60,physics,1);
 assert(ocean.wheelFoam.every(slot=>slot.value.z<.001),'Reverse also keeps rings off');
 physics.speed=0;for(let i=0;i<90;i++)ocean.updateWheelFoam(1/60,physics,1);
 assert(ocean.wheelFoam.every(slot=>slot.value.z>.59),'Stopping restores gentle rings');
 physics.rb={linvel:()=>({x:.5,y:0,z:0})};for(let i=0;i<45;i++)ocean.updateWheelFoam(1/60,physics,1);
 assert(ocean.wheelFoam.every(slot=>slot.value.z<.001),'Sideways sliding removes rings too');
 delete physics.rb;
 physics.origin={x:512,z:-512};contacts.forEach(c=>{c.x-=512;c.z+=512});ocean.updateWheelFoam(1/60,physics,1);
 assert.equal(ocean.wheelFoam[0].value.x,-36,'Foam remains at the world-space wheel after rebasing');
 contacts.forEach(c=>c.y=3);for(let i=0;i<90;i++)ocean.updateWheelFoam(1/60,physics,1);
 assert(ocean.wheelFoam.every(slot=>slot.value.z<.001),'Dry tires shed residual foam');
 ocean.clear();assert(ocean.wheelFoam.every(slot=>slot.value.z===0),'Recovery/reset clears wheel foam');

 assert.equal(scene.children.length,1,'Streaming does not accumulate ocean meshes');ocean.dispose();
 console.log({mobile,vertices:p.count});
}
console.log('Ocean mesh, streaming, animation budget and rebase checks passed');

// A render frame can consume several physics marks for each wheel. Keep one
// bounded disturbance cadence regardless of how many marks were batched.
for(const mobile of [false,true]){
 const {riverZ}=await import('./expedition.mjs'),scene=new THREE.Scene(),ocean=new Ocean(scene,{mobile}),z=riverZ(248);
 ocean.update({x:248,z},0,{x:0,z:0});const pixels=ocean.wakePixels,texture=ocean.wakeTexture;
 const run=duplicates=>{
  ocean.clear();
  for(let frame=0;frame<120;frame++){
   const time=frame/120;
   for(let repeat=0;repeat<duplicates;repeat++)for(let wheel=0;wheel<4;wheel++)ocean.disturb({x:248+(wheel%2? .85:-.85),z:z-time*4+(wheel<2?-1.3:1.3),wheel,slip:0},22.352,0,time);
   ocean.wake.step(1/120);
  }
  return {impulses:ocean.wake.impulses,height:ocean.wake.height.slice()};
 };
 const normal=run(1),batch=run(8);assert.equal(batch.impulses,normal.impulses,'Repeated marks at the same time add no extra wake impulses');assert.deepEqual(batch.height,normal.height,'Batch size cannot change water energy');
 assert(batch.impulses<=(mobile?24:30)*4,'Four wet tires stay within the fixed mobile/desktop wake budget');
 ocean.update({x:248,z},1,{x:0,z:0});const before=ocean.height(248,z-.5,1);ocean.update({x:248,z},1,{x:512,z:-512});
 const after=ocean.height(248,z-.5,1);assert.equal(after,before,'Floating-origin rebase preserves the exact large-wake water sample');
 assert.equal(ocean.wakePixels,pixels);assert.equal(ocean.wakeTexture,texture,'Large wakes reuse the same GPU texture');
 ocean.clear();assert(ocean.disturb({x:248,z,wheel:0,slip:0},22.352,0,0),'Reset releases the cadence even when the clock restarts');
 ocean.dispose();
}
console.log('Ocean wake cadence: repeated mark batches, four-wheel/mobile budgets, reusable texture and reset passed');
