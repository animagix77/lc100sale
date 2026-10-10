import {VEHICLE_SETUP} from './vehicle-spec.mjs';
import assert from 'node:assert/strict';
import {stepDriveline} from './drivetrain.mjs';
import {DrivePhysics,RAPIER} from './physics.mjs';
const dt=1/120;
const tyres=()=>Array.from({length:4},()=>({omega:0,angle:0,slip:0}));
function run({locked,reverse=false,grip=true,tc=false}){
 const wheels=tyres();let speed=0,travel=0,result;
 for(let n=0;n<240;n++){
  const contacts=wheels.map((w,i)=>({roadSpeed:speed,load:i<2?0:12000,soft:.7,depth:0,contact:grip&&i>=2,tractionControl:tc}));
  result=stepDriveline(wheels,contacts,{dt,motor:reverse?-1800:1800,locked});
  speed+=(result.forces.reduce((s,f)=>s+f,0)-speed*280)/2450*dt;travel+=speed*dt;
 }
 return {speed,travel,wheels,result};
}
for(const reverse of [false,true]){
 const open=run({locked:false,reverse}),locked=run({locked:true,reverse});
 console.log('Unloaded front axle',{reverse,open:open.travel,locked:locked.travel,axleSlip:locked.result.axleSlip});
 assert(Math.abs(locked.travel)>Math.abs(open.travel)*1.65,'Center lock sends usable torque to grounded axle in either direction');
 assert(Math.abs(locked.result.axleSlip)<.001,'Front/rear mean shaft speeds are coupled');
 assert(Math.abs(open.result.axleSlip)>5,'Open center permits different axle speeds');
 assert.equal(Math.sign(locked.speed),reverse?-1:1);
}
for(const locked of [false,true])assert.equal(run({locked,grip:false}).travel,0,'No contact means no propulsion even locked');
// Lock transfers equal/opposite motor torque and conserves angular momentum.
const free=tyres();free[0].omega=4;free[1].omega=2;free[2].omega=-1;free[3].omega=1;
const before=free.reduce((s,w)=>s+w.omega,0),motor=800;
stepDriveline(free,free.map(()=>({roadSpeed:0,load:0,soft:0,depth:0,contact:false})),{dt,motor,locked:true});
assert(Math.abs(free.reduce((s,w)=>s+w.omega,0)-(before+(4*motor*VEHICLE_SETUP.rollingRadius-before*.7)/18*dt))<1e-8,'Coupler does not invent engine torque');
assert(Math.abs(free[0].omega-free[1].omega)>1.9,'Center lock does not lock left/right wheels');
// Different axle paths in a corner generate dissipative scrub, not a steering multiplier.
function corner(locked){const w=tyres();for(let i=0;i<4;i++)w[i].omega=(i<2?3.3:3)/VEHICLE_SETUP.rollingRadius;let out;
 for(let n=0;n<180;n++)out=stepDriveline(w,w.map((_,i)=>({roadSpeed:i<2?3.3:3,load:6000,soft:0,depth:0,contact:true})),{dt,motor:0,locked});
 return {out,work:out.forces.reduce((sum,f,i)=>sum+f*(i<2?3.3:3),0)};}
const openTurn=corner(false),lockedTurn=corner(true);
console.log('Corner scrub',{open:openTurn.work,locked:lockedTurn.work,forces:lockedTurn.out.forces});
assert(lockedTurn.work<openTurn.work-150,'Locked drivetrain dissipates more energy on mismatched axle paths');
assert(lockedTurn.out.forces[0]*lockedTurn.out.forces[2]<0,'Opposing axle reactions produce scrub');
const p=await DrivePhysics.create();p.world.createCollider(RAPIER.ColliderDesc.cuboid(100,.1,100).setTranslation(-20,-.1,0));p.reset(-20,0,0);
for(let n=0;n<240;n++)p.step(dt,{brake:true});assert.equal(p.centerLocked,false);assert(p.setCenterLock(true));assert(p.centerLocked);assert(p.setRange('LO'));assert(p.centerLocked,'Range change retains lock');
for(const input of [{gas:true},{reverse:true},{cruise:true}]){
 p.controls=input;assert(!p.setCenterLock(false));assert(!p.setRange('HI'));assert(p.centerLocked);assert.equal(p.range,'LO');
}
p.controls={};p.speed=-3;p.tyres[0].slip=5;p.rb.setLinvel({x:0,y:0,z:3},true);const velocity=p.rb.linvel();
assert(p.setCenterLock(false),'Gravity drift and residual wheelspin do not block an unloaded shift');assert(p.setRange('HI'));assert.deepEqual(p.rb.linvel(),velocity,'Changing modes does not brake or teleport the truck');
p.controls={gas:true};assert(p.setRange('LO',{}),'Fresh released input overrides previous physics tick');assert(p.setCenterLock(false,{}));
p.controls={};p.speed=0;p.tyres[0].slip=0;p.rb.setLinvel({x:0,y:0,z:0},true);
assert(p.setCenterLock(true));for(let n=0;n<720;n++)p.step(dt,{gas:true});assert(p.speed>2&&p.speed<3.4,'Locked low range stays governed');
p.reset(-20,0,0);assert(p.centerLocked,'Reset preserves selected lock');assert(p.tyres.every(w=>w.omega===0));p.dispose();
console.log('Center differential: traction, reverse, axle coupling, torque conservation, corner scrub and engagement guards passed.');
