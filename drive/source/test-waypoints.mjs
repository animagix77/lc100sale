import assert from 'node:assert/strict';
import {WaypointRoute,waypoint} from './waypoints.mjs';
import {shore,baseHeight} from './terrain.mjs';
const r=new WaypointRoute(),t=r.target(),ground=baseHeight(t.x,t.z),p=(x,z,y=ground+1)=>({x,z,y});
r.update(p(t.x,t.z+2),{groundHeight:ground});assert(r.update(p(t.x,t.z-2),{groundHeight:ground}));assert.equal(r.passed,1);assert.equal(r.target().index,1);
assert(!r.update(p(t.x,t.z+2),{groundHeight:ground}),'Returning through an old gate does not count twice');
const n=r.target(),h=baseHeight(n.x,n.z);r.resetTracking();r.update(p(n.x+10,n.z+2,h+1),{groundHeight:h});assert(!r.update(p(n.x+10,n.z-2,h+1),{groundHeight:h}),'Must pass between the flags');r.resetTracking();r.update(p(n.x,n.z+2,h+8),{groundHeight:h});assert(!r.update(p(n.x,n.z-2,h+8),{groundHeight:h}),'Cannot fly over the gate');r.resetTracking();r.update(p(n.x,n.z+2,h+1),{groundHeight:h});assert(!r.update(p(n.x,n.z-2,h+1),{grounded:false,groundHeight:h}));
r.resetTracking();r.update(p(n.x,n.z+20,h+1),{groundHeight:h});assert(!r.update(p(n.x,n.z-20,h+1),{groundHeight:h}),'Teleporting does not collect waypoints');
r.resetTracking();r.update(p(n.x,n.z-2,h+1),{groundHeight:h});assert(r.update(p(n.x,n.z+2,h+1),{groundHeight:h}),'A missed gate can be crossed coming back');assert.equal(r.passed,2);
for(let i=2;i<2000;i++){const t=r.target(),h=baseHeight(t.x,t.z);r.resetTracking();r.update(p(t.x,t.z+1,h+1),{groundHeight:h});assert(r.update(p(t.x,t.z-1,h+1),{groundHeight:h}));assert.equal(r.nearby().length,4);assert(t.x-shore(t.z)>=19&&t.x-shore(t.z)<=33)}
assert.equal(r.passed,2000);assert(Number.isFinite(r.guidance({x:0,y:0,z:0},0).angle));const b=new WaypointRoute();assert(Math.abs(b.guidance({x:t.x,z:t.z+10},0).angle)<.001);assert(b.guidance({x:t.x-10,z:t.z+10},0).angle<0,'Right-hand target yields a clockwise HUD arrow');console.log('Waypoints: ordered gates, misses, reverse approach, teleport/airborne guards, guidance and 2,000-stop bounded route passed');
