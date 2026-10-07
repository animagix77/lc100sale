import assert from 'node:assert/strict';
import {DrivePhysics,RAPIER} from './physics.mjs';
import {waterSurfaceHeight,riverWakeOffset,oceanHeight,RIVER_WAKE_LIMITS} from './ocean-height.mjs';
import {riverZ,riverWidth,riverProfile,riverHeight,riverLevel,waterExists} from './expedition.mjs';
import {baseHeight} from './terrain.mjs';
const dt=1/120;

// Location alone cannot imply water: a dry depression below sea level must
// remain dry, while the real ocean and carved river accept contact forces.
const dry=await DrivePhysics.create();
dry.reset(100,300,-6);dry.step(dt,{});
assert.equal(waterSurfaceHeight(100,300,0),-Infinity,'Dry terrain has no water surface');
assert.equal(dry.rb.userForce().y,0,'Below-sea-level dry terrain receives no phantom buoyancy');
assert(dry.rb.linvel().y<0,'Gravity remains active in a dry depression');
dry.dispose();

// The same wheel can sit on an exposed rock or in water without changing the
// terrain: friction responds to the actual live surface, not a broad river mask.
const p=await DrivePhysics.create();
p.waterHeight=()=>-Infinity;
const floor=p.world.createCollider(RAPIER.ColliderDesc.cuboid(30,.1,30).setTranslation(248,-.1,riverZ(248)));
p.reset(248,riverZ(248),0);
for(let i=0;i<240;i++)p.step(dt,{brake:true});
assert(p.tyres.every(w=>w.contact),'All four wheels settled on the test crossing');
p.rb.setEnabledTranslations(false,false,false,true);p.rb.setEnabledRotations(false,false,false,true);
p.obstacles={has:()=>true,kind:()=> 'rock'};
const contactYs=Array.from({length:4},(_,i)=>p.vehicle.wheelContactPoint(i).y),rockTop=Math.max(...contactYs);
p.waterHeight=()=>rockTop+.015;p.step(dt,{brake:true});
const dryFriction=Array.from({length:4},(_,i)=>p.vehicle.wheelFrictionSlip(i));
assert(dryFriction.every(v=>Math.abs(v-1.9)<1e-5),'Film shallower than 2.5 cm does not create phantom wet rock traction');
p.waterHeight=()=>rockTop+.065;p.step(dt,{brake:true});
for(let i=0;i<4;i++)assert(Math.abs(p.vehicle.wheelFrictionSlip(i)/dryFriction[i]-.82)<1e-5,'Submerged rock uses wet traction at the same threshold as visual effects');
p.waterHeight=()=>rockTop-.02;p.step(dt,{brake:true});
for(let i=0;i<4;i++)assert(Math.abs(p.vehicle.wheelFrictionSlip(i)-dryFriction[i])<1e-5,'Emerging contact immediately regains dry grip');

// Sampling remains in world coordinates after the renderer rebases locally.
const before=Array.from({length:4},(_,i)=>({...p.vehicle.wheelContactPoint(i)})),samples=[];
p.rebase(128,-256);p.waterHeight=(x,z,time)=>{samples.push({x,z,time});return -Infinity};
// Rebase static test geometry just as TerrainView does in the application.
floor.setTranslation({x:248-128,y:-.1,z:riverZ(248)+256});
p.step(dt,{brake:true});samples.length=0;p.step(dt,{brake:true});
for(const c of before)assert(samples.some(s=>Math.abs(s.x-c.x)<.01&&Math.abs(s.z-c.z)<.01),'Wheel water samples remain world anchored');
assert(samples.some(s=>Math.abs(s.x-248)<.01&&Math.abs(s.z-riverZ(248))<.01),'Chassis water samples remain world anchored');
assert(samples.every(s=>s.time>0&&Number.isFinite(s.x+s.z)),'Water queries receive finite world coordinates and advancing time');
p.dispose();

// The bounded displaced chassis volume keeps deep water forces finite. These
// force checks use the real rigid body integrator, with gravity kept separate.
async function submerged(level){
 const body=await DrivePhysics.create();body.reset(248,riverZ(248),0);body.waterHeight=()=>level;body.rb.setTranslation({x:248,y:1,z:riverZ(248)},true);body.rb.setLinvel({x:3,y:0,z:0},true);body.step(dt,{});const force=body.rb.userForce();body.dispose();return force;
}
const shallow=await submerged(.5),deep=await submerged(10),deeper=await submerged(100);
assert(shallow.y>0&&shallow.y<24000,'Partial submergence produces proportional buoyancy');
assert.equal(deep.y,24000,'Fully immersed chassis buoyancy stays capped');
assert(Math.abs(deep.x-deeper.x)<1e-4&&deep.y===deeper.y,'Deep water cannot increase drag or displaced volume indefinitely');
assert(deep.x<shallow.x&&deep.x<0,'Water drag opposes the moving chassis and grows with immersion');
const x=248,z=riverZ(x)+riverWidth(x)+1;
assert.equal(waterSurfaceHeight(x,z,0),-Infinity,'Bank outside the physical shoreline has no invisible river');
console.log('Water contact: coherent wet threshold, exposed rock, dry depressions, world rebasing and bounded buoyancy/drag passed.');


