import assert from 'node:assert/strict';
import * as THREE from 'three/webgpu';
import {RoadsideStories} from './roadside-view.mjs';
import {ROADSIDE_SPOTS,inRoadsideClearing} from './roadside-spots.mjs';
import {routeSample,riverMask} from './expedition.mjs';
import {vehicleGeometry} from './roadside-models.mjs';
for(const spot of ROADSIDE_SPOTS){assert(routeSample(spot.x,spot.z).distance>=10);assert.equal(riverMask(spot.x,spot.z),0);assert(inRoadsideClearing(spot.x,spot.z));assert(!inRoadsideClearing(spot.x+40,spot.z));}
for(const mobile of [false,true]){
 const scene=new THREE.Scene(),view=new RoadsideStories(scene,{mobile}),p=ROADSIDE_SPOTS[1],origin={x:0,z:0};
 assert.equal(view.meshes.length,4);assert(view.stats.triangles<15000,'Fixed low-poly geometry budget');
 for(const m of view.meshes){assert(m.geometry.boundingSphere.radius<7,'Clearings enclose each scene');assert([...m.geometry.attributes.position.array].every(Number.isFinite));assert.equal(m.userData.fadeRange.far,130);}
 assert.match(view.update(p,origin,1),/performance review/);assert.equal(view.update(p,origin,2),null,'Jokes are not repeated every frame');assert(view.smoke.count>0);assert(view.smoke.count<=(mobile?8:12));
 const first=view.smoke.instanceMatrix.array.slice();view.update(p,{x:512,z:-512},2);const translated=view.smoke.instanceMatrix.array.slice();
 assert(Math.abs(translated[12]+512-first[12])<2,'Steam follows floating origin');assert.equal(view.meshes[1].position.x,-512);assert.equal(view.meshes[1].position.z,512);
 const versions=view.meshes.map(m=>m.geometry.version);for(let i=0;i<300;i++)view.update(p,origin,i/60,false);assert.deepEqual(view.meshes.map(m=>m.geometry.version),versions,'No per-frame geometry rebuilds');
 view.update({x:2000,z:2000},origin,10);assert.equal(view.stats.visible,0);assert.equal(view.smoke.count,0);
 view.dispose();assert.equal(scene.children.length,0);
}
{
 const view=new RoadsideStories(new THREE.Scene(),{reduced:true}),p=ROADSIDE_SPOTS[1];view.update(p,{x:0,z:0},1,false);const a=view.smoke.instanceMatrix.array.slice();view.update(p,{x:0,z:0},10,false);assert.deepEqual(view.smoke.instanceMatrix.array,a,'Reduced-motion steam is static');view.dispose();
}
for(const kind of ['pickup','suv','boxy']){const g=vehicleGeometry({kind});g.computeBoundingBox();assert(g.boundingBox.max.y>1.8&&g.boundingBox.max.y<2.5);assert(g.boundingBox.max.z-g.boundingBox.min.z>4);g.dispose()}
console.log('Roadside: four scenes, route clearance, dry placements, finite geometry, triangle/puff budgets, distance fade, once-only jokes, floating origin, reduced motion and disposal passed.');
