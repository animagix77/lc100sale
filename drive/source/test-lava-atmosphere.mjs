// Judge Dean LLC — vapor lifetime, mobile budget and origin-shift regression checks.
import assert from 'node:assert/strict';
import * as THREE from 'three/webgpu';
import {LavaAtmosphere} from './lava-atmosphere.mjs';
import {VolcanoView} from './volcano-view.mjs';
import {moltenMaterial} from './lava-material.mjs';
import {uniform} from 'three/tsl';
for(const mobile of [false,true]){
 const scene=new THREE.Scene(),volcano=new VolcanoView(scene,{mobile}),view=new LavaAtmosphere(scene,volcano.flowPoints,{mobile}),camera=new THREE.PerspectiveCamera();camera.position.set(475,120,-665);
 view.update(1,{x:0,z:0},camera);const first=view.haze.instanceMatrix.array.slice();view.update(7,{x:0,z:0},camera);assert.notDeepEqual(view.haze.instanceMatrix.array,first,'Vapor advects through time');
 assert(view.anchors.length<=(mobile?30:46));assert(view.lights.length===(mobile?2:4));assert(!view.haze.castShadow&&view.haze.material.depthTest&&!view.haze.material.depthWrite);
 assert([...view.haze.instanceMatrix.array,...view.haze.geometry.attributes.lavaVaporOpacity.array].every(Number.isFinite));assert([...view.haze.geometry.attributes.lavaVaporOpacity.array].some(v=>v>0));
 const matrix=view.haze.instanceMatrix.array.slice(),opacity=view.haze.geometry.attributes.lavaVaporOpacity.array.slice();camera.position.x-=512;camera.position.z+=512;view.update(7,{x:512,z:-512},camera);assert.deepEqual(view.haze.instanceMatrix.array,matrix);assert.deepEqual(view.haze.geometry.attributes.lavaVaporOpacity.array,opacity,'Rebase preserves camera-relative haze');assert.deepEqual(view.root.position.toArray(),[-512,0,512]);
 let disposed=0;view.haze.geometry.addEventListener('dispose',()=>disposed++);view.haze.material.addEventListener('dispose',()=>disposed++);view.dispose();assert.equal(disposed,2);volcano.dispose();assert.equal(scene.children.length,0);
}
const scene=new THREE.Scene(),still=new LavaAtmosphere(scene,[],{reduced:true});still.update(0,{x:0,z:0});const first=still.haze.instanceMatrix.array.slice(),lights=still.lights.map(l=>l.intensity);still.update(90,{x:0,z:0});assert.deepEqual(still.haze.instanceMatrix.array,first);assert.deepEqual(still.lights.map(l=>l.intensity),lights);assert.equal(still.clock.value,0);still.dispose();
for(const mode of ['crossing','stream','lake']){const mat=moltenMaterial(uniform(0),{mode});assert(mat.emissiveNode&&mat.roughnessNode);assert.equal(mat.userData.flowMode,mode);mat.dispose();}
console.log('Lava atmosphere: advected vapor, shadow/depth rules, fixed mobile pools, origin shifts, reduced motion and disposal passed.');
