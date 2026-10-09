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
 tick(w,c,p,startTime,weather);for(let i=1;i<=120;i++)tick(w,c,{x:p.x,z:p.z-i*.1},startTime+i/60,weather);return {x:p.x,z:p.z-12};
}
const seenFireflyHabitats=new Set();
function assertFireflyCanopy(w){
 for(let i=0;i<w.fireflyCount;i++){
  const f=w.fireflyData[i],riparian=riverGreenery(f.x,f.z)>.3,ground=baseHeight(f.x,f.z),hover=w.fireflies.instanceMatrix.array[i*16+13]-ground;seenFireflyHabitats.add(riparian?'riparian':'meadow');
  assert(hover>=(riparian?1.3:2.2)&&hover<=(riparian?1.9:2.9),'Glows skim the actual short riparian grass or tall meadow canopy');
  assert(f.size>=.28&&f.size<.39,'Fireflies use compact pinprick sprites');
 }
}
const {scene,camera,wildlife:w}=setup();
const geometry=w.fireflies.geometry,matrixArray=w.fireflies.instanceMatrix.array,flyPool=w.fireflyData;
assert.equal(scene.children.length,1,'Meadow scenery allocates only its firefly mesh');
assert.equal(w.birds,undefined,'The grass-bird mesh is removed');
assert.equal(w.birdData,undefined,'No flight pool is allocated');
for(let i=0;i<180;i++)tick(w,camera,start,i/60,night);assertFireflyCanopy(w);
for(const weather of [day,night,{altitude:8,rain:.7},{altitude:8,snow:.7}]){
 move(w,camera,start,4,weather);
 assert.equal(w.stats.birds,0,'Driving through grass in any weather never launches birds');
 assert.equal(scene.children.length,1,'Travel does not add a bird mesh');
}
for(const [name,p] of Object.entries({beach:{x:-14,z:0},dunes:{x:64,z:-164},approach:{x:236,z:-312},river:{x:248,z:-336},snow:{x:312,z:-600},volcano:{x:527,z:-680}})){
 const item=setup();move(item.wildlife,item.camera,p,0,night);assert.equal(item.wildlife.stats.birds,0,`${name} has no flying birds`);
 if(name==='snow'||name==='volcano'||name==='beach'){assert.equal(item.wildlife.stats.fireflies,0,`${name} does not show fireflies`);assert(!item.wildlife.fireflies.visible)}
 item.wildlife.dispose();
}

const defaults=setup(),meadowWeather=biomeWeather(start.x,start.z);
tick(defaults.wildlife,defaults.camera,start,12,meadowWeather,{speed:0});
assert(meadowWeather.altitude<6,'The default meadow is golden-hour dusk');
assert(defaults.wildlife.stats.fireflies>=3,'Several meadow glows are visible without changing the weather mode');
assert(Math.max(...defaults.wildlife.fireflyAlpha.array)>.35,'Default dusk glows are bright enough to read');
assert(defaults.wildlife.fireflyCount>=16,'Fireflies form small, populated patches');
assert(defaults.wildlife.fireflies.material.color.r>3,'Fireflies retain a bright luminous core against dusk foliage');
for(let i=0;i<defaults.wildlife.fireflyCount;i++){const matrix=new THREE.Matrix4();defaults.wildlife.fireflies.getMatrixAt(i,matrix);const position=new THREE.Vector3().setFromMatrixPosition(matrix),size=new THREE.Vector3().setFromMatrixScale(matrix).x;assert(size<=position.distanceTo(defaults.camera.position)*.012+.0001,'Nearby halos have a bounded apparent size');}
assert.equal(defaults.wildlife.fireflies.material.fog,false);assert(defaults.wildlife.fireflies.material.depthTest,'Glows must still be occluded by terrain');
defaults.wildlife.dispose();

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
assert.equal(w.fireflies.geometry,geometry);assert.equal(w.fireflies.instanceMatrix.array,matrixArray);assert.equal(w.fireflyData,flyPool);

