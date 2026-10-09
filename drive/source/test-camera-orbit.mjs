import assert from 'node:assert/strict';
import {CameraOrbit} from './camera-orbit.mjs';
import {drivingInput} from './keyboard.mjs';
const near=(a,b)=>assert(Math.abs(a-b)<1e-8,`${a} != ${b}`);
const allArrows=new Set(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown']);
assert.deepEqual(drivingInput(allArrows),{gas:false,reverse:false,brake:false,handbrake:false,turn:0,cruise:false},'Camera keys never move the vehicle');
assert.deepEqual(drivingInput(new Set(['KeyW','KeyA','ArrowUp','ArrowRight'])),{gas:true,reverse:false,brake:false,handbrake:false,turn:1,cruise:false},'WASD and orbit work simultaneously');
assert.equal(drivingInput(allArrows,{gas:.3,turn:-.4,reverse:0}).gas,.3,'Touch retains analog control during camera input');
assert.equal(drivingInput(allArrows,{},true).cruise,true,'Orbit does not cancel cruise');
const orbit=new CameraOrbit();
for(const heading of [0,.8,Math.PI,-2]){
 const o=orbit.offset(heading,10.5,3.7,3.3);
 near(o.x,Math.sin(heading)*10.5+Math.cos(heading)*3.7);near(o.z,Math.cos(heading)*10.5-Math.sin(heading)*3.7);near(o.y,3.3);
}
orbit.nudge('ArrowLeft');assert(orbit.yaw<0&&orbit.active,'A single tap is visible even between render frames');
orbit.reset();orbit.nudge('ArrowUp');assert(orbit.pitch>0);assert(orbit.offset(0,10.5,3.7,3.3).y>3.3);
for(let i=0;i<1000;i++)orbit.update(1/60,new Set(['ArrowUp','ArrowRight']));
assert(orbit.pitch<=1.15&&Math.abs(orbit.yaw)<=Math.PI,'Pitch and continuous rotations stay bounded');
let pose=orbit.offset(0,10.5,3.7,3.3);assert(Object.values(pose).every(Number.isFinite));
const held={yaw:orbit.yaw,pitch:orbit.pitch};orbit.update(.06,new Set());near(orbit.yaw,held.yaw);near(orbit.pitch,held.pitch);
orbit.update(.06,new Set(['ArrowLeft']),{enabled:false});near(orbit.yaw,held.yaw);
orbit.recenter();for(let i=0;i<160;i++)orbit.update(1/60,new Set());assert(!orbit.active);near(orbit.yaw,0);near(orbit.pitch,0);near(orbit.blend,0);
for(let i=0;i<1000;i++)orbit.update(1/60,new Set(['ArrowDown']));pose=orbit.offset(0,10.5,3.7,3.3);assert(pose.y>1,'Low view cannot pass below the target');
orbit.reset();near(orbit.blend,0);near(orbit.yaw,0);assert(!orbit.active);
const outcomes=[];for(const fps of [30,60,120]){const o=new CameraOrbit();for(let i=0;i<fps*2;i++)o.update(1/fps,new Set(['ArrowRight','ArrowUp']));outcomes.push(o)}
near(outcomes[0].yaw,outcomes[1].yaw);near(outcomes[1].yaw,outcomes[2].yaw);near(outcomes[0].blend,outcomes[2].blend);
console.log('Camera orbit: independent driving, touch/cruise preservation, tap/hold, full rotation, pitch limits, recenter, preview freeze, default composition and frame-rate independence passed.');
