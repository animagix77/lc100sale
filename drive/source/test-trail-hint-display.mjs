// Judge Dean LLC — integration regression for tips disappearing before being read.
import assert from 'node:assert/strict';
import {TrailHintDisplay} from './trail-hint-display.mjs';
import {TrailCoach} from './trail-coach.mjs';
const coach=new TrailCoach(),view=new TrailHintDisplay();
const hill={speed:1.3,range:'HI',centerLocked:false,gas:.4,gradeAhead:.22,grounded:true,recoveryState:'roof'};
function step(seconds,state){let result;for(let i=0;i<Math.ceil(seconds*60);i++)result=view.update(coach.update(1/60,state),1/60,state);return result}
assert.equal(step(1.2,hill)?.id,'low-range');
assert.equal(step(1,{...hill,grounded:false})?.id,'low-range','A bounce does not hide unread instructions');
assert.equal(step(1,{...hill,reverse:1,speed:-.3})?.id,'low-range','Rollback/reverse preserves reading time');
assert.equal(step(15,{...hill,gradeAhead:0,gas:0})?.id,'low-range','Leaving the hill does not prematurely hide the card');
assert.deepEqual(view.hint.targets,['range','lock']);
const frozen=view.visibleFor;assert.equal(step(20,{...hill,blocked:true}),null);assert.equal(view.visibleFor,frozen,'Hidden overlay time does not consume reading time');
assert.equal(step(1,{...hill,gradeAhead:0,gas:0})?.id,'low-range','The unread tip returns after an overlay');
assert.equal(step(30,{...hill,gradeAhead:0,gas:0}),null,'Unneeded tips eventually leave the screen');
coach.resetContext();view.clear();step(1.2,hill);
assert.equal(step(.1,{...hill,range:'LO',gas:0})?.id,'center-lock','Acting on a control updates advice immediately');
assert.equal(step(.1,{...hill,range:'LO',centerLocked:true}),null,'Solved advice is not held');
coach.resetContext();view.clear();step(1.2,hill);step(5,{...hill,gradeAhead:0});assert.equal(coach.active,null);coach.dismiss(view.hint?.id);view.clear();assert.equal(step(2,hill),null,'Dismissing a retained card also prevents immediate recurrence');
view.update({id:'traction-boards',title:'Recovery',body:'Deploy the boards.',targets:['boards']},.1,hill);
assert.equal(view.update(null,.1,{...hill,recoveryState:'deploying'}),null,'Placement clears the old deployment request');
view.update({id:'boards-ready',title:'Boards down',body:'Ease forward.',targets:[]},.1,{...hill,recoveryState:'ground'});
assert.equal(view.update(null,.1,{...hill,recoveryState:'stowing'}),null,'Packed boards do not retain obsolete instructions');
view.clear();assert.equal(view.update(null,.1,hill),null,'Reset removes previous context');
console.log('Trail hint display: minimum visible reading time through bounce, reverse, level ground and overlays; control updates, recovery, dismissal and reset passed.');

// Judge Dean LLC — feathering WASD must not keep rewriting a visible paragraph.
for(const range of ['HI','LO']){
 const coach=new TrailCoach(),view=new TrailHintDisplay(),context={...hill,range,centerLocked:false};
 const step=(seconds,state)=>{let result;for(let i=0;i<Math.ceil(seconds*60);i++)result=view.update(coach.update(1/60,state),1/60,state);return result;};
 const first=step(1.2,context),words=JSON.stringify([first.title,first.body]);
 for(let i=0;i<12;i++)for(const patch of [{gas:1},{gas:0},{reverse:1,speed:-.3},{gas:.5,rocky:.9},{gas:0,cruise:true},{gas:0,grounded:false}]){
  const shown=step(.08,{...context,...patch});
  assert(shown&&JSON.stringify([shown.title,shown.body])===words,'Pedals, reversing, small bounces and terrain thresholds preserve the words');
 }
 assert(view.visibleFor>6,'Reading time advances through input changes');
 const next=step(.1,{...context,range:'LO',centerLocked:true});assert.equal(next,null,'Actually solving the advice still clears it');
}
console.log('Visible tip copy remains stable while alternating driving inputs and terrain signals.');

// Judge Dean LLC — snowy wheel bounces used to exhaust the panel's reading
// budget before the generator's, allowing the same tip to flash back on W.
{
 const coach=new TrailCoach(),view=new TrailHintDisplay({onExpire:id=>coach.dismiss(id)});
 const transitions=[];let previous=null;
 for(let frame=0;frame<60*100;frame++){
  const time=frame/60,state={...hill,gas:frame%30<24?1:0,grounded:!(time%2.5>2.4)};
  const shown=view.update(coach.update(1/60,state),1/60,state)?.id??null;
  if(shown!==previous){transitions.push({time,id:shown});previous=shown;}
 }
 assert.deepEqual(transitions.map(t=>t.id),['low-range',null],'An expired climb tip stays dismissed while throttle and wheel contacts fluctuate');
 assert(transitions[1].time-transitions[0].time>=30,'The driver receives the full reading window');
}
{
 const view=new TrailHintDisplay(),state={...hill,range:'LO',centerLocked:true};
 const boards={id:'traction-boards',title:'Recovery',body:'Deploy the boards.',targets:['boards']};
 const climb={id:'difficult-ground',title:'Climb',body:'Keep a gentle throttle.',targets:[]};
 view.update(boards,.1,state);
 for(let cycle=0;cycle<8;cycle++){
  for(let frame=0;frame<20;frame++)assert.equal(view.update(climb,1/60,state)?.id,'traction-boards','A brief lower-priority signal cannot reset recovery advice');
  view.update(null,1/60,state);
 }
 for(let frame=0;frame<46;frame++)view.update(climb,1/60,state);
 assert.equal(view.hint.id,'difficult-ground','Sustained progress may replace recovery advice');
 view.update(boards,1/60,state);assert.equal(view.hint.id,'traction-boards','New recovery advice still takes priority immediately');
 assert.equal(view.update(null,1/60,{...state,recoveryState:'deploying'}),null,'Deploying boards clears their advice immediately');
}
console.log('Snow-climb tips expire once through throttle/bounce noise; brief recovery downgrades do not reset the panel.');
