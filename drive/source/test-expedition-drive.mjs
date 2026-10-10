import {LoosePebbles} from './loose-pebbles.mjs';
import assert from 'node:assert/strict';
import {MountainDetails} from './mountain-details.mjs';
import {LavaCrossingView} from './lava-crossing-view.mjs';
import {BeachLife} from './beach-life.mjs';
import {BeachObstacles} from './obstacles.mjs';
import * as THREE from 'three/webgpu';
import {DrivePhysics} from './physics.mjs';import {SandField,clamp} from './terrain.mjs';import {TerrainView} from './terrain-view.mjs';import {WaypointRoute,WAYPOINT_COUNT} from './waypoints.mjs';import {LANDMARKS} from './expedition.mjs';
const choices=process.env.LC100_ROUTE_VARIANT||'saddle,mud';
const f=new SandField(),p=await DrivePhysics.create(f),view=new TerrainView(new THREE.Scene(),p,f),r=new WaypointRoute();
assert(r.choose('dunes',choices.split(',')[0]),'Valid dune route variant');assert(r.choose('return',choices.split(',')[1]),'Valid return route variant');console.log('ITINERARY',choices);
const life=new BeachLife(view.scene),mountain=new MountainDetails(view.scene),crossing=new LavaCrossingView(view.scene),obstacles=new BeachObstacles(p);const gravel=new LoosePebbles(view.scene,p,f);life.ridgeRocks=mountain.rocks;life.lavaRocks=crossing.rocks;
const geometry=view.geometry.bind(view);view.geometry=(...args)=>args[4]?new THREE.PlaneGeometry(1,1):geometry(...args);
const start=Number(process.env.LC100_ROUTE_START||0);if(start)r.next=r.passed=start;const spawn=start?r.checkpoint():{x:-14,z:0};
view.update(spawn.x,spawn.z);p.reset(spawn.x,spawn.z,f.height(spawn.x,spawn.z));if(start){const t=r.target(),yaw=Math.atan2(-(t.x-spawn.x),-(t.z-spawn.z));p.rb.setRotation({x:0,y:Math.sin(yaw/2),z:0,w:Math.cos(yaw/2)},true)}p.setRange('LO');p.setCenterLock(true);for(let i=0;i<240;i++)p.step(1/120,{brake:true});let lastPass=0;
for(let i=0;i<160000&&r.passed<WAYPOINT_COUNT;i++){
 const a=p.position(),t=r.target();
 // A driver lines up with the narrow visible deck. Follow its centerline with
 // an 8m lookahead instead of cutting toward a gate 90m beyond the approach.
 const aim=r.passed===17&&a.z<-438?{x:665,z:Math.min(-436,a.z+8)}:t;
 const fwd=p.forward(),heading=Math.atan2(-fwd.x,-fwd.z),desired=Math.atan2(-(aim.x-a.x),-(aim.z-a.z)),error=Math.atan2(Math.sin(desired-heading),Math.cos(desired-heading));
 view.update(a.x,a.z);life.refresh(a,p.origin);mountain.refresh(a,p.origin);crossing.update(i/120,p.origin);obstacles.refresh(life);if(i%4===0)gravel.stream(a);if(i%16===0)view.refresh();p.step(1/120,{gas:p.speed<2.6,turn:clamp(error*3,-1,1),brake:Math.abs(error)>1&&Math.abs(p.speed)>1.5});p.marks.length=0;p.soundEvents.length=0;
 const contacts=[0,1,2,3].filter(w=>p.vehicle.wheelIsInContact(w)),groundHeight=contacts.length?Math.max(...contacts.map(w=>p.vehicle.wheelContactPoint(w)?.y??-Infinity)):f.height(a.x,a.z);
 if(r.update(p.position(),{grounded:contacts.length>=2,groundHeight})){console.log('PASS',r.passed,t.name,'seconds',(i/120).toFixed(1));lastPass=i;}
 if(i-lastPass>18000){console.log('STALL',r.passed,p.position(),p.speed,'target',t,'ruts',f.deepest);process.exitCode=1;break;}
}
console.log('Expedition result',r.passed,'/',WAYPOINT_COUNT,p.position(), 'ruts',f.deepest);if(r.passed!==WAYPOINT_COUNT)process.exitCode=1;assert.equal(r.passed,WAYPOINT_COUNT,'Complete ascent, descent and both rocky fords without resetting');gravel.dispose();obstacles.dispose();crossing.dispose();mountain.dispose();life.dispose();view.dispose();p.dispose();
