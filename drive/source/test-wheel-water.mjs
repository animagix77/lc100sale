import assert from 'node:assert/strict';
import {createWheelWaterState,sampleWheelWater} from './wheel-water.mjs';
import {DrivePhysics,wheelLayout} from './physics.mjs';
const state=createWheelWaterState(),marks=[...state.marks],points=[{x:1,y:4,z:-2},{x:-1,y:4.4,z:-2},{x:1,y:5,z:2},{x:-1,y:4,z:2}];
let ignored=-1;
const physics={origin:{x:128,z:-512},speed:10,tyres:Array.from({length:4},(_,i)=>({contact:i!==3,omega:12,slip:.2,soft:.1})),vehicle:{wheelContactPoint:i=>points[i],wheelIsInContact:i=>physics.tyres[i].contact&&i!==ignored}};
const samples=[];sampleWheelWater(physics,(x,z,t)=>{samples.push({x,z,t});return 4.8},7,state);
assert.equal(state.contact,.5,'Two submerged contacts count; the exposed rock and airborne wheel stay dry');
assert(Math.abs(state.depth-.6)<1e-10,'Audio receives average immersion of only the wet wheels');
assert.deepEqual(state.marks.map(m=>m.active),[true,true,false,false]);
assert.equal(state.marks[1].y,4.4,'Particles use rock contact height, not the lower terrain beneath it');
assert(samples.every(p=>p.t===7&&Math.abs(p.x-128)===1&&p.z<-509),'Samples use world coordinates and the rendering clock');
ignored=1;sampleWheelWater(physics,()=>4.8,7.1,state);assert.equal(state.contact,.25,'A stale cached tyre flag cannot splash after the live wheel leaves a rock');ignored=-1;
const rebased=points.map(p=>({x:p.x+128,z:p.z-512}));physics.origin={x:256,z:-256};for(const p of points){p.x-=128;p.z-=256}
samples.length=0;sampleWheelWater(physics,(x,z,t)=>{samples.push({x,z,t});return 4.8},8,state);
assert.deepEqual(samples.map(({x,z})=>({x,z})),rebased.slice(0,3),'Rebasing preserves the water query locations');
physics.tyres[0].omega=-10;physics.speed=-3;sampleWheelWater(physics,()=>4.8,9,state);assert.equal(state.marks[0].dir,-1,'Reverse water fans follow wheel rotation');
sampleWheelWater(physics,()=>4.025,10,state);assert.equal(state.contact,0,'A water film no deeper than 2.5 cm is not a splash');
sampleWheelWater(physics,()=>-Infinity,11,state);assert.equal(state.depth,0);assert(state.marks.every(m=>!m.active),'Dry contact clears every previous wet record');
for(const w of physics.tyres)w.contact=false;sampleWheelWater(physics,()=>100,12,state);assert.equal(state.contact,0,'Without a current body pose, stale airborne contacts cannot emit water');
for(const w of physics.tyres)w.contact=true;sampleWheelWater(physics,()=>100,13,state);assert.equal(state.depth,1.5,'Unusual deep water cannot create an unlimited audio level');
assert(state.marks.every((m,i)=>m===marks[i]),'Four mutable records are reused each frame');


