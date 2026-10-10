// Judge Dean LLC — rated output, energy bounds and traction-limited grade checks.
import assert from 'node:assert/strict';
import {LC100,VEHICLE_SETUP} from './vehicle-spec.mjs';
import {Powertrain,engineTorque,AUTO_RATIOS} from './powertrain.mjs';
import {engineVoice} from './sound.mjs';
import {stepDriveline} from './drivetrain.mjs';
const dt=1/120,close=(a,b,eps=1e-8)=>assert(Math.abs(a-b)<eps,`${a} differs from ${b}`);
close(engineTorque(3400)/1.355817948,320);
close(engineTorque(4800)*4800*Math.PI/30/745.699872,235);
assert.deepEqual(AUTO_RATIOS,[3.520,2.042,1.400,1,.716]);
for(let rpm=700;rpm<=6000;rpm+=10){assert(engineTorque(rpm)<=LC100.torqueNm);assert(engineTorque(rpm)*rpm*Math.PI/30<=LC100.powerW+.001);}
function stalled(range,reverse=false){const e=new Powertrain();for(let i=0;i<1200;i++)e.update(dt,{range,reverse,throttle:1});return e;}
const light=new Powertrain(),loaded=new Powertrain();light.gear=loaded.gear=3;
light.update(dt,{wheelSpeed:13,speed:13,throttle:.1});loaded.update(dt,{wheelSpeed:13,speed:13,throttle:1});
assert.equal(light.gear,3);assert.equal(loaded.gear,2,'High demand on a slow climb downshifts without waiting for near-idle RPM');
close(engineVoice({rpm:4800,load:1}).fundamental,320);
const hi=stalled('HI'),lo=stalled('LO'),reverse=stalled('HI',true);
close(lo.force/hi.force,2.488);close(reverse.force/hi.force,3.224/3.520);
assert(hi.force>2550,'V8 output is no longer clipped to the old constant-force motor');
for(const range of ['HI','LO'])for(const reverse of [false,true]){
 const e=new Powertrain();
 for(let i=0;i<3600;i++){
  const wheelSpeed=(i%1200)/1200*35,throttle=.2+.8*(i%300)/300;
  e.update(dt,{range,reverse,throttle,wheelSpeed,speed:wheelSpeed});
  assert(Number.isFinite(e.force)&&e.force>=0);
  assert(e.converter>=1&&e.converter<=1.65);
  assert(e.outputPower<=LC100.powerW*.88*throttle+.001,'Converter and RPM lag cannot manufacture power');
 }
 e.update(dt,{power:0,throttle:1});assert.equal(e.force,0);
}
// Integrate the same angular tyres/center differential and V8 against known
// slope gravity. This isolates grip and load from procedural terrain features.
function grade({degrees=25,soft=0,grip=1,contact=true,throttle=1}={}){
 const angle=degrees*Math.PI/180,mass=VEHICLE_SETUP.massKg,e=new Powertrain();
 const wheels=Array.from({length:4},()=>({omega:0,angle:0}));let speed=0,travel=0;
 for(let i=0;i<960;i++){
  const wheelSpeed=wheels.reduce((n,w)=>n+w.omega*VEHICLE_SETUP.rollingRadius,0)/4;
  e.update(dt,{range:'LO',wheelSpeed,speed,throttle});
  const load=mass*9.81*Math.cos(angle)/4;
  const out=stepDriveline(wheels,wheels.map(()=>({roadSpeed:speed,load,soft,depth:0,contact,tractionControl:true,grip,throttle})),{dt,motor:e.force,locked:true});
  const force=out.forces.reduce((a,b)=>a+b,0),cap=contact?mass*9.81*Math.cos(angle)*(1.12-.4*soft)*grip:0;
  assert(Math.abs(force)<=cap+.01,'Engine/gearing/lock cannot exceed available soil grip');
  speed+=(force-mass*9.81*Math.sin(angle)-speed*150)/mass*dt;travel+=speed*dt;
 }
 return {speed,travel};
}
const hard=grade(),sand=grade({soft:.95,grip:.72}),steep=grade({degrees:45,grip:.6}),air=grade({contact:false}),unpowered=grade({throttle:0});
console.log('Controlled grade results (test fixtures, not certified real-world limits)',{hard,sand,steep,air,unpowered});
assert(hard.travel>10,'Firm 25-degree grade is achievable in low range');
assert(sand.travel<hard.travel*.7,'Loose sand materially reduces climb performance');
assert(steep.travel<0,'Low range cannot overcome an insufficient friction coefficient');
assert(air.travel<0&&unpowered.travel<0,'No contact/no throttle cannot climb');
console.log('2004 V8 rated peaks, gear ratios, converter power conservation and grade/traction checks passed.');
