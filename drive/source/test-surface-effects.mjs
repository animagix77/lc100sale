import assert from 'node:assert/strict';
import * as THREE from 'three/webgpu';
import {SurfaceEffects} from './surface-effects.mjs';
import {surfaceProfile,oceanHeight} from './ocean-height.mjs';
import {SandField,shore} from './terrain.mjs';
import {riverZ} from './expedition.mjs';
const field=new SandField(),scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(),fx=new SurfaceEffects(scene,field,{random:()=>.5});
assert(fx.sand.mesh.instanceColor,'Material-specific tint must exist before the preload shader compilation');
const dry={x:shore(0)+22,z:0,soft:.1,slip:0,dir:1,wheel:0};
fx.emit(dry,0,0,0);assert.deepEqual(fx.stats,{sand:0,dust:0,powder:0,splash:0,sheet:0,wake:0},'Idle tires do not emit effects');
for(let i=0;i<4;i++)fx.emit({...dry,wheel:2},0,3,(i+1)*.1);assert(fx.stats.sand>0&&fx.stats.dust>0,'Normal firm-sand driving emits grains and dust without wheelspin');
assert.equal(fx.stats.dust,2,'Rear tyres emit dust only every other mark');assert(fx.dust.opacity<=.13,'Dust remains translucent');assert(fx.dust.particles.filter(p=>p.life>0).every(p=>p.ttl<=1&&p.size<.6),'Short-lived, compact dust stays near the tyres');const before=fx.stats.sand;fx.emit({...dry,soft:.9,slip:4},0,0,0);assert(fx.stats.sand-before>5,'Stationary wheelspin still throws a strong sand plume');
const wet={...dry,x:shore(0)+2,wheel:2};const prior={...fx.stats};assert(fx.emit(wet,0,3,.6),'Shallow contact is classified as wet');fx.emit(wet,0,3,.7);assert(fx.stats.splash>0&&fx.stats.wake>0);assert.equal(fx.splash.mesh.geometry.type,'SphereGeometry','Spray uses small 3D droplets, not cloudy sprites');assert.equal(fx.stats.dust,prior.dust);assert.equal(fx.stats.sand,prior.sand);
const sample=(speed,dir=1,wheel=2,heading=0)=>{const e=new SurfaceEffects(new THREE.Scene(),field,{random:()=>.5});for(let i=0;i<8;i++)e.emit({...wet,dir,wheel},heading,speed,i*.1);const drops=e.splash.particles.filter(p=>p.life>0).map(p=>({...p})),count=e.stats.splash;e.dispose();return {drops,count}};
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
assert(fast.drops.every(p=>p.size<.04&&p.ttl<.9),'Droplets stay small while higher-speed throws last longer');
assert.equal(sample(0).count,0,'Parked wheels never spray');
assert(!surfaceProfile({...dry,x:shore(0)+25},3,-1,0).wet,'An inland rut is not mistaken for the sea');
for(let i=0;i<100;i++)fx.emit(wet,.5,5,1+i/60);
const capacities=fx.pools.map(p=>p.particles.length);fx.update(.016,camera,{x:512,z:-512},.3);
assert(fx.wake.particles.some(p=>p.life>0&&Math.abs(p.y-oceanHeight(p.x,p.z,.3)-.045)<1e-8),'Wake follows the displaced water surface');
for(const pool of fx.pools){assert([...pool.mesh.instanceMatrix.array].every(Number.isFinite));assert([...pool.alpha.array].every(a=>a>=0&&a<=1));}
fx.update(4,camera,{x:512,z:-512},4);assert(fx.pools.every(p=>p.particles.every(a=>a.life===0)),'All effects expire');assert.deepEqual(fx.pools.map(p=>p.particles.length),capacities,'Particle memory stays bounded');
fx.emit(dry,0,3,4);fx.clear();assert(fx.pools.every(p=>p.particles.every(a=>a.life===0)),'Recover clears residual effects');fx.dispose();assert.equal(scene.children.length,0);console.log('Surface effects: idle, restrained beach dust, trailing water spray, waterline, expiry, rebase and cleanup passed');

