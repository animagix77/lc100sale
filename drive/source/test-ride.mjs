import assert from 'node:assert/strict';
import {DrivePhysics} from './physics.mjs';
import {SandField,shore} from './terrain.mjs';
import {TerrainView} from './terrain-view.mjs';
import * as THREE from 'three/webgpu';
const field=new SandField(),p=await DrivePhysics.create(field),v=new TerrainView(new THREE.Scene(),p,field),x=shore(0)+18;
v.update(x,0);p.reset(x,0,field.height(x,0));for(let i=0;i<360;i++)p.step(1/120,{brake:true});let sum=0,travel=0,prev=Array.from({length:4},(_,i)=>p.vehicle.wheelSuspensionLength(i)),maxdiff=0;
for(let i=0;i<2400;i++){const at=p.position();v.update(at.x,at.z);if(i%16===0)v.refresh();p.step(1/120,{cruise:true});p.marks.length=0;sum+=p.rb.linvel().y**2;const lengths=prev.map((_,i)=>p.vehicle.wheelSuspensionLength(i));travel+=lengths.reduce((s,l,i)=>s+Math.abs(l-prev[i]),0)/4;maxdiff=Math.max(maxdiff,Math.abs(lengths[0]-lengths[2]));prev=lengths}
console.log(JSON.stringify({verticalVelocityRMS:Math.sqrt(sum/2400),suspensionTravelTotal:travel,axleDifference:maxdiff,distance:p.travel}));p.dispose();

assert(Math.sqrt(sum/2400)>.15,'Physical relief produces sustained body heave after settling');assert(maxdiff>.12,'Front and rear wheels independently articulate over irregular relief');console.log('Settled suspension ride checks passed');
