import assert from 'node:assert/strict';
import * as THREE from 'three/webgpu';
import {DrivePhysics,RAPIER} from './physics.mjs';
import {BeachObstacles} from './obstacles.mjs';
const p=await DrivePhysics.create(),solid=new BeachObstacles(p,{radius:Infinity}),g=new THREE.BoxGeometry(2,3,4),mat=new THREE.MeshBasicMaterial(),rocks=new THREE.InstancedMesh(g,mat,4),ridge=new THREE.InstancedMesh(g,mat,4);
rocks.count=2;ridge.count=1;ridge.userData.detailKey='ridge0';const life={key:'cell0',rocks,ridgeRocks:ridge},m=new THREE.Matrix4(),q=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),.38);
const put=(mesh,index,x,z)=>{m.compose(new THREE.Vector3(x-p.origin.x,2,z-p.origin.z),q,new THREE.Vector3(1.2,.8,1.4));mesh.setMatrixAt(index,m)};
put(rocks,0,20,-30);put(rocks,1,40,-30);put(ridge,0,60,-30);
let creates=0,removes=0;const create=p.world.createCollider.bind(p.world),remove=p.world.removeCollider.bind(p.world);p.world.createCollider=(...a)=>{creates++;return create(...a)};p.world.removeCollider=(...a)=>{removes++;return remove(...a)};
solid.refresh(life);assert.equal(creates,3);assert.equal(removes,0);const initial=solid.colliders.map(c=>c.handle),count=p.world.colliders.len();
life.key='cell1';solid.refresh(life);assert.equal(creates,3,'Shared cells keep existing shapes');assert.deepEqual(solid.colliders.map(c=>c.handle),initial);
// Same instances in a new order, plus one newly entering rock.
put(rocks,0,40,-30);put(rocks,1,20,-30);put(rocks,2,80,-30);rocks.count=3;life.key='cell2';solid.refresh(life);assert.equal(creates,4);assert.equal(removes,0);assert.equal(solid.colliders[0].handle,initial[1]);assert.equal(solid.colliders[1].handle,initial[0]);assert.equal(solid.colliders[3].handle,initial[2],'Independent ridge group stays untouched');
// Floating-origin changes translate existing shapes instead of rebuilding their BVHs.
const stable=solid.colliders.map(c=>c.handle);p.rebase(512,-512);put(rocks,0,40,-30);put(rocks,1,20,-30);put(rocks,2,80,-30);put(ridge,0,60,-30);life.key='cell2-rebase';ridge.userData.detailKey='ridge0-rebase';solid.refresh(life);assert.deepEqual(solid.colliders.map(c=>c.handle),stable);assert.equal(creates,4);assert.equal(removes,0);
p.world.step();for(const x of [20,40,60,80]){const hit=p.world.castRay(new RAPIER.Ray({x:x-p.origin.x,y:10,z:-30-p.origin.z},{x:0,y:-1,z:0}),20,true);assert(hit&&solid.has(hit.collider));assert(Math.abs(hit.timeOfImpact-(10-3.2))<.0001,'Collider surface follows the rendered instance after rebasing');assert.equal(solid.kind(hit.collider),'rock')}
// Replacing one shape only retires that instance, with no stale membership.
const retired=solid.colliders[2];rocks.count=2;life.key='cell3';solid.refresh(life);assert.equal(removes,1);assert.equal(creates,4);assert(!solid.has(retired));assert.equal(solid.kind(retired),undefined);assert.equal(p.world.colliders.len(),count);
delete life.ridgeRocks;solid.refresh(life);assert.equal(removes,2,'Removed mesh group releases its collider');assert.equal(solid.colliders.length,2);
solid.clear();assert.equal(removes,4);assert.equal(solid.colliders.length,0);assert.equal(solid.handles.size,0);assert.equal(solid.kinds.size,0);assert.equal(p.world.colliders.len(),1);solid.refresh(life);assert.equal(solid.colliders.length,2,'Clear supports rebuilding after reset');solid.dispose();p.dispose();rocks.dispose();ridge.dispose();g.dispose();mat.dispose();
console.log('Obstacle streaming: retained handles, changed-only creation, independent groups, exact rebase surfaces and cleanup passed.');
// Visible scenery extends much farther than the physical contact zone. Activate
// it on approach without waiting for the larger 64m scenery cell to change.
const nearPhysics=await DrivePhysics.create(),nearSolid=new BeachObstacles(nearPhysics),nearGeometry=new THREE.BoxGeometry(2,2,2),nearMat=new THREE.MeshBasicMaterial(),nearMesh=new THREE.InstancedMesh(nearGeometry,nearMat,3),nearLife={key:'unchanged scenery',rocks:nearMesh};nearMesh.count=3;
for(const [i,x] of [20,90,160].entries())nearMesh.setMatrixAt(i,new THREE.Matrix4().makeTranslation(x,1,10));
nearPhysics.reset(0,0,0);nearSolid.refresh(nearLife);assert.equal(nearSolid.colliders.length,1,'Far visible objects do not consume collision work');const firstHandle=nearSolid.colliders[0].handle;
for(let x=2;x<=170;x+=2){nearPhysics.reset(x,0,0);nearSolid.refresh(nearLife);nearPhysics.world.step();for(const objectX of [20,90,160])if(Math.hypot(objectX-x,10)<=55){const hit=nearPhysics.world.castRay(new RAPIER.Ray({x:objectX,y:10,z:10},{x:0,y:-1,z:0}),20,true);assert(hit&&nearSolid.has(hit.collider),'Every object within the guaranteed 55m zone is already physical');if(objectX===20&&x<=55)assert.equal(hit.collider.handle,firstHandle,'Nearby objects keep collision identity during streaming')}}
assert.equal(nearSolid.colliders.length,1,'Objects well behind the truck retire');nearSolid.dispose();
// Large geometry centred outside the normal radius must activate if any part can
// approach the contact zone. A 100m-long log is an intentionally harsh bound test.
nearPhysics.reset(0,0,0);nearMesh.count=1;nearMesh.setMatrixAt(0,new THREE.Matrix4().compose(new THREE.Vector3(100,1,0),new THREE.Quaternion(),new THREE.Vector3(50,1,1)));const longSolid=new BeachObstacles(nearPhysics);longSolid.refresh(nearLife);assert.equal(longSolid.colliders.length,1,'Object radius expands activation for long geometry');longSolid.dispose();
const staticPhysics={world:nearPhysics.world,origin:nearPhysics.origin},staticSolid=new BeachObstacles(staticPhysics);nearMesh.setMatrixAt(0,new THREE.Matrix4().makeTranslation(1000,1,0));staticSolid.refresh(nearLife);assert.equal(staticSolid.colliders.length,1,'Callers without a player position preserve full-scene collision');staticSolid.dispose();nearPhysics.dispose();nearMesh.dispose();nearGeometry.dispose();nearMat.dispose();
console.log('Obstacle approach: safe activation radius, unchanged-scenery movement, stable nearby contacts, large objects and static callers passed.');
