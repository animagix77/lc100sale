import assert from 'node:assert/strict';
import {DrivePhysics,RAPIER} from './physics.mjs';
import {SandField} from './terrain.mjs';
import {Recovery} from './recovery.mjs';
const dt=1/120;
class FlatSand extends SandField{atGrid(i,j){return this.gridOffset(i,j)}}
async function scenario(dug=true){const field=new FlatSand(),p=await DrivePhysics.create(field);let collider;
 function refresh(){if(collider)p.world.removeCollider(collider,false);const verts=[],indices=[],n=80;for(let j=0;j<=n;j++)for(let i=0;i<=n;i++){const x=80+i*.5,z=-20+j*.5;verts.push(x,field.height(x,z),z);if(i<n&&j<n){const a=j*(n+1)+i;indices.push(a,a+n+1,a+1,a+1,a+n+1,a+n+2)}}collider=p.world.createCollider(RAPIER.ColliderDesc.trimesh(new Float32Array(verts),new Uint32Array(indices)).setFriction(.9))}
 // A realistic, deliberately dug depression at all four contact patches.
 if(dug)for(const x of [99,101])for(const z of [-1.5,1.5])for(let i=0;i<14;i++)field.stamp(x,z,1,.17,1.2);
 refresh();p.reset(100,0,0);for(let i=0;i<360;i++)p.step(dt,{brake:true});p.setRange('LO');if(dug)assert(p.setCenterLock(true),'Deep-rut recovery uses center lock');
 function run(seconds,input){for(let i=0;i<seconds*120;i++){p.step(dt,input);if(i%16===0)refresh();p.marks=[]}}
 return {p,field,refresh,run};}
const back=await scenario();const before=back.p.position();back.run(6,{reverse:true});const escaped=back.p.position().z-before.z;console.log('Reverse from ruts',{escaped,speed:back.p.speed,depth:back.field.deepest});assert(escaped>3,'Reverse must climb out of a dug rut, not remain artificially braked');back.p.dispose();
const a=await scenario(),r=new Recovery(a.p),initial=a.p.position();assert.equal(r.deploy(),'ok');assert.deepEqual(a.p.position(),initial,'Deploy never teleports');assert.equal(r.boards.length,4);a.run(1,{brake:true});assert.equal(r.state,'ground');assert(r.boards.every(b=>b.collider));
for(let i=0;i<4;i++){const c=a.p.vehicle.wheelContactPoint(i),b=r.boards[i];assert(Math.abs(b.position.x-(c.x+a.p.origin.x))<.2);assert(b.position.z<c.z+a.p.origin.z,'Each board sits forward of its own tire');assert(r.supports(b.position.x,b.position.z,b.position.y));}

const board=r.boards[0],pt=board.position;assert(r.supports(pt.x,pt.z,pt.y));assert(!r.supports(pt.x+4,pt.z,pt.y),'No grip boost outside board');assert(!r.supports(pt.x,pt.z,pt.y+1),'No boost above board');
const hit=a.p.world.castRay(new RAPIER.Ray({x:pt.x,y:pt.y+.1,z:pt.z},{x:0,y:-1,z:0}),.2,true);assert(hit,'Boards have solid collision support');
a.run(8,{gas:true});console.log('Board escape',{distance:a.p.travel,state:r.state,position:a.p.position(),depth:a.field.deepest});assert(a.p.position().z<initial.z-5,'Drive forward off the boards');assert.equal(r.state,'roof','Boards automatically return to rack');assert.equal(r.boards.length,0);assert.equal(r.deploy(),'moving');a.p.reset(100,8,0);a.run(3,{brake:true});assert.equal(r.deploy(),'ok');a.run(1,{brake:true});a.p.rebase(96,0);r.step(dt);assert(r.boards.every(b=>Math.abs(b.collider.translation().x-(b.position.x-96))<.001),'All four boards survive floating-origin rebase');r.clear();assert.equal(r.state,'roof');a.p.dispose();
// A normal soft-sand drive should not continuously create a self-trapping trench.
const roll=await scenario(false);roll.run(6,{gas:true});console.log("Normal soft-sand travel",roll.p.travel,roll.field.deepest);assert(roll.p.travel>8);assert(!roll.p.stuck);roll.p.dispose();console.log('Reverse escape, physical boards, deployment guard, pickup, rebase and cleanup passed');
