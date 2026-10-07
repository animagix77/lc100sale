import assert from 'node:assert/strict';
import * as THREE from 'three/webgpu';
import {DrivePhysics,RAPIER} from './physics.mjs';
import {BeachLife} from './beach-life.mjs';
import {BeachObstacles} from './obstacles.mjs';
import {shore} from './terrain.mjs';
const p=await DrivePhysics.create(),scene=new THREE.Scene(),life=new BeachLife(scene),solid=new BeachObstacles(p,{radius:Infinity});
p.world.createCollider(RAPIER.ColliderDesc.cuboid(100,.1,100).setTranslation(0,-.1,0));
life.logs.count=1;life.key='test';const m=new THREE.Matrix4().compose(new THREE.Vector3(0,0,-8),new THREE.Quaternion(),new THREE.Vector3(1.6,1.6,1.6));life.logs.setMatrixAt(0,m);solid.refresh(life);
p.reset(0,0,0);for(let i=0;i<240;i++)p.step(1/120,{brake:true});const settled=p.position().y;let onLog=0,peak=settled,compression=1;
for(let i=0;i<1200;i++){p.step(1/120,{cruise:true});peak=Math.max(peak,p.position().y);for(let w=0;w<4;w++){if(solid.has(p.vehicle.wheelGroundObject(w)))onLog++;compression=Math.min(compression,p.vehicle.wheelSuspensionLength(w));}}
console.log({settled,peak,onLog,compression,z:p.position().z});assert(onLog>0,'Wheels contact the actual driftwood geometry');assert(peak<settled+.6,'Log impact remains controlled');assert(peak>settled+.05,'Truck rises over log');assert(compression<.27,'Suspension compresses over obstacle');assert(p.position().z<-14,'Truck can climb across log without becoming trapped');
// Fixed objects also stop the chassis, not only the wheel rays.
const probe=p.world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(0,2,-8));const probeCollider=p.world.createCollider(RAPIER.ColliderDesc.ball(.2).setMass(30),probe);let hit=false;for(let i=0;i<240;i++){p.world.step();for(const c of solid.colliders)p.world.contactPair(probeCollider,c,()=>{hit=true})}assert(hit,'Rigid bodies collide with log surface');p.world.removeRigidBody(probe);
// World streaming and origin shifts rebuild exact matching local collision geometry.
life.update({x:shore(0)+22,z:0},0,{x:0,z:0});solid.refresh(life);const count=solid.colliders.length;assert.equal(count,life.logs.count+life.rocks.count);const before=p.world.colliders.len();solid.refresh(life);assert.equal(p.world.colliders.len(),before);
p.rebase(512,-512);life.update({x:shore(0)+22,z:0},0,p.origin);solid.refresh(life);assert.equal(solid.colliders.length,count);assert.equal(p.world.colliders.len(),before);
for(const z of [-1500,2000,9000]){life.update({x:shore(z)+22,z},0,p.origin);solid.refresh(life);assert.equal(solid.colliders.length,life.logs.count+life.rocks.count);assert(solid.colliders.length<=280);}
solid.dispose();assert.equal(p.world.colliders.len(),2);life.dispose();p.dispose();console.log('Obstacle traversal, chassis contact, streaming, rebase and cleanup passed');
