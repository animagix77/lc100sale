import assert from 'node:assert/strict';
import * as THREE from 'three/webgpu';
import {biomeWeather,LANDMARKS} from './expedition.mjs';
import {WeatherView} from './weather-view.mjs';
import {Ocean} from './ocean.mjs';
import {SunsetClouds} from './clouds.mjs';
for(const reduced of [false,true]){
 const scene=new THREE.Scene();scene.fog=new THREE.Fog('#aaa',180,520);scene.environmentIntensity=.5;
 const camera=new THREE.PerspectiveCamera(),sun=new THREE.Mesh(new THREE.SphereGeometry(),new THREE.MeshBasicMaterial()),hemi=new THREE.HemisphereLight(),light=new THREE.DirectionalLight(),ocean=new Ocean(scene),clouds=new SunsetClouds(scene),skyMat=new THREE.MeshBasicNodeMaterial();
 const v=new WeatherView({scene,skyMat,sun,hemi,light,ocean,clouds,reduced});
 const apply=state=>{v.set({cloud:.2,wind:8,rain:0,snow:0,fog:false,...state});for(let i=0;i<240;i++)v.update(1/30,camera,{x:0,y:0,z:0})};
 apply({altitude:60});assert(scene.fog.far<250&&scene.fog.near<45,'Clear air still masks the distant streaming horizon');const clearFar=scene.fog.far;const daytime=v.top.value.clone();assert(!v.precip.visible);assert(light.intensity>1.5);
 apply({altitude:-30});assert(v.top.value.r<daytime.r);assert(light.intensity>.5&&hemi.intensity>1,'Night remains driveable');assert(ocean.brightness.value<.6);
 apply({altitude:20,cloud:1,rain:.8,wind:40});assert.equal(v.precip.visible,!reduced);assert(!sun.visible);assert(ocean.waveScale.value>1.2);
 assert([...v.positions].every(Number.isFinite));assert(v.precip.geometry.drawRange.count<=v.count*2||reduced);
 apply({altitude:20,snow:.7});assert.equal(v.snowflakes.visible,!reduced);assert(!v.precip.visible);assert(v.snowflakes.count<=v.count);
 apply({altitude:20,rain:.6,snow:.25});assert.equal(v.precip.visible,!reduced);assert.equal(v.snowflakes.visible,!reduced);assert([...v.positions].every(Number.isFinite),'Mixed precipitation remains finite');
 apply({altitude:15,rain:0,cloud:.5});const dryFar=v.fogFar;
 v.set({altitude:15,cloud:.5,wind:8,rain:.001,snow:0,fog:false});assert(Math.abs(v.fogFar-dryFar)<.3,'The first drop does not abruptly halve visibility');
 apply({altitude:15,rain:1,cloud:.95});assert(scene.fog.far<140&&scene.fog.far<clearFar*.60,'Bad weather visibly reduces distance');
 const stormFar=scene.fog.far;v.set({altitude:15,cloud:.2,wind:8,rain:0,snow:0,fog:false});v.update(1/60,camera,{x:0,y:0,z:0});assert(scene.fog.far-stormFar<2,'Weather clears gradually rather than popping');
 const meadow=LANDMARKS[5];apply(biomeWeather(meadow.x,meadow.z));assert(light.intensity>hemi.intensity*1.8,'Raking golden light has stronger contrast than ambient fill');assert(light.color.r>light.color.b&&hemi.color.b>hemi.color.r,'Meadow sunlight is warm against cool sky fill');
 for(const a of [-6.001,-5.999,13.999,14.001]){v.set({altitude:a,cloud:.2,wind:8,rain:0,snow:0,fog:false});if(a===-6.001||a===13.999)v.previousPalette=v.colors.top.clone();else assert(Math.max(...['r','g','b'].map(key=>Math.abs(v.colors.top[key]-v.previousPalette[key])))<.001,'Palette boundaries blend continuously');}
 apply({altitude:20,fog:true});assert(scene.fog.far<150);
 v.dispose();assert(!scene.children.includes(v.precip));ocean.dispose();clouds.dispose();
}
console.log('Environment: daylight, readable night, cloud cover, bounded precipitation, wind, fog, reduced motion and disposal passed.');
