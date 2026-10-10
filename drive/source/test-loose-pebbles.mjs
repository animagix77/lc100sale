import assert from 'node:assert/strict';
import * as THREE from 'three/webgpu';
import {VEHICLE_SETUP} from './vehicle-spec.mjs';
import {DrivePhysics,RAPIER,wheelLayout} from './physics.mjs';
import {LoosePebbles,pebbleHabitat} from './loose-pebbles.mjs';
const dt=1/120,field={height:()=>0};
for(const mobile of [false,true]){
 const scene=new THREE.Scene(),p=await DrivePhysics.create(),start={x:64,z:-164};p.reset(start.x,start.z,0);
 const ground=p.world.createCollider(RAPIER.ColliderDesc.cuboid(150,.5,150).setTranslation(start.x,-.5,start.z));
 const before={b:p.world.bodies.len(),c:p.world.colliders.len()},groups=p.chassis.collisionGroups(),gravel=new LoosePebbles(scene,p,field,{mobile});
 assert.equal(p.world.bodies.len(),before.b+gravel.capacity+4);assert.equal(gravel.capacity,mobile?72:120);
 const handles=gravel.pool.map(r=>r.collider.handle);let allocations=0;const create=p.world.createCollider.bind(p.world);p.world.createCollider=(...args)=>{allocations++;return create(...args)};
 for(let i=0;i<120;i++)p.step(dt,{brake:true});
 // Four independent push shapes must not become suspension ground or hit the truck.
 assert([0,1,2,3].every(i=>p.vehicle.wheelIsInContact(i)),'Tyres retain terrain contact');
 assert([0,1,2,3].every(i=>!gravel.handles.has(p.vehicle.wheelGroundObject(i)?.handle)),'Suspension cannot raycast its own push shapes');
 const parked=p.rb.translation();assert(Math.abs(parked.x-start.x)<.02&&Math.abs(parked.z-start.z)<.02,'Push shapes do not push their own chassis');
 // Deliberately place one real convex pebble partly in the left tyre track.
 const rock=gravel.pool[1],x=start.x+wheelLayout[0].x+VEHICLE_SETUP.wheelWidth/2+.025,z=start.z-4,y=rock.radius*gravel.bottom+.012;
 Object.assign(rock,{key:'contact-test',x,z,moved:false});gravel.active.set(rock.key,rock);rock.body.setTranslation({x,y,z},false);rock.body.setEnabled(true);rock.body.wakeUp();
 let peakHeight=0,peakSpeed=0,angle=0,contact=false;
 for(let i=0;i<540;i++){
  p.step(dt,i<360?{gas:true}:{brake:true});gravel.update(p.position());const at=rock.body.translation(),v=rock.body.linvel();peakHeight=Math.max(peakHeight,at.y);peakSpeed=Math.max(peakSpeed,Math.hypot(v.x,v.y,v.z));angle=Math.max(angle,Math.abs(rock.body.rotation().w-1));
  p.world.contactPairsWith(rock.collider,c=>{if(gravel.handles.has(c.handle))contact=true});
 }
 const displaced=rock.body.translation();console.log({mobile,contact,displacement:Math.hypot(displaced.x-x,displaced.z-z),side:displaced.x-x,peakHeight,peakSpeed});
 assert(contact,'The tyre and stone must share a real Rapier contact manifold');assert(Math.hypot(displaced.x-x,displaced.z-z)>.04,'Tyre contact displaces the stone');assert(Math.abs(displaced.x-x)>.03,'Off-centre contact pushes the stone sideways');assert(angle>.02,'Contact produces angular motion');assert(peakHeight<4&&peakSpeed<22,'Small stones do not explode from a contact');
 for(let i=0;i<1800;i++)p.step(dt,{brake:true});
 assert(rock.body.isSleeping()||Math.hypot(...Object.values(rock.body.linvel()))<.05,'A displaced stone settles instead of animating forever');
 const settled={...rock.body.translation()},rotation={...rock.body.rotation()};gravel.update(p.position());assert(gravel.stats.displaced>=1);
 // Origin shifts preserve the exact physical pose and velocity.
 p.rebase(512,-512);ground.setTranslation({x:start.x-512,y:-.5,z:start.z+512});const shifted=rock.body.translation();assert(Math.abs(shifted.x+512-settled.x)<.0001);assert(Math.abs(shifted.z-512-settled.z)<.0001);assert.deepEqual({...rock.body.rotation()},rotation);
 gravel.retire(rock);assert(gravel.history.has('contact-test'),'Retiring retains the displaced world position');
 const saved=gravel.history.get('contact-test');assert(Math.abs(saved.x-settled.x)<.0001);
 p.reset(start.x,start.z,0);for(let i=0;i<20;i++)gravel.stream(p.position());gravel.update(p.position());assert(gravel.stats.visible>15,'Dry dirt receives distributed pebbles');assert(gravel.stats.visible<=gravel.capacity);
 for(const r of gravel.active.values()){const at=r.body.translation();assert(Math.hypot(at.x+p.origin.x-start.x,at.z+p.origin.z-start.z)>=3.19,'Fresh pebbles never appear beneath the truck')}
 const retained=[...gravel.active.values()].find(r=>{const at=r.body.translation();return Math.hypot(at.x+p.origin.x-start.x,at.z+p.origin.z-start.z)>5});
 const displacedPose=retained.body.translation();retained.body.setTranslation({x:displacedPose.x+.45,y:displacedPose.y,z:displacedPose.z+.2},true);const retainKey=retained.key;gravel.retire(retained);gravel.stream(p.position());const restored=gravel.active.get(retainKey);assert(restored,'A retired local stone is restored');assert(Math.abs(restored.body.translation().x-(displacedPose.x+.45))<.0001,'Revisiting preserves the displaced position instead of the original seed');
 for(let i=0;i<80;i++){const point={x:start.x+i*7,z:start.z};gravel.stream(point);gravel.update(point)}
 assert.equal(allocations,0,'Streaming and wheel contact never allocate colliders');assert.deepEqual(gravel.pool.map(r=>r.collider.handle),handles);assert(gravel.history.size<=1024);assert([...gravel.mesh.instanceMatrix.array].every(Number.isFinite));
 gravel.dispose();gravel.dispose();assert.equal(p.world.bodies.len(),before.b);assert.equal(p.world.colliders.len(),before.c);assert.equal(p.chassis.collisionGroups(),groups);assert.equal(scene.children.length,0);p.dispose();
}
// A moving tyre remains stable at road speed, in reverse, and after a reset.
for(const reverse of [false,true]){
 const scene=new THREE.Scene(),p=await DrivePhysics.create(),start={x:64,z:-164};p.reset(start.x,start.z,0);
 p.world.createCollider(RAPIER.ColliderDesc.cuboid(200,.5,200).setTranslation(start.x,-.5,start.z));const gravel=new LoosePebbles(scene,p,field);
 for(let i=0;i<180;i++)p.step(dt,{brake:true});
 for(let i=0;i<12;i++)gravel.stream(p.position());
 p.rb.setLinvel({x:0,y:0,z:reverse?15:-15},true);let peak=0;
 for(let i=0;i<300;i++){gravel.stream(p.position());p.step(dt,reverse?{reverse:true}:{gas:true});gravel.update(p.position());for(const r of gravel.active.values()){const at=r.body.translation();assert(Object.values(at).every(Number.isFinite));peak=Math.max(peak,Math.hypot(...Object.values(r.body.linvel())))}assert(p.rb.translation().y<2,'Gravel cannot jack up the chassis');}
 assert(peak<35,'Fast contacts stay within a plausible bounded velocity');
 p.reset(start.x+100,start.z,0);p.step(dt,{brake:true});assert(gravel.tyres.every(t=>Math.abs(t.body.translation().x-(start.x+100))<1.1),'Reset snaps push shapes instead of sweeping through the world');
 gravel.dispose();p.dispose();
}
for(const p of [{x:-45,z:0},{x:248,z:-336},{x:312,z:-600},{x:527,z:-680}])assert(!pebbleHabitat(p.x,p.z),'Water, snow and volcanic scenery retain their own surface treatment');
console.log('Loose pebbles: actual tyre contact, sideways displacement, angular motion, settling, self-collision exclusion, pooling, rebasing, world history, habitats and mobile budgets passed.');
