import assert from 'node:assert/strict';
import * as THREE from 'three/webgpu';
import {MeadowWildlife} from './meadow-wildlife.mjs';
import {SandField,baseHeight,surfaceAt} from './terrain.mjs';
import {riverZ,riverGreenery,biomeWeather} from './expedition.mjs';

const field=new SandField(),origin={x:0,z:0},night={altitude:-12},day={altitude:40},start={x:190,z:-270};
function setup(options={}){
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera();camera.position.set(start.x+3,field.height(start.x,start.z)+3,start.z+7);
 const wildlife=new MeadowWildlife(scene,field,options);return {scene,camera,wildlife};
}
function tick(w,c,p,t,weather=day,travel={speed:6,heading:0,grounded:true},renderOrigin=origin){w.update(p,t,renderOrigin,c,weather,travel)}
function move(w,c,p=start,startTime=0,weather=day){
 tick(w,c,p,startTime,weather);for(let i=1;i<=30;i++)tick(w,c,{x:p.x,z:p.z-i*.1},startTime+i/60,weather);return {x:p.x,z:p.z-3};
}
const seenFireflyHabitats=new Set();
function assertFireflyCanopy(w){
 for(let i=0;i<w.fireflyCount;i++){
  const f=w.fireflyData[i],riparian=riverGreenery(f.x,f.z)>.3,ground=baseHeight(f.x,f.z),hover=w.fireflies.instanceMatrix.array[i*16+13]-ground;seenFireflyHabitats.add(riparian?'riparian':'meadow');
  assert(hover>=(riparian?1.3:2.2)&&hover<=(riparian?1.9:2.9),'Glows skim the actual short riparian grass or tall meadow canopy');
  assert(f.size>=.55&&f.size<.73,'Fireflies remain restrained sub-metre glows');
 }
}
const {scene,camera,wildlife:w}=setup();
const geometries=[w.birds.geometry,w.fireflies.geometry],matrices=[w.birds.instanceMatrix.array,w.fireflies.instanceMatrix.array],birdPool=w.birdData,flyPool=w.fireflyData;
// A plausible speed alone, or a stationary wheelspin, must never disturb grass.
for(let i=0;i<180;i++)tick(w,camera,start,i/60,night);assert.equal(w.stats.birds,0,'A parked car never repeatedly flushes birds');assertFireflyCanopy(w);
const end=move(w,camera,start,4);assert(w.stats.birds>=3&&w.stats.birds<=5,'Driving through grass flushes a small flock');
const flock=w.birdData.filter(b=>b.active).map(b=>({...b}));assert(flock.every(b=>b.vz<0),'Flights move away in the vehicle travel direction');
for(const b of flock){assert(surfaceAt(b.x,b.z).grass>=.30,'Each launch site is actually grass');assert(Math.hypot(b.vx,b.vz)>6);assert(b.ttl>=3.8&&b.ttl<=4.7&&b.size<1,'Small birds leave after a short visible flight')}
assert(flock.every(b=>b.y-baseHeight(b.x,b.z)>=2.5),'Meadow birds launch above the tall grass instead of disappearing inside it');
const count=w.cooldowns.size;for(let i=0;i<400;i++)tick(w,camera,end,4.5+i/60,night,{speed:0,heading:0,grounded:true});
assert.equal(w.stats.birds,0,'All birds leave the scene after a short flight');assert.equal(w.cooldowns.size,count,'No repeated stationary trigger');
move(w,camera,start,15);assert.equal(w.stats.birds,0,'Returning through the same world patch respects its cooldown');
move(w,camera,start,55);assert(w.stats.birds>0,'A visited patch can recover after its cooldown');

for(const [name,p] of Object.entries({beach:{x:-14,z:0},dunes:{x:64,z:-164},approach:{x:236,z:-312},river:{x:248,z:-336},snow:{x:312,z:-600},volcano:{x:527,z:-680}})){
 const item=setup();move(item.wildlife,item.camera,p,0,night);assert.equal(item.wildlife.stats.birds,0,`${name} does not flush grass birds`);
 if(name==='snow'||name==='volcano'||name==='beach'){assert.equal(item.wildlife.stats.fireflies,0,`${name} does not show fireflies`);assert(!item.wildlife.fireflies.visible)}
 item.wildlife.dispose();
}
// A rising hillside must not swallow a departing flock back into tall grass.
const uphill=setup();uphill.wildlife.field={height:(x,z)=>field.height(x,z)+Math.max(0,start.z-z-6)*1.4};
move(uphill.wildlife,uphill.camera,start,0,day);
tick(uphill.wildlife,uphill.camera,{x:start.x,z:start.z-3},2,day,{speed:0});
let uphillBirds=0;
for(let i=0;i<uphill.wildlife.birdCapacity;i++){
 const bird=uphill.wildlife.birdData[i];if(!bird.active)continue;uphillBirds++;
 const matrix=uphill.wildlife.birds.instanceMatrix.array,offset=i*16,ground=uphill.wildlife.field.height(matrix[offset+12],matrix[offset+14]);
 assert(matrix[offset+13]-ground>=bird.clearance-.0001,'Departing birds maintain their cached canopy clearance on rising ground');
 assert.equal(bird.clearance,2.5,'Meadow clearance is retained from the launch habitat');
}
assert(uphillBirds>0,'The uphill check exercises an active flock');uphill.wildlife.dispose();

