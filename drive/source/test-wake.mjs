import assert from 'node:assert/strict';
import {WakeField,WAKE_LIMITS} from './wake-field.mjs';
import {shore} from './terrain.mjs';
for(const options of [{size:129,spacing:.5},{size:97,spacing:2/3}]){
 const f=new WakeField(options),x=shore(0)+1;f.move(x,0);f.stamp(x,0,0);assert.equal(f.impulses,0);
 for(let i=0;i<20;i++){f.stamp(x,-i*.17,4);f.step(1/60)}
 f.pack();assert(f.peak>.015&&f.peak<.421,'Moving tires visibly displace water within a bounded range');
 const before=f.sample(x,-1);f.move(x+8,0);assert(Math.abs(before-f.sample(x,-1))<1e-6,'Streaming preserves world-anchored ripples');
 assert(f.data.length===options.size**2*4);assert([...f.pack()].every(Number.isFinite));
 let propagated=false;for(let i=0;i<120;i++){f.step(1/60);if(Math.abs(f.sample(x+2,-1))>.0005)propagated=true}assert(propagated,'Disturbances spread away from tire contacts');
 for(let i=0;i<1200;i++)f.step(1/60);f.pack();assert(f.peak<.002,'Wake settles after driving stops');
 f.stamp(x,0,5);f.clear();assert(f.height.every(h=>h===0)&&f.velocity.every(v=>v===0)&&f.impulses===0);
 console.log({grid:options.size,initialDisplacement:before,settled:f.peak});
}
console.log('Geometric wake: idle suppression, displacement, propagation, streaming, decay, mobile budget and reset passed');

// Crest direction reverses with the truck instead of always pushing water forward.
for(const direction of [1,-1]){const f=new WakeField(),x=shore(0)+1;f.move(x,0);for(let i=0;i<8;i++){f.stamp(x,0,direction*4);f.step(1/60)}assert(f.sample(x,-direction*.75)>.03,'Water piles up in the direction of travel');assert(f.sample(x,direction*.5)<-.03,'Tire leaves a geometric trough');}

const lip=new WakeField(),lipX=shore(0)+7;lip.move(lipX,0);for(let i=0;i<30;i++){lip.stamp(lipX,-i*.17,4);lip.step(1/60)}lip.pack();assert(lip.peak>.04,'Shoreline damping must not erase tire displacement immediately');

// Inland river was previously masked out by the coastline-only damping field.
for(const options of [{size:129,spacing:.5},{size:97,spacing:2/3}]){
 const f=new WakeField(options),x=248,z=-336;f.move(x,z);
 for(let i=0;i<24;i++){f.stamp(x,z-i*.08,3.0,0);f.step(1/60)}
 f.pack();assert(f.peak>.045,'River tyres produce real height displacement inland');
 assert(f.data.some((v,i)=>i%4===1&&Math.abs(v)>.025),'River wake supplies slope changes for reflections');
 const before=f.sample(x,z-1);f.move(x+8,z);assert(Math.abs(before-f.sample(x,z-1))<1e-6,'River wake remains anchored after streaming');
 for(let i=0;i<900;i++)f.step(1/60);f.pack();assert(f.peak<.004,'River wake settles after driving away');
 const dry=new WakeField(options);dry.move(248,-310);for(let i=0;i<20;i++){dry.stamp(248,-310,4);dry.step(1/60)}dry.pack();assert.equal(dry.peak,0,'Dry banks never generate water displacement');
}
console.log('River wake: inland displacement, normal gradients, streaming, dry-bank mask and decay passed');

// Road speed displaces a taller and broader body of water, rather than merely
// generating more copies of the same small tyre ripple. The field stays fixed.
for(const options of [{size:129,spacing:.5},{size:97,spacing:2/3}]){
 const {riverZ}=await import('./expedition.mjs'),{riverWakeOffset}=await import('./ocean-height.mjs'),z=riverZ(248);
 const crossing=speed=>{
  const f=new WakeField(options);f.move(248,z);let crest=0,area=0,foam=0;
  for(let frame=0;frame<90;frame++){
   if(frame%2===0)for(const side of [-.85,.85])f.stamp(248+side,z+5-speed*frame/60,speed);
   f.step(1/60);f.pack();let cells=0,white=0;
   for(let k=0;k<f.count;k++){crest=Math.max(crest,f.height[k]);if(f.height[k]>.1)cells++;if(f.data[k*4+3]>.3)white++}
   area=Math.max(area,cells*options.spacing**2);foam=Math.max(foam,white*options.spacing**2);
  }
  return {f,crest,area,foam};
 };
 const slow=crossing(1),ford=crossing(4),quick=crossing(12),fast=crossing(WAKE_LIMITS.speed);
 assert(slow.crest<.10,'Walking pace leaves a small wake');
 assert(quick.crest>ford.crest*2.5&&fast.crest>quick.crest*1.4,'Bow height keeps rising through high-range speeds');
 assert(riverWakeOffset(.36,fast.crest)>.90,'Fast ford crossings visibly lift about a metre of water');
 assert(fast.area>ford.area*4&&fast.foam>ford.foam*8,'Fast bow shoulders create a larger disturbed and foamy footprint');
 assert.equal(fast.f.count,options.size**2,'Speed cannot increase grid memory or vertex count');
 const arrays=[fast.f.height,fast.f.velocity,fast.f.mask,fast.f.data].map(a=>a.length);
 const f=fast.f;f.move(248,z);
 for(let n=0;n<1000;n++)f.stamp(248,z,100,100,.7);
 f.pack();assert(f.peak<=WAKE_LIMITS.crest+1e-6&&f.velocity.every(v=>Math.abs(v)<=WAKE_LIMITS.velocity),'Repeated high-slip contacts cannot accumulate unbounded energy');
 assert(f.data.every(Number.isFinite)&&f.data.every((v,i)=>i%4!==3||(v>=0&&v<=.950001)),'Wake normals and foam remain finite and bounded');
 const before=f.sample(248,z);f.move(256,z);assert(Math.abs(f.sample(248,z)-before)<1e-6,'Large wakes stay in place when the field origin moves');
 assert.deepEqual([f.height,f.velocity,f.mask,f.data].map(a=>a.length),arrays,'Moving the wake window keeps fixed buffers');
 for(let n=0;n<900;n++)f.step(1/60);f.pack();assert(f.peak<.005,'Large bow waves settle after leaving the river');
 const limit=new WakeField(options),extreme=new WakeField(options);limit.move(248,z);extreme.move(248,z);
 for(let n=0;n<12;n++){limit.stamp(248,z-n*.2,WAKE_LIMITS.speed,6);extreme.stamp(248,z-n*.2,100,100);limit.step(1/60);extreme.step(1/60)}
 assert.deepEqual(limit.height,extreme.height,'Wake response saturates at the road-speed and slip budgets');
 for(const direction of [1,-1]){
  const reversed=new WakeField(options);reversed.move(248,z);for(let i=0;i<5;i++){reversed.stamp(248,z,WAKE_LIMITS.speed*direction);reversed.step(1/60)}
  assert(reversed.sample(248,z-direction*1.4)>.45,'Large bow wave follows forward or reverse travel');
  assert(reversed.sample(248,z+direction*.4)<-.1,'Fast crossing still leaves a trough behind the tire');
 }
 console.log({grid:options.size,slowCrest:slow.crest,fordCrest:ford.crest,fastCrest:fast.crest,fastArea:fast.area});
}
console.log('Fast river wake: speed/width/foam scaling, 50 mph cap, repeated-contact stability, reverse, streaming and fixed grid passed');
