// Judge Dean LLC — real rigid-body braking, load transfer and rough descents.
import assert from 'node:assert/strict';
import {DrivePhysics,RAPIER} from './physics.mjs';
import {VEHICLE_SETUP} from './vehicle-spec.mjs';
import {stepDriveline} from './drivetrain.mjs';
async function run({degrees=0,bump=0,speed=22.352,mode='brake',pedal=1,dt=1/120,seconds=20,turn=0}={}){
 const p=await DrivePhysics.create(),angle=-degrees*Math.PI/180,q={x:Math.sin(angle/2),y:0,z:0,w:Math.cos(angle/2)},n={x:0,y:Math.cos(angle),z:Math.sin(angle)},slope=Math.tan(-angle),height=z=>100+slope*z+bump*Math.sin(z*1.8);
 p.waterHeight=()=>null;p.roadsideSafety.zones=[];
 let floor;
 if(bump){const vertices=[],indices=[];for(let i=0;i<=4000;i++){const z=10-i*.25;vertices.push(-200,height(z),z,200,height(z),z);if(i<4000){const a=i*2;indices.push(a,a+2,a+1,a+1,a+2,a+3)}}floor=RAPIER.ColliderDesc.trimesh(new Float32Array(vertices),new Uint32Array(indices));}
 else floor=RAPIER.ColliderDesc.cuboid(500,.1,1500).setRotation(q).setTranslation(-20,100-.1*n.y,-.1*n.z);
 const ground=p.world.createCollider(floor);p.obstacles={has:c=>c?.handle===ground.handle,kind:()=> 'rock'};
 p.reset(-20,0,100);p.rb.setRotation(q,true);for(let i=0;i<3/dt;i++)p.step(dt,{brake:true});
 const start=p.position(),f=p.forward(),settledHeight=(start.y-height(start.z))*n.y;
 p.rb.setLinvel({x:f.x*speed,y:f.y*speed,z:f.z*speed},true);for(const w of p.tyres)w.omega=speed/VEHICLE_SETUP.rollingRadius;
 let minUp=1,lift=0,stop=null,largestBrake=0;
 for(let i=0;i<seconds/dt;i++){
  p.step(dt,{[mode]:pedal,turn});const at=p.position(),rot=p.rb.rotation(),upY=1-2*(rot.x**2+rot.z**2),upZ=2*(rot.y*rot.z+rot.w*rot.x);
  minUp=Math.min(minUp,upY*n.y+upZ*n.z);lift=Math.max(lift,(at.y-height(at.z))*n.y-settledHeight);
  largestBrake=Math.max(largestBrake,...[0,1,2,3].map(w=>p.vehicle.wheelBrake(w)/dt));
  if(stop===null&&Math.abs(p.speed)<Math.max(.15,dt*15))stop={seconds:(i+1)*dt,distance:Math.hypot(at.x-start.x,at.y-start.y,at.z-start.z)};
 }
 const result={degrees,bump,speed,mode,pedal,dt,turn,minUp,lift,stop,finalSpeed:p.speed,largestBrake};p.dispose();return result;
}
// The previous build rolled over and launched >4m on these modest corrugations
// when braking at 50 mph. At 0.3m corrugations, even coasting can launch a real
// rigid body: this fix must not lock chassis orientation or erase actual jumps.
for(const degrees of [25,35])for(const mode of ['brake','handbrake']){
 const r=await run({degrees,bump:.12,mode,seconds:8});console.log('Rough descent',r);
 assert(r.minUp>.90,'Braking on corrugations cannot pitch the roof through the ground');assert(r.lift<.5,'No multi-metre braking launch');
}
const level=[];
for(const dt of [1/60,1/120])for(const degrees of [0,15,25,35]){
 const r=await run({degrees,dt});console.log('Supported stop',r);
 assert(r.minUp>.98&&r.lift<.05,'Weight transfer remains physical and bounded on a smooth descent');
 assert(r.stop&&Math.abs(r.finalSpeed)<Math.max(.15,dt*15),'Service brake reaches near standstill, with slope creep bounded by the gravity integration step');
 assert(r.largestBrake<=VEHICLE_SETUP.massKg*9.81*.85*.325+.01,'Pressure is a force budget converted to impulse, independent of step frequency');
 if(degrees===0){level.push(r.stop.distance);assert(r.stop.distance>25&&r.stop.distance<40,'50 mph stopping distance is neither instantaneous nor ineffective');}
}
assert(Math.abs(level[0]-level[1])<1,'60 and 120 Hz produce consistent stop distance');
for(const turn of [-.25,.25]){const r=await run({degrees:20,speed:12,turn});console.log('Steered stop',r);assert(r.minUp>.94&&r.stop,'Braking while steering stays stable');}
const full=await run({speed:12}),partial=await run({speed:12,pedal:.35});assert(partial.stop.distance>full.stop.distance*1.5,'Feathering the brake lengthens stopping distance');
// Service braking returns no propulsion reaction, keeps bounded rolling tread,
// and stops airborne spin without manufacturing a chassis contact force.
for(const contact of [true,false]){
 const wheels=Array.from({length:4},()=>({omega:22/VEHICLE_SETUP.rollingRadius,angle:0}));let out;
 for(let i=0;i<240;i++)out=stepDriveline(wheels,wheels.map(()=>({roadSpeed:22,load:contact?6000:0,soft:0,depth:0,contact})),{dt:1/120,motor:0,brake:1,locked:true});
 assert(out.forces.every(f=>f===0));assert.equal(out.transfer,0);
 assert(contact?wheels.every(w=>Math.abs(w.omega*VEHICLE_SETUP.rollingRadius-22*.92)<.001):wheels.every(w=>Math.abs(w.omega)<.001));
}
console.log('Braking stability: rough downhill rollover regression, 50 mph stops, 60/120 Hz, grades, steering, analog braking and airborne/ABS wheel response passed.');
