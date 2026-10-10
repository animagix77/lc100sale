import {readingSeconds} from './driving-messages.mjs';
/**
 * Contextual, advisory-only trail assistance. No physics or browser dependencies.
 *
 * update(dt, state) returns the active {id,title,body,targets} card every frame,
 * or null. speed is signed metres/second; grades are rise/run in the forward
 * direction; rocky is a 0..1 nearby crawl score; slip is wheel/road speed delta.
 * State: speed, range ('HI'|'LO'), centerLocked, gas, reverse, cruise,
 * gradeAhead, gradeCurrent, rocky, slip, stuck, recoveryState
 * ('roof'|'deploying'|'ground'|'stowing'), grounded, paused, blocked.
 * targets identifies existing controls ('range', 'lock', 'boards'), never actions
 * to perform automatically. Call resetContext() after a teleport/respawn; use
 * suppress() for transient overlays/pause so the display budget is preserved.
 */
const clamp=(x,min,max)=>Math.min(max,Math.max(min,x));
const number=x=>Number.isFinite(x)?x:0;
const COOLDOWN=65;
export class TrailCoach{
 constructor(){this.clock=0;this.cooldowns=new Map();this.exposure=new Map();this.resetContext()}
 resetContext(){this.exposure.clear();this.suppress()}
 suppress(){
  this.active=null;this.hardFor=0;this.hardClearFor=0;
  this.hardActive=false;this.bogFor=0;this.recoveryWanted=false;
  this.escapedFor=0;this.groundFor=0;
 }
 dismiss(id=this.active?.id){
  if(id){this.cooldowns.set(id,this.clock+COOLDOWN);this.exposure.delete(id)}
  if(this.active?.id===id)this.active=null;
 }
 update(dt,state={}){
  if(!Number.isFinite(dt)||dt<=0)return this.active;
  dt=Math.min(dt,.1);
  this.clock+=dt;
  if(state.paused||state.blocked){this.suppress();return null}
  const speed=number(state.speed),absSpeed=Math.abs(speed);
  const gas=clamp(number(Number(state.gas)),0,1),reverse=Number(state.reverse)>0;
  const effort=gas>.12||Boolean(state.cruise),forward=!reverse&&(speed>=-.25||effort);
  const grounded=state.grounded!==false,recovery=state.recoveryState||'roof';
  // Reversing is itself useful recovery. Gravity-induced rollback under
  // forward throttle is different: that driver still needs climb advice.
  if(!grounded||!forward){this.suppress();return null}
  const grade=Math.max(number(state.gradeAhead),number(state.gradeCurrent));
  const climbing=grade>(this.hardActive ? .085 : .14);
  const crawling=Number(state.rocky)>.45&&absSpeed<4.6;
  const hardSignal=absSpeed<7.5&&(speed>.3||effort||this.hardActive)&&(climbing||crawling);
  if(hardSignal){this.hardFor+=dt;this.hardClearFor=0;if(this.hardFor>=1.1)this.hardActive=true}
  else{this.hardFor=0;this.hardClearFor+=dt;if(this.hardClearFor>4)this.hardActive=false}
  // Wheelspin on a fast pass and a parked truck are not a bog. The latch keeps
  // useful advice visible when the driver lifts off to operate the controls.
  const bogSignal=absSpeed<.7&&effort&&(Boolean(state.stuck)||number(state.slip)>1.6);
  this.bogFor=bogSignal?this.bogFor+dt:Math.max(0,this.bogFor-dt*2);
  if(this.bogFor>=2.4)this.recoveryWanted=true;
  this.escapedFor=absSpeed>1.4?this.escapedFor+dt:0;
  if(this.escapedFor>.8){this.recoveryWanted=false;this.bogFor=0}
  if(recovery==='ground'||recovery==='deploying'||recovery==='stowing')this.recoveryWanted=false;
  this.groundFor=recovery==='ground'?this.groundFor+dt:0;
  let hint=null;
  // Judge Dean LLC — a reading card is advice, not a live pedal readout.
  // Stable wording avoids reflow on every W/S press and on crawl/grade noise.
  const release='Ease off the accelerator and turn cruise off, then ';
  if(recovery==='ground'&&this.groundFor>.15&&absSpeed<2.2){
   hint={id:'boards-ready',title:'Orange things. Actual purpose.',body:'Use gentle throttle to climb onto the boards. Flooring it is how we got here. They return to the roof once you’re clear.',targets:[]};
  }else if(recovery==='roof'&&this.recoveryWanted&&absSpeed<=2){
   hint={id:'traction-boards',title:'You’ve found the parking spot.',body:'Ease off and deploy TRACTION BOARDS. Four boards go under the tyres; use gentle throttle to climb out. The roof jewellery earns its keep.',targets:['boards']};
  }else if(recovery==='roof'&&this.hardActive){
   if(state.range!=='LO'){
    hint={id:'low-range',title:'Low range. More control.',body:`${release}select 4LO${state.centerLocked?'':' and CENTER LOCK'} for steep or rocky ground. You can switch while coasting. Low range gives you slower, stronger drive. If the tyres keep spinning without progress, traction boards may be needed.`,targets:state.centerLocked?['range']:['range','lock']};
   }else if(!state.centerLocked){
    hint={id:'center-lock',title:'Give both axles a job.',body:`${release}engage CENTER LOCK to link the front and rear axles on loose ground. Gentle throttle. If you stop making progress, ease off and use TRACTION BOARDS; a little rocking is fine.`,targets:['lock']};
   }else if(grade>.28||Number(state.rocky)>.8){
    hint={id:'difficult-ground',title:'Slow and steady from here.',body:'4LO and CENTER LOCK are set. Keep a gentle throttle through this difficult section. If the tyres spin without progress, ease off and deploy TRACTION BOARDS. A little rocking is fine.',targets:[]};
   }
  }
  // Solved conditions disappear immediately; new actionable advice (for example
  // centre lock after selecting low range) does not wait behind an old card.
  if(!hint||this.clock<(this.cooldowns.get(hint.id)||0)){this.active=null;return null}
  // Count actual visible time per hint, even when a brief reverse input,
  // airborne wheel, or overlay temporarily clears its approach evidence.
  // Otherwise feathering reverse can restart the card forever.
  const exposure=(this.exposure.get(hint.id)||0)+dt;
  if(exposure>=readingSeconds(hint.title+' '+hint.body,{minimum:28,maximum:42})){
   this.cooldowns.set(hint.id,this.clock+COOLDOWN);this.exposure.delete(hint.id);
   this.active=null;return null;
  }
  this.exposure.set(hint.id,exposure);this.active=hint;return hint;
 }
}
