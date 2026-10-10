import assert from 'node:assert/strict';
import {ContactFeedback} from './contact-feedback.mjs';
import {impactPCM} from './impact-audio.mjs';
import {contactImpactMix} from './sound.mjs';
import {DrivePhysics,RAPIER} from './physics.mjs';
const f=new ContactFeedback(),wheel=()=>({contact:true,length:.4,kind:'sand'});const wheels=Array.from({length:4},wheel);f.sample(1,.01,wheels,2,0);assert.equal(f.sample(1.01,.01,wheels,2,0).length,0);wheels[0]={contact:true,length:.25,kind:'wood'};const hit=f.sample(1.02,.01,wheels,2,0);assert.equal(hit[0].kind,'wood');assert(hit[0].pan<0);assert.equal(f.sample(1.03,.01,wheels,0,0).length,0);
for(const kind of ['wood','rock','suspension']){const a=impactPCM(kind);assert(a.length<=48000*.35);assert(a.every(Number.isFinite));assert(Math.max(...a)<1&&Math.min(...a)>-1);assert(Math.abs(a[a.length-1])<.001);assert.notDeepEqual(a,impactPCM(kind,48000,1));}
// Frequency-band energy and attack/tail checks prevent harsh clicks or bright
// ringing from returning when these procedural foley voices are adjusted.
const rms=a=>Math.sqrt(a.reduce((n,v)=>n+v*v,0)/a.length);
function bandEnergy(data,sr,lo,hi){let energy=0;for(let hz=lo;hz<=hi;hz+=25){const c=2*Math.cos(2*Math.PI*hz/sr);let a=0,b=0;for(const value of data){const n=value+c*a-b;b=a;a=n}energy+=a*a+b*b-c*a*b;}return energy;}
for(const sr of [24000,48000])for(const kind of ['wood','rock','suspension']){
 const pcm=impactPCM(kind,sr),body=rms(pcm.slice(sr*.01,sr*.065));
 assert(rms(pcm.slice(0,sr*.002))<body*.2,'Rounded onset avoids a hard sample click');
 assert(rms(pcm.slice(-sr*.02))<body*.12,'The short tail decays without a ringing sustain');
 const treble=bandEnergy(pcm,sr,1000,6000),low=bandEnergy(pcm,sr,25,975);
 assert(treble/low<.025,`${kind} stays muffled across sample rates: ${treble/low}`);
 const mix=contactImpactMix({kind,energy:1,pan:2});assert(mix.volume<=.355&&mix.cutoff<=850&&mix.pan===1);
 assert(contactImpactMix({kind,energy:0}).volume<.06,'Light contacts stay subdued');
 console.log('Muffled contact spectrum',{kind,sr,trebleRatio:treble/low});
}
async function crossing(obstacle){const p=await DrivePhysics.create();p.world.createCollider(RAPIER.ColliderDesc.cuboid(100,.1,100).setTranslation(0,-.1,0));if(obstacle){const c=p.world.createCollider(RAPIER.ColliderDesc.cuboid(1.4,obstacle==='wall'?1.5:.15,.45).setTranslation(0,obstacle==='wall'?1.5:.15,-8));p.obstacles={has:o=>o?.handle===c.handle,kind:o=>o?.handle===c.handle?'wood':undefined}}
p.reset(0,0,0);for(let i=0;i<360;i++)p.step(1/120,{brake:true});p.soundEvents=[];const events=[];for(let i=0;i<1400;i++){p.step(1/120,{cruise:true});events.push(...p.soundEvents.splice(0));}const out={obstacle,events:events.length,wood:events.filter(e=>e.kind==='wood').length};console.log(out);p.dispose();return out}
const flat=await crossing(null),log=await crossing('log'),wall=await crossing('wall');assert.equal(flat.events,0,'Steady flat driving stays quiet');assert(log.wood>0,'Rolling across a log triggers wooden impacts');assert(wall.wood>0,'Chassis hits trigger collision foley');assert(wall.events<25,'Holding against a wall must not chatter every frame');
console.log('Contact sounds: real wheel/body impacts, quiet coasting, cooldowns, stereo side and bounded original foley passed.');
