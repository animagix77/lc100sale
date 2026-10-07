import assert from 'node:assert/strict';
import {DrivePhysics,RAPIER} from './physics.mjs';
const dt=1/120,step=(p,input,n)=>{for(let i=0;i<n;i++)p.step(dt,input)};
async function level(x=-20,wet=false){
 const p=await DrivePhysics.create();p.waterHeight=()=>wet?.04:null;
 p.world.createCollider(RAPIER.ColliderDesc.cuboid(2000,.1,2000).setTranslation(x,-.1,0));
 p.reset(x,0,0);step(p,{brake:true},240);return p;
}
function launch(p,speed){p.rb.setLinvel({x:0,y:0,z:-speed},true);for(const w of p.tyres)w.omega=speed/.45;}
// Rear-axle sideways velocity distinguishes an actual tail-out slide from
// the normal center-of-mass sideslip caused by following a curved wheel path.
function rearSlip(p){const v=p.rb.linvel(),f=p.forward();return v.x*-f.z+v.z*f.x+p.rb.angvel().y*1.43;}
const surfaces=[{name:'firm',x:-20,wet:false},{name:'loose',x:100,wet:false},{name:'wet',x:-20,wet:true}],summary=[];
for(const surface of surfaces)for(const locked of [false,true])for(const turn of [-.8,.8]){
 const samples=[];
 for(const handbrake of [false,true]){
  const p=await level(surface.x,surface.wet);p.centerLocked=locked;launch(p,12);
  step(p,{turn},48);step(p,{turn,handbrake},60);
  const sample={yaw:Math.abs(p.rb.angvel().y),rearSlip:Math.abs(rearSlip(p))};
  if(handbrake){
   assert(p.tyres.slice(2).every(w=>w.omega===0),'The sliding rear tread stays locked');
   assert(p.tyres.slice(0,2).every(w=>w.omega>2),'Front wheels keep rolling and steering');
  }
  let previousYaw=p.rb.angvel().y,maxYawStep=0;
  for(let i=0;i<240;i++){p.step(dt,{turn:0,gas:.35});maxYawStep=Math.max(maxYawStep,Math.abs(p.rb.angvel().y-previousYaw));previousYaw=p.rb.angvel().y;}
  assert(Math.abs(rearSlip(p))<.02&&Math.abs(p.rb.angvel().y)<.01,'Straightening and releasing the brake recovers stable grip');
  assert(maxYawStep<.09,'Grip recovery does not snap the chassis rotation');
  assert(p.speed>4&&p.tyres.slice(2).every(w=>w.omega>2),'Power and rear rolling motion resume after release');
  samples.push(sample);p.dispose();
 }
 const [normal,slide]=samples;
 assert(slide.rearSlip>normal.rearSlip*8&&slide.rearSlip>1,'An e-brake pull produces substantial rear-axle slide');
 assert(slide.yaw>normal.yaw*1.2,'E-braking tightens the turn through real tire forces');
 summary.push({surface:surface.name,locked,turn,rearSlip:+slide.rearSlip.toFixed(2),normalSlip:+normal.rearSlip.toFixed(3)});
}
// A straight pull must not invent a sideways shove; held brakes must still park.
for(const speed of [0,3,22.352]){
 const p=await level();launch(p,speed);let maxYaw=0;
 for(let i=0;i<900;i++){p.step(dt,{gas:1,cruise:true,handbrake:true});maxYaw=Math.max(maxYaw,Math.abs(p.rb.angvel().y));}
 assert(Math.abs(p.speed)<.05,'The e-brake overrides throttle/cruise and stops the truck');
 assert(maxYaw<.01,'Straight-line e-braking stays straight, including from 50 mph');
 p.reset(-20,0,0);assert.equal(p.handbrakeSlip,0,'Reset clears residual sliding grip');p.dispose();
}
// Test the physical terminal speed, not only a configuration number. 4LO is unchanged.
for(const [range,lo,hi] of [['HI',49.8,50.1],['LO',5.8,7.1]]){
 const p=await level();p.setRange(range);let min=Infinity,max=-Infinity;
 for(let i=0;i<4800;i++){p.step(dt,{gas:true});if(i>=3600){min=Math.min(min,p.speed*2.236936);max=Math.max(max,p.speed*2.236936);}}
 assert(min>lo&&max<hi,`${range} holds its expected speed: ${min.toFixed(2)}–${max.toFixed(2)} mph`);
 console.log(range,'governor',min,max);p.dispose();
}
console.log('Rear e-brake breakaway, left/right turns, loose/wet grip, center lock, smooth release, stable stopping and governors passed.',summary);