// Ground contact can disappear during buoyant bobbing even while the tyre is
// still immersed. Its current hub and suspension define that water contact.
{
 const body={x:3,y:.6,z:-4},rotation={x:0,y:0,z:0,w:1},suspension=[.5,.5,.5,.5],grounded=[false,false,false,false];
 const contacts=wheelLayout.map(()=>({x:999,y:-100,z:999}));
 const p={origin:{x:128,z:-512},speed:2,tyres:wheelLayout.map(()=>({contact:false,omega:8,slip:.1,soft:0})),rb:{translation:()=>body,rotation:()=>rotation},vehicle:{wheelIsInContact:i=>grounded[i],wheelContactPoint:i=>contacts[i],wheelSuspensionLength:i=>suspension[i]}};
 const s=createWheelWaterState(),records=[...s.marks],queries=[];
 const sample=(water=.2)=>sampleWheelWater(p,(x,z,time)=>{queries.push({x,z,time});return water},17,s);
 sample();assert.equal(s.contact,1,'Four immersed tyres emit despite having no ground contacts');
 assert(Math.abs(s.depth-.49)<1e-10,'Ungrounded immersion uses the hub, suspension and tyre radius');
 for(let i=0;i<4;i++){
  assert(Math.abs(s.marks[i].x-(131+wheelLayout[i].x))<1e-10);
  assert(Math.abs(s.marks[i].z-(-516+wheelLayout[i].z))<1e-10);
  assert(Math.abs(s.marks[i].y+.29)<1e-10,'Fallback uses fresh body geometry, never the stale ray point');
 }
 assert(queries.every(v=>v.time===17),'Geometric queries use the rendering clock');
 body.y=2;sample();assert.equal(s.contact,0,'Airborne tyres above the water emit nothing');assert.equal(s.depth,0);
 body.y=1.1;suspension.splice(0,4,.8,.2,.8,.2);sample(.5);
 assert.deepEqual(s.marks.map(m=>m.active),[true,false,true,false],'Each wheel uses its own current suspension extension');
 suspension.fill(.5);body.y=1.4;rotation.z=Math.SQRT1_2;rotation.w=Math.SQRT1_2;sample(.5);
 assert.deepEqual(s.marks.map(m=>m.active),[true,false,true,false],'Body roll immerses the low-side tyres, not the raised pair');
 assert(s.marks.filter(m=>m.active).every(m=>Math.abs(m.x-131.44)<1e-10),'Rolled wheel hubs rotate around the current body pose');
 body.y=2.4;rotation.z=1;rotation.w=0;sample(2.5);
 assert.equal(s.contact,1,'Inverted tyres still intersect water at their world-space lower extent');
 sample(2.3);assert.equal(s.contact,0,'An inverted truck above water cannot produce a wake');
 rotation.z=0;rotation.y=Math.SQRT1_2;rotation.w=Math.SQRT1_2;body.y=.6;sample();
 for(let i=0;i<4;i++){
  assert(Math.abs(s.marks[i].x-(131+wheelLayout[i].z))<1e-10,'Yaw rotates the wheel layout');
  assert(Math.abs(s.marks[i].z-(-516-wheelLayout[i].x))<1e-10,'Yaw rotates the wheel layout');
 }
 const before=s.marks.map(({x,y,z})=>({x,y,z}));
 p.origin={x:256,z:-256};body.x-=128;body.z-=256;queries.length=0;sample();
 for(let i=0;i<4;i++)for(const axis of ['x','y','z'])assert(Math.abs(s.marks[i][axis]-before[i][axis])<1e-10,'Floating-origin changes preserve geometric tyre positions');
 assert(queries.every((p,i)=>Math.hypot(p.x-before[i].x,p.z-before[i].z)<1e-10),'Rebased fallback water queries remain world anchored');
 // A real rock contact takes precedence over a geometric lower-extent estimate.
 for(let i=0;i<4;i++){grounded[i]=true;p.tyres[i].contact=true;contacts[i]={x:body.x,y:i===1?.1:1,z:body.z}}
 sample(.2);assert.deepEqual(s.marks.map(m=>m.active),[false,true,false,false],'Exposed rock contacts stay dry even if the geometric fallback would be immersed');
 assert.equal(s.marks[1].y,.1,'Submerged rock particles retain the actual rock contact height');
 // Reset clears the cached tyre flags before the live controller refreshes.
 // Even if its previous ray remains wet, only the new pose may produce water.
 for(const tyre of p.tyres)tyre.contact=false;
 body.y=5;sample(2);assert.equal(s.contact,0,'A dry reset pose cannot reuse wet pre-reset ground contacts');
 body.y=.6;sample(.2);assert.equal(s.contact,1,'A fresh reset pose that is immersed can still disturb water');
 sample(-Infinity);assert.equal(s.contact,0);assert.equal(s.depth,0);assert(s.marks.every(m=>!m.active));
 assert(s.marks.every((m,i)=>m===records[i]),'Geometric fallback retains the same four bounded records');
}

// Exercise actual raycast suspension output while a submerged rigid body has no
// floor to contact: this is the bobbing case that previously suppressed wakes.
{
 const p=await DrivePhysics.create(),s=createWheelWaterState();p.waterHeight=()=>1;p.reset(248,-336,-.3);
 for(let i=0;i<30;i++){
  p.step(1/120,{});sampleWheelWater(p,()=>1,p.time,s);
  assert(p.tyres.every(w=>!w.contact),'The bobbing fixture has no grounded tyres');
  assert.equal(s.contact,1,'Submerged moving tyres continue emitting without a ground ray hit');
 }
 p.rb.setTranslation({x:248,y:5,z:-336},true);sampleWheelWater(p,()=>1,p.time,s);assert.equal(s.contact,0,'The same physical truck produces no water when lifted clear');
 p.dispose();
}
console.log('Wheel water: grounded rock precedence, submerged ungrounded tyres, airborne clearing, per-wheel suspension, roll/yaw/inversion, fresh reset pose, origin shifts and bounded record reuse passed.');
