import assert from 'node:assert/strict';
import * as THREE from 'three/webgpu';
import {WeatherView} from './weather-view.mjs';
import {Ocean} from './ocean.mjs';
import {SunsetClouds} from './clouds.mjs';
for(const reduced of [false,true]){
 const scene=new THREE.Scene();scene.fog=new THREE.Fog('#aaa',180,520);scene.environmentIntensity=.5;
 const camera=new THREE.PerspectiveCamera(),sun=new THREE.Mesh(new THREE.SphereGeometry(),new THREE.MeshBasicMaterial()),hemi=new THREE.HemisphereLight(),light=new THREE.DirectionalLight(),ocean=new Ocean(scene),clouds=new SunsetClouds(scene),skyMat=new THREE.MeshBasicNodeMaterial();
 const v=new WeatherView({scene,skyMat,sun,hemi,light,ocean,clouds,reduced});
 const apply=state=>{v.set({cloud:.2,wind:8,rain:0,snow:0,fog:false,...state});for(let i=0;i<240;i++)v.update(1/30,camera,{x:0,y:0,z:0})};
 apply({altitude:60});const daytime=v.top.value.clone();assert(!v.precip.visible);assert(light.intensity>1.5);
 apply({altitude:-30});assert(v.top.value.r<daytime.r);assert(light.intensity>.5&&hemi.intensity>1,'Night remains driveable');assert(ocean.brightness.value<.6);
 apply({altitude:20,cloud:1,rain:.8,wind:40});assert.equal(v.precip.visible,!reduced);assert(!sun.visible);assert(ocean.waveScale.value>1.2);
 assert([...v.positions].every(Number.isFinite));assert(v.precip.geometry.drawRange.count<=v.count*2||reduced);
 apply({altitude:20,snow:.7});assert.equal(v.precip.visible,!reduced);
 apply({altitude:20,fog:true});assert(scene.fog.far<150);
 v.dispose();assert(!scene.children.includes(v.precip));ocean.dispose();clouds.dispose();
}
console.log('Environment: daylight, readable night, cloud cover, bounded precipitation, wind, fog, reduced motion and disposal passed.');
