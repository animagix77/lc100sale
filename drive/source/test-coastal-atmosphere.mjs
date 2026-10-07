import assert from 'node:assert/strict';
import * as THREE from 'three/webgpu';
import {CoastalAtmosphere} from './coastal-atmosphere.mjs';
import {coastalWind} from './coastal-wind.mjs';
import {SandField,shore} from './terrain.mjs';
for(const mobile of [false,true]){
 const scene=new THREE.Scene(),field=new SandField(),camera=new THREE.PerspectiveCamera(),a=new CoastalAtmosphere(scene,field,{mobile}),p={x:shore(0)+35,z:0},origin={x:0,z:0},weather={altitude:8,wind:25};a.update(p,12,origin,camera,weather);
 assert(a.stats.gulls>0&&a.stats.gulls<=3);assert.equal(a.stats.sand,0);assert.equal(scene.children.length,3);const before=a.gulls.instanceMatrix.array.slice(),bird=new THREE.Matrix4();a.gulls.getMatrixAt(0,bird);a.update(p,12,{x:512,z:-512},camera,weather);const shifted=new THREE.Matrix4();a.gulls.getMatrixAt(0,shifted);assert(Math.abs(shifted.elements[12]+512-bird.elements[12])<.001);assert(Math.abs(shifted.elements[14]-512-bird.elements[14])<.001);
 a.update(p,14,origin,camera,weather);assert.notDeepEqual(a.gulls.instanceMatrix.array,before);
 for(let i=0;i<a.birdCount;i++){const m=new THREE.Matrix4();a.gulls.getMatrixAt(i,m);const e=m.elements;assert(e[12]-shore(e[14])< -65,'Birds stay offshore');assert(e[13]>17,'Birds stay above the driving view');}
 const nearBird=new THREE.Matrix4();a.gulls.getMatrixAt(0,nearBird);camera.position.setFromMatrixPosition(nearBird);a.update(p,14,origin,camera,weather);a.gulls.getMatrixAt(0,nearBird);assert.equal(new THREE.Vector3().setFromMatrixScale(nearBird).length(),0,'No close fly-bys through the camera');camera.position.set(0,0,0);
 const meadow={x:190,z:-270};a.update(meadow,15,origin,camera,{altitude:4,cloud:.15,rain:0});assert(a.inlandMist.visible,'The meadow receives visible ground haze');assert(a.mistCount<=(mobile?6:9),'Inland haze stays within a small fixed instance budget');assert([...a.mistAlpha.array].some(alpha=>alpha>.03),'Haze has a visible but restrained opacity');
 const mistBefore=[...a.inlandMist.instanceMatrix.array],alphaBefore=[...a.mistAlpha.array];a.update(meadow,15,{x:512,z:-512},camera,{altitude:4,cloud:.15,rain:0});
 for(let i=0;i<a.mistCount;i++){assert(Math.abs(a.inlandMist.instanceMatrix.array[i*16+12]-(mistBefore[i*16+12]-512))<.001);assert(Math.abs(a.inlandMist.instanceMatrix.array[i*16+14]-(mistBefore[i*16+14]+512))<.001)}assert.deepEqual([...a.mistAlpha.array],alphaBefore,'Origin rebasing does not flash haze opacity');
 a.update(p,15,origin,camera,{altitude:-15,wind:40,rain:1});assert(!a.gulls.visible);assert.equal(a.stats.sand,0);
 for(const z of [-2000,8000,50000]){a.update({x:shore(z)+35,z},20,{x:0,z},camera,weather);assert([...a.gulls.instanceMatrix.array,...a.haze.instanceMatrix.array].every(Number.isFinite));assert.equal(scene.children.length,3)}a.dispose();assert.equal(scene.children.length,0);
}
const scene=new THREE.Scene(),a=new CoastalAtmosphere(scene,new SandField(),{reduced:true});a.update({x:0,z:0},20,{x:0,z:0},new THREE.PerspectiveCamera(),{wind:60,altitude:8});assert(!a.gulls.visible);assert.equal(a.clock.value,0);a.dispose();assert(coastalWind(5,60)>coastalWind(5,5));
console.log('Coastal atmosphere: quiet offshore birds, clear camera space, wet/night suppression, rebasing, reduced motion and disposal passed.');
