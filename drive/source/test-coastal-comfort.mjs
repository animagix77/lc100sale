// Judge Dean LLC — scenic sand must remain comfortable at normal driving speeds.
import assert from 'node:assert/strict';
import * as THREE from 'three/webgpu';
import {DrivePhysics} from './physics.mjs';
import {SandField,clamp} from './terrain.mjs';
import {TerrainView} from './terrain-view.mjs';
import {COASTAL_LANDMARKS} from './coastal-islands.mjs';
import {oceanHeight} from './ocean-height.mjs';
import {VEHICLE_SETUP} from './vehicle-spec.mjs';

const dt=1/120;
function leg(index){const a=COASTAL_LANDMARKS[index-1],b=COASTAL_LANDMARKS[index],length=Math.hypot(b.x-a.x,b.z-a.z);return {a,b,length,dx:(b.x-a.x)/length,dz:(b.z-a.z)/length};}
const sampleField=new SandField();let maxGrade=0,minDryClearance=Infinity;
// Include the entire formerly omitted mainland approach, transition and both
// wheel paths, not just the already-flat offshore causeways.
for(let index=1;index<=3;index++){
 const {a,length,dx,dz}=leg(index);
 for(let along=0;along<length;along+=.25)for(const offset of [-3.4,-.962,0,.962,3.4]){
  const x=a.x+dx*along+dz*offset,z=a.z+dz*along-dx*offset,h=sampleField.height(x,z);
  maxGrade=Math.max(maxGrade,Math.abs(sampleField.height(x+dx*.25,z+dz*.25)-h)/.25);
  for(const time of [0,3,7,13,23])minDryClearance=Math.min(minDryClearance,h-oceanHeight(x,z,time));
 }
}
assert(maxGrade<.12,'Every approach wheel line has a gentle grade, without the former 30–44% dune ramps');
assert(minDryClearance>.25,'The approach no longer dips into invisible water drag');

async function fixture(){
 const field=new SandField(),physics=await DrivePhysics.create(field),view=new TerrainView(new THREE.Scene(),physics,field);
 // Distant rendering is irrelevant to wheel contact; retain all real near
 // terrain vertices, streamed colliders and mutable tyre deformation.
 const geometry=view.geometry.bind(view);view.geometry=(...args)=>args[4]?new THREE.PlaneGeometry(1,1):geometry(...args);
 let resets=0,interventions=0,stepIndex=0;
 const reset=physics.reset.bind(physics),constrain=physics.roadsideSafety.constrain.bind(physics.roadsideSafety);
 physics.reset=(...args)=>{resets++;return reset(...args)};
 physics.roadsideSafety.constrain=(...args)=>{const result=constrain(...args);if(result)interventions++;return result};
 function step(input){const at=physics.position();view.update(at.x,at.z);if(stepIndex++%16===0)view.refresh();physics.step(dt,input);if(physics.roadsideSafety.active)interventions++;physics.marks.length=0;physics.soundEvents.length=0;}
 function spawn(segment,along){
  const x=segment.a.x+segment.dx*along,z=segment.a.z+segment.dz*along,yaw=Math.atan2(-segment.dx,-segment.dz);
  view.update(x,z);physics.reset(x,z,field.height(x,z));physics.rb.setRotation({x:0,y:Math.sin(yaw/2),z:0,w:Math.cos(yaw/2)},true);
  physics.setRange('HI');physics.setCenterLock(false);for(let i=0;i<240;i++)step({brake:true});
  return {resets,interventions,clearance:physics.position().y-field.height(x,z)};
 }
 function measure(segment,state){const at=physics.position(),q=physics.rb.rotation();state.minUp=Math.min(state.minUp,1-2*(q.x*q.x+q.z*q.z));state.maxLift=Math.max(state.maxLift,at.y-field.height(at.x,at.z)-state.clearance);state.maxSpeed=Math.max(state.maxSpeed,physics.speed);state.crossTrack=Math.max(state.crossTrack,Math.abs((at.x-segment.a.x)*segment.dz-(at.z-segment.a.z)*segment.dx));return (at.x-segment.a.x)*segment.dx+(at.z-segment.a.z)*segment.dz;}
 function steering(segment){const f=physics.forward(),desired=Math.atan2(-segment.dx,-segment.dz),actual=Math.atan2(-f.x,-f.z),at=physics.position(),cross=(at.x-segment.a.x)*segment.dz-(at.z-segment.a.z)*segment.dx;return clamp(Math.atan2(Math.sin(desired-actual),Math.cos(desired-actual))*3-cross*.30,-1,1);}
 function verify(state){assert.equal(resets,state.resets,'No recovery/reset may conceal a failed drive');assert.equal(interventions,state.interventions,'No roadside safety reposition may conceal unstable physics');assert(state.minUp>.94,'A normal beach drive stays upright');assert(state.maxLift<.40,'Sand contact does not launch the chassis');assert(state.crossTrack<2,'The truck follows its compacted lane');}
 return {field,physics,view,step,spawn,measure,steering,verify,dispose(){view.dispose();physics.dispose();}};
}

