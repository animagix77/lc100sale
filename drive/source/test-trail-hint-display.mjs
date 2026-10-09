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