const riverFx=new SurfaceEffects(new THREE.Scene(),field,{random:()=>.5}),riverMark={x:248,z:riverZ(248),wheel:2,slip:0,soft:.1,dir:1};
for(let i=0;i<8;i++)assert(riverFx.emit(riverMark,0,3,i/60),'Default surface effects use the river waterline');
assert(riverFx.stats.splash>0&&riverFx.stats.wake>0,'River contact produces water effects');
riverFx.update(.016,camera,{x:0,z:0},.3);for(const pool of riverFx.pools)assert([...pool.mesh.instanceMatrix.array].every(Number.isFinite),'Dry-surface sentinel never reaches particle transforms');riverFx.dispose();


// The same tire contact produces material-specific spray, with rate limits
// independent of physics mark count and the 50 mph road speed.
const looseSample=({x,z,speed=5,slip=0,dir=1,wheel=2,heading=0,mobile=false,seconds=.3})=>{
 const e=new SurfaceEffects(new THREE.Scene(),field,{random:()=>.5,mobile});
 for(let i=0;i<Math.ceil(seconds*120);i++)e.emit({x,z,wheel,dir,slip,soft:.8},heading,speed,i/120);
 return e;
};
const mudPoint={x:365,z:-489},snowPoint={x:312,z:-600};
const mud=looseSample(mudPoint),snow=looseSample(snowPoint),beach=looseSample({...dry}),snowSpinning=looseSample({...snowPoint,speed:0,slip:4});
const grains=e=>e.sand.particles.filter(p=>p.life>0),powder=e=>e.powder.particles.filter(p=>p.life>0);
assert(grains(mud).length>grains(beach).length,'Wet mud throws more clods than firm beach sand');
assert(grains(snow).length>grains(beach).length,'Deep snow throws more fragments than firm beach sand');
assert(grains(mud).every(p=>p.medium==='mud'&&['#493529','#86634a'].includes(p.tint)&&p.size>2&&p.stretch>1),'Wet clods are dark, thick, irregular grains');
assert(grains(snow).every(p=>p.medium==='snow'&&['#f4f9ff','#ccdfea'].includes(p.tint)&&p.size>2.3),'Snow fragments remain visibly white and larger than sand');
assert(snow.stats.powder>0&&snowSpinning.stats.powder>0,'Driving and stationary wheelspin both release snow powder');
assert.equal(mud.stats.powder,0,'Wet mud never turns into a powder cloud');
assert.equal(snow.stats.dust,0,'Snow never emits brown beach dust');
assert.equal(mud.stats.dust,0,'Wet mud stays granular instead of smoking');
assert(powder(snow).every(p=>p.ttl<=1&&p.size<1.4&&p.width>p.height)&&snow.powder.opacity<=.44,'Powder opens into a distinct low fan without long-lived smoke');
for(const point of [mudPoint,snowPoint])for(const heading of [0,.9,Math.PI])for(const dir of [1,-1]){
 const e=looseSample({...point,heading,dir,speed:8*dir}),forward={x:-Math.sin(heading)*dir,z:-Math.cos(heading)*dir};
 for(const p of [...grains(e),...powder(e)]){
  assert((p.x-point.x)*forward.x+(p.z-point.z)*forward.z<-.1,'Loose material is emitted behind the tire');
  assert(p.vx*forward.x+p.vz*forward.z<0,'Mud and snow fans trail travel in either direction');
 }
 e.dispose();
}
const highSpeed=looseSample({...snowPoint,speed:22.352,slip:5,seconds:1,mobile:true});
const extremeSpeed=looseSample({...snowPoint,speed:80,slip:20,seconds:1,mobile:true});
assert(highSpeed.stats.sand<=21*8&&highSpeed.stats.powder<=21,'50 mph is constrained by a per-wheel emission budget');
assert.equal(highSpeed.stats.sand,extremeSpeed.stats.sand,'Excess speed does not multiply particle work');
assert(grains(extremeSpeed).every(p=>p.vy<5&&Math.hypot(p.vx,p.vz)<9.5),'High-speed spray remains near the truck rather than shooting projectiles');
assert(highSpeed.pools.reduce((sum,p)=>sum+p.particles.length,0)<1000,'Mobile effects use a fixed total budget of fewer than 1000 particles including stronger material fans');
const mobileCap=highSpeed.pools.map(p=>p.particles.length);
for(let i=0;i<500;i++)highSpeed.emit({...snowPoint,wheel:i%4,dir:1,slip:8,soft:.8},0,22.352,2+i/240);
assert.deepEqual(highSpeed.pools.map(p=>p.particles.length),mobileCap,'Bursting all four wheels cannot grow memory');
highSpeed.update(.06,camera,{x:512,z:-512},4);
for(const pool of highSpeed.pools){assert([...pool.mesh.instanceMatrix.array].every(Number.isFinite));assert([...pool.alpha.array].every(a=>a>=0&&a<=1))}
const emitted=highSpeed.stats.sand;highSpeed.clear();highSpeed.emit({...snowPoint,wheel:2,dir:1,slip:1,soft:.8},0,2,0);
assert(highSpeed.stats.sand>emitted,'Reset releases emission throttle even when the game clock restarts');
for(const e of [mud,snow,beach,snowSpinning,highSpeed,extremeSpeed])e.dispose();
console.log('Loose terrain spray: mud/snow appearance, trailing fans, stationary wheelspin, 50 mph rate limits and mobile pool budgets passed');

