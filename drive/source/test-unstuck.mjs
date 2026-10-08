import assert from 'node:assert/strict';
import {StuckRecovery} from './unstuck.mjs';
import {DrivePhysics,RAPIER} from './physics.mjs';
const stationary={position:{x:1000,z:-500},velocity:{x:0,y:0,z:0},input:{gas:true}};
function run(m,seconds,state=stationary,hz=60){for(let i=0;i<Math.ceil(seconds*hz);i++)m.update(1/hz,state)}
for(const hz of [30,60,120]){
 const m=new StuckRecovery();run(m,6,stationary,hz);assert(!m.visible,'Spawn grace and detection delay');run(m,1,stationary,hz);assert(m.visible,'Forward throttle stalled on any surface');
 run(m,10,{...stationary,input:{}},hz);assert(m.visible,'Offer stays available after releasing the controls');
 run(m,1,{...stationary,position:{x:1004,z:-500}},hz);assert(!m.visible,'Escape automatically clears the offer');
}
for(const input of [{},{brake:true,gas:true},{handbrake:true,gas:true},{gas:.05}]){
 const m=new StuckRecovery();run(m,25,{...stationary,input});assert(!m.visible,'Parking, held brakes and tiny inputs are not stuck');
}
for(const extra of [{blocked:true},{velocity:{x:0,y:-2,z:0}},{velocity:{x:0,y:0,z:2}}]){
 const m=new StuckRecovery();run(m,25,{...stationary,...extra});assert(!m.visible,'Scripted holds, falls and sideways movement are not stuck');
}
for(const input of [{reverse:true},{cruise:true},{gas:.2}]){
 const m=new StuckRecovery();run(m,7,{...stationary,input});assert(m.visible,'Reverse, cruise and deliberate analog input all qualify');
}
{
 const m=new StuckRecovery();for(let i=0;i<1800;i++)m.update(1/60,{...stationary,position:{x:1000+i*.3/60,z:-500},velocity:{x:.3,y:0,z:0}});assert(!m.visible,'Slow but steady rock crawling makes enough progress');
 run(m,7);assert(m.visible);m.dismiss();run(m,11);assert(!m.visible,'Dismiss snoozes further offers');run(m,2);assert(m.visible,'Persistent trap can offer help again');
 const before=m.effort;m.update(0,stationary);m.update(NaN,stationary);assert.equal(m.effort,before,'Pause and invalid time cannot advance detection');
 m.reset();assert(!m.visible);assert.equal(m.effort,0);
}
// Reproduce a high-centred truck with the chassis on a rock and all tyres hanging.
const p=await DrivePhysics.create();
p.world.createCollider(RAPIER.ColliderDesc.cuboid(.55,.8,.65).setTranslation(0,.1,0));p.reset(0,0,0);
const m=new StuckRecovery();
for(let i=0;i<120*10;i++){
 p.step(1/120,{gas:true});
 m.update(1/120,{position:p.position(),velocity:p.rb.linvel(),input:{gas:true}});
 if(m.visible)break;
}
assert(m.visible,'Real chassis-on-rock trap triggers without requiring wheel contacts');
assert.equal([0,1,2,3].filter(i=>p.vehicle.wheelIsInContact(i)).length,0,'Test reproduces unloaded wheels');
p.dispose();
console.log('Unstuck: physical high-centre trap, forward/reverse/analog, frame rates, grace, brakes, parking, airborne, crawling, release persistence, escape, snooze and reset passed.');
