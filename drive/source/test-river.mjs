import assert from 'node:assert/strict';
import * as THREE from 'three/webgpu';
import {DrivePhysics,RAPIER} from './physics.mjs';
import {SandField,clamp} from './terrain.mjs';
import {TerrainView} from './terrain-view.mjs';
import {BeachLife} from './beach-life.mjs';
import {BeachObstacles} from './obstacles.mjs';
import {riverRocksNear} from './river-rocks.mjs';
import {Ocean} from './ocean.mjs';
import {RiverView} from './river-view.mjs';
for(const mobile of [false,true]){
 const scene=new THREE.Scene(),ocean=new Ocean(scene,{mobile}),river=new RiverView(scene,ocean),life=new BeachLife(scene,{mobile});
 const geometry=river.mesh.geometry;assert(geometry.attributes.position.count<47000,'Bounded river geometry');assert(geometry.attributes.position.count>20000,'Tessellation resolves tyre wakes');
 assert([...geometry.attributes.riverDepth.array].every(v=>Number.isFinite(v)&&v>=0));assert(geometry.attributes.riffle.array.some(v=>v>.3),'Exposed stones produce turbulent patches');
 life.refresh({x:248,z:-336},{x:0,z:0});assert(life.samples.filter(r=>r.river&&Math.hypot(r.x-248,r.z+336)<22).length>70,'Dense riverbed around the crossing');
 const rocks=riverRocksNear(248,-336,22);assert(rocks.some(r=>r.sy<.75)&&rocks.some(r=>r.sy>1.3),'Low crossing stones and taller bank obstacles');
 const positions=life.rocks.instanceMatrix.array.slice();life.refresh({x:249,z:-335},{x:0,z:0});assert.deepEqual(life.rocks.instanceMatrix.array,positions,'Rocks stay fixed within a streaming cell');
 life.dispose();river.dispose();ocean.dispose();
}
const field=new SandField(),p=await DrivePhysics.create(field),scene=new THREE.Scene(),terrain=new TerrainView(scene,p,field),life=new BeachLife(scene),obstacles=new BeachObstacles(p);
// Far visual tiles do not participate in this physics traversal test.
const geometry=terrain.geometry.bind(terrain);terrain.geometry=(...args)=>args[4]?new THREE.PlaneGeometry(1,1):geometry(...args);
const start={x:243,z:-324},target={x:255,z:-355};terrain.update(start.x,start.z);life.refresh(start,p.origin);obstacles.refresh(life);p.reset(start.x,start.z,field.height(start.x,start.z));
const yaw=Math.atan2(-(target.x-start.x),-(target.z-start.z));p.rb.setRotation({x:0,y:Math.sin(yaw/2),z:0,w:Math.cos(yaw/2)},true);p.setRange('LO');p.setCenterLock(true);
for(let i=0;i<240;i++)p.step(1/120,{brake:true});let rockContacts=0,maxRoll=0,reached=false;
for(let i=0;i<18000;i++){
 const pos=p.position(),fwd=p.forward(),heading=Math.atan2(-fwd.x,-fwd.z),desired=Math.atan2(-(target.x-pos.x),-(target.z-pos.z)),error=Math.atan2(Math.sin(desired-heading),Math.cos(desired-heading));
 terrain.update(pos.x,pos.z);if(i%16===0)terrain.refresh();life.refresh(pos,p.origin);obstacles.refresh(life);p.step(1/120,{gas:p.speed<2.2,turn:clamp(error*3,-1,1)});
 for(let w=0;w<4;w++)if(obstacles.kind(p.vehicle.wheelGroundObject(w))==='rock')rockContacts++;
 const q=p.rb.rotation(),e=new THREE.Euler().setFromQuaternion(new THREE.Quaternion(q.x,q.y,q.z,q.w));maxRoll=Math.max(maxRoll,Math.abs(e.z));
 p.marks.length=0;p.soundEvents.length=0;
 if(Math.hypot(pos.x-target.x,pos.z-target.z)<3){reached=true;break;}
}
console.log({rockContacts,maxRoll,position:p.position(),reached,colliders:obstacles.colliders.length});
assert(rockContacts>30,'Wheels climb physical river stones');assert(maxRoll>.025,'The chassis responds to uneven stones');assert(reached,'The marked ford remains passable in low range');
// A small rigid probe also lands on a rock, proving chassis collision is present.
const rock=riverRocksNear(248,-336,10)[0],probe=p.world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(rock.x,rock.y+3,rock.z)),body=p.world.createCollider(RAPIER.ColliderDesc.ball(.12).setMass(30),probe);let hit=false;
for(let i=0;i<240;i++){p.world.step();for(const c of obstacles.colliders)p.world.contactPair(body,c,()=>{hit=true})}assert(hit,'River stones collide with rigid bodies as well as tyre rays');
obstacles.dispose();life.dispose();p.dispose();console.log('River: geometry budget, shallow visibility, stable rock bed, wheel/chassis contacts and ford traversal passed.');