// A 50 mph ford produces a tall rearward fan and coherent water sheets, while
// a crawl or shallow film remains restrained. The airborne pool is fixed.
const crossing=(speed,depth=.60)=>{
 const e=new SurfaceEffects(new THREE.Scene(),{height:()=>0},{mobile:true,random:()=>.5,waterHeight:()=>depth});
 for(let i=0;i<120;i++)for(let wheel=0;wheel<4;wheel++)e.emit({...riverMark,y:0,wheel,dir:Math.sign(speed)||1},0,speed,i/120);
 return e;
};
const crawlWater=crossing(1),middleWater=crossing(11.176),fastWater=crossing(22.352),shallowWater=crossing(22.352,.05),reverseWater=crossing(-22.352);
const drops=e=>e.splash.particles.filter(p=>p.life>0),sheets=e=>e.sheet.particles.filter(p=>p.life>0);
assert(drops(fastWater)[0].vy>drops(middleWater)[0].vy*1.6,'Throw height still increases from 25 to 50 mph');
assert(drops(fastWater)[0].vy**2/(2*9.81)>2,'Fast deep contact throws droplets above two metres');
assert(drops(crawlWater)[0].vy**2/(2*9.81)<.1,'Crawling remains a small tire splash');
assert.equal(sheets(crawlWater).length,0,'Slow contact never creates spray sheets');
assert(sheets(fastWater).length>0&&sheets(fastWater).every(p=>p.length>3&&p.height>2),'Fast contact throws broad curved water sheets');
assert.equal(sheets(shallowWater).length,0,'A thin puddle cannot throw full sheets');
assert(drops(shallowWater)[0].vy<drops(fastWater)[0].vy*.75,'Water depth limits splash energy');
assert(drops(reverseWater).every(p=>p.vz<0)&&drops(fastWater).every(p=>p.vz>0),'High-speed fans trail either direction');
assert(fastWater.stats.splash<=4*21*5&&fastWater.stats.sheet<=4*11,'Per-wheel timing caps high speed emission');
assert(fastWater.pools.reduce((n,p)=>n+p.particles.length,0)<1000,'All mobile effects remain fixed and bounded');
assert(fastWater.sheet.mesh.geometry.attributes.position.count<64,'Water sheets use a shared compact mesh');
const highRock=new SurfaceEffects(new THREE.Scene(),{height:()=>0},{random:()=>.5,waterHeight:()=>.4});
highRock.emit({...riverMark,y:.5},0,22.352,0);assert.equal(highRock.stats.splash,0,'Exposed rock contact cannot splash from the riverbed below it');
for(const e of [crawlWater,middleWater,fastWater,shallowWater,reverseWater,highRock]){
 e.update(.12,camera,{x:512,z:-512},2);for(const pool of e.pools)assert([...pool.mesh.instanceMatrix.array].every(Number.isFinite));
 e.clear();assert(e.sheet.particles.every(p=>p.life===0),'Reset clears pooled sheets');e.dispose();
}
console.log('Fast river spray: 50 mph scaling, depth limits, curved fans, reverse trails, exposed rock, fixed budgets and cleanup passed');


