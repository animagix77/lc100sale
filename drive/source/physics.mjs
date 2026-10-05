import RAPIER from '@dimforge/rapier3d-compat';
import {clamp,smooth,shore} from './terrain.mjs';
export {RAPIER};
export const wheelLayout=[{name:'FL',x:-.93,z:-1.42,front:true},{name:'FR',x:.93,z:-1.42,front:true},{name:'RL',x:-.93,z:1.43,front:false},{name:'RR',x:.93,z:1.43,front:false}];
export class DrivePhysics{
 static async create(){await RAPIER.init();return new DrivePhysics()}
 constructor(){this.world=new RAPIER.World({x:0,y:-9.81,z:0});this.world.timestep=1/120;this.world.numSolverIterations=8;this.rb=this.world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(0,3,0).setLinearDamping(.08).setAngularDamping(.7).setCanSleep(false).setCcdEnabled(true));this.chassis=this.world.createCollider(RAPIER.ColliderDesc.cuboid(.85,.47,2.12).setTranslation(0,.32,0).setMass(2450).setFriction(.55),this.rb);this.vehicle=this.world.createVehicleController(this.rb);this.vehicle.indexUpAxis=1;this.vehicle.setIndexForwardAxis=2;this.steer=0;this.speed=0;this.travel=0;this.time=0;this.origin={x:0,z:0};
 for(let i=0;i<4;i++){const w=wheelLayout[i];this.vehicle.addWheel({x:w.x,y:.06,z:w.z},{x:0,y:-1,z:0},{x:-1,y:0,z:0},.38,.45);this.vehicle.setWheelSuspensionStiffness(i,26);this.vehicle.setWheelSuspensionCompression(i,4.4);this.vehicle.setWheelSuspensionRelaxation(i,5.2);this.vehicle.setWheelMaxSuspensionTravel(i,.23);this.vehicle.setWheelMaxSuspensionForce(i,26000);this.vehicle.setWheelFrictionSlip(i,1.75);this.vehicle.setWheelSideFrictionStiffness(i,.85)}
 }
 reset(x,z,height){this.rb.setTranslation({x:x-this.origin.x,y:height+.96,z:z-this.origin.z},true);this.rb.setRotation({x:0,y:0,z:0,w:1},true);this.rb.setLinvel({x:0,y:0,z:0},true);this.rb.setAngvel({x:0,y:0,z:0},true);this.rb.resetForces(true);this.rb.resetTorques(true);this.speed=this.steer=0}
 position(){const p=this.rb.translation();return {x:p.x+this.origin.x,y:p.y,z:p.z+this.origin.z}}
 forward(){const q=this.rb.rotation();return {x:-2*(q.x*q.z+q.w*q.y),y:-2*(q.y*q.z-q.w*q.x),z:-(1-2*(q.x*q.x+q.y*q.y))}}
 step(dt,input){this.world.timestep=dt;this.time+=dt;const p=this.position(),v=this.rb.linvel(),f=this.forward();this.speed=v.x*f.x+v.y*f.y+v.z*f.z;this.travel+=Math.hypot(v.x,v.z)*dt;const soft=smooth(15,60,p.x-shore(p.z));const targetSteer=input.turn*.48/(1+Math.abs(this.speed)*.045);this.steer+=(targetSteer-this.steer)*(1-Math.exp(-3.8*dt));let engine=0,brake=input.brake?85:0;
 // Engine torque is shared by four contact patches. Above 18 mph the governor eases torque.
 if(input.gas)engine=(2400-650*smooth(0,3,this.speed))*clamp((8.0-this.speed)/2.4,0,1);
 else if(input.cruise)engine=clamp((3.55-this.speed)*1400,-450,2800);
 if(input.reverse){if(this.speed>.3)brake=65;else engine=-1050*clamp((2.2+this.speed)/1,0,1)}
 const rolling=(Math.abs(this.speed)>.08?(.6+soft*1.8):.5);if(!input.gas&&!input.reverse&&!input.cruise)brake=Math.max(brake,rolling);if(input.cruise&&this.speed>3.9)brake=Math.max(brake,12);
 for(let i=0;i<4;i++){this.vehicle.setWheelEngineForce(i,-engine);this.vehicle.setWheelBrake(i,brake);this.vehicle.setWheelSteering(i,i<2?this.steer:0);this.vehicle.setWheelFrictionSlip(i,1.9-soft*.6);this.vehicle.setWheelSideFrictionStiffness(i,.92-soft*.22)}
 this.rb.resetForces(false);const drag=(115+soft*220)+Math.abs(this.speed)*14;this.rb.addForce({x:-v.x*drag,y:0,z:-v.z*drag},true);
 // Water resistance is gradual. No invisible wall at the shoreline.
 const depth=Math.max(0,-p.y+.48);if(depth>0){this.rb.addForce({x:-v.x*depth*4200,y:Math.min(24000,depth*30000),z:-v.z*depth*4200},true)}
 this.vehicle.updateVehicle(dt,RAPIER.QueryFilterFlags.EXCLUDE_DYNAMIC);this.world.step();
 }
 rebase(x,z){const p=this.rb.translation();this.rb.setTranslation({x:p.x-x,y:p.y,z:p.z-z},true);this.origin.x+=x;this.origin.z+=z}
 dispose(){this.world.free()}
}
