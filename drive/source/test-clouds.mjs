// Judge Dean LLC — weather continuity, mobile assets and async cloud cleanup.
import assert from 'node:assert/strict';
import * as THREE from 'three/webgpu';
import {SunsetClouds} from './clouds.mjs';
for(const mobile of [false,true]){
 const scene=new THREE.Scene(),clouds=new SunsetClouds(scene,{mobile}),camera=new THREE.PerspectiveCamera();
 let path,disposed=false;const texture=new THREE.Texture();texture.addEventListener('dispose',()=>disposed=true);
 assert(await clouds.loadTexture({loader:{async loadAsync(p){path=p;return texture}}}));assert.equal(path.includes('-768'),mobile);
 assert.equal(clouds.mesh.geometry.index.count,6);assert.equal(texture.colorSpace,THREE.SRGBColorSpace);
 clouds.setCover(.38);const a=[...clouds.alpha.array];clouds.setCover(.3801);assert(Math.max(...a.map((v,i)=>Math.abs(v-clouds.alpha.array[i])))<.003,'Small forecast changes fade cloud coverage without adding a solid bank');
 for(const cover of [0,.5,1]){clouds.setCover(cover);clouds.update(camera,35);assert([...clouds.alpha.array].every(v=>v>=0&&v<=1));assert.equal(clouds.mesh.count,24);assert([...clouds.mesh.instanceMatrix.array].every(Number.isFinite));}
 const before=[...clouds.mesh.instanceMatrix.array];camera.position.set(512,30,-512);clouds.update(camera,35);
 for(let i=0;i<24;i++){assert(Math.abs(clouds.mesh.instanceMatrix.array[i*16+12]-before[i*16+12]-512)<.001);assert(Math.abs(clouds.mesh.instanceMatrix.array[i*16+14]-before[i*16+14]+512)<.001);}
 clouds.dispose();assert(disposed);assert.equal(scene.children.length,0);
 const fallback=new SunsetClouds(scene,{reduced:true});assert.equal(await fallback.loadTexture({loader:{async loadAsync(){throw Error('offline')}}}),false);fallback.update(camera,1);const still=[...fallback.mesh.instanceMatrix.array];fallback.update(camera,10);assert.deepEqual([...fallback.mesh.instanceMatrix.array],still);fallback.dispose();
 const late=new SunsetClouds(scene);let finish;const pending=late.loadTexture({loader:{loadAsync(){return new Promise(r=>finish=r)}}});late.dispose();let released=false;const asset=new THREE.Texture();asset.addEventListener('dispose',()=>released=true);finish(asset);assert.equal(await pending,false);assert(released,'A download completing after page exit releases its texture');
}
console.log('Clouds: bounded cards, device texture sizes, continuous coverage, camera rebasing, optional fallback, reduced motion and async disposal passed.');