const defaults=setup(),meadowWeather=biomeWeather(start.x,start.z);
tick(defaults.wildlife,defaults.camera,start,12,meadowWeather,{speed:0});
assert(meadowWeather.altitude<6,'The default meadow is golden-hour dusk');
assert(defaults.wildlife.stats.fireflies>=3,'Several meadow glows are visible without changing the weather mode');
assert(Math.max(...defaults.wildlife.fireflyAlpha.array)>.15,'Default dusk glows are bright enough to read');
assert(defaults.wildlife.fireflyCount>=16,'Fireflies form small, populated patches');
assert(defaults.wildlife.fireflies.material.color.r>2,'Fireflies retain a bright luminous core against dusk foliage');
defaults.wildlife.dispose();

const air=setup();tick(air.wildlife,air.camera,start,0);for(let i=1;i<=60;i++)tick(air.wildlife,air.camera,{x:start.x,z:start.z-i*.1},i/60,night,{speed:6,grounded:false});assert.equal(air.wildlife.stats.birds,0,'Airborne travel cannot disturb grass');air.wildlife.dispose();
const teleport=setup();tick(teleport.wildlife,teleport.camera,start,0);tick(teleport.wildlife,teleport.camera,{x:255,z:-67},1/60);assert.equal(teleport.wildlife.stats.birds,0,'A recovery jump never sweeps birds along the intervening path');teleport.wildlife.dispose();

const bank={x:220,z:riverZ(220)+17};camera.position.set(bank.x+3,field.height(bank.x,bank.z)+3,bank.z+7);
w.reset();tick(w,camera,bank,65,night,{speed:0});assert(w.fireflyCount>0&&w.stats.fireflies>0,'Riparian woodland has small night glows');assert(w.fireflies.material.isMeshBasicNodeMaterial,'Fireflies use native WebGPU node material');
for(const f of w.fireflyData.slice(0,w.fireflyCount)){
 const s=surfaceAt(f.x,f.z);assert(s.grass>=.30&&s.riverApproach<=.18&&s.river<=.05,'Fireflies stay in grass beside water, not on a bare ford');
 assert(f.y>baseHeight(f.x,f.z),'Firefly anchors remain above the terrain');
}
assertFireflyCanopy(w);assert(seenFireflyHabitats.has('riparian')&&seenFireflyHabitats.has('meadow'),'Height checks cover both vegetation canopies');
const anchors=w.fireflyData.slice(0,w.fireflyCount).map(f=>({...f}));tick(w,camera,bank,66,day,{speed:0});assert(!w.fireflies.visible&&w.stats.fireflies===0,'Sunlight removes the glows');
tick(w,camera,bank,66,{altitude:3},{speed:0});const sunsetAlpha=[...w.fireflyAlpha.array];assert(w.fireflies.visible,'Sunset gradually introduces fireflies');
tick(w,camera,bank,66,night,{speed:0});assert([...w.fireflyAlpha.array].some((a,i)=>a>sunsetAlpha[i]+.02),'Night is brighter than sunset');
assert.deepEqual(w.fireflyData.slice(0,w.fireflyCount),anchors,'Time and daylight do not move world anchors');
const fireflyBeforeReset=w.fireflyCount;w.reset();assert.equal(w.fireflyCount,fireflyBeforeReset,'Recovery retains ambient firefly scenery');assert(w.fireflies.visible,'Reset preserves visible scenery');assert.equal(w.stats.birds,0);

