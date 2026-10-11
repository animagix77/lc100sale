// Judge Dean LLC — two itineraries, compatible saves and independent island camp.
import assert from 'node:assert/strict';
import * as THREE from 'three/webgpu';
import {WaypointRoute} from './waypoints.mjs';
import {CAMP,LANDMARKS} from './expedition.mjs';
import {COASTAL_CAMP} from './coastal-islands.mjs';
import {CampState,campPlacement,campFireSite} from './camp.mjs';
import {CampCamera} from './camp-camera.mjs';
import {baseHeight} from './terrain.mjs';
import {oceanHeight} from './ocean-height.mjs';
import {expeditionRecoveryPose,beachRecoveryPose} from './ocean-recovery.mjs';
import {availableRouteChoice,saveJourney,readJourney} from './journey-ui.mjs';
const route=new WaypointRoute();assert(route.choose('dunes','islands'));
assert.equal(route.count,10);assert.equal(route.camp,COASTAL_CAMP);assert.equal(route.forks.length,1);
assert(!route.choose('return','bank'),'The island itinerary has no mountain return fork');
assert(route.points.every(p=>!['volcanic','snow','mud','river'].includes(p.biome)));
for(let next=0;next<=route.count;next++){
 route.next=route.passed=next;
 const restored=new WaypointRoute();assert(restored.restore(route.snapshot()));
 assert.deepEqual(restored.target(),route.target());assert.deepEqual(restored.checkpoint(),route.checkpoint());
 assert.equal(restored.complete,next===10);assert.equal(restored.camp,COASTAL_CAMP);
 if(next>1){assert.equal(availableRouteChoice(restored),null);assert(!restored.choose('dunes','saddle'));}
 if(next>=3){const pose=expeditionRecoveryPose({x:-510,z:-320},baseHeight,restored);assert(Math.hypot(pose.x-route.checkpoint().x,pose.z-route.checkpoint().z)<.01);assert(baseHeight(pose.x,pose.z)>oceanHeight(pose.x,pose.z,0)+.5,'Every reached island flag recovers on dry ground');}
}
for(const next of [0,1,2,7,17,26]){
 const old=new WaypointRoute(),choices={dunes:'shelf',...(next>21?{return:'bank'}:{})};
 assert(old.restore({version:2,next,choices}));assert.equal(old.count,26);assert.equal(old.camp,CAMP);
 assert.equal(old.checkpoint().x,LANDMARKS[next].x);assert.equal(old.points[3].name,'Coastal shelf');
 const from={x:-60,z:0};assert.deepEqual(expeditionRecoveryPose(from,baseHeight,old),beachRecoveryPose(from,baseHeight));
 if(next<=23){const v1=new WaypointRoute();assert(v1.restore({version:1,next,choices:{...choices,...(next>18?{return:'bank'}:{})}}));assert.equal(v1.next,next>=17?next+3:next);assert.equal(v1.count,26);}
}
const beforeChoice=new WaypointRoute();assert(beforeChoice.restore({version:2,next:2,choices:{}}));assert.equal(beforeChoice.target().name,LANDMARKS[3].name);assert(!beforeChoice.choose('dunes','islands'),'Cannot move a reached mainland checkpoint into the sea');
const t=beforeChoice.target(),height=baseHeight(t.x,t.z);beforeChoice.resetTracking({x:t.x,z:t.z+1,y:height+1});assert(beforeChoice.update({x:t.x,z:t.z,y:height+1},{groundHeight:height}));assert(new WaypointRoute().restore(beforeChoice.snapshot()));
const checkpoint=route.snapshot();for(const data of [
 {version:1,next:4,choices:{dunes:'islands'}},
 {version:2,next:11,choices:{dunes:'islands'}},
 {version:2,next:4,choices:{dunes:'islands',return:'bank'}},
 {version:2,next:4,choices:{dunes:'unrecognised'}}
]){assert(!route.restore(data));assert.deepEqual(route.snapshot(),checkpoint,'Rejected save never mutates the active itinerary');}
const camp=new CampState(route.camp),point={x:route.camp.x+7,z:route.camp.z+3,yaw:.3};
const result=campPlacement(point,{site:route.camp,heightAt:baseHeight,waterAt:(x,z)=>oceanHeight(x,z,0),vehicle:route.camp});assert(result.ok,result.reason);
camp.begin(point);camp.result=result;assert(camp.confirm());camp.fire=true;
const store=new Map();globalThis.localStorage={getItem:key=>store.get(key),setItem:(key,value)=>store.set(key,value)};
assert(saveJourney(route,camp));const saved=readJourney(),restoredRoute=new WaypointRoute();assert(restoredRoute.restore(saved.route));const restoredCamp=new CampState(restoredRoute.camp);restoredCamp.restore(saved.camp);assert.deepEqual(restoredCamp.snapshot(),camp.snapshot());assert.deepEqual([...store.keys()],['com.judgedeanllc.lc100.expedition.v1']);delete globalThis.localStorage;
const fire=campFireSite(route.camp);assert.equal(fire.x,route.camp.x-10);assert(Math.abs(baseHeight(fire.x,fire.z)-COASTAL_CAMP.height)<1e-9);
assert(!campPlacement(CAMP,{site:route.camp,heightAt:baseHeight,waterAt:()=>-Infinity}).ok);
const camera=new THREE.PerspectiveCamera(48,390/844,.1,1500),view=new CampCamera(),origin={x:-384,z:-256};view.enter(camera,origin);view.update(camera,.1,{site:route.camp,origin,complete:true,distance:1,reduced:true});assert.equal(camera.position.x,route.camp.x+12-origin.x);assert.equal(camera.position.z,route.camp.z+29-origin.z);assert.equal(camera.position.y,route.camp.height+17);
camp.setSite(CAMP);assert.equal(camp.tent,null);assert(!camp.fire);assert.equal(camp.site,CAMP);
console.log('Coastal journey: all 11 save positions, isolated fork/camp, dry island rescues, legacy v1/v2 migration, invalid saves, shelter/fire persistence and rebased camera passed.');
