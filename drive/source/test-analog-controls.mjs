import assert from 'node:assert/strict';
import {DrivePhysics,RAPIER,pedalAmount} from './physics.mjs';
import {stepDriveline} from './drivetrain.mjs';
const dt=1/120;
const step=(p,input,n)=>{for(let i=0;i<n;i++)p.step(dt,input)};
async function level(){
 const p=await DrivePhysics.create();p.waterHeight=()=>null;
 p.world.createCollider(RAPIER.ColliderDesc.cuboid(500,.1,500).setTranslation(-20,-.1,0));
 p.reset(-20,0,0);step(p,{brake:true},240);return p;
}
for(const [value,expected] of [[true,1],[false,0],[undefined,0],[NaN,0],[Infinity,0],[-1,0],[2,1],[.35,.35],['1',0]])assert.equal(pedalAmount(value),expected);
async function accelerate(throttle){const p=await level();step(p,{gas:throttle},240);return p;}
const feather=await accelerate(.2),mid=await accelerate(.55),full=await accelerate(1),keyboard=await accelerate(true);
assert(feather.speed>0.3,'Feathering the joystick produces usable forward drive');
assert(mid.speed>feather.speed*1.6,'More stick travel produces stronger acceleration');
assert(full.speed>mid.speed*1.3,'Full travel remains stronger than half travel');
assert.equal(full.speed,keyboard.speed,'Boolean keyboard gas retains full-throttle behavior');
console.log('Proportional forward speed',{feather:feather.speed,mid:mid.speed,full:full.speed});
const beforeCoast=mid.speed;step(mid,{},240);assert(mid.speed<beforeCoast,'Releasing the stick removes power and allows coasting');assert.equal(mid.controls.gas,0);
for(const p of [feather,mid,keyboard])p.dispose();
// Pulling back first meters the service brakes, then selects proportional reverse.
const partialBrake=await accelerate(true);step(full,{reverse:1},12);step(partialBrake,{reverse:.2},12);
assert(partialBrake.speed>full.speed+.15,'Partial reverse-stick travel brakes less strongly while moving forward');
assert(Math.abs(partialBrake.vehicle.wheelBrake(0)-17)<.01,'Reverse-stick service braking is proportional');
assert(partialBrake.lighting.braking&&!partialBrake.lighting.reversing,'Forward braking is not displayed as reverse');
step(partialBrake,{reverse:.2},1200);assert(partialBrake.speed<-.2,'Holding back transitions from braking into reverse');
const slowReverse=partialBrake.speed;step(full,{reverse:true},1200);assert(Math.abs(full.speed)>Math.abs(slowReverse),'Partial reverse preserves controllable crawling speed');
partialBrake.dispose();full.dispose();
// The e-brake owns the rear axle, overrides throttle/cruise, and releases cleanly.
for(const locked of [false,true]){
 const p=await accelerate(true);p.centerLocked=locked;const speed=p.speed;
 p.step(dt,{gas:1,cruise:true,handbrake:true});
 assert(p.tyres.slice(2).every(w=>w.omega===0),'Rear tread visibly locks as the parking brake is held');
 assert(p.tyres.slice(0,2).every(w=>w.omega>1),'Front tread keeps rolling while the rear tyres slide');
 assert(p.vehicle.wheelBrake(2)>=85&&p.vehicle.wheelBrake(3)>=85,'Rear brakes receive the handbrake force');
 assert(p.vehicle.wheelBrake(0)<3&&p.vehicle.wheelBrake(1)<3,'Front wheels only have normal rolling resistance');
 assert(p.vehicle.wheelEngineForce(2)===0&&p.vehicle.wheelEngineForce(3)===0,'Handbrake cuts rear propulsion despite throttle and cruise');
 step(p,{gas:1,cruise:true,handbrake:true},360);
 assert(Math.abs(p.speed)<.12,'Holding the handbrake brings the truck to rest despite requested power');
 step(p,{gas:.5},240);assert(p.speed>1,'Releasing the handbrake restores normal drive');
 assert(p.vehicle.wheelBrake(2)<3&&p.tyres[2].omega>0,'Rear wheels unlock without a sticky brake');
 console.log('Parking brake stop/release',{locked,start:speed,released:p.speed});p.dispose();
}
// No-contact handbrake cannot invent grip or engine force at the rear axle.
const wheels=Array.from({length:4},()=>({omega:8,angle:0}));
const out=stepDriveline(wheels,wheels.map(()=>({roadSpeed:3,load:0,soft:0,depth:0,contact:false})),{dt,motor:4900,locked:true,handbrake:true});
assert(wheels[0].omega>7&&wheels[1].omega>7);assert.equal(wheels[2].omega,0);assert.equal(wheels[3].omega,0);assert(out.forces.every(f=>f===0));
console.log('Analog controls: proportional forward/reverse/braking, keyboard parity, coasting, rear-only e-brake, override and release passed.');
