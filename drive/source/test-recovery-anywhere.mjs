import assert from 'node:assert/strict';
import {DrivePhysics,RAPIER} from './physics.mjs';
import {Recovery} from './recovery.mjs';
const dt=1/120;
for(const [name,x,z,y] of [['beach',-14,0,0],['dunes',64,-164,11],['grass',190,-278,15],['river',248,-336,14],['snow',325,-464,28],['mud',408,-231,19]]){
 const p=await DrivePhysics.create(),r=new Recovery(p);p.world.createCollider(RAPIER.ColliderDesc.cuboid(10,.2,10).setTranslation(x,y-.2,z));p.reset(x,z,y);for(let i=0;i<240;i++)p.step(dt,{brake:true});
 // Slow gravity-driven drift should not make finding a recovery position impossible.
 p.rb.setLinvel({x:.8,y:0,z:.5},true);const before=p.position();assert.equal(r.deploy(),'ok',name+' accepts deployment while slowly drifting');assert.deepEqual(p.position(),before,'Recovery does not teleport');
 assert.equal(r.boards.length,4);assert(r.boards.every(b=>Math.abs(b.position.y-y-.022)<.015),name+' boards find actual ground at region elevation');
 for(let i=0;i<120;i++)p.step(dt,{brake:true});assert.equal(r.state,'ground');assert(r.boards.every(b=>b.collider));assert(Math.hypot(p.position().x-before.x,p.position().z-before.z)<.15,'Parking hold prevents drifting away during deployment');const old=r.boards.map(b=>b.collider.handle);assert.equal(r.deploy(),'ok','Grounded boards can be repositioned without driving five metres');assert(old.every(h=>!p.world.getCollider(h)),'Reposition removes old physical supports');r.clear();p.dispose();
}
// The chassis is perched on a high rock with tyres hanging over the surrounding ground.
const p=await DrivePhysics.create(),r=new Recovery(p);p.world.createCollider(RAPIER.ColliderDesc.cuboid(15,.2,15).setTranslation(0,-.2,0));p.world.createCollider(RAPIER.ColliderDesc.cuboid(.6,.8,.6).setTranslation(0,.8,0));p.reset(0,0,1.6);for(let i=0;i<360;i++)p.step(dt,{brake:true});
const contacts=[0,1,2,3].filter(i=>p.vehicle.wheelIsInContact(i)).length;assert(contacts<4,'Fixture genuinely has unloaded suspension');assert.equal(r.deploy(),'ok','Unloaded wheels no longer block recovery');assert(r.boards.every(b=>Math.abs(b.position.y-.022)<.02),'Hanging tyres use ground probes, not stale wheel contacts');r.clear();
// Raised stone beneath one tyre must be picked up by the support probe.
p.world.createCollider(RAPIER.ColliderDesc.cuboid(.35,.2,.8).setTranslation(-.962,.2,-1.74));p.world.step();assert.equal(r.deploy(),'ok');assert(r.boards[0].position.y>.40,'Boards sit on rocks instead of being buried below them');assert(r.boards[1].position.y<.05);r.clear();
p.rb.setLinvel({x:3,y:0,z:0},true);assert.equal(r.deploy(),'moving','High-speed deployment is still rejected');p.rb.setLinvel({x:0,y:0,z:0},true);p.rb.setRotation({x:0,y:0,z:1,w:0},true);assert.equal(r.deploy(),'tilted','Rollover still requires reset');p.dispose();
console.log('Recovery anywhere: all six regions, slow drift, four physical boards, unloaded tyres, rock support and rollover guard passed.');
