// Judge Dean LLC — specification-anchored automatic driveline, shared by physics and audio.
import {LC100,VEHICLE_SETUP} from './vehicle-spec.mjs';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const AUTO_RATIOS=LC100.ratios;
// Published torque/power peaks are anchors. Other samples, converter behavior,
// shift schedule and losses are approximations, not a factory dyno/ECU map.
const ratedTorque=LC100.powerW/(LC100.powerRpm*Math.PI/30);
const curve=[[700,235],[1400,350],[2400,415],[3400,LC100.torqueNm],[4400,380],[4800,ratedTorque],[5200,280]];
export function engineTorque(rpm){
 let torque=280;
 for(let i=1;i<curve.length;i++){
  const [r,t]=curve[i], [a,b]=curve[i-1];
  if(rpm<=r){torque=b+(t-b)*clamp((rpm-a)/(r-a),0,1);break;}
 }
 return Math.min(torque,LC100.powerW/(Math.max(700,rpm)*Math.PI/30));
}
export class Powertrain{
 constructor(){this.reset()}
 reset(){this.running=true;this.rpm=720;this.gear=1;this.shiftTime=0;this.hold=0;this.load=0;this.force=0;this.engineBrake=0;this.shifts=0;this.outputPower=0;this.converter=1;this.shiftDuration=0;this.shiftMix=0;this.shiftDirection=0;this.cruiseHold=0;}
 update(dt,{wheelSpeed=0,speed=0,throttle=0,range='HI',reverse=false,braking=false,speedLimited=false,resistanceForce=0,power=1}={}){
  throttle=clamp(throttle,0,1);power=clamp(power,0,1);this.running=power>0;
  const transfer=range==='LO'?LC100.lowRange:1;
  this.cruiseHold=speedLimited?2:Math.max(0,this.cruiseHold-dt);
  const governed=range==='HI'&&!reverse&&this.cruiseHold>0;
  this.hold=Math.max(0,this.hold-dt);this.shiftTime=Math.max(0,this.shiftTime-dt);
  // LO retains the game's first-gear crawl governor, not the real A750F's
  // complete low-range speed envelope. Reverse has its own mechanical ratio.
  if(range==='LO'||reverse)this.gear=1;
  const shaft=Math.abs(wheelSpeed)/VEHICLE_SETUP.rollingRadius*60/(2*Math.PI)*LC100.finalDrive*transfer;
  const coupled=shaft*AUTO_RATIOS[this.gear-1];
  const capacity=g=>engineTorque(Math.max(720,shaft*AUTO_RATIOS[g-1]))*AUTO_RATIOS[g-1]*LC100.finalDrive*transfer*.88/(4*VEHICLE_SETUP.rollingRadius);
  // At the game speed ceiling, relax the schedule only if the next gear
  // can carry road/grade resistance. Hysteresis prevents 4th/5th hunting.
  const canPullNext=this.gear<5&&(!governed||capacity(this.gear+1)>resistanceForce*1.15);
  if(range==='HI'&&!reverse&&!this.hold){
   const up=[0,5.2,9.2,14,19][this.gear]??Infinity;
   if(this.gear<5&&canPullNext&&Math.abs(speed)>up&&coupled>(governed?1900:3000+throttle*1700)){
    this.gear++;this.shiftTime=this.shiftDuration=.24;this.shiftDirection=1;this.hold=1.2;this.shifts++;
   }else if(this.gear>1&&(coupled<(governed?1100:1350+throttle*700)||(governed&&capacity(this.gear)<resistanceForce*.98))&&shaft*AUTO_RATIOS[this.gear-2]<4300){
    this.gear--;this.shiftTime=this.shiftDuration=.18;this.shiftDirection=-1;this.hold=.9;this.shifts++;
   }
  }
  if(this.shiftTime<=0)this.shiftDirection=0;
  this.shiftMix=this.shiftTime>0?Math.sin(Math.PI*clamp(1-this.shiftTime/this.shiftDuration,0,1)):0;
  const gearRatio=reverse?LC100.reverseRatio:AUTO_RATIOS[this.gear-1];
  const ratio=gearRatio*LC100.finalDrive*transfer,turbineRpm=shaft*gearRatio;
  const target=clamp(Math.max(720,turbineRpm,720+(governed?Math.min(throttle,.2):throttle)*1250),720,5200);
  this.rpm+=(target-this.rpm)*(1-Math.exp(-dt*(this.shiftTime>0?12:throttle?5:3)));
  this.load+=(throttle*power*(governed?clamp(resistanceForce/Math.max(1,capacity(this.gear)),.15,1):1)-this.load)*(1-Math.exp(-dt*5));
  // Multiplication decays with converter slip, not vehicle speed: transfer
  // gearing changes turbine RPM. Bound output power even during RPM transients.
  const speedRatio=clamp(turbineRpm/this.rpm,0,1);
  this.converter=1+.65*(1-speedRatio)**2;
  const cut=1-.45*this.shiftMix,limiter=1-clamp((turbineRpm-5100)/300,0,1);
  const torque=engineTorque(this.rpm)*throttle*cut*power*limiter;
  const efficiency=.88,availablePower=torque*this.rpm*Math.PI/30*efficiency;
  const torqueForce=torque*ratio*efficiency*this.converter/(4*VEHICLE_SETUP.rollingRadius);
  this.force=Math.min(torqueForce,Math.abs(wheelSpeed)>.001?availablePower/(4*Math.abs(wheelSpeed)):Infinity);
  this.outputPower=this.force*4*Math.abs(wheelSpeed);
  this.engineBrake=throttle<.02&&!braking?Math.min(range==='LO'?360:120,Math.abs(wheelSpeed)*(range==='LO'?100:16)):0;
  return this;
 }
}
