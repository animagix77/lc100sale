import assert from 'node:assert/strict';
import {LANDMARKS,riverBounds,riverZ,riverLevel,riverWidth,riverProfile,riverMask,riverHeight,riverMouthBlend,waterExists} from './expedition.mjs';
import {baseHeight,shore,SandField} from './terrain.mjs';
let shallowest=Infinity,deepest=0,maxBankError=0;
for(let x=-60;x<520;x+=2){
 const z=riverZ(x),width=riverWidth(x),level=riverLevel(x);
 for(const f of [-.95,-.65,0,.65,.95]){
  const q=z+width*f,p=riverProfile(x,q),depth=level-baseHeight(x,q);
  assert(p.depth>0&&p.wet>0,'The whole river reach has one connected wet channel');
  assert(depth>0,`Water cannot pass through a dry hill at ${x}, ${q}`);
  for(const t of [0,.45,1.9,5.7])assert(riverHeight(x,q,t)>baseHeight(x,q),'Surface ripples stay above the bed');
 }
 if(x< -20)continue; // The open mouth joins ocean water, rather than two dry river banks.
 for(const side of [-1,1]){
  const edge=z+side*width,err=Math.abs(level-baseHeight(x,edge));maxBankError=Math.max(maxBankError,err);
  assert(err<1e-8,'Mean water edge and terrain shoreline are identical');
  assert.equal(riverMask(x,edge),0,'The exact mean shoreline is dry');
  for(const beyond of [.2,1,3,6]){
   const q=edge+side*beyond;
   assert(baseHeight(x,q)>level,`Bank must enclose the river at ${x}, ${q}`);
   assert.equal(riverMask(x,q),0);
   for(const t of [0,1,7])assert.equal(riverHeight(x,q,t),level,'No wave displacement survives beyond the bank');
  }
 }
 const depth=level-baseHeight(x,z);shallowest=Math.min(shallowest,depth);deepest=Math.max(deepest,depth);
}
for(const x of [248,475]){
 const z=riverZ(x),depth=riverLevel(x)-baseHeight(x,z);
 assert(depth>.3&&depth<.42,'The two route crossings stay shallow');
 assert.equal(riverLevel(x),-.18+(x+36)*.052,'Existing crossing elevation is preserved');
}
assert.equal(riverWidth(riverBounds.maxX),0,'The source closes to a point without an exposed end wall');
for(const x of [520,525,540])assert.equal(riverMask(x,riverZ(x)),0,'No water slab extends beyond the source');
for(const x of [-55,-48,-40,-32,-28])assert.equal(riverLevel(x),-.18,'The tidal reach meets the ocean mean level');
assert.equal(riverMouthBlend(-48),0);assert.equal(riverMouthBlend(-28),1);
for(let x=-60;x<=0;x+=.5){
 const z=riverZ(x),depth=riverLevel(x)-baseHeight(x,z);
 assert(depth>.3,'The mouth has an uninterrupted submerged channel');
 if(x<shore(z)+10)assert(waterExists(x,z),'Ocean and river wet footprints overlap at the mouth');
}
// The actual half-metre collision grid remains continuous where the river crosses
// tile boundaries; no geometry-only mask can hide a dry dam in the wheel surface.
const field=new SandField();
for(let x=-55;x<500;x+=.5)assert(field.height(x,riverZ(x))<riverLevel(x)-.24,'Collision bed follows the continuous water channel');
let steepest=0;
for(let n=1;n<LANDMARKS.length;n++){
 const a=LANDMARKS[n-1],b=LANDMARKS[n],steps=Math.ceil(Math.hypot(b.x-a.x,b.z-a.z)*2);let last=baseHeight(a.x,a.z);
 for(let i=1;i<=steps;i++){
  const x=a.x+(b.x-a.x)*i/steps,z=a.z+(b.z-a.z)*i/steps,h=baseHeight(x,z),step=Math.hypot(b.x-a.x,b.z-a.z)/steps;
  steepest=Math.max(steepest,Math.abs(h-last)/step);last=h;
 }
}
assert(steepest<.65,'The revised river banks leave every waypoint approach passable');
console.log({riverCrossingDepths:[248,475].map(x=>riverLevel(x)-baseHeight(x,riverZ(x))),maxBankError,steepest,deepest,sourceDepth:shallowest});
console.log('River channel: continuous mouth, shallow crossings, matching bank waterlines, closed source, ripple bounds and route grades passed.');