const driving=[];
for(const index of [1,2,3,4]){
 const test=await fixture(),segment=leg(index);
 try{
  // Keep the actual first-pass deformation for the second pass. A fresh
  // respawn only starts a separate measurement; it cannot rescue either run.
  for(const speed of [6,8]){
   const state={...test.spawn(segment,5),minUp:1,maxLift:0,maxSpeed:0,crossTrack:0},startStamps=test.field.stamps;
   let progress=5,seconds=0,fastTime=0;
   while(progress<segment.length-7&&seconds<40){
    test.step({gas:test.physics.speed<speed,turn:test.steering(segment)});
    progress=test.measure(segment,state);seconds+=dt;if(test.physics.speed>speed-.8)fastTime+=dt;
   }
   const result={index,targetSpeed:speed,seconds,fastTime,...state,rutDepth:test.field.deepest};driving.push(result);console.log('Coastal comfort drive',result);
   assert(progress>=segment.length-7,'Scenic lane must finish without crawling or stalling');
   assert(fastTime>seconds*.40,'The test actually drives at 6–8m/s, rather than passing only at a crawl');
   assert(test.field.stamps>startStamps,'Real tyre contacts deform the sand during both passes');
   test.verify(state);
  }
 }finally{test.dispose();}
}

const braking=[];
for(const speed of [8,12]){
 const test=await fixture(),segment=leg(3);
 try{
  const state={...test.spawn(segment,24),minUp:1,maxLift:0,maxSpeed:0,crossTrack:0},p=test.physics,f=p.forward();
  // Controlled entry velocity isolates S/joystick-back braking on the real
  // coastal slope. Both wheel and body speeds begin consistently.
  p.rb.setLinvel({x:f.x*speed,y:f.y*speed,z:f.z*speed},true);for(const tyre of p.tyres)tyre.omega=speed/VEHICLE_SETUP.rollingRadius;
  const start=p.position();let stopped=null,reversed=false;
  for(let i=0;i<1200;i++){
   test.step({reverse:1});test.measure(segment,state);
   if(stopped===null&&p.speed<.30)stopped={seconds:(i+1)*dt,distance:Math.hypot(p.position().x-start.x,p.position().z-start.z)};
   if(stopped&&p.speed<-.65){reversed=true;break;}
  }
  const result={speed,stopped,reversed,...state};braking.push(result);console.log('Coastal S braking',result);
  assert(stopped&&stopped.seconds<5,'S stops the truck on the coastal descent');
  assert(stopped.distance>speed*.25&&stopped.distance<speed*2.3,'S applies a physical, bounded stopping distance');
  assert(reversed,'Holding S transitions from braking to reverse without a launch or reset');test.verify(state);
 }finally{test.dispose();}
}
console.log({maxGrade,minDryClearance,driveCases:driving.length,brakingCases:braking.length});
console.log('Coastal comfort: complete mainland approach, dry wheels, 6–8m/s unlocked 4HI, retained ruts and S braking passed.');
