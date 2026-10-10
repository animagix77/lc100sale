// Judge Dean LLC — automatic shifts, sound response and confirmed tire fit.
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {DrivePhysics,RAPIER} from './physics.mjs';
import {Powertrain} from './powertrain.mjs';
import {drivingMix,engineVoice} from './sound.mjs';
import {VEHICLE_SETUP,FITTED_TYRE} from './vehicle-spec.mjs';
import {fitTyreVisual} from './tyre-fit.mjs';
const dt=1/120,trace=[],shifts=[],p=await DrivePhysics.create();
assert.equal(FITTED_TYRE.size,'LT275/70R18');assert(Math.abs(VEHICLE_SETUP.wheelRadius-.42164)<1e-10);
assert(Math.abs(1609.344/(2*Math.PI*VEHICLE_SETUP.rollingRadius)-627)<1e-8);
p.waterHeight=()=>-Infinity;p.world.createCollider(RAPIER.ColliderDesc.cuboid(500,.1,1500).setTranslation(-20,-.1,0));p.reset(-20,0,0);
for(let i=0;i<240;i++)p.step(dt,{brake:true});let prior=1;
for(let i=0;i<40*120;i++){
 p.step(dt,{gas:true});const e=p.powertrain,m=drivingMix({engine:e,speed:p.speed}),v=engineVoice(m);
 trace.push({t:i*dt,rpm:e.rpm,speed:p.speed,gear:e.gear,load:e.load,shiftTime:e.shiftTime,shiftMix:e.shiftMix,...v});
 if(e.gear!==prior){shifts.push({frame:i,from:prior,to:e.gear,rpm:e.rpm,speed:p.speed});prior=e.gear;}
 assert.equal(m.rpm,e.rpm,'Audio never fabricates a separate gear/RPM state');
 assert(Math.abs(v.fundamental-e.rpm/15)<1e-8,'Four V8 firing events per crank revolution');
 assert(v.pitchResponse<=.065,'Pitch follows a shift without the old half-second smear');
}
console.log('Automatic acceleration shifts',shifts);
assert(p.powertrain.gear>=3,'Governed cruising shifts beyond the acceleration gears when load permits');
assert(shifts.some(s=>s.from===1&&s.to===2),'Acceleration includes a real automatic upshift');
assert(shifts.filter(s=>s.frame>30*120).length===0,'No repeated up/down hunting at a steady governed speed');
assert(p.speed>22.2&&p.speed<22.5,'Retains the requested 50 mph cruise ceiling');
for(const s of shifts.filter(s=>s.to>s.from)){
 const before=trace[s.frame-1],after=trace[Math.min(trace.length-1,s.frame+48)];
 assert(after.rpm<before.rpm*.92,'Upshift produces an audible RPM drop');
}
const cruise=new Powertrain();for(let i=0;i<1800;i++)cruise.update(dt,{speed:22.35,wheelSpeed:22.35,throttle:.3,speedLimited:true,resistanceForce:200});assert.equal(cruise.gear,5,'Light-load cruise can use fifth; a heavily loaded cruise may correctly hold fourth');
// A hill/kickdown at the same road speed raises actual engine RPM.
const e=new Powertrain();e.gear=3;for(let i=0;i<240;i++)e.update(dt,{speed:13,wheelSpeed:13,throttle:.1});
const light=e.rpm,gear=e.gear;for(let i=0;i<60;i++)e.update(dt,{speed:13,wheelSpeed:13,throttle:1});
assert(e.gear<gear&&e.rpm>light*1.2,'Kickdown revs rise under load');
const full=engineVoice({rpm:3000,load:1}),shift=engineVoice({rpm:3000,load:1,shifting:true,shiftMix:1});
assert(shift.gains[0]<full.gains[0]&&shift.gains[0]>full.gains[0]*.5,'Shift briefly unloads the exhaust without muting or a bang');
for(const args of [{range:'LO',speed:3,wheelSpeed:3},{reverse:true,speed:-2,wheelSpeed:-2},{speed:0,wheelSpeed:15}]){const e=new Powertrain();for(let i=0;i<1200;i++)e.update(dt,{...args,throttle:1});assert.equal(e.gear,1,'Crawl, reverse and stationary wheelspin do not fake upshift sounds');}
const parent=new THREE.Group(),roll=new THREE.Group(),mesh=new THREE.Mesh(new THREE.CylinderGeometry(.5,.5,.4,64),new THREE.MeshBasicMaterial());mesh.rotation.z=Math.PI/2;roll.add(mesh);parent.add(roll);parent.rotation.set(.2,.3,.1);fitTyreVisual(roll);const scale=roll.scale.clone();fitTyreVisual(roll);assert(roll.scale.distanceTo(scale)<1e-8,'Runtime tire fit is repeat-safe');assert(Math.abs(roll.scale.y*.5-VEHICLE_SETUP.wheelRadius)<1e-6);assert(Math.abs(roll.scale.x*.4-VEHICLE_SETUP.wheelWidth)<1e-6);
mesh.geometry.dispose();mesh.material.dispose();p.dispose();
if(process.env.LC100_AUDIO_TRACE){const {writeFileSync}=await import('node:fs');writeFileSync(process.env.LC100_AUDIO_TRACE,JSON.stringify({sampleHz:120,trace,shifts}));}
console.log('Automatic engine audio: acceleration, shift drops, kickdown, overdrive, crawl/reverse/spin, tire size and runtime fit passed.');
