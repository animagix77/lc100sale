import assert from 'node:assert/strict';
import * as THREE from 'three/webgpu';
import {CoastalAtmosphere} from './coastal-atmosphere.mjs';
import {coastalWind} from './coastal-wind.mjs';
import {SandField,shore} from './terrain.mjs';
for(const mobile of [false,true]){
 const scene=new THREE.Scene(),field=new SandField(),camera=new THREE.PerspectiveCamera(),a=new CoastalAtmosphere(scene,field,{mobile}),p={x:shore(0)+35,z:0},origin={x:0,z:0},weather={altitude:8,wind:25};a.update(p,12,origin,camera,weather);
 assert(a.stats.gulls>0&&a.stats.sand>0);assert.equal(scene.children.length,3);assert(a.stats.sand<=a.capacity);const before=a.gulls.instanceMatrix.array.slice(),sand=a.sandPositions.slice(),bird=new THREE.Matrix4();a.gulls.getMatrixAt(0,bird);a.update(p,12,{x:512,z:-512},camera,weather);const shifted=new THREE.Matrix4();a.gulls.getMatrixAt(0,shifted);assert(Math.abs(shifted.elements[12]+512-bird.elements[12])<.001);assert(Math.abs(shifted.elements[14]-512-bird.elements[14])<.001);
 a.update(p,14,origin,camera,weather);assert.notDeepEqual(a.gulls.instanceMatrix.array,before);assert.notDeepEqual(a.sandPositions,sand);
 for(let i=0;i<a.stats.sand;i++){const [x,y,z]=a.sandPositions.slice(i*6,i*6+3);assert(x-shore(z)>=24.99);assert(y-field.height(x,z)>0&&y-field.height(x,z)<.14,'Sand stays close to dry terrain');}
 a.update(p,15,origin,camera,{altitude:-15,wind:40,rain:1});assert(!a.gulls.visible&&!a.sand.visible);assert.equal(a.stats.sand,0);
 for(const z of [-2000,8000,50000]){a.update({x:shore(z)+35,z},20,{x:0,z},camera,weather);assert([...a.gulls.instanceMatrix.array,...a.haze.instanceMatrix.array,...a.sandPositions].every(Number.isFinite));assert.equal(scene.children.length,3)}a.dispose();assert.equal(scene.children.length,0);
}
const scene=new THREE.Scene(),a=new CoastalAtmosphere(scene,new SandField(),{reduced:true});a.update({x:0,z:0},20,{x:0,z:0},new THREE.PerspectiveCamera(),{wind:60,altitude:8});assert(!a.sand.visible&&!a.gulls.visible);assert.equal(a.clock.value,0);a.dispose();assert(coastalWind(5,60)>coastalWind(5,5));
console.log('Coastal atmosphere: bounded mobile pools, dry ground sand, wet/night suppression, gliding birds, rebasing, reduced motion and disposal passed.');
