import assert from 'node:assert/strict';
import * as THREE from 'three/webgpu';
import {RoadsideStories} from './roadside-view.mjs';
import {ROADSIDE_SPOTS,inRoadsideClearing,roadsideActors} from './roadside-spots.mjs';
import {routeSample,riverMask} from './expedition.mjs';
import {vehicleGeometry} from './roadside-models.mjs';
import {COASTAL_LANDMARKS,COASTAL_CAMP,BARGE_SITE,coastalRouteDistance} from './coastal-islands.mjs';
import {roadsideZones} from './roadside-safety.mjs';
import {baseHeight} from './terrain.mjs';
for(const spot of ROADSIDE_SPOTS){assert(routeSample(spot.x,spot.z).distance>=10);assert.equal(riverMask(spot.x,spot.z),0);assert(inRoadsideClearing(spot.x,spot.z));assert(!inRoadsideClearing(spot.x+40,spot.z));}
const coastal=ROADSIDE_SPOTS.filter(s=>s.coastal),coastalZones=roadsideZones(coastal);
assert.equal(coastal.length,3);assert.deepEqual(ROADSIDE_SPOTS.slice(0,4).map(s=>s.id),['buried-pickup','repair-meeting','wrong-way-up','snow-confidence']);
for(const spot of coastal){
 assert(coastalRouteDistance(spot.x,spot.z)>=12);assert(spot.buried>=.35&&spot.buried<=.55);assert.equal(roadsideActors(spot).length,0);
 assert(Math.hypot(spot.x-COASTAL_CAMP.x,spot.z-COASTAL_CAMP.z)>COASTAL_CAMP.radius+15);assert(Math.hypot(spot.x-BARGE_SITE.x,spot.z-BARGE_SITE.z)>23);
 assert(Math.hypot(spot.hx,spot.hz)<.22);assert(baseHeight(spot.x,spot.z)>.35);
}
// Every point across the full usable lane stays outside the actual expanded
// vehicle safety zones, including around bends and beside the sandbar entries.
for(let i=0;i<COASTAL_LANDMARKS.length-1;i++){
 const a=COASTAL_LANDMARKS[i],b=COASTAL_LANDMARKS[i+1],dx=b.x-a.x,dz=b.z-a.z,len=Math.hypot(dx,dz);
 for(let d=0;d<=len;d+=1)for(const offset of [-4,0,4]){
  const x=a.x+dx*d/len-dz/len*offset,z=a.z+dz*d/len+dx/len*offset;
  assert(coastalZones.every(zone=>Math.hypot(x-zone.x,z-zone.z)>zone.radius+.5),'Bogged vehicles cannot trigger protection in the driving lane');
 }
}
for(const mobile of [false,true]){
 const scene=new THREE.Scene(),view=new RoadsideStories(scene,{mobile}),p=ROADSIDE_SPOTS[1],origin={x:0,z:0};
 assert.equal(view.meshes.length,7);assert.equal(view.sandMeshes.length,3);assert(view.stats.triangles<25000,'Fixed low-poly geometry budget');
 for(const m of view.meshes){assert(m.geometry.boundingSphere.radius<7,'Clearings enclose each scene');assert([...m.geometry.attributes.position.array].every(Number.isFinite));assert.equal(m.userData.fadeRange.far,130);}
 for(const m of view.sandMeshes){
  const p=m.geometry.attributes.position,n=m.geometry.attributes.normal,s=m.userData.story;
  for(let i=0;i<p.count;i++){const ground=baseHeight(p.getX(i),p.getZ(i));assert(p.getY(i)>ground-.002&&p.getY(i)<ground+.27,'Churn hugs sand with small rounded spoil');assert(Math.hypot(p.getX(i)-s.x,p.getZ(i)-s.z)<6,'All churn remains inside scenery clearing');assert(n.getY(i)>0,'Ground strips face upwards');}
 }
 assert.match(view.update(p,origin,1),/performance review/);assert.equal(view.update(p,origin,2),null,'Jokes are not repeated every frame');assert(view.smoke.count>0);assert(view.smoke.count<=(mobile?8:12));
 const first=view.smoke.instanceMatrix.array.slice();view.update(p,{x:512,z:-512},2);const translated=view.smoke.instanceMatrix.array.slice();
 assert(Math.abs(translated[12]+512-first[12])<2,'Steam follows floating origin');assert.equal(view.meshes[1].position.x,-512);assert.equal(view.meshes[1].position.z,512);
 for(const m of view.sandMeshes){assert.equal(m.position.x,-512);assert.equal(m.position.z,512);}
 const versions=view.meshes.map(m=>m.geometry.version);for(let i=0;i<300;i++)view.update(p,origin,i/60,false);assert.deepEqual(view.meshes.map(m=>m.geometry.version),versions,'No per-frame geometry rebuilds');
 view.update({x:2000,z:2000},origin,10);assert.equal(view.stats.visible,0);assert.equal(view.smoke.count,0);
 view.dispose();assert.equal(scene.children.length,0);
}
{
 const view=new RoadsideStories(new THREE.Scene(),{reduced:true}),p=ROADSIDE_SPOTS[1];view.update(p,{x:0,z:0},1,false);const a=view.smoke.instanceMatrix.array.slice();view.update(p,{x:0,z:0},10,false);assert.deepEqual(view.smoke.instanceMatrix.array,a,'Reduced-motion steam is static');view.dispose();
}
for(const kind of ['pickup','suv','boxy']){const g=vehicleGeometry({kind});g.computeBoundingBox();assert(g.boundingBox.max.y>1.8&&g.boundingBox.max.y<2.5);assert(g.boundingBox.max.z-g.boundingBox.min.z>4);g.dispose()}
console.log('Roadside: seven scenes, route clearance, dry placements, finite geometry, triangle/puff budgets, distance fade, once-only jokes, floating origin, reduced motion and disposal passed.');
