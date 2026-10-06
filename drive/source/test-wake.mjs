import assert from 'node:assert/strict';
import {WakeField} from './wake-field.mjs';
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
