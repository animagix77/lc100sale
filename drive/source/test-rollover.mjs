import assert from 'node:assert/strict';
import {RolloverRecovery,checkpointPose} from './rollover.mjs';
import {WaypointRoute,WAYPOINT_COUNT} from './waypoints.mjs';
import {LANDMARKS} from './expedition.mjs';
import {SandField} from './terrain.mjs';
import {DrivePhysics,RAPIER} from './physics.mjs';
const dt=1/60,tilt=angle=>({x:0,y:0,z:Math.sin(angle/2),w:Math.cos(angle/2)}),upright=tilt(0),roof=tilt(Math.PI);
function ready(){const monitor=new RolloverRecovery();for(let i=0;i<60;i++)assert(!monitor.update(dt,upright));return monitor}
for(const hz of [30,60,120]){
 const m=ready();let firedAt=0;
 for(let i=1;i<hz*3;i++)if(m.update(1/hz,roof)){firedAt=i/hz;break}
 assert(Math.abs(firedAt-1.65)<=1/hz,'Rollover delay is consistent across frame rates');
 assert(!m.update(dt,roof),'One rollover produces only one reset');
 m.reset();assert(!m.update(dt,roof),'A new spawn starts a fresh grace period');
}
{
 const m=ready();
 for(let i=0;i<300;i++)assert(!m.update(dt,tilt(Math.sin(i/18)*1.18)),'Banking, bumps and steep climbs are not rollovers');
 for(let i=0;i<60;i++)assert(!m.update(dt,roof),'A short inversion can recover naturally');
 assert(!m.update(dt,upright));assert.equal(m.tippedFor,0);
 for(let i=0;i<95;i++)assert(!m.update(dt,tilt(Math.PI/2)),'A second tip starts from zero');
 assert(!m.update(0,roof),'Pause time does not count');assert(!m.update(NaN,roof),'Invalid deltas do not poison state');
 for(let i=0;i<10;i++)m.update(dt,roof);
 assert(m.triggered,'Resting on the side is recoverable too');
}
{
 const m=ready();for(let i=0;i<1000;i++){const yaw=i*.04;assert(!m.update(dt,{x:0,y:Math.sin(yaw/2),z:0,w:Math.cos(yaw/2)}),'Steering and camera heading cannot trigger a reset')}
}
const field=new SandField(),r=new WaypointRoute();
for(const count of [0,1,7,23,24,25,48,4807]){
 r.next=r.passed=count;const before=[r.next,r.passed],pose=checkpointPose(r,(x,z)=>field.height(x,z)),checkpoint=LANDMARKS[count%WAYPOINT_COUNT],next=r.target();
 assert.deepEqual([pose.x,pose.z],[checkpoint.x,checkpoint.z],'Respawn is the last reached stop, including start and completed laps');
 assert.deepEqual([r.next,r.passed],before,'Choosing a checkpoint never removes or grants route progress');
 assert(Math.hypot(pose.x-next.x,pose.z-next.z)>10,'The next target remains ahead rather than being collected by respawning');
 const dx=next.x-pose.x,dz=next.z-pose.z,len=Math.hypot(dx,dz);
 assert(Math.abs(-Math.sin(pose.yaw)-dx/len)<1e-8&&Math.abs(-Math.cos(pose.yaw)-dz/len)<1e-8,'Spawn faces the next unvisited stop');
 assert(pose.height>=field.height(pose.x,pose.z),'Spawn clears the current deformed terrain');
}
// A real rigid body resting on its roof is recovered, even with no tire contacts.
const p=await DrivePhysics.create(field);r.next=r.passed=7;
const pose=checkpointPose(r,(x,z)=>field.height(x,z));
p.world.createCollider(RAPIER.ColliderDesc.cuboid(15,.3,15).setTranslation(pose.x,pose.height-.3,pose.z));
p.reset(pose.x,pose.z,pose.height);p.rb.setRotation(roof,true);const m=ready();let recovered=false;
for(let i=0;i<240;i++){p.step(1/120,{brake:true});if(m.update(1/120,p.rb.rotation())){recovered=true;break}}
assert(recovered,'A physically overturned truck triggers recovery');
p.rebase(256,-352);p.reset(pose.x,pose.z,pose.height);p.rb.setRotation({x:0,y:Math.sin(pose.yaw/2),z:0,w:Math.cos(pose.yaw/2)},true);r.resetTracking();
assert(Math.abs(p.position().x-pose.x)<1e-6&&Math.abs(p.position().z-pose.z)<1e-6,'Checkpoint position survives floating-origin shifts');
assert.equal(p.rb.linvel().x,0);assert.equal(p.rb.linvel().z,0);assert.equal(p.rb.angvel().z,0);assert.equal(p.speed,0);
assert(p.tyres.every(w=>!w.contact&&w.slip===0),'Reset cannot splash water from stale pre-teleport wheel contacts');
assert(!r.update(p.position(),{groundHeight:pose.height}),'Respawn does not collect a gate');assert.equal(r.passed,7);
for(let i=0;i<120;i++)p.step(1/120,{brake:true});
const q=p.rb.rotation();assert(1-2*(q.x*q.x+q.z*q.z)>.95,'The reset truck settles upright');
p.dispose();
console.log('Rollover: sustained tilt, brief recovery, banks, yaw, frame independence, pause, all checkpoint/lap cases, physical roof recovery, stale contacts and origin-aware respawn passed.');
