import assert from 'node:assert/strict';
import * as THREE from 'three/webgpu';
import {DrivePhysics} from './physics.mjs';
import {SandField,shore} from './terrain.mjs';
import {TerrainView} from './terrain-view.mjs';
const p=await DrivePhysics.create(),s=new SandField(),view=new TerrainView(new THREE.Scene(),p,s);view.update(0,0);p.reset(0,0,s.height(0,0));let lastTracks=[];let minY=Infinity,maxY=-Infinity,air=0,rebases=0;
for(let i=0;i<18000;i++){let at=p.position();view.update(at.x,at.z);if(i%12===0){for(let w=0;w<4;w++)if(p.vehicle.wheelIsInContact(w)){const c=p.vehicle.wheelContactPoint(w);const x=c.x+p.origin.x,z=c.z+p.origin.z;if(!lastTracks[w]||Math.hypot(lastTracks[w].x-x,lastTracks[w].z-z)>.17){s.stamp(x,z);lastTracks[w]={x,z}}}view.refresh()}p.step(1/120,{cruise:true,turn:0});at=p.position();minY=Math.min(minY,at.y);maxY=Math.max(maxY,at.y);if(![0,1,2,3].some(w=>p.vehicle.wheelIsInContact(w)))air++;const l=p.rb.translation();if(Math.abs(l.z)>256){const z=Math.round(l.z/32)*32;p.rebase(0,z);view.rebase();rebases++}assert(Number.isFinite(at.y)&&at.y>s.height(at.x,at.z)-1,'Chassis stays above streamed ground')}
console.log({end:p.position(),distance:p.travel,minY,maxY,rebases,air,tiles:view.tiles.size,rutDepth:s.deepest,retained:s.ruts.size});assert(p.travel>300,'Drives beyond the old map boundary');assert(rebases>0,'Crosses floating-origin boundary');assert(view.tiles.size===25,'Terrain memory stays bounded');assert(s.deepest<-.1,'Wheels deform physics surface');p.dispose();console.log('Streamed terrain, deformation and floating origin passed');
