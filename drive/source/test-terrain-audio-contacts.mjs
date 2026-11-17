// Judge Dean LLC — tyre foley follows real ray contacts without owning physics.
import assert from 'node:assert/strict';
import {DrivePhysics,RAPIER} from './physics.mjs';

const dt=1/120,p=await DrivePhysics.create();
const floor=p.world.createCollider(RAPIER.ColliderDesc.cuboid(1000,.1,1000).setTranslation(0,-.1,0));
p.waterHeight=()=>-Infinity;
const records=p.tyres.map(w=>w.audioSurface),keys=['sand','snow','mud','gravel','wet','compaction'];

function settle(x,z){
 p.reset(x,z,0);
 for(let i=0;i<240;i++)p.step(dt,{brake:true});
 assert(p.tyres.every((w,i)=>p.vehicle.wheelIsInContact(i)&&w.audioLoad>0),'All four tyres carry genuine Rapier loads');
 for(const [i,w] of p.tyres.entries()){
  assert.equal(w.audioSurface,records[i],'The audio material record is reused');
  assert.deepEqual(Object.keys(w.audioSurface),keys);
  for(const value of Object.values(w.audioSurface))assert(Number.isFinite(value)&&value>=0&&value<=1,'Material weights stay bounded');
  assert(w.audioSurface.sand+w.audioSurface.snow+w.audioSurface.mud+w.audioSurface.gravel<=1.000001,'Material transitions do not double the contact energy');
 }
}
function silentMaterials(label){
 for(const w of p.tyres)assert(Object.values(w.audioSurface).every(v=>v===0),`${label} does not play the loose material below it`);
}

try{
 settle(0,0);
 assert(p.tyres.every(w=>w.audioSurface.sand>.9&&w.audioSurface.snow===0&&w.audioSurface.mud===0),'Dunes produce sand shuffle');
 assert(p.tyres.every(w=>w.audioSurface.wet===0),'Dry sand is not slush');
 p.rb.setLinvel({x:0,y:0,z:-4},true);
 p.step(dt,{});
 assert(p.tyres.every(w=>w.audioSpeed>3.8&&Number.isFinite(w.audioSlip)&&w.audioSlip>=0),'Moving contacts report road speed and tread shear in metres per second');

 settle(312,-600);
 assert(p.tyres.every(w=>w.audioSurface.snow>.9&&w.audioSurface.sand===0),'Snow is classified as snow, never sand just because it is soft');
 settle(365,-489);
 assert(p.tyres.every(w=>w.audioSurface.mud>.9&&w.audioSurface.sand===0),'Mud retains its own squelch material');
 assert(p.tyres.some(w=>w.audioSurface.wet>.1),'Puddles contribute wetness');
 settle(447,-658);
 assert(p.tyres.every(w=>w.audioSurface.gravel>.9&&w.audioSurface.sand===0),'Volcanic terrain supplies mineral crunch');
 settle(190,-278);
 assert(p.tyres.every(w=>w.audioSurface.sand===0),'Grass and forest trails do not become sand');

 // The contacts remain real; only the existing material registries are varied.
 // This isolates a bridge/board/solid's suppression from unrelated geometry.
 settle(0,0);
 p.recovery={step(){},supports(){return true;}};
 p.step(dt,{brake:true});
 silentMaterials('Recovery boards');
 p.recovery=null;
 p.obstacles={has:c=>c?.handle===floor.handle,kind:()=> 'rock'};
 p.step(dt,{brake:true});
 silentMaterials('Embedded rocks');
 p.obstacles=null;
 const originalBridgeHas=p.bridge.has.bind(p.bridge);
 p.bridge.has=c=>c?.handle===floor.handle||originalBridgeHas(c);
 p.step(dt,{brake:true});
 silentMaterials('Timber deck');
 p.bridge.has=originalBridgeHas;
 p.step(dt,{brake:true});
 assert(p.tyres.every(w=>w.audioSurface.sand>.9),'Returning to terrain restores sand contact audio');

 // There must be no lingering material or rolling sound on the first air frame.
 p.rb.setTranslation({x:0,y:12,z:0},true);
 p.rb.setLinvel({x:0,y:0,z:0},true);
 p.step(dt,{});
 assert(p.tyres.every((_,i)=>!p.vehicle.wheelIsInContact(i)),'The vehicle is airborne');
 silentMaterials('Airborne tyres');
 assert(p.tyres.every(w=>w.audioLoad===0&&w.audioSpeed===0&&w.audioSlip===0),'Airborne contact energy clears immediately');

 settle(0,0);
 p.reset(0,0,0);
 silentMaterials('Reset');
 assert(p.tyres.every((w,i)=>w.audioSurface===records[i]&&w.audioLoad===0&&w.audioSpeed===0&&w.audioSlip===0),'Reset clears but never replaces audio records');
 console.log('Terrain audio contacts: sand, snow, mud, mineral, grass, boards, bridge, solid, airborne and reset passed');
}finally{p.dispose();}
