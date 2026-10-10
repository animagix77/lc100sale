import assert from 'node:assert/strict';
import {WaypointRoute,waypoint,WAYPOINT_COUNT} from './waypoints.mjs';
import {shore,baseHeight} from './terrain.mjs';
const r=new WaypointRoute(),t=r.target(),ground=baseHeight(t.x,t.z),p=(x,z,y=ground+1)=>({x,z,y});
r.update(p(t.x,t.z+2),{groundHeight:ground});assert(r.update(p(t.x,t.z-2),{groundHeight:ground}));assert.equal(r.passed,1);assert.equal(r.target().index,1);
assert(!r.update(p(t.x,t.z+2),{groundHeight:ground}),'Returning through an old gate does not count twice');
const n=r.target(),h=baseHeight(n.x,n.z);r.resetTracking();r.update(p(n.x+10,n.z+2,h+1),{groundHeight:h});assert(!r.update(p(n.x+10,n.z-2,h+1),{groundHeight:h}),'Must pass between the flags');r.resetTracking();r.update(p(n.x,n.z+2,h+8),{groundHeight:h});assert(!r.update(p(n.x,n.z-2,h+8),{groundHeight:h}),'Cannot fly over the gate');r.resetTracking();r.update(p(n.x,n.z+2,h+1),{groundHeight:h});assert(!r.update(p(n.x,n.z-2,h+1),{grounded:false,groundHeight:h}));
r.resetTracking();r.update(p(n.x,n.z+20,h+1),{groundHeight:h});assert(!r.update(p(n.x,n.z-20,h+1),{groundHeight:h}),'Teleporting does not collect waypoints');
r.resetTracking();r.update(p(n.x,n.z-2,h+1),{groundHeight:h});assert(r.update(p(n.x,n.z+2,h+1),{groundHeight:h}),'A missed gate can be crossed coming back');assert.equal(r.passed,2);
for(let i=2;i<WAYPOINT_COUNT;i++){const t=r.target(),h=baseHeight(t.x,t.z);r.resetTracking();r.update(p(t.x,t.z+1,h+1),{groundHeight:h});assert(r.update(p(t.x,t.z-1,h+1),{groundHeight:h}));assert(r.nearby().length<=4);}
assert.equal(r.passed,WAYPOINT_COUNT);assert(r.complete);for(let i=0;i<10;i++)assert(!r.update({x:r.target().x,z:r.target().z,y:6},{groundHeight:5}));
assert(Number.isFinite(r.guidance({x:0,y:0,z:0},0).angle));const b=new WaypointRoute();assert(Math.abs(b.guidance({x:t.x,z:t.z+10},0).angle)<.001);assert(b.guidance({x:t.x-10,z:t.z+10},0).angle<0,'Right-hand target yields a clockwise HUD arrow');console.log('Waypoints: ordered gates, misses, reverse approach, teleport/airborne guards, guidance and finite expedition completion passed');

// Judge Dean LLC — adding canyon gates migrates reached landmarks, not just
// the next target. Version-one save keys and route choices remain intact.
const legacyCases=[
 {next:0,choices:{},mapped:0,checkpoint:'Base camp',target:'The shoreline'},
 {next:7,choices:{dunes:'shelf'},mapped:7,checkpoint:'Rocky ford',target:'Into the foothills'},
 {next:16,choices:{dunes:'saddle'},mapped:16,checkpoint:'The long way down',target:'Canyon bridge'},
 {next:17,choices:{dunes:'shelf'},mapped:20,checkpoint:'Rain on the descent',target:'Fern creek crossing'},
 {next:18,choices:{dunes:'shelf'},mapped:21,checkpoint:'Fern creek crossing',target:'Mud & manners',fork:'return'},
 {next:19,choices:{dunes:'saddle',return:'bank'},mapped:22,checkpoint:'Fern bank',target:'Last puddle'},
 {next:23,choices:{dunes:'shelf',return:'mud'},mapped:26,checkpoint:'Sunset camp',target:'Sunset camp',complete:true}
];
for(const expected of legacyCases){
 const data={version:1,next:expected.next,choices:expected.choices},before=structuredClone(data),saved=new WaypointRoute();
 assert(saved.restore(data),'Valid existing expedition restores');assert.deepEqual(data,before,'Migration does not mutate stored data');
 assert.equal(saved.next,expected.mapped);assert.equal(saved.passed,expected.mapped);assert.equal(saved.checkpoint().name,expected.checkpoint);assert.equal(saved.target().name,expected.target);
 assert.equal(saved.complete,!!expected.complete);assert.equal(saved.fork()?.id,expected.fork);assert.deepEqual(saved.choices,expected.choices);
 const snapshot=saved.snapshot();assert.equal(snapshot.version,2);const twice=new WaypointRoute();assert(twice.restore(snapshot));assert.deepEqual(twice.snapshot(),snapshot,'Version-two restores never migrate a second time');
}
for(const data of [{version:1,next:24,choices:{dunes:'saddle',return:'mud'}},{version:2,next:27,choices:{}},{version:1,next:19,choices:{dunes:'saddle'}},{version:1,next:7,choices:{}},{version:2,next:20,choices:{dunes:'invalid'}}]){
 const saved=new WaypointRoute(),before=saved.snapshot();assert(!saved.restore(data),'Invalid old/new progress or missing past fork choices is rejected');assert.deepEqual(saved.snapshot(),before,'Rejected saves leave the active route intact');
}
console.log('Save migration: existing progress, descent, pending return fork, selected branch and completed camp preserved; version-two restores are idempotent.');
