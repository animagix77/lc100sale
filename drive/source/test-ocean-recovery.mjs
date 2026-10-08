import assert from 'node:assert/strict';
import {OceanRecovery,beachRecoveryPose} from './ocean-recovery.mjs';
import {SandField,shore} from './terrain.mjs';
import {riverProfile,riverZ} from './expedition.mjs';
import {WaypointRoute} from './waypoints.mjs';
const tick=(m,n,s)=>{let fires=0;for(let i=0;i<n;i++)if(m.update(1/60,s))fires++;return fires};
const deep={position:{x:-70,y:-1,z:0},groundHeight:-3,waterHeight:0};
for(const hz of [20,30,60,120]){const m=new OceanRecovery();let count=0;for(let i=0;i<hz*5;i++)count+=Number(m.update(1/hz,deep));assert.equal(count,1);m.reset();assert(!m.update(0,deep));assert(!m.update(NaN,deep));assert(!m.update(1/hz,deep));}
for(const state of [
 {position:{x:-33,y:.7,z:0},groundHeight:-.4,waterHeight:.2},
 {position:{x:248,y:14,z:riverZ(248)},groundHeight:13.8,waterHeight:14.5},
 {...deep,position:{x:-70,y:5,z:0}}
])assert.equal(tick(new OceanRecovery(),600,state),0,'Surf, river and airborne vehicles stay playable');
const field=new SandField(),route=new WaypointRoute();route.next=route.passed=19;
for(const z of [0,-210,-340,-350,-680,800]){const pose=beachRecoveryPose({x:shore(z)-30,z},(x,z)=>field.height(x,z));assert.equal(pose.x-shore(pose.z),19);assert(riverProfile(pose.x,pose.z).influence<.01);for(const side of [-1,1])for(const axle of [-1,1]){const cs=Math.cos(pose.yaw),sn=Math.sin(pose.yaw),x=pose.x+side*.962*cs+axle*1.43*sn,q=pose.z-side*.962*sn+axle*1.43*cs;assert(pose.height>=field.height(x,q));}}
assert.equal(route.passed,19);const m=new OceanRecovery();const first=m.message();m.reset();assert.notEqual(m.message(),first);assert.equal(m.rescues,2);
console.log('Ocean recovery: deep immersion, delay, surf/river/jump exclusions, dry beach footprint and varied rescue writing passed.');
