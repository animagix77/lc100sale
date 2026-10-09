import assert from 'node:assert/strict';
import * as THREE from 'three/webgpu';
import {CoastalAtmosphere} from './coastal-atmosphere.mjs';
import {coastalWind,grassWindStrength} from './coastal-wind.mjs';
import {SandField,shore} from './terrain.mjs';
for(const mobile of [false,true]){
 const scene=new THREE.Scene(),field=new SandField(),camera=new THREE.PerspectiveCamera(),a=new CoastalAtmosphere(scene,field,{mobile}),p={x:shore(0)+35,z:0},origin={x:0,z:0},weather={altitude:8,wind:25};a.update(p,12,origin,camera,weather);
 assert.equal(a.stats.gulls,0);assert.equal(a.stats.sand,0);assert.equal(a.gulls,undefined,'No gull mesh is allocated');assert.equal(a.birdCount,undefined,'No offshore bird pool remains');assert.equal(scene.children.length,2,'Only coastal haze and inland mist are allocated');
 const before=a.haze.instanceMatrix.array.slice();a.update(p,12,{x:512,z:-512},camera,weather);
 for(let i=0;i<a.haze.count;i++){assert(Math.abs(a.haze.instanceMatrix.array[i*16+12]+512-before[i*16+12])<.001);assert(Math.abs(a.haze.instanceMatrix.array[i*16+14]-512-before[i*16+14])<.001)}
 a.update(p,14,origin,camera,weather);assert.notDeepEqual(a.haze.instanceMatrix.array,before,'Offshore haze continues drifting without birds');
 const meadow={x:190,z:-270};a.update(meadow,15,origin,camera,{altitude:4,cloud:.15,rain:0});assert(a.inlandMist.visible,'The meadow receives visible ground haze');assert(a.mistCount<=(mobile?6:9),'Inland haze stays within a small fixed instance budget');assert([...a.mistAlpha.array].some(alpha=>alpha>.15),'Ground mist has enough opacity to read across the meadow');
 assert.equal(a.inlandMist.material.fog,false,'Ground mist is not faded twice by distance fog');
 const mistBefore=[...a.inlandMist.instanceMatrix.array],alphaBefore=[...a.mistAlpha.array];a.update(meadow,15,{x:512,z:-512},camera,{altitude:4,cloud:.15,rain:0});
 for(let i=0;i<a.mistCount;i++){assert(Math.abs(a.inlandMist.instanceMatrix.array[i*16+12]-(mistBefore[i*16+12]-512))<.001);assert(Math.abs(a.inlandMist.instanceMatrix.array[i*16+14]-(mistBefore[i*16+14]+512))<.001)}assert.deepEqual([...a.mistAlpha.array],alphaBefore,'Origin rebasing does not flash haze opacity');
 a.update(p,15,origin,camera,{altitude:-15,wind:40,rain:1});assert.equal(a.stats.gulls,0);assert.equal(a.stats.sand,0);assert(a.hazeOpacity.value>0,'Wet nights retain coastal haze');
 for(const z of [-2000,8000,50000]){a.update({x:shore(z)+35,z},20,{x:0,z},camera,weather);assert([...a.inlandMist.instanceMatrix.array,...a.haze.instanceMatrix.array].every(Number.isFinite));assert.equal(a.stats.gulls,0);assert.equal(scene.children.length,2)}a.dispose();assert.equal(scene.children.length,0);
}
const scene=new THREE.Scene(),a=new CoastalAtmosphere(scene,new SandField(),{reduced:true}),p={x:0,z:0},origin={x:0,z:0},camera=new THREE.PerspectiveCamera(),weather={wind:60,altitude:8};
a.update(p,20,origin,camera,weather);const still=[...a.haze.instanceMatrix.array],opacity=a.hazeOpacity.value;a.update(p,40,origin,camera,weather);assert.deepEqual([...a.haze.instanceMatrix.array],still,'Reduced motion freezes coastal haze drift');assert.equal(a.hazeOpacity.value,opacity,'Reduced motion freezes gust-driven opacity');assert.equal(a.stats.gulls,0);a.dispose();assert(coastalWind(5,60)>coastalWind(5,5));
console.log('Coastal atmosphere: birds removed, preserved offshore haze and meadow mist, rebasing, reduced motion and disposal passed.');

for(const speed of [0,8,25,60,80,400,NaN])for(let time=0;time<120;time+=.25){
 const strength=grassWindStrength(time,speed);assert(Number.isFinite(strength)&&strength>=0&&strength<=.65,'Grass gusts remain bounded in extreme or invalid weather');
}
assert(grassWindStrength(5,60)>grassWindStrength(5,5),'Storms still visibly increase rooted foliage motion');
console.log('Grass wind: restrained, weather-responsive tip motion with a storm limit passed.');