// Rebasing adjusts only the render coordinates, keeping the same world and light phases.
tick(w,camera,bank,67,night,{speed:0});const before=[...w.fireflies.instanceMatrix.array],alphas=[...w.fireflyAlpha.array];
const shifted={x:512,z:-512};camera.position.x-=shifted.x;camera.position.z-=shifted.z;tick(w,camera,bank,67,night,{speed:0},shifted);
for(let i=0;i<w.fireflyCount;i++){assert(Math.abs(w.fireflies.instanceMatrix.array[i*16+12]-(before[i*16+12]-shifted.x))<.0001);assert(Math.abs(w.fireflies.instanceMatrix.array[i*16+14]-(before[i*16+14]-shifted.z))<.0001)}
assert.deepEqual([...w.fireflyAlpha.array],alphas,'Floating origin does not change glow visibility');
const fly=w.fireflyData[0];camera.position.set(fly.x-shifted.x+Math.sin(67*.42+fly.phase)*.16,fly.y+Math.sin(67*.70+fly.phase)*.075,fly.z-shifted.z+Math.cos(67*.36+fly.phase)*.16);tick(w,camera,bank,67,night,{speed:0},shifted);assert.equal(w.fireflyAlpha.getX(0),0,'Glows disappear before reaching the camera');
assert.equal(w.birds.geometry,geometries[0]);assert.equal(w.fireflies.geometry,geometries[1]);assert.equal(w.birds.instanceMatrix.array,matrices[0]);assert.equal(w.fireflies.instanceMatrix.array,matrices[1]);assert.equal(w.birdData,birdPool);assert.equal(w.fireflyData,flyPool);

const a=setup(),b=setup();move(a.wildlife,a.camera,start,0,night);move(b.wildlife,b.camera,start,0,night);assert.deepEqual(a.wildlife.birdData,b.wildlife.birdData,'The same drive produces deterministic bird flights');assert.deepEqual(a.wildlife.fireflyData,b.wildlife.fireflyData,'Firefly scenery is deterministic');
const birdBefore=[...a.wildlife.birds.instanceMatrix.array];tick(a.wildlife,a.camera,{x:start.x,z:start.z-3},.5,night,{speed:0},shifted);
for(let i=0;i<a.wildlife.birdCapacity;i++)if(a.wildlife.birdData[i].active){assert(Math.abs(a.wildlife.birds.instanceMatrix.array[i*16+12]-(birdBefore[i*16+12]-512))<.0001);assert(Math.abs(a.wildlife.birds.instanceMatrix.array[i*16+14]-(birdBefore[i*16+14]+512))<.0001)}
a.wildlife.dispose();b.wildlife.dispose();

const mobile=setup({mobile:true});move(mobile.wildlife,mobile.camera,start,0,night);assert(mobile.wildlife.birdCapacity<w.birdCapacity&&mobile.wildlife.fireflyCapacity<w.fireflyCapacity,'Mobile has smaller fixed pools');assert(mobile.wildlife.fireflyCount<=32&&mobile.wildlife.stats.birds<=10);mobile.wildlife.dispose();
const reduced=setup({reduced:true});move(reduced.wildlife,reduced.camera,start,0,night);assert.equal(reduced.wildlife.stats.birds,0);const still=[...reduced.wildlife.fireflies.instanceMatrix.array],quiet=[...reduced.wildlife.fireflyAlpha.array];tick(reduced.wildlife,reduced.camera,{x:start.x,z:start.z-3},12,night,{speed:0});assert.deepEqual([...reduced.wildlife.fireflies.instanceMatrix.array],still,'Reduced motion freezes firefly drift');assert.deepEqual([...reduced.wildlife.fireflyAlpha.array],quiet,'Reduced motion replaces blinking with a quiet steady glow');reduced.wildlife.dispose();

// World patch history is bounded even after many distinct grassy areas are visited.
let visit=0;for(let z=-430;z<60;z+=14)for(let x=90;x<380;x+=14){const s=surfaceAt(x,z);if(s.grass<.4||s.riverApproach>.1||s.snow>.1||s.volcanic>.05)continue;w.reset();w._flush({x,z},100+visit++*50,0,-1,6)}
assert(visit>128&&w.cooldowns.size<=128,'The disturbance history remains bounded on long drives');
for(const mesh of [w.birds,w.fireflies])assert([...mesh.instanceMatrix.array].every(Number.isFinite),'All transforms remain finite');
w.dispose();w.dispose();assert.equal(scene.children.length,0,'Disposal removes both meshes safely');
console.log('Meadow wildlife: grass-only contact, finite short flights, stationary/airborne/teleport guards, patch cooldowns, riverbank sunset/night glows, camera clearance, deterministic pools, mobile budgets, reduced motion, rebasing and disposal passed.');
