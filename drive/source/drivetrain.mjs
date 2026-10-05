import {clamp,smooth} from './terrain.mjs';
export const RANGES={HI:{name:'4HI',maxSpeed:8,cruise:3.55,force:2550,reverse:2.2},LO:{name:'4LO',maxSpeed:3.15,cruise:1.45,force:4900,reverse:1.15}};
// Angular tyre dynamics: motor torque accelerates the wheel; ground reaction consumes torque.
// An implicit contact spring avoids oscillation at the 120 Hz physics step.
export function stepTyre(w,{dt,roadSpeed,driveForce,load,soft,depth,contact,brake}){
 const radius=.45,inertia=18,sink=smooth(.12,.53,depth),mu=(1.05-.57*soft)*(1-.72*sink),cap=contact?Math.max(0,load)*mu:0;
 const stiffness=8500-5000*soft,torque=driveForce*radius;
 let force=contact?clamp(stiffness*(w.omega*radius+dt*torque*radius/inertia-roadSpeed)/(1+stiffness*dt*radius*radius/inertia),-cap,cap):0;
 w.omega+=(torque-force*radius-w.omega*.7)/inertia*dt;
 if(brake)w.omega*=Math.exp(-dt*24);
 w.omega=clamp(w.omega,-45,45);w.angle=(w.angle+w.omega*dt)%(Math.PI*2);
 w.slip=contact?Math.abs(w.omega*radius-roadSpeed):Math.abs(w.omega*radius);
 w.depth=depth;w.soft=soft;w.force=force;w.sink=sink;w.contact=contact;
 return force;
}
