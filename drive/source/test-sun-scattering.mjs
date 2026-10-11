// Judge Dean LLC — sunbeams follow daylight, with no scene/pipeline rebuilds.
import assert from 'node:assert/strict';
import * as THREE from 'three/webgpu';
import {texture} from 'three/tsl';
import {createSunScattering,sunScatteringStrength} from './sun-scattering.mjs';
const color=texture(new THREE.Texture()),depth=texture(new THREE.DepthTexture()),scenePass={getTextureNode:name=>name==='depth'?depth:color};
const camera=new THREE.PerspectiveCamera(),light=new THREE.DirectionalLight('#fff0d4',2.4);
const off=createSunScattering(scenePass,camera,light);assert.equal(off.output,color);assert.equal(off.enabled,false);assert.equal(off.rays,undefined);off.update({});off.dispose();
assert.equal(sunScatteringStrength({altitude:-6}),0);assert.equal(sunScatteringStrength({altitude:20,cloud:1}),0);
assert(sunScatteringStrength({altitude:10,cloud:.15})>sunScatteringStrength({altitude:10,cloud:.65}));
assert(sunScatteringStrength({altitude:10,volcanic:1})<sunScatteringStrength({altitude:10})*.2);
for(const altitude of [-30,-2,0,8,20,80])for(const cloud of [0,.2,.7,1])for(const wet of [0,.2,1]){const value=sunScatteringStrength({altitude,cloud,rain:wet});assert(Number.isFinite(value)&&value>=0&&value<=1)}
const fx=createSunScattering(scenePass,camera,light,{enabled:true}),graph=fx.output;
assert.equal(fx.rays.raymarchSteps.value,24);assert.equal(fx.rays.resolutionScale,.35);
fx.update({altitude:10,cloud:.2},10);const clear=fx.rays.maxDensity.value;assert(clear>.07&&clear<=.08);
fx.update({altitude:10,cloud:1},1/60);assert(Math.abs(fx.rays.maxDensity.value-clear)<.003,'Weather changes do not flash rays');
for(let i=0;i<600;i++)fx.update({altitude:-10,cloud:1},1/60);
assert(fx.rays.maxDensity.value<.00001);assert.equal(fx.output,graph,'Uniform weather changes retain the prewarmed graph');
fx.dispose();fx.dispose();console.log('Sun scattering: desktop-only allocation, fixed step/resolution budget, daylight/cloud/lava envelope, stable graphs and cleanup passed.');
