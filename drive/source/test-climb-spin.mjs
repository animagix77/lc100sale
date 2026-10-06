import assert from 'node:assert/strict';
import {stepTyre,RANGES} from './drivetrain.mjs';
import {DrivePhysics,RAPIER} from './physics.mjs';
const dt=1/120;
function tyre(range,throttle,soft=.95){const w={omega:0,angle:0};let min=Infinity,travel=0;
 const options={dt,roadSpeed:0,driveForce:RANGES[range].force,load:8000,soft,depth:0,contact:true,brake:false,tractionControl:true,throttle};
 for(let n=0;n<600;n++){stepTyre(w,options);if(n>120){min=Math.min(min,w.omega);travel+=w.omega*dt;}}
 return {w,min,travel,options};}
for(const range of ['HI','LO']){
 const base=tyre(range,0),spin=tyre(range,1);console.log('Loaded sand tire',range,{baselineRPM:base.w.omega*60/(2*Math.PI),climbRPM:spin.w.omega*60/(2*Math.PI)});
 assert(spin.min>3,'Sustained throttle keeps a loaded sand tire visibly rotating');assert(spin.travel>base.travel*1.6,'Uphill sand shears more than ordinary rolling');
 assert(spin.w.force<=base.w.force+10,'Wheelspin does not invent ground traction');
 for(let n=0;n<240;n++)stepTyre(spin.w,{...spin.options,driveForce:0,throttle:0});assert(Math.abs(spin.w.omega)<.01,'Lifting stops the wheelspin');
 const hard=tyre(range,1,0),hardBase=tyre(range,0,0);assert.equal(hard.w.omega,hardBase.w.omega,'No forced sand wheelspin on solid terrain');
}
// A restrained chassis on a loaded ramp models a climb with no forward progress.
// Wheel contact, driveline, physical wheel angle and sand marks still run normally.
for(const range of ['HI','LO'])for(const locked of [false,true]){
 const p=await DrivePhysics.create(),a=.34;p.world.createCollider(RAPIER.ColliderDesc.cuboid(100,.1,100).setTranslation(100,0,0).setRotation({x:Math.sin(a/2),y:0,z:0,w:Math.cos(a/2)}));p.reset(100,0,0);p.rb.setRotation({x:Math.sin(a/2),y:0,z:0,w:Math.cos(a/2)},true);
 assert(p.setRange(range));assert(p.setCenterLock(locked));for(let i=0;i<240;i++)p.step(dt,{brake:true});p.rb.setEnabledTranslations(false,false,false,true);p.rb.setEnabledRotations(false,false,false,true);
 let min=Infinity;for(let i=0;i<720;i++){p.step(dt,{gas:true});if(i>240)min=Math.min(min,p.tyres.reduce((s,w)=>s+Math.abs(w.omega),0)/4);}
 console.log('Restrained uphill spin',{range,locked,rpm:min*60/(Math.PI*2),marks:p.marks.length});assert(min>2.5,'Holding gas sustains wheelspin at zero uphill progress');assert(p.marks.length>20,'Wheelspin continues generating surface-effect marks');
 for(let i=0;i<240;i++)p.step(dt,{brake:true});assert(p.tyres.every(w=>Math.abs(w.omega)<.1),'Brake stops wheel rotation');p.dispose();
}
console.log('Uphill throttle, visible sustained spin, lift/brake, solid ground and both locked/unlocked ranges passed.');
