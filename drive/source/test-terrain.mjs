import assert from 'node:assert/strict';
import * as THREE from 'three/webgpu';
import {DrivePhysics} from './physics.mjs';
import {SandField,shore} from './terrain.mjs';
import {TerrainView} from './terrain-view.mjs';
const s=new SandField(),p=await DrivePhysics.create(s),view=new TerrainView(new THREE.Scene(),p,s);
let minY=Infinity,maxY=-Infinity,minSusp=Infinity,maxSusp=-Infinity,maxAxleDifference=0;
// Drive the firm coastal strip with actual streamed, deforming collision meshes.
const startX=shore(0)+18;view.update(startX,0);p.reset(startX,0,s.height(startX,0));
for(let i=0;i<3600;i++){let at=p.position();view.update(at.x,at.z);if(i%16===0)view.refresh();p.step(1/120,{cruise:true,turn:0});p.marks.length=0;at=p.position();const lengths=[0,1,2,3].map(j=>p.vehicle.wheelSuspensionLength(j));minSusp=Math.min(minSusp,...lengths);maxSusp=Math.max(maxSusp,...lengths);maxAxleDifference=Math.max(maxAxleDifference,Math.abs(lengths[0]-lengths[2]));minY=Math.min(minY,at.y);maxY=Math.max(maxY,at.y);assert(Number.isFinite(at.y)&&at.y>s.height(at.x,at.z)-1,'Chassis stays above streamed ground')}
assert(p.travel>65,'Continuous coastal drive crosses multiple tile boundaries');assert(maxSusp-minSusp>.12,'Suspension compresses and extends over real swales');assert(maxAxleDifference>.08,'Front and rear axles articulate independently');assert(s.stamps>100,'Physics contacts deform the actual terrain');
// Probe distant coast segments and recenter the active collision/render tile set.
for(const z of [-600,1200,-10000]){const x=shore(z)+18;p.reset(x,z,s.height(x,z));view.update(x,z);const local=p.rb.translation();p.rebase(Math.round(local.x/32)*32,Math.round(local.z/32)*32);view.rebase();for(let i=0;i<240;i++){p.step(1/120,{brake:true});if(i%16===0)view.refresh();p.marks.length=0}const at=p.position();assert(Math.abs(at.y-s.height(at.x,at.z))<1.5,'Truck settles on correctly rebased distant colliders');assert(view.tiles.size===25,'Tile memory stays bounded')}
console.log({distance:p.travel,minY,maxY,minSusp,maxSusp,maxAxleDifference,tiles:view.tiles.size,rutDepth:s.deepest,retained:s.ruts.size});p.dispose();console.log('Streamed deforming terrain and distant floating-origin checks passed');
