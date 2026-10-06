import assert from 'node:assert/strict';
import * as THREE from 'three/webgpu';
import {SurfaceEffects} from './surface-effects.mjs';
import {surfaceProfile,oceanHeight} from './ocean-height.mjs';
import {SandField,shore} from './terrain.mjs';
const field=new SandField(),scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(),fx=new SurfaceEffects(scene,field,{random:()=>.5});
const dry={x:shore(0)+22,z:0,soft:.1,slip:0,dir:1,wheel:0};
fx.emit(dry,0,0,0);assert.deepEqual(fx.stats,{sand:0,dust:0,splash:0,wake:0},'Idle tires do not emit effects');
for(let i=0;i<4;i++)fx.emit({...dry,wheel:2},0,3,0);assert(fx.stats.sand>0&&fx.stats.dust>0,'Normal firm-sand driving emits grains and dust without wheelspin');
assert.equal(fx.stats.dust,2,'Rear tyres emit dust only every other mark');assert(fx.dust.opacity<=.13,'Dust remains translucent');assert(fx.dust.particles.filter(p=>p.life>0).every(p=>p.ttl<=1&&p.size<.6),'Short-lived, compact dust stays near the tyres');const before=fx.stats.sand;fx.emit({...dry,soft:.9,slip:4},0,0,0);assert(fx.stats.sand-before>5,'Stationary wheelspin still throws a strong sand plume');
const wet={...dry,x:shore(0)+2,wheel:2};const prior={...fx.stats};assert(fx.emit(wet,0,3,0),'Shallow contact is classified as wet');fx.emit(wet,0,3,0);assert(fx.stats.splash>0&&fx.stats.wake>0);assert.equal(fx.splash.mesh.geometry.type,'SphereGeometry','Spray uses small 3D droplets, not cloudy sprites');assert.equal(fx.stats.dust,prior.dust);assert.equal(fx.stats.sand,prior.sand);
const sample=(speed,dir=1,wheel=2,heading=0)=>{const e=new SurfaceEffects(new THREE.Scene(),field,{random:()=>.5});for(let i=0;i<8;i++)e.emit({...wet,dir,wheel},heading,speed,0);const drops=e.splash.particles.filter(p=>p.life>0).map(p=>({...p})),count=e.stats.splash;e.dispose();return {drops,count}};
const slow=sample(1),fast=sample(10),reverse=sample(-10,-1),right=sample(10,1,3);
assert(fast.count>slow.count&&fast.drops[0].vy>slow.drops[0].vy,'Speed increases emission and spray height');
assert(fast.drops[0].vx<0&&right.drops[0].vx>0,'Left and right tyre fans point outwards');
assert(fast.drops[0].vz>0&&reverse.drops[0].vz<0,'Spray trails forward and reverse travel');
for(const heading of [0,Math.PI/2,Math.PI,-.7])for(const dir of [1,-1])for(const wheel of [0,1,2,3]){
 const {drops}=sample(10*dir,dir,wheel,heading),fx=-Math.sin(heading)*dir,fz=-Math.cos(heading)*dir;
 for(const p of drops){
  assert(Math.abs((p.x-wet.x)*fx+(p.z-wet.z)*fz+.36)<1e-8,'Emission starts at the trailing edge of every tire');
  const trailing=-(p.vx*fx+p.vz*fz),sideways=Math.abs(p.vx*fz-p.vz*fx);
  assert(trailing>sideways*3,'Spray kicks backward rather than fanning sideways');
 }
}
assert(fast.drops.every(p=>p.size<.04&&p.ttl<.6),'Droplets stay small and short lived');
assert.equal(sample(0).count,0,'Parked wheels never spray');
assert(!surfaceProfile({...dry,x:shore(0)+25},3,-1,0).wet,'An inland rut is not mistaken for the sea');
for(let i=0;i<100;i++)fx.emit(wet,.5,5,i/60);
const capacities=fx.pools.map(p=>p.particles.length);fx.update(.016,camera,{x:512,z:-512},.3);
assert(fx.wake.particles.some(p=>p.life>0&&Math.abs(p.y-oceanHeight(p.x,p.z,.3)-.045)<1e-8),'Wake follows the displaced water surface');
for(const pool of fx.pools){assert([...pool.mesh.instanceMatrix.array].every(Number.isFinite));assert([...pool.alpha.array].every(a=>a>=0&&a<=1));}
fx.update(4,camera,{x:512,z:-512},4);assert(fx.pools.every(p=>p.particles.every(a=>a.life===0)),'All effects expire');assert.deepEqual(fx.pools.map(p=>p.particles.length),capacities,'Particle memory stays bounded');
fx.emit(dry,0,3,4);fx.clear();assert(fx.pools.every(p=>p.particles.every(a=>a.life===0)),'Recover clears residual effects');fx.dispose();assert.equal(scene.children.length,0);console.log('Surface effects: idle, rolling dust, stationary spray, water transition, moving wake, expiry, rebase and cleanup passed');
