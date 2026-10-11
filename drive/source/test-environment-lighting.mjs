// Judge Dean LLC — environment lighting must never bake while driving.
import assert from 'node:assert/strict';
import * as THREE from 'three/webgpu';
import {createEnvironmentLighting,createSkyRadianceTexture,environmentWeather,skyRadiance} from './environment-lighting.mjs';

const sun=new THREE.Vector3(-430,280,-650).normalize(),front=skyRadiance(sun.x,sun.y,sun.z),back=skyRadiance(-sun.x,sun.y,-sun.z),overcast=skyRadiance(sun.x,sun.y,sun.z,1);
assert(front[0]>1&&front[0]>back[0]*2,'Clear sky contains bounded directional HDR radiance');
assert(overcast[0]<front[0]*.4,'Overcast removes the hot directional lobe');
assert(skyRadiance(0,-1,0)[0]<skyRadiance(0,1,0)[0]*.4,'The lower hemisphere is earth, not another sky');
for(let a=0;a<360;a+=3){const x=Math.cos(a)*.8,y=.6,z=Math.sin(a)*.8;for(const cover of [0,.5,1])for(const c of skyRadiance(x,y,z,cover))assert(Number.isFinite(c)&&c>=0&&c<6);}
const source=createSkyRadianceTexture({width:64});
assert.equal(source.type,THREE.HalfFloatType);assert.equal(source.colorSpace,THREE.LinearSRGBColorSpace);assert.equal(source.flipY,false);
assert.equal(source.image.data.length,64*32*4);assert.equal(source.generateMipmaps,false);
for(const c of source.image.data)assert(Number.isFinite(THREE.DataUtils.fromHalfFloat(c)));
const bottom=THREE.DataUtils.fromHalfFloat(source.image.data[0]),top=THREE.DataUtils.fromHalfFloat(source.image.data[(31*64)*4]);assert(top>bottom*2,'Raw DataTexture rows preserve the equirectangular upper hemisphere');source.dispose();
const clear=environmentWeather({altitude:30,cloud:0}),cloudy=environmentWeather({altitude:30,cloud:1}),night=environmentWeather({altitude:-15});
assert.deepEqual(clear.tint,[1,1,1]);assert.equal(clear.blend,0);assert(cloudy.blend>.85);assert(night.tint[0]<night.tint[2]&&night.tint[2]<1);
for(const altitude of [-30,0,8,28,80])for(const cloud of [0,.3,1])for(const wet of [0,1]){const w=environmentWeather({altitude,cloud,rain:wet});assert(w.blend>=0&&w.blend<=1);assert(w.tint.every(v=>v>=0&&v<=1.1));}

function generator(failAt=0){
 const result={sources:[],targets:[],disposed:0,sourceDisposals:0,fromEquirectangular(source){
  this.sources.push(source);source.addEventListener('dispose',()=>this.sourceDisposals++);
  if(failAt===this.sources.length)throw Error('GPU allocation failed');
  const texture=new THREE.Texture({width:384,height:512});texture.mapping=THREE.CubeUVReflectionMapping;
  const target={texture,disposed:0,dispose(){this.disposed++}};this.targets.push(target);return target;
 },dispose(){this.disposed++}};
 return result;
}
for(const [highQuality,webGPU,count,width] of [[true,true,2,512],[false,true,1,256],[true,false,1,256]]){
 const scene=new THREE.Scene(),old=new THREE.Texture();scene.environment=old;scene.environmentIntensity=.43;
 const pmrem=generator(),lighting=createEnvironmentLighting({backend:{isWebGPUBackend:webGPU}},scene,{highQuality,pmremGenerator:pmrem}),graph=scene.environmentNode,texture=scene.environment;
 assert.equal(lighting.probeCount,count);assert.equal(pmrem.sources.length,count);assert.equal(pmrem.sourceDisposals,count);assert.equal(pmrem.disposed,1);
 assert(pmrem.sources.every(s=>s.image.width===width));
 for(let i=0;i<900;i++)lighting.update({altitude:i<450?30:-12,cloud:(i%120)/120,rain:(i%180)/180},1/60);
 assert.equal(scene.environmentNode,graph,'Driving never replaces the compiled environment graph');
 assert.equal(scene.environment,texture);assert.equal(pmrem.sources.length,count,'No weather change captures or convolves another probe');
 assert.equal(scene.environmentIntensity,.43,'WeatherView retains environment exposure ownership');
 lighting.dispose();lighting.dispose();assert.equal(scene.environment,old);assert.equal(scene.environmentNode,undefined);assert(pmrem.targets.every(t=>t.disposed===1),'The render targets, not only texture handles, are released exactly once');
}
const scene=new THREE.Scene(),old=new THREE.Texture();scene.environment=old;
const failure=generator(2);assert.throws(()=>createEnvironmentLighting({backend:{isWebGPUBackend:true}},scene,{highQuality:true,pmremGenerator:failure}),/allocation/);
assert.equal(scene.environment,old);assert.equal(failure.disposed,1);assert.equal(failure.sourceDisposals,2);assert.equal(failure.targets[0].disposed,1);
console.log('Environment lighting: directional HDR, earth horizon, weather envelope, bounded tier budgets, stable runtime graph and complete target cleanup passed.');
