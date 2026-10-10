// Judge Dean LLC — physical load response, recovery, moving contact and crossing.
import assert from 'node:assert/strict';
import {DrivePhysics,RAPIER} from './physics.mjs';
import {BRIDGE_SPEC as S} from './canyon-bridge.mjs';
import * as THREE from 'three/webgpu';
import {SandField} from './terrain.mjs';
import {TerrainView} from './terrain-view.mjs';
const dt=1/120,p=await DrivePhysics.create(),b=p.bridge;p.reset(0,0,0);
function frame(load=false){p.world.timestep=dt;b.beforeStep(dt);if(load){p.vehicle.updateVehicle(dt,0,undefined,c=>b.has(c));b.applyWheelLoads(dt)}p.world.step();b.afterStep(dt)}
for(let i=0;i<600;i++)frame();
const middle=b.segments[10],empty=middle.body.translation().y;
assert.equal(b.segments.length,20);assert(b.segments.every(s=>s.body.isDynamic()));assert.equal(b.anchor.numColliders(),0,'Fixed cable supports have no invisible road collider');
for(const a of b.abutments)assert(Math.abs(a.body.translation().z-S.centerZ)-.675>S.span/2,'Every fixed landing sill stops outside the suspended span');
p.reset(S.centerX,S.centerZ,79);
for(let i=0;i<960;i++)frame(true);
const sag=empty-middle.body.translation().y;
assert(sag>.08&&sag<.8,`Actual full vehicle load deflects suspended deck: ${sag}`);
assert(p.position().y>78.5,'Truck remains supported by dynamic deck');
const loadedPose=b.poses()[10].position;
p.rebase(600,-400);for(let i=0;i<240;i++)frame(true);
assert(Math.abs(b.poses()[10].position.y-loadedPose.y)<.025&&p.position().y>78.5,'Loaded rebase preserves support without a reset');
p.rebase(-600,400);for(let i=0;i<120;i++)frame(true);
// Check the installed Rapier implementation does not already react suspension
// into the deck; the explicit reciprocal load must not duplicate that impulse.
const deck=b.segment(p.vehicle.wheelGroundObject(0)),before=deck.body.linvel().y;
b.beforeStep(dt);p.vehicle.updateVehicle(dt,0,undefined,c=>b.has(c));assert(Math.abs(deck.body.linvel().y-before)<1e-4);b.applyWheelLoads(dt);assert(deck.body.linvel().y<before-.02,'Matching suspension impulse acts on the deck');
p.reset(0,0,0);for(let i=0;i<1800;i++)frame();
assert(Math.abs(empty-middle.body.translation().y)<.025,'After unloading springs recover their equilibrium');
// Uneven parked vehicle weight rolls the actual deck; unloading restores it.
p.reset(S.centerX+.45,S.centerZ,79);for(let i=0;i<480;i++)frame(true);
const loadedRoll=Math.abs(middle.body.rotation().z)*2;
assert(loadedRoll>.015&&loadedRoll<.2,`Off-center vehicle weight produces bounded roll: ${loadedRoll}`);
p.reset(0,0,0);for(let i=0;i<1800;i++)frame();
assert(Math.abs(middle.body.rotation().z)*2<loadedRoll*.2,'Deck roll restores after off-center truck leaves');
// A lateral impulse produces free damped sway, with no animation/time drive.
middle.body.applyImpulse({x:650,y:0,z:0},true);let sway=0;
for(let i=0;i<600;i++){frame();sway=Math.max(sway,Math.abs(middle.body.translation().x-S.centerX))}
assert(sway>.02&&sway<1.2,`Real lateral motion: ${sway}`);
for(let i=0;i<2400;i++)frame();assert(Math.abs(middle.body.translation().x-S.centerX)<sway*.25,'Sway decays after impulse');
const pose=b.poses()[10];b.rebase(600,-400);p.origin.x+=600;p.origin.z-=400;
for(let i=0;i<240;i++)frame();const rebased=b.poses()[10];assert(Math.abs(rebased.position.y-pose.position.y)<.02&&Math.abs(rebased.position.x-pose.position.x)<.03,'Rebasing carries deck and fixed supports together');
assert.equal(b.velocityAt(middle.collider,middle.body.translation()).x,middle.body.linvel().x);
console.log('Suspended bridge physical checks',{vehicleSagM:sag,freeSwayM:sway,loadedRollRadians:loadedRoll,deckBodies:b.segments.length});
b.dispose();b.dispose();p.dispose();

// Traverse the complete suspended span in both directions using the actual
// V8 automatic drivetrain, tyres, suspension, moving ground and bridge hooks.
for(const direction of [-1,1]){
 const p=await DrivePhysics.create();
 for(const z of [-510,-430])p.world.createCollider(RAPIER.ColliderDesc.cuboid(4,2,10).setTranslation(S.centerX,78,z));
 p.reset(S.centerX,direction<0?-432:-508,80);
 if(direction>0)p.rb.setRotation({x:0,y:1,z:0,w:0},true);
 let crossed=false,minY=Infinity,deckContact=false;
 for(let i=0;i<6000;i++){
  p.step(dt,{cruise:i>240,brake:i<=240,turn:0});const pos=p.position();minY=Math.min(minY,pos.y);
  for(let w=0;w<4;w++)deckContact ||= p.bridge.has(p.vehicle.wheelGroundObject(w));
  if(direction*(pos.z-(direction<0?-507:-433))>0){crossed=true;break}
  assert(pos.y>76,'Truck stays on the span throughout crossing');
 }
 assert(crossed&&deckContact,`Automatic vehicle crosses ${direction} using moving deck contacts`);
 console.log('Suspended crossing',{direction,minY,position:p.position()});p.dispose();
}

// Stream the actual ravine colliders, then leave the bridge unloaded for150s.
// This catches self-contact and abutment penetration that a flat fixture misses.
{
 const field=new SandField(),p=await DrivePhysics.create(field),view=new TerrainView(new THREE.Scene(),p,field);
 const geometry=view.geometry.bind(view);view.geometry=(...args)=>args[4]?new THREE.PlaneGeometry(1,1):geometry(...args);
 view.prepareSpawn(S.centerX,-536);p.reset(S.centerX,-536,field.height(S.centerX,-536));
 for(let i=0;i<18000;i++)p.step(dt,{brake:1});
 const maxTilt=Math.max(...p.bridge.segments.map(s=>{const q=s.body.rotation();return 2*Math.acos(Math.min(1,Math.abs(q.w)))}));
 assert(maxTilt<.25,`Terrain-streamed bridge remains unfolded after150seconds: ${maxTilt}`);
 console.log('Long terrain-loaded stability',{seconds:150,maxTiltRadians:maxTilt});view.dispose();p.dispose();
}
