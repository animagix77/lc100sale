import assert from 'node:assert/strict';
import {Scene,Group,Mesh,InstancedMesh,LOD,BoxGeometry,MeshStandardMaterial,PerspectiveCamera,PointLight,Color} from 'three/webgpu';
import {warmSceneMaterials} from './scene-warmup.mjs';
const scene=new Scene(),camera=new PerspectiveCamera(),hiddenGroup=new Group(),geometry=new BoxGeometry(),material=new MeshStandardMaterial(),distant=new Mesh(geometry,material),emptyPool=new InstancedMesh(geometry,material,12),hiddenMaterial=new MeshStandardMaterial(),hiddenMesh=new Mesh(geometry,hiddenMaterial),light=new PointLight(),lod=new LOD();
hiddenGroup.visible=false;hiddenGroup.layers.set(3);distant.position.set(500,0,500);distant.visible=false;distant.layers.set(2);emptyPool.count=0;emptyPool.setColorAt(0,new Color(1,1,1));hiddenMaterial.visible=false;light.layers.set(6);hiddenGroup.add(distant,emptyPool,hiddenMesh,light,lod);scene.add(hiddenGroup);
const originalTarget={name:'canvas'},originalMRT={name:'previous'},passTarget={name:'scene color and depth'},passMRT={name:'scene MRT'},scenePass={renderTarget:passTarget,getMRT:()=>passMRT};
let currentTarget=originalTarget,currentMRT=originalMRT,progress=0,compiles=0;
const renderer={getRenderTarget:()=>currentTarget,getMRT:()=>currentMRT,setRenderTarget:t=>{currentTarget=t},setMRT:m=>{currentMRT=m},compileAsync:async(s,c,target,onProgress)=>{
 assert.equal(s,scene);assert.equal(c,camera);assert.equal(target,null);assert.equal(currentTarget,passTarget);assert.equal(currentMRT,passMRT);
 assert(hiddenGroup.visible&&distant.visible&&hiddenMesh.visible);assert(!distant.frustumCulled);assert(distant.layers.test(camera.layers));assert(hiddenMaterial.visible);assert.equal(emptyPool.count,1);assert.equal(emptyPool.instanceColor.getX(0),1);assert(!lod.autoUpdate);
 assert(!light.visible,'An inactive light must not add a shader variant');assert.equal(light.layers.mask,64);compiles++;onProgress?.({loaded:1,total:1});
}};
const assertRestored=()=>{
 assert(!hiddenGroup.visible);assert(!distant.visible);assert.equal(distant.layers.mask,4);assert.equal(hiddenGroup.layers.mask,8);assert(distant.frustumCulled);assert.equal(emptyPool.count,0);assert(!hiddenMaterial.visible);assert(light.visible,'Light state is restored without enabling its hidden parent');assert(lod.autoUpdate);assert.equal(currentTarget,originalTarget);assert.equal(currentMRT,originalMRT);
};
await warmSceneMaterials(renderer,scene,camera,{scenePass,onProgress:()=>progress++});assertRestored();assert.equal(compiles,1);assert.equal(progress,1);
let warmFrames=0;
await warmSceneMaterials(renderer,scene,camera,{scenePass,warmRender:async()=>{
 assert.equal(currentTarget,originalTarget);assert.equal(currentMRT,originalMRT);assert(hiddenGroup.visible&&distant.visible);assert(!distant.frustumCulled);assert.equal(emptyPool.count,1);assert(!light.visible);warmFrames++;
}});assert.equal(warmFrames,1);assertRestored();
await assert.rejects(warmSceneMaterials(renderer,scene,camera,{scenePass,warmRender:async()=>{throw new Error('Shadow rendering rejected')}}),/Shadow rendering rejected/);assertRestored();
renderer.compileAsync=async()=>{throw new Error('Compile rejected')};
await assert.rejects(warmSceneMaterials(renderer,scene,camera,{scenePass}),/Compile rejected/);assertRestored();
geometry.dispose();material.dispose();hiddenMaterial.dispose();
console.log('Scene warmup covers culled/hidden/empty scenery, matches the scene target, optionally renders shadow variants, preserves lights and restores state after compile/render failures.');
