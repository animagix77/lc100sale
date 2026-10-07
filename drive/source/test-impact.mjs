import assert from 'node:assert/strict';
import {DrivePhysics,RAPIER} from './physics.mjs';
async function run(offset){const p=await DrivePhysics.create();p.world.createCollider(RAPIER.ColliderDesc.cuboid(500,.1,500).setTranslation(0,-.1,0));if(offset!==null){const log=p.world.createCollider(RAPIER.ColliderDesc.cuboid(offset===0?2:.43,.14,.65).setTranslation(offset,.14,-8));p.obstacles={has:c=>c?.handle===log.handle};}p.reset(0,0,0);for(let i=0;i<360;i++)p.step(1/120,{brake:true});let roll=0,pitch=0,support=0;const settled=p.position().y;let rise=0;
for(let i=0;i<1800;i++){p.step(1/120,{cruise:true});const q=p.rb.rotation();roll=Math.max(roll,Math.abs(Math.atan2(2*(q.w*q.z+q.x*q.y),1-2*(q.x*q.x+q.z*q.z)))*180/Math.PI);pitch=Math.max(pitch,Math.abs(Math.atan2(2*(q.w*q.x+q.y*q.z),1-2*(q.x*q.x+q.z*q.z)))*180/Math.PI);support=Math.max(support,p.bumpSupport||0);rise=Math.max(rise,p.position().y-settled)}
const out={offset,roll,pitch,support,rise,z:p.position().z};p.dispose();console.log(out);return out}
const flat=await run(null),one=await run(-.962),both=await run(0);
assert(one.roll>2&&one.roll>flat.roll+1,'One-sided obstacle rolls the actual chassis');assert(both.pitch>2,'Two-wheel obstacle pitches the actual chassis');assert(one.support>500&&both.support>500,'Deep compression transfers through progressive bump stops');assert(one.z<-16&&both.z<-16,'Obstacle crossings remain driveable');
assert(one.roll<15&&both.pitch<15&&one.rise<.5&&both.rise<.5,'Bump reactions stay bounded without launching or rolling the truck');
const p=await DrivePhysics.create();p.world.createCollider(RAPIER.ColliderDesc.cuboid(500,.1,500).setTranslation(0,-.1,0));p.reset(-20,0,0);for(let i=0;i<240;i++)p.step(1/120,{brake:true});for(let i=0;i<3000;i++)p.step(1/120,{gas:true});const mph=p.speed*2.236936;console.log({HI:mph});assert(mph>49.8&&mph<50.1,'4HI reaches and holds the requested 50 mph');p.dispose();
console.log('Chassis impact transfer and 50 mph governor passed');
