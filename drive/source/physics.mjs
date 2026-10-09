import {RoadsideSafety} from './roadside-safety.mjs';
import {waterSurfaceHeight} from './ocean-height.mjs';
import {ContactFeedback} from './contact-feedback.mjs';
import RAPIER from '@dimforge/rapier3d-compat';
import {clamp,smooth,softnessAt,surfaceAt} from './terrain.mjs';
import {RANGES,stepDriveline} from './drivetrain.mjs';
export {RAPIER};
// Keyboard buttons remain full travel; touch pedals supply bounded analog values.
export function pedalAmount(value){return value===true?1:typeof value==='number'&&Number.isFinite(value)?clamp(value,0,1):0;}
export const wheelLayout=[{name:'FL',x:-.962,z:-1.42,front:true},{name:'FR',x:.962,z:-1.42,front:true},{name:'RL',x:-.962,z:1.43,front:false},{name:'RR',x:.962,z:1.43,front:false}];
export class DrivePhysics{
 static async create(sand=null){await RAPIER.init();return new DrivePhysics(sand)}
 constructor(sand=null){this.roadsideSafety=new RoadsideSafety();this.feedback=new ContactFeedback();this.soundEvents=[];this.world=new RAPIER.World({x:0,y:-9.81,z:0});this.world.timestep=1/120;this.world.numSolverIterations=8;this.rb=this.world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(0,3,0).setLinearDamping(.08).setAngularDamping(.7).setCanSleep(false).setCcdEnabled(true));this.chassis=this.world.createCollider(RAPIER.ColliderDesc.cuboid(.85,.47,2.12).setTranslation(0,.32,0).setMass(2450).setFriction(.55),this.rb);this.vehicle=this.world.createVehicleController(this.rb);this.vehicle.indexUpAxis=1;this.vehicle.setIndexForwardAxis=2;this.steer=0;this.handbrakeSlip=0;this.speed=0;this.travel=0;this.time=0;this.origin={x:0,z:0};this.sand=sand;this.waterHeight=waterSurfaceHeight;this.controls={};this.lighting={braking:false,reversing:false};this.range='HI';this.centerLocked=false;this.centerTransfer=0;this.axleSlip=0;this.tyres=wheelLayout.map(()=>({omega:0,angle:0,slip:0,depth:0,soft:0,force:0,travel:0,contact:false}));this.marks=[];this.stuckTime=0;this.stuck=false;
 for(let i=0;i<4;i++){const w=wheelLayout[i];this.vehicle.addWheel({x:w.x,y:.06,z:w.z},{x:0,y:-1,z:0},{x:-1,y:0,z:0},.50,.45);this.vehicle.setWheelSuspensionStiffness(i,21);this.vehicle.setWheelSuspensionCompression(i,2.6);this.vehicle.setWheelSuspensionRelaxation(i,3.5);this.vehicle.setWheelMaxSuspensionTravel(i,.36);this.vehicle.setWheelMaxSuspensionForce(i,26000);this.vehicle.setWheelFrictionSlip(i,1.75);this.vehicle.setWheelSideFrictionStiffness(i,.85)}
 }
 reset(x,z,height){this.roadsideSafety.reset();this.feedback.reset(this.time);this.soundEvents=[];this.rb.setTranslation({x:x-this.origin.x,y:height+1.04,z:z-this.origin.z},true);this.rb.setRotation({x:0,y:0,z:0,w:1},true);this.rb.setLinvel({x:0,y:0,z:0},true);this.rb.setAngvel({x:0,y:0,z:0},true);this.rb.resetForces(true);this.rb.resetTorques(true);this.controls={};this.lighting={braking:false,reversing:false};this.speed=this.steer=this.handbrakeSlip=0;this.stuckTime=0;this.stuck=false;this.marks=[];if(this.loosePebbles)this.loosePebbles.snapTyres=true;for(const w of this.tyres)Object.assign(w,{omega:0,angle:0,slip:0,travel:0,depth:0,soft:0,force:0,contact:false})}
 setRange(range,input=this.controls){if(!RANGES[range]||input.gas||input.reverse||input.cruise)return false;this.range=range;return true}
 setCenterLock(locked,input=this.controls){if(input.gas||input.reverse||input.cruise)return false;this.centerLocked=!!locked;return true}
 position(){const p=this.rb.translation();return {x:p.x+this.origin.x,y:p.y,z:p.z+this.origin.z}}
 forward(){const q=this.rb.rotation();return {x:-2*(q.x*q.z+q.w*q.y),y:-2*(q.y*q.z-q.w*q.x),z:-(1-2*(q.x*q.x+q.y*q.y))}}
 step(dt,input){
 input=this.roadsideSafety.filter(input,this.position(),this.rb.linvel(),this.forward());
 this.controls={gas:pedalAmount(input.gas),reverse:pedalAmount(input.reverse),cruise:!!input.cruise,handbrake:!!input.handbrake};this.recovery?.step(dt);if(this.recovery?.state==='deploying')input={brake:true,turn:0};this.world.timestep=dt;this.time+=dt;const p=this.position(),v=this.rb.linvel(),f=this.forward(),gear=RANGES[this.range];this.speed=v.x*f.x+v.y*f.y+v.z*f.z;this.travel+=Math.hypot(v.x,v.z)*dt;
 const soft=softnessAt(p.x,p.z),targetSteer=(input.turn||0)*.48/(1+Math.abs(this.speed)*.045);this.steer+=(targetSteer-this.steer)*(1-Math.exp(-3.8*dt));
 const gas=pedalAmount(input.gas),reverse=pedalAmount(input.reverse),handbrake=!!input.handbrake;
 // Locked rear tyres give up lateral grip while the fronts still steer. Ramp
 // the contact grip back in after release; no artificial yaw or chassis pose.
 const cornering=Math.max(smooth(.035,.16,Math.abs(this.steer)),smooth(.3,1.6,Math.abs(v.x*-f.z+v.z*f.x)));
 const slideTarget=handbrake?smooth(.5,2.5,Math.abs(this.speed))*(.4+.6*cornering):0;
 this.handbrakeSlip+=(slideTarget-this.handbrakeSlip)*(1-Math.exp(-dt*(handbrake?9:3.6)));
 const serviceBrake=Math.max(pedalAmount(input.brake),reverse&&this.speed>.3?reverse:0),braking=serviceBrake>0;
 let brake=serviceBrake*85,drive=0;
 if(gas&&!braking&&!handbrake)drive=gear.force*gas;
 else if(input.cruise&&!braking&&!handbrake)drive=clamp((gear.cruise-this.speed)*(this.range==='LO'?2300:1400),-450,gear.force);
 if(reverse&&!braking&&!handbrake)drive=-gear.force*.95*reverse;
 if(!drive&&!braking)brake=.65+soft*1.6;if(input.cruise&&!handbrake&&this.speed>gear.cruise+.35)brake=Math.max(brake,12);
 this.lighting={braking:serviceBrake>0||brake>=12,reversing:reverse>0&&!braking&&!handbrake};
 let totalDepth=0,totalSlip=0;
 const manualThrottle=!braking&&!handbrake?(reverse||gas):0;
 const climbingThrottle=manualThrottle*smooth(.10,.30,f.y*(input.reverse?-1:1));
 const soilThrottle=manualThrottle*(.72+.28*climbingThrottle);
 const omega=this.rb.angvel(),rotation=this.rb.rotation();
 const right={x:1-2*(rotation.y**2+rotation.z**2),y:2*(rotation.x*rotation.y+rotation.w*rotation.z),z:2*(rotation.x*rotation.z-rotation.w*rotation.y)};
 const contacts=this.tyres.map((w,i)=>{
  const contact=!!this.vehicle.wheelIsInContact(i),c=this.vehicle.wheelContactPoint(i),x=c?c.x+this.origin.x:p.x,z=c?c.z+this.origin.z:p.z;
  const onBoard=this.recovery?.supports(x,z,c?.y),onSolid=this.obstacles?.has(this.vehicle.wheelGroundObject(i));
  const contactSurface=surfaceAt(x,z),soil=onBoard||onSolid?0:contactSurface.soft,depth=onBoard||onSolid?0:this.sand?.depthAt(x,z)||0,load=contact?clamp(this.vehicle.wheelSuspensionForce(i)||6000,500,16000):0;
  // Wheel contact velocity includes chassis yaw/roll and front steering. Thus
  // unequal axle paths in a turn load the center lock through tire scrub.
  const steer=i<2?this.steer:0,cs=Math.cos(steer),sn=Math.sin(steer),direction={x:f.x*cs-right.x*sn,y:f.y*cs-right.y*sn,z:f.z*cs-right.z*sn};
  const dx=x-p.x,dy=c?c.y-p.y:0,dz=z-p.z;
  const roadSpeed=(v.x+omega.y*dz-omega.z*dy)*direction.x+(v.y+omega.z*dx-omega.x*dz)*direction.y+(v.z+omega.x*dy-omega.y*dx)*direction.z;
  const waterSurface=this.waterHeight(x,z,this.time);
  const wet=contact&&!!c&&Number.isFinite(waterSurface)&&waterSurface>c.y+.025;
  const grip=onBoard?1:onSolid?(wet?.82:1):contactSurface.grip*(wet?.88:1);
  return {heading:Math.atan2(-direction.x,-direction.z),roadSpeed,load,soft:soil,depth:Math.max(0,depth-contactSurface.snow*.34),contact,tractionControl:true,grip,throttle:soilThrottle};
 });
 // One engine governor sees the mean shaft speed. A freely spinning axle
 // consumes that speed budget; the center lock can transfer torque to grip.
 // Lower the old 25-mph high-speed drag envelope progressively above that
 // pace. Low-speed terrain drag and 4LO behavior stay unchanged.
 const drag=(115+soft*220)+Math.abs(this.speed)*(14-(this.range==='HI'?10*smooth(10,18,Math.abs(this.speed)):0));
 const wheelSpeed=this.tyres.reduce((sum,w)=>sum+w.omega*.45,0)/4,top=drive<0?gear.reverse:gear.maxSpeed;
 const loose=contacts.reduce((n,c)=>n+clamp(c.soft+Math.max(0,1-c.grip)*1.6,0,1),0)/4;
 const spinAllowance=soilThrottle*loose*2.2*(1-smooth(.5,3.5,Math.abs(this.speed)));
 let motor=drive*clamp((top+spinAllowance-Math.sign(drive)*wheelSpeed)/(this.range==='LO'?.9:2.4),0,1);
 if(drive>0&&this.range==='HI'&&!input.cruise){
  const resistance=(drag+2450*.08)*Math.max(0,this.speed)/4;
  motor=clamp(drive*(top-this.speed)/.6+resistance,0,drive)*clamp(top+1.5+spinAllowance-wheelSpeed,0,1);
 }
 const result=stepDriveline(this.tyres,contacts,{dt,motor,locked:this.centerLocked,brake:serviceBrake,handbrake});
 this.centerTransfer=result.transfer;this.axleSlip=result.axleSlip;
 for(let i=0;i<4;i++){
  const w=this.tyres[i],{soft:soil,depth}=contacts[i];
  this.vehicle.setWheelEngineForce(i,-result.forces[i]);this.vehicle.setWheelBrake(i,Math.max(brake,handbrake&&i>=2?85:0)+soil*w.sink*6.5);this.vehicle.setWheelSteering(i,i<2?this.steer:0);this.vehicle.setWheelFrictionSlip(i,(1.9-soil*.6)*contacts[i].grip*(i>=2?1-this.handbrakeSlip*.48:1));const normalSide=(.92-soil*.22)*contacts[i].grip;
  const lockedSide=.003+.005*clamp(contacts[i].grip-soil*.4,0,1);
  this.vehicle.setWheelSideFrictionStiffness(i,normalSide*(i>=2?1-this.handbrakeSlip*(1-lockedSide):1));
  totalDepth+=depth;totalSlip+=w.slip;
 }
 this.rb.resetForces(false);this.rb.resetTorques(false);this.rb.addForce({x:-v.x*drag,y:0,z:-v.z*drag},true);
 // Share the rendered waterline, including bounded local waves. A low dry
 // depression must never become an invisible body of water; full immersion
 // saturates displaced volume and drag instead of increasing without bound.
 const waterSurface=this.waterHeight(p.x,p.z,this.time),waterDepth=Number.isFinite(waterSurface)?clamp(waterSurface-p.y+.66,0,1.1):0;if(waterDepth>0)this.rb.addForce({x:-v.x*waterDepth*4200,y:Math.min(24000,waterDepth*30000),z:-v.z*waterDepth*4200},true);
 // Progressive bump stops transfer large wheel hits to the chassis at that corner.
 // Ordinary suspension stroke stays compliant; deep compression lifts and rotates
 // the actual rigid body rather than moving only the rendered wheel.
 this.bumpSupport=0;
 for(let i=0;i<4;i++){
  if(!this.vehicle.wheelIsInContact(i))continue;
  const point=this.vehicle.wheelContactPoint(i),length=this.vehicle.wheelSuspensionLength(i),compression=Math.max(0,.30-length);
  if(point&&compression>0){const support=Math.min(10000,compression*compression*280000);this.rb.addForceAtPoint({x:0,y:support,z:0},point,true);this.bumpSupport+=support;}
 }
 this.vehicle.updateVehicle(dt,RAPIER.QueryFilterFlags.EXCLUDE_DYNAMIC,undefined,c=>!this.loosePebbles?.handles.has(c.handle));this.loosePebbles?.beforeStep();this.world.step();
 const protectedMotion=this.roadsideSafety.constrain(p,this.position(),this.rb.linvel());
 if(protectedMotion){const a=protectedMotion.position;this.rb.setTranslation({x:a.x-this.origin.x,y:a.y,z:a.z-this.origin.z},true);this.rb.setLinvel(protectedMotion.velocity,true);this.lighting.braking=true;}
 const hits=[];this.world.contactPairsWith(this.chassis,other=>{if(!this.obstacles?.has(other))return;this.world.contactPair(this.chassis,other,m=>{let impulse=0;for(let i=0;i<m.numContacts();i++)impulse+=m.contactImpulse(i);const n=m.normal();hits.push({id:other.handle,kind:this.obstacles.kind?.(other)||'rock',impulse,closing:Math.abs(v.x*n.x+v.y*n.y+v.z*n.z),pan:n.x*right.x+n.z*right.z})})});
 const wheelSounds=wheelLayout.map((_,i)=>({contact:!!this.vehicle.wheelIsInContact(i),length:this.vehicle.wheelSuspensionLength(i),kind:this.obstacles?.kind?.(this.vehicle.wheelGroundObject(i))||'sand'}));
 this.soundEvents.push(...this.feedback.sample(this.time,dt,wheelSounds,this.speed,v.y,hits));if(this.soundEvents.length>8)this.soundEvents.splice(0,this.soundEvents.length-8);

 // Powder beneath the chassis yields under contact, unlike rocks or hard ground.
 if(this.sand?.compactSnow&&surfaceAt(p.x,p.z).snow>.15&&Math.round(this.time/dt)%12===0){
  for(const across of [-.65,0,.65])for(const along of [-1.65,-.8,0,.8,1.65]){
   const x=p.x+right.x*across+f.x*along,z=p.z+right.z*across+f.z*along,underside=p.y+right.y*across+f.y*along-.22;
   this.sand.compactSnow(x,z,underside);
  }
 }
 // Contact work is integrated in physics time, so digging does not depend on rendering FPS.
 for(let i=0;i<4;i++){
  const w=this.tyres[i],c=this.vehicle.wheelContactPoint(i);if(!c||!this.vehicle.wheelIsInContact(i))continue;
  const x=c.x+this.origin.x,z=c.z+this.origin.z,slipWork=Math.max(0,w.slip-.35);
  w.travel+=(Math.abs(this.speed)+slipWork*.8)*dt;
  if(w.travel>=.17){const travel=Math.min(w.travel,.34);w.travel-=travel;const load=clamp((this.vehicle.wheelSuspensionForce(i)||6000)/6000,.25,1.7);if(this.recovery?.supports(x,z,c.y)||this.obstacles?.has(this.vehicle.wheelGroundObject(i)))continue;this.sand?.stamp(x,z,load,travel,slipWork,contacts[i].heading);this.marks.push({x,z,wheel:i,slip:slipWork,soft:w.soft,load,dir:Math.sign(w.omega)||1});if(this.marks.length>256)this.marks.shift()}
 }
 const burying=Math.abs(this.speed)<.4&&totalSlip/4>.7&&totalDepth/4>.28&&!!drive;this.stuckTime=burying?this.stuckTime+dt:Math.max(0,this.stuckTime-dt*2);this.stuck=this.stuckTime>1.5;
 }

 rebase(x,z){const p=this.rb.translation();this.rb.setTranslation({x:p.x-x,y:p.y,z:p.z-z},true);this.origin.x+=x;this.origin.z+=z;this.loosePebbles?.rebase(x,z)}
 dispose(){this.world.free()}
}
