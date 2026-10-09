import assert from 'node:assert/strict';
import * as THREE from 'three/webgpu';
import {DrivePhysics,RAPIER} from './physics.mjs';
import {VolcanoHazards,volcanoHazardStrength,volcanoRockFlight} from './volcano-hazards.mjs';
const scene=new THREE.Scene(),physics=await DrivePhysics.create(),height=112,field={height:()=>height},p={x:487,y:height+1.04,z:-669},camera=new THREE.PerspectiveCamera();camera.position.set(p.x+10,p.y+5,p.z+12);physics.reset(p.x,p.z,height);
physics.obstacles={handles:new Set(),kinds:new Map(),has(c){return !!c&&this.handles.has(c.handle)},kind(c){return c?this.kinds.get(c.handle):undefined}};
const ground=physics.world.createCollider(RAPIER.ColliderDesc.cuboid(110,.5,110).setTranslation(p.x,height-.5,p.z));
const initialBodies=physics.world.bodies.len(),initialColliders=physics.world.colliders.len(),hazards=new VolcanoHazards(scene,physics,field);
assert.equal(hazards.pool.length,10);assert.equal(physics.world.bodies.len(),initialBodies+10);assert.equal(physics.world.colliders.len(),initialColliders+10);assert(hazards.pool.every(r=>!r.body.isEnabled()));
assert.equal(volcanoHazardStrength(0,0),0);assert(volcanoHazardStrength(p.x,p.z)>.7,'Lava crossing has local eruption activity');
for(let i=0;i<100;i++){
 const f=volcanoRockFlight(p,{x:0,z:-1},i,field.height);assert(Math.abs(f.targetX-p.x)>=6.5,'Landing target leaves the truck footprint clear');assert(Math.hypot(f.targetX-p.x,f.targetZ-p.z)<26);
 assert(Math.abs(f.x+f.vx*f.duration-f.targetX)<1e-8);assert(Math.abs(f.z+f.vz*f.duration-f.targetZ)<1e-8);assert(Math.abs(f.y+f.vy*f.duration-4.905*f.duration*f.duration-height)<1e-8,'Launch follows a gravity-driven ballistic arc');
}
let creates=0;const create=physics.world.createCollider.bind(physics.world);physics.world.createCollider=(...args)=>{creates++;return create(...args)};
let sawSettled=false,sawSound=false,sawImpactSmoke=false,maxLive=0,maxEmbers=0,maxSmoke=0;const handles=hazards.pool.map(r=>r.collider.handle);
for(let i=0;i<1800;i++){
 physics.step(1/60,{brake:true});hazards.update(physics.position(),i/60,physics.origin,camera,{wind:24});maxLive=Math.max(maxLive,hazards.stats.rocks);sawSettled ||= hazards.pool.some(r=>r.active&&r.settled);sawImpactSmoke ||= hazards.stats.impactSmoke>0;maxEmbers=Math.max(maxEmbers,hazards.stats.embers);maxSmoke=Math.max(maxSmoke,hazards.stats.smoke);
 assert(hazards.stats.rocks<=10&&hazards.stats.embers<=144&&hazards.stats.smoke<=22&&hazards.stats.impactSmoke<=30);assert(hazards.events.length<=8);
 if(i%60===0)for(const event of hazards.drainImpacts()){sawSound=true;assert.equal(event.kind,'rock');assert(event.energy>0&&event.energy<=1);assert(Math.abs(event.pan)<=.8);assert.equal(event.source,'volcano');assert(event.radius>=.32&&event.radius<=.66);assert(event.velocity>=1.3);assert(event.distance>=0&&event.distance<38);assert.equal(typeof event.ground,'boolean')}
 if(i===180){
  const before=hazards.pool.filter(r=>r.active).map(r=>({r,position:r.body.translation()}));physics.rebase(512,-672);ground.setTranslation({x:p.x-physics.origin.x,y:height-.5,z:p.z-physics.origin.z});camera.position.x-=512;camera.position.z+=672;hazards.update(physics.position(),i/60,physics.origin,camera,{});
  for(const {r,position} of before){const now=r.body.translation();assert(Math.abs(now.x+512-position.x)<.0001);assert(Math.abs(now.z-672-position.z)<.0001);assert.equal(now.y,position.y)}
 }
}
assert(maxLive>=4,'Several rocks coexist around the volcanic drive');assert(sawSettled,'Bounced rocks settle into tyre-solid chunks');assert(sawSound,'Nearby ground impacts produce the existing audio event shape');assert(sawImpactSmoke,'Real Rapier ground contacts bloom into visible impact ash');assert(maxEmbers>70,'The pass has a field of fine embers');assert(maxSmoke>10,'Layered ambient smoke fills the pass');assert.equal(creates,0,'Updates never allocate colliders');assert.deepEqual(hazards.pool.map(r=>r.collider.handle),handles,'Pooling and rebasing retain collider handles');
for(const mesh of [hazards.rocks,hazards.embers,hazards.smoke,hazards.impactSmoke])assert([...mesh.instanceMatrix.array].every(Number.isFinite));
hazards.update({x:0,y:1,z:0},31,physics.origin,camera,{});assert.deepEqual(hazards.stats,{rocks:0,embers:0,smoke:0,impactSmoke:0,impacts:hazards.stats.impacts});assert(hazards.pool.every(r=>!r.body.isEnabled()));assert.equal(physics.obstacles.handles.size,0);
// A deliberately intercepted projectile transfers momentum to the actual chassis.
hazards.reset();physics.reset(p.x,p.z,height);const rock=hazards.pool[0],local=physics.rb.translation();Object.assign(rock,{active:true,started:40,expires:60,hitAt:-100,lastVx:18,lastVy:0,lastVz:0,age:0,settled:false});rock.body.setBodyType(RAPIER.RigidBodyType.Dynamic,true);rock.body.setTranslation({x:local.x-3,y:local.y+.35,z:local.z},true);rock.body.setLinvel({x:18,y:0,z:0},true);rock.body.setEnabled(true);hazards.nextSpawn=100;let truckMotion=0;
for(let i=0;i<36;i++){hazards.update(physics.position(),40+i/120,physics.origin,camera,{});physics.step(1/120,{brake:true});truckMotion=Math.max(truckMotion,Math.abs(physics.rb.linvel().x))}
assert(truckMotion>.12,'Airborne rock physically hits and moves the truck');
const chassisSounds=hazards.drainImpacts();assert.equal(chassisSounds.length,1,'A projectile hitting a stationary truck emits one rock sound without contact chatter');assert.equal(chassisSounds[0].kind,'rock');assert(chassisSounds[0].energy>.25,'Sound energy includes the moving rock, even when the truck was parked');
assert.equal(creates,0,'Chassis impact monitoring never allocates colliders');
// Once settled, the same collider is included in the existing tyre ray query.
const target={x:local.x-1,y:height+.35,z:local.z-1.4};rock.body.setTranslation(target,true);rock.body.setLinvel({x:0,y:0,z:0},false);rock.body.setBodyType(RAPIER.RigidBodyType.Fixed,false);rock.settled=true;physics.world.step();
const hit=physics.world.castRay(new RAPIER.Ray({x:target.x,y:height+4,z:target.z},{x:0,y:-1,z:0}),5,true,RAPIER.QueryFilterFlags.EXCLUDE_DYNAMIC);assert.equal(hit.collider.handle,rock.collider.handle,'Settled rocks are visible to wheel collision queries');assert.equal(physics.obstacles.kind(rock.collider),'rock');
// Sound deduplication must never hide a real ground impact, even if the same
// rock struck the chassis immediately beforehand. Puffs remain world anchored.
hazards.reset();hazards.nextSpawn=200;physics.feedback.bodyAt.set(rock.collider.handle,physics.time+1);
const contact={x:p.x-physics.origin.x+8,y:height+.4,z:p.z-physics.origin.z};hazards._impact(rock,contact,p,70,20,true);assert.equal(hazards.drainImpacts().length,0);
hazards._impact(rock,contact,p,70.01,20,false);const landing=hazards.drainImpacts();assert.equal(landing.length,1);assert.equal(landing[0].ground,true);hazards._impactClouds(p,70.25,camera,{},1);assert.equal(hazards.stats.impactSmoke,hazards.impactParticles);
const puff=hazards.impactPool.find(v=>v.active),worldPuff={x:puff.x,z:puff.z},beforeMatrix=new THREE.Matrix4();hazards.impactSmoke.getMatrixAt(0,beforeMatrix);const oldOrigin={...hazards.origin};hazards._rebase({x:oldOrigin.x+128,z:oldOrigin.z-128});camera.position.x-=128;camera.position.z+=128;hazards._impactClouds(p,70.25,camera,{},1);const afterMatrix=new THREE.Matrix4();hazards.impactSmoke.getMatrixAt(0,afterMatrix);
assert.deepEqual({x:puff.x,z:puff.z},worldPuff);assert(Math.abs(afterMatrix.elements[12]+128-beforeMatrix.elements[12])<.0001);assert(Math.abs(afterMatrix.elements[14]-128-beforeMatrix.elements[14])<.0001);
hazards._impactClouds(p,74,camera,{},1);assert.equal(hazards.stats.impactSmoke,0,'Impact clouds expand and fully fade');
for(let i=0;i<40;i++)hazards._burst(p.x+i*.1,p.z,80+i*.01,.65,22);assert.equal(hazards.impactPool.length,6);hazards._impactClouds(p,80.5,camera,{},1);assert.equal(hazards.stats.impactSmoke,30,'Impact storms reuse the fixed particle pool');
hazards.reset();assert.deepEqual(hazards.stats,{rocks:0,embers:0,smoke:0,impactSmoke:0,impacts:0});assert.equal(hazards.drainImpacts().length,0);hazards.dispose();assert.equal(physics.world.bodies.len(),initialBodies);assert.equal(physics.world.colliders.len(),initialColliders);assert.equal(scene.children.length,0);
for(const options of [{mobile:true},{reduced:true}]){const h=new VolcanoHazards(scene,physics,field,options);h.update(p,0,physics.origin,camera,{});assert.equal(h.pool.length,options.mobile?6:10);assert.equal(h.emberCount,options.reduced?16:88);assert.equal(h.smokeCount,options.reduced?8:14);assert(h.stats.impactSmoke<=h.impactCount*h.impactParticles);if(options.reduced){assert.equal(h.stats.rocks,0);assert(h.stats.embers<=16);h._impact(h.pool[0],{x:p.x-physics.origin.x,y:height,z:p.z-physics.origin.z},p,1,20);assert(h.impactPool.every(v=>!v.active),'Reduced motion disables the impact bloom')}h.dispose()}
physics.dispose();
console.log('Volcano hazards: safe ballistic landings, bounded pools, ground bounces, truck collisions, tyre-solid settled rocks, audio events, dense fine embers, layered smoke, contact ash, rebase, locality, reduced motion, reset and disposal passed.');