const a=setup(),b=setup();move(a.wildlife,a.camera,start,0,day);move(b.wildlife,b.camera,start,0,day);assert.deepEqual(a.wildlife.fireflyData,b.wildlife.fireflyData,'Firefly scenery is deterministic');a.wildlife.dispose();b.wildlife.dispose();
const mobile=setup({mobile:true});move(mobile.wildlife,mobile.camera,start,0,night);assert(mobile.wildlife.fireflyCapacity<w.fireflyCapacity,'Mobile retains a smaller firefly pool');assert(mobile.wildlife.fireflyCount<=98);assert.equal(mobile.wildlife.stats.birds,0);assert.equal(mobile.scene.children.length,1);mobile.wildlife.dispose();
const reduced=setup({reduced:true});move(reduced.wildlife,reduced.camera,start,0,night);assert.equal(reduced.wildlife.stats.birds,0);const still=[...reduced.wildlife.fireflies.instanceMatrix.array],quiet=[...reduced.wildlife.fireflyAlpha.array];tick(reduced.wildlife,reduced.camera,{x:start.x,z:start.z-12},12,night,{speed:0});assert.deepEqual([...reduced.wildlife.fireflies.instanceMatrix.array],still,'Reduced motion freezes firefly drift');assert.deepEqual([...reduced.wildlife.fireflyAlpha.array],quiet,'Reduced motion replaces blinking with a quiet steady glow');reduced.wildlife.dispose();

for(const value of [NaN,Infinity]){
 tick(w,camera,{x:value,z:start.z},80,night);assert(!w.fireflies.visible);assert.equal(w.stats.fireflies,0);
 tick(w,camera,start,value,night);assert(!w.fireflies.visible);assert.equal(w.stats.birds,0);
}
camera.position.set(bank.x+3,field.height(bank.x,bank.z)+3,bank.z+7);
tick(w,camera,bank,80,night);assert(w.fireflies.visible,'A valid update restores glows after invalid input');
assert([...w.fireflies.instanceMatrix.array].every(Number.isFinite),'All firefly transforms remain finite');
w.dispose();w.dispose();assert.equal(scene.children.length,0,'Disposal removes the firefly mesh safely');assert.equal(w.stats.fireflies,0);
console.log('Meadow wildlife: birds removed, riverbank sunset/night glows, canopy placement, camera clearance, deterministic pools, mobile budgets, reduced motion, rebasing and disposal passed.');

// Judge Dean LLC — a cell refresh must never introduce or remove a visible light.
for(const mobile of [false,true]){
 const {wildlife:w,camera}=setup({mobile,reduced:true});let crossings=0;
 const snapshot=p=>{
  camera.position.set(p.x+3,field.height(p.x,p.z)+3,p.z+7);tick(w,camera,p,0,night);
  return new Map(w.fireflyData.slice(0,w.fireflyCount).map((f,i)=>[`${f.x},${f.z}`,w.fireflyAlpha.getX(i)]));
 };
 for(let x=170;x<=270;x+=10)for(let z=-360;z<=-240;z+=10)for(const axis of ['x','z']){
  const before=snapshot({x:x-(axis==='x'?.001:0),z:z-(axis==='z'?.001:0)}),after=snapshot({x:x+(axis==='x'?.001:0),z:z+(axis==='z'?.001:0)});
  for(const [key,alpha] of before){if(!after.has(key))assert.equal(alpha,0,'Removed patches are already fully faded');else assert(Math.abs(after.get(key)-alpha)<.002,'Shared lights stay continuous across a streaming boundary');}
  for(const [key,alpha] of after)if(!before.has(key))assert.equal(alpha,0,'New patches begin invisible');
  crossings++;
 }
 assert(crossings>250);w.dispose();
}
console.log('Firefly streaming: desktop and mobile cell boundaries retain continuous brightness; added/removed patches are invisible.');