// A single shoreline domain serves traction, audio, effects, and sampling,
// including the millimetre-deep fringe and the tapering upstream spring.
for(const x of [-72,-60,-48,-40,-32,-28,0,80,248,475,498,515,519,520,538]){
 for(const side of [-1.5,-1,-.999,-.97,-.7,0,.7,.97,.999,1,1.5]){
  const z=riverZ(x)+riverWidth(x)*side;
  assert.equal(Number.isFinite(waterSurfaceHeight(x,z,2)),waterExists(x,z),`All consumers agree whether water exists at ${x},${side}`);
 }
}
for(const x of [520,525,538])assert.equal(waterSurfaceHeight(x,riverZ(x),2),-Infinity,'Upstream dry terrain never falls back to an invisible ocean');

// Big wakes remain visible in the middle of the ford but lose displacement
// at the shallow shoreline. Even an extreme impulse cannot punch through bed.
for(const depth of [0,.001,.004,.01,.03,.08,.15,.25,.36,.8]){
 const crest=riverWakeOffset(depth,100),trough=riverWakeOffset(depth,-100);
 assert(crest>=0&&crest<=Math.min(RIVER_WAKE_LIMITS.crest,depth*RIVER_WAKE_LIMITS.crestDepth)+1e-12,'Raised crest is limited by available river depth');
 assert(trough<=0&&trough>=-depth*.70-1e-12,'Trough leaves water above the underlying riverbed');
 if(depth<.01)assert(Math.max(crest,-trough)<.0001,'Displacement resolves into the bank rather than leaving a floating edge');
}
assert(riverWakeOffset(.36,1.1)>.95,'Full ford depth supports the large crest of a fast crossing');
assert(riverWakeOffset(.36,.06)===.06,'Raising the crest limit does not amplify a slow crossing');
for(const x of [0,80,160,248,279,350,475,510,519])for(const side of [-.99,-.8,-.6,0,.6,.8,.99]){
 const z=riverZ(x)+riverWidth(x)*side,profile=riverProfile(x,z);
 for(const time of [0,.7,2,3.5,5.3,8])for(const wake of [-.45,0,.07,.6,1.1,100]){
  const h=waterSurfaceHeight(x,z,time,1,wake);
  assert(h>profile.ground,'Combined ripples and wake do not invert the shallow water column');
  assert(h>baseHeight(x,z)-.025,'Bed microtexture stays within the visible waterline tolerance');
 }
}
for(const x of [80,248,475]){
 const z=riverZ(x)+riverWidth(x)*.9999;
 for(const time of [0,1,3])assert(Math.abs(waterSurfaceHeight(x,z,time,1,1.1)-riverLevel(x))<1e-7,'Water meets the mean bank contour without an elevated wake edge');
 assert.equal(waterSurfaceHeight(x,riverZ(x)+riverWidth(x)*1.001,1),-Infinity,'A point just beyond the river bank is dry');
}

// The estuary ends in the same live ocean displacement rather than a separate
// horizontal river sheet. Both ends of the blend have continuous heights.
for(const time of [0,1.3,4,9])for(const wake of [-.25,0,.3]){
 const seaX=-48,seaZ=riverZ(seaX),landX=-28,landZ=riverZ(landX),landProfile=riverProfile(landX,landZ);
 assert(Math.abs(waterSurfaceHeight(seaX,seaZ,time,1,wake)-(oceanHeight(seaX,seaZ,time)+wake))<1e-12,'River mouth starts on the exact ocean surface');
 assert(Math.abs(waterSurfaceHeight(landX,landZ,time,1,wake)-(riverHeight(landX,landZ,time)+riverWakeOffset(landProfile.depth,wake)))<1e-12,'Landward mouth resolves into the shallow river surface');
 for(const edge of [seaX,landX]){
  const a=edge-.001,b=edge+.001,ha=waterSurfaceHeight(a,riverZ(a),time,1,wake),hb=waterSurfaceHeight(b,riverZ(b),time,1,wake);
  assert(Math.abs(ha-hb)<.001,'The longitudinal mouth transition has no height step');
 }
}
console.log('River sampling: shared wet domain, dry spring, depth-limited wakes, shore closure and ocean-mouth continuity passed.');
