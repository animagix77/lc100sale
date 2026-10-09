import assert from 'node:assert/strict';
import {RoadsideSafety,roadsideZones} from './roadside-safety.mjs';
import {ROADSIDE_SPOTS,roadsideActors} from './roadside-spots.mjs';
import {RoadsideStories} from './roadside-view.mjs';
import {DrivePhysics,RAPIER} from './physics.mjs';
import * as THREE from 'three/webgpu';

const zones=roadsideZones();
assert.equal(zones.filter(z=>z.kind==='person').length,5,'Both people in the repair scene are covered');
const view=new RoadsideStories(new THREE.Scene());
for(const mesh of view.meshes){
 const spot=mesh.userData.story,sceneZones=zones.filter(z=>z.id===spot.id),vertices=mesh.geometry.attributes.position;
 for(let i=0;i<vertices.count;i++)assert(sceneZones.some(z=>Math.hypot(vertices.getX(i)-z.x,vertices.getZ(i)-z.z)<z.radius-2.65),'Protection encloses actual tilted vehicles, open doors, arms and feet');
 for(const actor of roadsideActors(spot))assert(sceneZones.some(z=>z.kind==='person'&&z.x===actor.x&&z.z===actor.z));
}
view.dispose();
const zone={id:'test',x:0,z:0,radius:6},guard=new RoadsideSafety([zone]),forward={x:0,z:-1};
assert(guard.filter({gas:1},{x:0,z:40},{x:0,z:-22.352},forward).brake,'50 mph approach brakes before the scene');
assert.equal(guard.filter({gas:1},{x:10,z:40},{x:0,z:-22.352},forward).brake,undefined,'Passing beside the scene stays free');
assert(guard.filter({}, {x:9,z:0},{x:-4,z:0},forward).brake,'Sideways slide gets detected');
assert(guard.filter({}, {x:0,z:7},{x:0,z:-.8},{x:0,z:1}).brake,'Gravity rollback gets detected');
assert(guard.filter({gas:.1},{x:0,z:6.5},{x:0,z:0},forward).brake,'Gentle touch throttle cannot creep into people');
assert.equal(guard.filter({reverse:1},{x:0,z:6.5},{x:0,z:0},forward).reverse,1,'Reverse away remains available');
assert.equal(guard.filter({reverse:1},{x:0,z:6.1},{x:0,z:-.4},forward).reverse,1,'Reverse torque is allowed while gravity still rolls inward');
assert.equal(guard.filter({gas:1},{x:0,z:6.5},{x:0,z:1},{x:0,z:1}).gas,1,'Forward escape remains available');
assert.equal(guard.filter({gas:1},{x:0,z:6.1},{x:0,z:-.4},{x:0,z:1}).gas,1,'Forward escape is allowed during inward rollback');
assert.equal(guard.filter({reverse:1,brake:1},{x:0,z:6.1},{x:0,z:-.4},forward).brake,1,'Driver-requested braking is preserved while escaping');
assert.equal(guard.filter({gas:1},{x:0,z:6.5},{x:1,z:0},{x:1,z:0}).gas,1,'Steering parallel to the boundary is allowed');
assert(guard.filter({reverse:1},{x:0,z:6.5},{x:0,z:0},{x:0,z:1}).brake,'Reverse into people is also blocked');
const hit=guard.constrain({x:0,y:1,z:20},{x:0,y:1.2,z:-20},{x:0,y:2,z:-100});
assert(hit.position.z>=6&&hit.velocity.z===0,'Swept boundary cannot be tunneled through');
assert.equal(hit.velocity.y,2,'Suspension/airborne vertical motion is preserved');
assert.equal(guard.constrain({x:7,z:6,y:1},{x:7,z:-6,y:1},{x:0,y:0,z:-20}),null,'Safe passing never snaps the truck');
const overlap=new RoadsideSafety([{...zone,x:0},{...zone,x:4}]);
const recovered=overlap.constrain({x:2,z:0,y:2},{x:2,z:0,y:2},{x:0,z:0,y:0});
assert(overlap.zones.every(z=>Math.hypot(recovered.position.x-z.x,recovered.position.z-z.z)>=z.radius),'Overlapping boundaries recover a reset safely');

const dt=1/120;
async function setup(){
 const p=await DrivePhysics.create();p.waterHeight=()=>null;
 p.world.createCollider(RAPIER.ColliderDesc.cuboid(200,.1,200).setTranslation(-20,-.1,0));
 p.reset(-20,30,0);p.roadsideSafety=new RoadsideSafety([{id:'driver',x:-20,z:-30,radius:6}]);
 for(let i=0;i<240;i++)p.step(dt,{brake:true});return p;
}
for(const cruise of [false,true]){
 const p=await setup();p.rb.setLinvel({x:0,y:0,z:-22.352},true);
 let active=false,minClearance=Infinity;
 for(let i=0;i<900;i++){p.step(dt,cruise?{cruise:true}:{gas:1});active||=p.roadsideSafety.active;minClearance=Math.min(minClearance,Math.hypot(p.position().x+20,p.position().z+30));}
 assert(active);assert(minClearance>=6-.001,'Held throttle/cruise never crosses the boundary');
 assert(Math.abs(p.speed)<.15,'Proximity braking stops the truck');assert(p.lighting.braking,'Brake lamps follow automatic braking');
 const stopped=p.position().z;
 for(let i=0;i<400;i++)p.step(dt,{reverse:1});
 assert(p.position().z>stopped+1,'Actual vehicle can reverse out of the brake zone');
 console.log('Approach / reverse',{cruise,minClearance,stopped,afterReverse:p.position().z});p.dispose();
}
// A steep pull-off must allow reverse torque to build against gravity.
for(const slope of [.27,.45]){
 const p=await DrivePhysics.create(),theta=Math.atan(slope);p.waterHeight=()=>null;
 p.world.createCollider(RAPIER.ColliderDesc.cuboid(200,.1,200).setRotation({x:Math.sin(-theta/2),y:0,z:0,w:Math.cos(-theta/2)}));
 p.roadsideSafety=new RoadsideSafety([{id:'driver',x:-20,z:-30,radius:6}]);p.reset(-20,-22,slope*-22);
 p.range='LO';
 for(let i=0;i<400;i++)p.step(dt,{gas:1});
 const before=p.position().z;
 for(let i=0;i<900;i++){p.step(dt,{reverse:1});assert(p.position().z>=-24.001,'Gravity cannot push through during the direction change');}
 assert(p.position().z>before+1,'Reverse away on a steep grade remains possible');
 console.log('Sloped escape',{slope,before,after:p.position().z});p.dispose();
}
// Last-resort protection also holds while airborne and after floating-origin shifts.
const p=await setup();p.rebase(512,-512);p.rb.setTranslation({x:-20-p.origin.x,y:12,z:-20-p.origin.z},true);p.rb.setLinvel({x:0,y:0,z:-2000},true);
for(let i=0;i<10;i++){p.step(dt,{gas:true});assert(p.position().z>=-24.001);assert(p.roadsideSafety.active)}assert(p.roadsideSafety.interventions>0);assert(p.rb.linvel().z>=-.001);p.dispose();
console.log('Roadside safety: geometry coverage, directional/rollback braking, no false passing stops, high-speed sweep, overlapping zones, throttle/cruise override, reverse escape and floating origin passed.');
