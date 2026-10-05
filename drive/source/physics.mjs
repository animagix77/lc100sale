import RAPIER from '@dimforge/rapier3d-compat';
import {clamp,smooth,shore,softnessAt} from './terrain.mjs';
import {RANGES,stepTyre} from './drivetrain.mjs';
export {RAPIER};
export const wheelLayout=[{name:'FL',x:-.962,z:-1.42,front:true},{name:'FR',x:.962,z:-1.42,front:true},{name:'RL',x:-.962,z:1.43,front:false},{name:'RR',x:.962,z:1.43,front:false}];
export class DrivePhysics{
 static async create(sand=null){await RAPIER.init();return new DrivePhysics(sand)}
 constructor(sand=null){this.world=new RAPIER.World({x:0,y:-9.81,z:0});this.world.timestep=1/120;this.world.numSolverIterations=8;this.rb=this.world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(0,3,0).setLinearDamping(.08).setAngularDamping(.7).setCanSleep(false).setCcdEnabled(true));this.chassis=this.world.createCollider(RAPIER.ColliderDesc.cuboid(.85,.47,2.12).setTranslation(0,.32,0).setMass(2450).setFriction(.55),this.rb);this.vehicle=this.world.createVehicleController(this.rb);this.vehicle.indexUpAxis=1;this.vehicle.setIndexForwardAxis=2;this.steer=0;this.speed=0;this.travel=0;this.time=0;this.origin={x:0,z:0};this.sand=sand;this.range='HI';this.tyres=wheelLayout.map(()=>({omega:0,angle:0,slip:0,depth:0,soft:0,force:0,travel:0,contact:false}));this.marks=[];this.stuckTime=0;this.stuck=false;
 for(let i=0;i<4;i++){const w=wheelLayout[i];this.vehicle.addWheel({x:w.x,y:.06,z:w.z},{x:0,y:-1,z:0},{x:-1,y:0,z:0},.46,.45);this.vehicle.setWheelSuspensionStiffness(i,24);this.vehicle.setWheelSuspensionCompression(i,3.8);this.vehicle.setWheelSuspensionRelaxation(i,4.8);this.vehicle.setWheelMaxSuspensionTravel(i,.30);this.vehicle.setWheelMaxSuspensionForce(i,26000);this.vehicle.setWheelFrictionSlip(i,1.75);this.vehicle.setWheelSideFrictionStiffness(i,.85)}
 }
 reset(x,z,height){this.rb.setTranslation({x:x-this.origin.x,y:height+1.04,z:z-this.origin.z},true);this.rb.setRotation({x:0,y:0,z:0,w:1},true);this.rb.setLinvel({x:0,y:0,z:0},true);this.rb.setAngvel({x:0,y:0,z:0},true);this.rb.resetForces(true);this.rb.resetTorques(true);this.speed=this.steer=0;this.stuckTime=0;this.stuck=false;this.marks=[];for(const w of this.tyres)Object.assign(w,{omega:0,angle:0,slip:0,travel:0,depth:0})}
 setRange(range){if(!RANGES[range]||Math.abs(this.speed)>.5)return false;this.range=range;return true}
 position(){const p=this.rb.translation();return {x:p.x+this.origin.x,y:p.y,z:p.z+this.origin.z}}
 forward(){const q=this.rb.rotation();return {x:-2*(q.x*q.z+q.w*q.y),y:-2*(q.y*q.z-q.w*q.x),z:-(1-2*(q.x*q.x+q.y*q.y))}}
 step(dt,input){
 this.recovery?.step(dt);if(this.recovery?.state==='deploying')input={brake:true,turn:0};this.world.timestep=dt;this.time+=dt;const p=this.position(),v=this.rb.linvel(),f=this.forward(),gear=RANGES[this.range];this.speed=v.x*f.x+v.y*f.y+v.z*f.z;this.travel+=Math.hypot(v.x,v.z)*dt;
 const soft=softnessAt(p.x,p.z),targetSteer=(input.turn||0)*.48/(1+Math.abs(this.speed)*.045);this.steer+=(targetSteer-this.steer)*(1-Math.exp(-3.8*dt));
 let braking=!!input.brake||(input.reverse&&this.speed>.3),brake=braking?85:0,drive=0;
 if(input.gas&&!braking)drive=gear.force;
 else if(input.cruise&&!braking)drive=clamp((gear.cruise-this.speed)*(this.range==='LO'?2300:1400),-450,gear.force);
 if(input.reverse&&!braking)drive=-gear.force*.95;
 if(!drive&&!braking)brake=.65+soft*1.6;if(input.cruise&&this.speed>gear.cruise+.35)brake=Math.max(brake,12);
 let totalDepth=0,totalSlip=0;
 for(let i=0;i<4;i++){
  const w=this.tyres[i],contact=!!this.vehicle.wheelIsInContact(i),c=this.vehicle.wheelContactPoint(i);const x=c?c.x+this.origin.x:p.x,z=c?c.z+this.origin.z:p.z;
  const onBoard=this.recovery?.supports(x,z,c?.y),soil=onBoard?0:softnessAt(x,z),depth=onBoard?0:this.sand?.depthAt(x,z)||0,load=contact?clamp(this.vehicle.wheelSuspensionForce(i)||6000,500,16000):0;
  const wheelSpeed=w.omega*.45,top=drive<0?gear.reverse:gear.maxSpeed;
  const motor=drive*clamp((top-Math.sign(drive)*wheelSpeed)/(this.range==='LO'?.9:2.4),0,1);
  const force=stepTyre(w,{dt,roadSpeed:this.speed,driveForce:motor,load,soft:soil,depth,contact,brake:braking});
  this.vehicle.setWheelEngineForce(i,-force);this.vehicle.setWheelBrake(i,brake+soil*w.sink*6.5);this.vehicle.setWheelSteering(i,i<2?this.steer:0);this.vehicle.setWheelFrictionSlip(i,1.9-soil*.6);this.vehicle.setWheelSideFrictionStiffness(i,.92-soil*.22);
  totalDepth+=depth;totalSlip+=w.slip;
 }
 this.rb.resetForces(false);const drag=(115+soft*220)+Math.abs(this.speed)*14;this.rb.addForce({x:-v.x*drag,y:0,z:-v.z*drag},true);
 const waterDepth=Math.max(0,-p.y+.48);if(waterDepth>0)this.rb.addForce({x:-v.x*waterDepth*4200,y:Math.min(24000,waterDepth*30000),z:-v.z*waterDepth*4200},true);
 this.vehicle.updateVehicle(dt,RAPIER.QueryFilterFlags.EXCLUDE_DYNAMIC);this.world.step();
 // Contact work is integrated in physics time, so digging does not depend on rendering FPS.
 for(let i=0;i<4;i++){
  const w=this.tyres[i],c=this.vehicle.wheelContactPoint(i);if(!c||!this.vehicle.wheelIsInContact(i))continue;
  const x=c.x+this.origin.x,z=c.z+this.origin.z,slipWork=Math.max(0,w.slip-.35);
  w.travel+=(Math.abs(this.speed)+slipWork*.8)*dt;
  if(w.travel>=.17){const travel=Math.min(w.travel,.34);w.travel-=travel;const load=clamp((this.vehicle.wheelSuspensionForce(i)||6000)/6000,.25,1.7);if(this.recovery?.supports(x,z,c.y))continue;this.sand?.stamp(x,z,load,travel,slipWork);this.marks.push({x,z,wheel:i,slip:slipWork,soft:w.soft,load,dir:Math.sign(w.omega)||1});if(this.marks.length>256)this.marks.shift()}
 }
 const burying=Math.abs(this.speed)<.4&&totalSlip/4>.7&&totalDepth/4>.28&&!!drive;this.stuckTime=burying?this.stuckTime+dt:Math.max(0,this.stuckTime-dt*2);this.stuck=this.stuckTime>1.5;
 }

 rebase(x,z){const p=this.rb.translation();this.rb.setTranslation({x:p.x-x,y:p.y,z:p.z-z},true);this.origin.x+=x;this.origin.z+=z}
 dispose(){this.world.free()}
}
