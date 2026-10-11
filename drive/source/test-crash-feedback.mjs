import assert from 'node:assert/strict';
import {ContactFeedback} from './contact-feedback.mjs';
import {impactPCM} from './impact-audio.mjs';
import {contactImpactMix} from './sound.mjs';
const f=new ContactFeedback(),hit={id:1,source:'chassis',kind:'rock',impulse:3200,closing:5,pan:-.5};
const sample=(t,h=hit)=>f.sample(t,1/120,[],5,0,[h]);
assert(!sample(.1).some(h=>h.crash),'Reset settling is silent');
assert(sample(1)[0].crash,'Substantial contact gets its own crash event');
assert(!sample(1.2).some(h=>h.crash),'Sustained contact cannot chatter');
assert(sample(1.6)[0].crash,'Another distinct crash can play');
assert(!sample(2.2,{...hit,closing:0}).some(h=>h.crash),'Static pressure never crashes');
assert(!sample(2.4,{...hit,impulse:500}).some(h=>h.crash),'Gentle body bumps stay muffled');
assert(!sample(2.6,{...hit,source:'pebble'}).some(h=>h.crash),'Tiny gravel never triggers a crash');
f.globalAt=10;assert(sample(3)[0].crash,'Wheel/contact cooldown cannot suppress a real crash');
for(let i=0;i<100;i++)sample(4+i,{...hit,id:i});assert(f.bodyAt.size<=32,'Crash identity cache remains bounded');
for(const sr of [24000,48000]){
 const a=impactPCM('crash',sr),b=impactPCM('crash',sr,1);
 assert.equal(a.length,Math.ceil(sr*.72));assert(a.every(Number.isFinite));assert(Math.max(...a)<1&&Math.min(...a)>-1);assert.equal(a[0],0);assert.equal(a.at(-1),0);assert.notDeepEqual(a,b);
 const energy=v=>v.reduce((sum,x)=>sum+x*x,0)/v.length;
 assert(energy(a.slice(-sr*.1))<energy(a.slice(sr*.01,sr*.1))*.002,'No sustained metallic ringing');
}
const crashMix=contactImpactMix({...hit,crash:true,energy:1}),pebbleMix=contactImpactMix({...hit,source:'pebble',energy:1});
assert.equal(crashMix.kind,'crash');assert(crashMix.volume<=.56&&crashMix.cutoff<=1800);assert(pebbleMix.volume<=.095);assert(crashMix.volume>pebbleMix.volume*4);
console.log('Crash feedback: actual severity thresholds, reset/parked silence, independent cooldown, bounded cache, finite original audio and quiet pebbles passed.');
