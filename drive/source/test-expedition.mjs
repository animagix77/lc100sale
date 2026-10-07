import assert from 'node:assert/strict';
import {LANDMARKS,LOOP_LENGTH,routeSample,biomeWeather,riverZ,riverLevel} from './expedition.mjs';
import {SandField,baseHeight,surfaceAt} from './terrain.mjs';
import {WaypointRoute,WAYPOINT_COUNT} from './waypoints.mjs';
assert(LOOP_LENGTH>1000&&LOOP_LENGTH<2000);
assert.deepEqual([LANDMARKS[0].x,LANDMARKS[0].z],[LANDMARKS.at(-1).x,LANDMARKS.at(-1).z]);
let steepest=0;
for(let i=1;i<LANDMARKS.length;i++){
 const a=LANDMARKS[i-1],b=LANDMARKS[i],steps=Math.ceil(Math.hypot(a.x-b.x,a.z-b.z));let last=baseHeight(a.x,a.z);
 for(let j=1;j<=steps;j++){const x=a.x+(b.x-a.x)*j/steps,z=a.z+(b.z-a.z)*j/steps,h=baseHeight(x,z);assert(Number.isFinite(h));steepest=Math.max(steepest,Math.abs(h-last));last=h;}
}
assert(steepest<.65,'Route avoids impassable terrain steps');
for(const [index,biome] of [[0,'beach'],[3,'dunes'],[5,'grass'],[7,'river'],[10,'snow'],[14,'mud']]){const p=LANDMARKS[index];assert.equal(surfaceAt(p.x,p.z).biome,biome)}
const snow=LANDMARKS[10],mud=LANDMARKS[14];assert(biomeWeather(snow.x,snow.z).snow>.8);assert(biomeWeather(mud.x,mud.z).rain>.8);assert.equal(biomeWeather(-14,0).rain,0);
const ford={x:248,z:riverZ(248)};const depth=riverLevel(ford.x)-baseHeight(ford.x,ford.z);assert(depth>.2&&depth<.5,'Ford is shallow enough to drive');
const f=new SandField();for(let i=0;i<20;i++){f.stamp(snow.x+12,snow.z-12,1,.17,.6);f.stamp(64,-164,1,.17,.6)}
assert(f.depthAt(snow.x+12,snow.z-12)>f.depthAt(64,-164)*1.3,'Powder deforms deeper than sand');
const route=new WaypointRoute();for(let n=0;n<WAYPOINT_COUNT*2;n++){const t=route.target(),y=baseHeight(t.x,t.z)+1;route.resetTracking({x:t.x,z:t.z+2,y});assert(route.update({x:t.x,z:t.z,y},{groundHeight:y-1}));}assert.equal(route.target().leg,1);assert.equal(route.passed,WAYPOINT_COUNT*2);
console.log({loopMetres:Math.round(LOOP_LENGTH),steepest,fordDepth:depth,snowRut:f.depthAt(snow.x+12,snow.z-12),sandRut:f.depthAt(64,-164)});console.log('Expedition: connected loop, region surfaces, climate, route grades, shallow ford, deep powder and repeat laps passed.');
