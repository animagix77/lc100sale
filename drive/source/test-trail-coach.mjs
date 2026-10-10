import assert from 'node:assert/strict';
import {TrailCoach} from './trail-coach.mjs';
const base={speed:1.3,range:'HI',centerLocked:false,gas:.45,reverse:0,cruise:false,gradeAhead:0,gradeCurrent:0,rocky:0,slip:0,stuck:false,recoveryState:'roof',grounded:true};
const state=overrides=>({...base,...overrides});
const step=(coach,seconds,s)=>{let hint;for(let i=0;i<Math.ceil(seconds*60);i++)hint=coach.update(1/60,s);return hint};
const hill=state({gradeAhead:.22});
{
 const coach=new TrailCoach();
 assert.equal(step(coach,10,state({speed:0,gas:0,gradeAhead:.35,rocky:1,slip:5})),null,'A parked truck is not a reason to nag');
 assert.equal(step(coach,10,{...hill,grounded:false,stuck:true}),null,'No advice while airborne');
 assert.equal(step(coach,10,{...hill,speed:10}),null,'No crawl controls during a fast pass');
 assert.equal(step(coach,5,state({speed:0,gas:0,slip:5})),null,'Idle residual wheel spin is not a bog');
}
{
 const coach=new TrailCoach();
 for(let i=0;i<25;i++){
  assert.equal(step(coach,.25,hill),null);
  assert.equal(step(coach,.25,{...hill,gradeAhead:.02}),null);
 }
 assert.equal(step(coach,1.2,hill)?.id,'low-range','A sustained approach anticipates a climb');
 assert.equal(step(coach,.3,{...hill,gradeAhead:.10})?.id,'low-range','Hysteresis tolerates a small dip in sampled grade');
 assert.equal(step(coach,4.1,state({speed:2})),null,'Advice clears after leaving the obstacle');
}
{
 const coach=new TrailCoach();let hint=step(coach,1.2,hill);
 assert.deepEqual(hint.targets,['range','lock']);assert.match(hint.body,/Ease off the accelerator/);
 hint=coach.update(1/60,{...hill,range:'LO',gas:0});
 assert.equal(hint.id,'center-lock','Switching low range exposes remaining lock advice immediately');
 assert.deepEqual(hint.targets,['lock']);assert.match(hint.body,/front and rear axles/);
 assert.equal(coach.update(1/60,{...hill,range:'LO',centerLocked:true}),null,'Using both controls solves the hint');
 assert.equal(step(coach,1,hill)?.id,'low-range','Reverting a needed control is actionable again');
}
{
 const coach=new TrailCoach();
 let hint=step(coach,1.2,state({rocky:.9,speed:2,cruise:true,gas:0}));
 assert.equal(hint.id,'low-range');assert.match(hint.title,/Low range/);
 assert.match(hint.body,/Ease off the accelerator and turn cruise off/);
 hint=coach.update(1/60,state({rocky:.9,speed:1,gas:0}));
 assert.match(hint.body,/switch while coasting/,'No stop requirement imposed on existing controls');
}
{
 const coach=new TrailCoach(),bog=state({speed:.08,slip:4,gas:.8});
 assert.equal(step(coach,1,bog),null,'A momentary hesitation is not stuck');
 assert.equal(step(coach,1.5,bog)?.id,'traction-boards');
 assert.equal(step(coach,1,{...bog,gas:0,slip:0})?.id,'traction-boards','Lifting off does not remove the needed recovery instructions');
 assert.equal(step(coach,.1,{...bog,recoveryState:'deploying'}),null,'Do not interrupt board deployment');
 assert.equal(step(coach,.3,{...bog,recoveryState:'ground'})?.id,'boards-ready');
 assert.match(coach.active.body,/gentle throttle/);
 assert.equal(step(coach,.1,{...bog,recoveryState:'stowing'}),null);
 assert.equal(step(coach,1,{...bog,speed:2.2,slip:0}),null,'Regaining motion clears the bog latch');
 assert.equal(step(coach,1,state({speed:0,gas:0})),null,'A recovered truck may stop without stale advice');
}
{
 const coach=new TrailCoach(),bog=state({speed:.2,slip:4,stuck:true,gradeAhead:.25});
 assert.equal(step(coach,1.2,bog)?.id,'low-range');
 assert.equal(step(coach,1.4,bog)?.id,'traction-boards','Sustained bog takes priority over gearing');
 assert.equal(step(coach,.1,{...bog,reverse:1,speed:-.2}),null,'Trying reverse is allowed to work without nagging');
 assert.equal(step(coach,1,state({speed:0,gas:0})),null,'Reversing clears a stale recovery latch');
}
{
 const coach=new TrailCoach();step(coach,1.2,hill);coach.dismiss();
 assert.equal(step(coach,30,hill),null,'Dismissed hint stays dismissed during cooldown');
 assert.equal(step(coach,34,hill),null);
 assert.equal(step(coach,1.1,hill)?.id,'low-range');
 assert.equal(step(coach,42.1,hill),null,'A card cannot occupy the screen forever');
 assert.equal(step(coach,20,hill),null,'Automatic expiry also receives a cooldown');
}
{
 const coach=new TrailCoach();step(coach,1.2,hill);coach.resetContext();
 assert.equal(coach.active,null);assert.equal(step(coach,.5,hill),null,'Respawn requires fresh approach evidence');
 assert.equal(step(coach,1,hill)?.id,'low-range');
 assert.equal(coach.update(1/60,{...hill,blocked:true}),null,'Important existing overlays win');
 assert.equal(step(coach,.5,hill),null,'Suppressed evidence cannot produce stale advice');
 assert.equal(step(coach,5,{...hill,paused:true}),null,'Pause does not advance coaching');
 assert.equal(coach.update(NaN,hill),null);assert.equal(coach.update(0,hill),null);
}
{
 const coach=new TrailCoach();step(coach,1.2,hill);coach.dismiss();coach.resetContext();
 assert.equal(step(coach,2,hill),null,'A respawn preserves an intentional dismissal');
}
{
 const coach=new TrailCoach(),stale=state({speed:0,gas:0,slip:0,stuck:true});
 assert.equal(step(coach,20,stale),null,'A stale unstuck-panel latch cannot create fresh idle advice');
 assert.equal(step(coach,2.5,{...stale,gas:.35})?.id,'traction-boards','A fresh drive attempt with no progress seeds recovery advice');
 assert.equal(step(coach,1,stale)?.id,'traction-boards','Once seeded, releasing throttle keeps useful board instructions visible');
}
{
 const coach=new TrailCoach(),rollback={...hill,speed:-.45,gas:.7};
 assert.equal(step(coach,1.2,rollback)?.id,'low-range','Forward throttle during gravity rollback still receives climbing advice');
 assert.equal(coach.update(1/60,{...rollback,reverse:1}),null,'Intentional reverse is still allowed without competing advice');
 assert.equal(step(coach,2,{...rollback,gas:0}),null,'Unpowered backward coasting is not an attempted climb');
}
{
 const coach=new TrailCoach();step(coach,30,hill);
 const before=coach.exposure.get('low-range');assert(before>28&&before<30);
 for(const interruption of [{reverse:1},{grounded:false},{blocked:true},{paused:true}]){
  assert.equal(coach.update(1/60,{...hill,...interruption}),null);
  assert.equal(coach.exposure.get('low-range'),before,'Transient suppression preserves accumulated visible exposure');
 }
 assert.equal(step(coach,.5,hill),null,'Transient suppression clears approach evidence');
 assert.equal(step(coach,.8,hill)?.id,'low-range');
 assert.equal(step(coach,14,hill),null,'Reverse/airborne/overlay interruptions cannot restart the extended display budget');
 assert.equal(step(coach,20,hill),null,'The exhausted hint receives its normal cooldown');
}
{
 const coach=new TrailCoach();step(coach,2,hill);const before=coach.exposure.get('low-range');
 coach.suppress();assert.equal(coach.exposure.get('low-range'),before,'External pause suppression preserves exposure');
 coach.resetContext();assert.equal(coach.exposure.size,0,'Explicit respawn resets context and display exposure');
 assert.equal(step(coach,.5,hill),null,'Respawn needs fresh context');
}
console.log('Trail coach: anticipatory hills/crawls, debounce, hysteresis, recovery priority, solved controls, input release, reversing, dismissal, reset and pause passed.');

{const coach=new TrailCoach();const hard={...hill,gradeAhead:.34,range:'LO',centerLocked:true};assert.equal(step(coach,1.2,hard)?.id,'difficult-ground');assert.match(coach.active.body,/TRACTION BOARDS/);assert.equal(step(coach,4.1,{...hard,gradeAhead:0}),null)}

{const coach=new TrailCoach();step(coach,1.2,hill);assert.equal(step(coach,2,{...hill,gradeAhead:0})?.id,'low-range','A short level patch does not flash the advice away');assert.equal(step(coach,14,hill)?.id,'low-range','Long driving instructions remain visible beyond the previous thirteen-second cap')}

{
 const coach=new TrailCoach();step(coach,1.2,hill);
 step(coach,2.5,{...hill,speed:0,slip:4,stuck:true});
 assert.equal(coach.active.id,'traction-boards');
 coach.dismiss('low-range');
 assert.equal(coach.active.id,'traction-boards','Expiring a retained older card must not dismiss new recovery advice');
}
