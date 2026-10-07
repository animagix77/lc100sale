import {clamp,smooth} from './terrain.mjs';
export const RANGES={HI:{name:'4HI',maxSpeed:22.352,cruise:3.55,force:2550,reverse:2.4},LO:{name:'4LO',maxSpeed:3.15,cruise:1.45,force:4900,reverse:1.7}};
// Angular tyre dynamics: motor torque accelerates the wheel; ground reaction consumes torque.
// An implicit contact spring avoids oscillation at the 120 Hz physics step.
function tyreResponse(w,{dt,roadSpeed,driveForce,load,soft,depth,contact,brake,handbrake=false,tractionControl=false,throttle=0,grip=1}){
 const radius=.45,inertia=18,sink=smooth(.24,.78,depth),mu=(1.12-.40*soft)*(1-.50*sink)*grip,cap=contact?Math.max(0,load)*mu:0;
 // Loose soil and wet low-grip contacts shear under throttle in either direction.
 // Rotation follows applied torque and contact resistance, not chassis speed.
 const loose=clamp(soft+Math.max(0,1-grip)*1.6,0,1);
 const shear=loose*clamp(throttle,0,1)*(1-smooth(.5,3.5,Math.abs(roadSpeed)));
 const stiffness=(8500-5000*soft)*(1-.82*shear),torque=driveForce*radius;
 const force=contact?clamp(stiffness*(w.omega*radius+dt*torque*radius/inertia-roadSpeed)/(1+stiffness*dt*radius*radius/inertia),-cap,cap):0;
 let omega=w.omega+(torque-force*radius-w.omega*.7)/inertia*dt;
 // Brake-based spin assistance, not an axle locker. A bounded brake reaction
 // restrains excess slip so an unloaded wheel does not consume all engine RPM.
 // It cannot create road force at a wheel with no contact.
 if(tractionControl){const relative=omega-roadSpeed/radius,excess=Math.max(0,Math.abs(relative)-(3.5+4*shear));omega-=Math.sign(relative)*Math.min(excess*(1-Math.exp(-dt*14)),1050/inertia*dt);}
 if(brake)omega*=Math.exp(-dt*24*clamp(Number(brake),0,1));
 // Rapier supplies the rear parking-brake impulse; do not add an engine
 // reaction at a locked tyre or let its visible tread keep rolling.
 if(handbrake)return {force:0,omega:0,sink};
 return {force,omega:clamp(omega,-70,70),sink};
}
export function stepTyre(w,options){
 const {force,omega,sink}=tyreResponse(w,options),{dt,roadSpeed,depth,soft,contact}=options;
 w.omega=omega;w.angle=(w.angle+w.omega*dt)%(Math.PI*2);
 w.slip=contact?Math.abs(w.omega*.45-roadSpeed):Math.abs(w.omega*.45);
 Object.assign(w,{depth,soft,force,sink,contact});return force;
}
// Equal torque at each open axle. Locking the center constrains the *mean*
// front/rear wheel speeds, never left/right. An implicit, bounded reaction
// transfers torque between axles without adding engine torque or tire grip.
export function stepDriveline(wheels,contacts,{dt,motor,locked,brake=false,handbrake=false}){
 const sample=(i,transfer)=>({dt,...contacts[i],driveForce:(handbrake?0:motor)+(i<2?-transfer:transfer),brake,handbrake:handbrake&&i>=2});
 let transfer=0;
 // The parking brake acts downstream of the torque solver. Free front tyres
 // must retain rolling rotation while the rear tyres slide.
 if(locked&&!handbrake){
  const difference=t=>wheels.reduce((sum,w,i)=>sum+(i<2?1:-1)*tyreResponse(w,sample(i,t)).omega,0);
  let low=-24000,high=24000;
  if(difference(low)<=0)transfer=low;
  else if(difference(high)>=0)transfer=high;
  else {for(let n=0;n<20;n++){const mid=(low+high)/2;if(difference(mid)>0)low=mid;else high=mid}transfer=(low+high)/2;}
 }
 const forces=wheels.map((w,i)=>stepTyre(w,sample(i,transfer)));
 return {forces,transfer,axleSlip:(wheels[0].omega+wheels[1].omega-wheels[2].omega-wheels[3].omega)/2};
}
