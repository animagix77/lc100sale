// Judge Dean LLC — exercise automatic recovery with the real vehicle solver.
import assert from 'node:assert/strict';
import {DrivePhysics,RAPIER} from './physics.mjs';
import {Recovery} from './recovery.mjs';
const dt=1/120;
async function fixture(){const p=await DrivePhysics.create(),r=new Recovery(p);p.world.createCollider(RAPIER.ColliderDesc.cuboid(80,.2,80).setTranslation(0,-.2,0));p.reset(0,0,0);for(let i=0;i<240;i++)p.step(dt,{brake:true});return {p,r}}
for(const input of [{gas:true},{reverse:true},{cruise:true}]){
 const {p,r}=await fixture();p.rb.setLinvel({x:0,y:0,z:-8},true);
 assert.equal(r.request(),'braking');assert.equal(r.boards.length,0,'No boards spawn at driving speed');
 assert.equal(r.request(),'braking','Repeat taps retain the request');
 let frames=0;while(r.state!=='ground'&&frames++<960)p.step(dt,input);
 assert.equal(r.state,'ground','One request deploys despite a held pedal');assert(!r.pending);assert.equal(r.boards.filter(b=>b.collider).length,4);assert(Math.abs(p.speed)<.6,'Truck is held through placement');
 r.clear();assert.equal(r.result,'');assert(!r.pending);p.dispose();
}
{
 const {p,r}=await fixture();
 for(let i=0;i<100;i++){p.rb.setTranslation({x:.13*Math.sin(i*.2),y:1.04,z:0},true);r.step(dt)}
 p.rb.setLinvel({x:2.8,y:1.2,z:0},true);p.rb.setAngvel({x:.8,y:0,z:.6},true);
 assert.equal(r.request(),'ok','Rocking truck deploys immediately');for(let i=0;i<120;i++)p.step(dt,{gas:true});assert.equal(r.state,'ground');r.clear();
 p.rb.setLinvel({x:8,y:0,z:0},true);assert.equal(r.request(),'braking');r.clear();assert(!r.pending,'Reset cancels braking');
 p.rb.setLinvel({x:8,y:0,z:0},true);r.request();
 // Deliberately prevent settling: bounded request must release the brake override.
 for(let i=0;i<1000&&r.pending;i++){p.rb.setTranslation({x:i*.1,y:1.04,z:0},true);p.rb.setLinvel({x:12,y:0,z:0},true);r.step(dt)}
 assert(!r.pending);assert.equal(r.result,'unsettled');assert.equal(r.boards.length,0);
 r.clear();p.rb.setLinvel({x:0,y:0,z:0},true);p.rb.setRotation({x:0,y:0,z:1,w:0},true);assert.equal(r.request(),'tilted');assert(!r.pending);p.dispose();
}
console.log('Recovery request: automatic braking, held gas/reverse/cruise, rocking, repeat taps, reset, timeout and rollover passed.');
