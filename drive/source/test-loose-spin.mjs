import assert from 'node:assert/strict';
import {stepTyre,RANGES} from './drivetrain.mjs';
import {DrivePhysics,RAPIER} from './physics.mjs';
const dt=1/120;
function tyre({soft=0,grip=1,direction=1,range='HI',roadSpeed=0,throttle=.72}={}){
 const w={omega:roadSpeed/.45,angle:0};const options={dt,roadSpeed,driveForce:RANGES[range].force*direction,load:7500,soft,grip,depth:0,contact:true,brake:false,tractionControl:true,throttle};
 let turns=0;for(let n=0;n<600;n++){stepTyre(w,options);if(n>120)turns+=w.omega*dt/(2*Math.PI)}return {w,options,turns};
}
for(const range of ['HI','LO'])for(const direction of [1,-1]){
 const dry=tyre({range,direction}),sand=tyre({range,direction,soft:.9}),mud=tyre({range,direction,soft:.6,grip:.7}),wet=tyre({range,direction,grip:.82});
 for(const [name,result] of [['sand',sand],['mud',mud],['wet stone',wet]]){
  assert.equal(Math.sign(result.w.omega),direction,`${name} wheel follows torque direction`);
  assert(Math.abs(result.turns)>Math.abs(dry.turns)*1.17,`${name} visibly slips more than dry contact`);
  const cap=7500*(1.12-.4*result.options.soft)*result.options.grip;assert(Math.abs(result.w.force)<=cap+.01,'Wheelspin does not create traction beyond the contact grip');
  for(let i=0;i<300;i++)stepTyre(result.w,{...result.options,driveForce:0,throttle:0});assert(Math.abs(result.w.omega)<.02,'Lifting the pedal stops powered stationary spin');
 }
 assert.equal(tyre({range,direction}).w.omega,tyre({range,direction,throttle:0}).w.omega,'Dry road does not get an artificial wheelspin floor');
 console.log({range,direction,sandTurns:sand.turns,mudTurns:mud.turns,wetTurns:wet.turns,dryTurns:dry.turns});
}
// Actual level-ground physics, not just the uphill helper: a blocked truck must
// continue turning its tyres and making contact marks while the pedal is held.
for(const range of ['HI','LO'])for(const reverse of [false,true]){
 const p=await DrivePhysics.create();p.world.createCollider(RAPIER.ColliderDesc.cuboid(50,.1,50).setTranslation(100,-.1,300));p.reset(100,300,0);p.setRange(range);
 for(let i=0;i<240;i++)p.step(dt,{brake:true});p.rb.setEnabledTranslations(false,false,false,true);p.rb.setEnabledRotations(false,false,false,true);
 for(let i=0;i<600;i++)p.step(dt,reverse?{reverse:true}:{gas:true});
 const rpm=p.tyres.reduce((n,w)=>n+Math.abs(w.omega)*60/(Math.PI*2),0)/4;assert(rpm>18,'Level loose ground sustains visible wheelspin');
 assert(p.marks.length>20,'Loose wheelspin emits surface marks at zero chassis speed');assert(p.tyres.every(w=>Math.sign(w.omega)===(reverse?-1:1)),'Physical tyre rotation follows reverse/forward');
 for(let i=0;i<240;i++)p.step(dt,{brake:true});assert(p.tyres.every(w=>Math.abs(w.omega)<.1),'Braking stops wheelspin');p.dispose();console.log({range,reverse,rpm});
}
console.log('Loose/wet wheelspin: level ground, both ranges, forward/reverse, lift/brake and traction limits passed.');