// At driving speed the loose material must read as a fan, not a few tiny specks.
const normalMud=looseSample({...mudPoint,speed:5}),normalSnow=looseSample({...snowPoint,speed:5}),normalSand=looseSample({...dry,speed:5});
assert(normalMud.stats.sand>=normalSand.stats.sand*3,'Normal muddy driving throws at least three times as many solids as restrained beach driving');
assert(normalSnow.stats.sand>=normalSand.stats.sand*3,'Normal snow driving throws a dense white fan');
assert(grains(normalMud).every(p=>p.size*.028*2>.12),'Mud clods are visibly larger than twelve centimetres at launch');
assert(grains(normalSnow).every(p=>p.size*.028*2>.14),'Snow throws substantial fragments rather than beach-grain-sized specks');
assert(grains(normalMud).every(p=>p.vy>1.5)&&grains(normalSnow).every(p=>p.vy>1.9),'Mud and snow rise clear of the tire contact patch');
for(const e of [normalMud,normalSnow]){
 e.update(.12,camera,zeroOrigin(),1);
 const active=e.sand.particles.findIndex(p=>p.life>0);assert(active>=0);
 assert(e.sand.alpha.getX(active)>.90,'Heavy fragments retain a strong silhouette through the opening part of the throw');
 const scale=new THREE.Vector3(),matrix=new THREE.Matrix4();e.sand.mesh.getMatrixAt(active,matrix);scale.setFromMatrixScale(matrix);
 assert(scale.x>e.sand.particles[active].size*.95,'Heavy fragments do not immediately shrink before becoming visible');
}
function zeroOrigin(){return {x:0,z:0}}

// Exercise the real render cadence with all four wheels. No live chunk or snow
// fan should be repeatedly overwritten halfway through its appearance.
for(const mobile of [false,true])for(const fps of [30,60])for(const point of [mudPoint,snowPoint]){
 const e=new SurfaceEffects(new THREE.Scene(),{height:()=>0},{mobile,random:()=>.5,waterHeight:()=>-Infinity}),spawn=e.spawn.bind(e),capacity=e.pools.map(pool=>pool.particles.length);let earlyOverwrites=0,peakChunks=0,peakPowder=0;
 e.spawn=(pool,values)=>{const old=pool.particles[pool.cursor%pool.particles.length];if((pool===e.sand||pool===e.powder)&&old.life>.2)earlyOverwrites++;return spawn(pool,values)};
 const dt=1/fps;
 for(let frame=0;frame<fps*3;frame++){
  const time=frame*dt;
  for(let wheel=0;wheel<4;wheel++)e.emit({...point,y:0,dir:1,wheel,slip:4,soft:.8},0,8,time);
  e.update(dt,camera,zeroOrigin(),time);peakChunks=Math.max(peakChunks,grains(e).length);peakPowder=Math.max(peakPowder,powder(e).length);
 }
 assert.equal(earlyOverwrites,0,`Four-wheel spray at ${fps}fps must not starve its pools (mobile=${mobile})`);
 assert(peakChunks>120,'Sustained wet/loose driving maintains a full granular fan');
 if(point===snowPoint)assert(peakPowder>=10&&peakPowder<e.powder.particles.length,'Snow fan develops fully without cycling the whole pool');
 assert.deepEqual(e.pools.map(pool=>pool.particles.length),capacity,'Three seconds of heavy wheelspin never allocates extra particles');
 const beforeIdle={...e.stats};for(let wheel=0;wheel<4;wheel++)e.emit({...point,y:0,dir:1,wheel,slip:0,soft:.8},0,0,4);assert.deepEqual(e.stats,beforeIdle,'Idle muddy or snowy tires stop emitting immediately');
 e.update(4,camera,zeroOrigin(),8);assert(e.pools.every(pool=>pool.particles.every(p=>p.life===0)),'Strong spray clears completely after stopping');e.dispose();
}
for(const e of [normalMud,normalSnow,normalSand])e.dispose();
console.log('Strong mud/snow: substantial fragments, dense material fans, early visibility, idle suppression and four-wheel 30/60fps pool lifetime passed');
