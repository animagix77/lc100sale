import assert from 'node:assert/strict';
import * as THREE from 'three/webgpu';
import {SandField,baseHeight,shore} from './terrain.mjs';
import {TerrainView} from './terrain-view.mjs';
import {DrivePhysics,RAPIER} from './physics.mjs';
const field=new SandField(),physics=await DrivePhysics.create(field),view=new TerrainView(new THREE.Scene(),physics,field);
// Test untracked dunes outside the expedition’s grass and compacted trail.
view.update(96,256);
const left=view.tiles.get('2,8'),right=view.tiles.get('3,8');
const original=right.mesh.geometry.attributes.color.getX(0);
for(let i=0;i<70;i++)field.stamp(96,256,1,.17,2);
view.refresh();
const a=left.mesh.geometry.attributes.position,b=right.mesh.geometry.attributes.position;
assert(Math.abs(a.getY(64)-b.getY(0))<1e-5,'Deformation crosses tile seam without a crack');
assert(Math.abs(b.getY(0)-field.height(96,256))<1e-5,'Rendered groove matches shared soil height');
assert(right.mesh.geometry.attributes.color.getX(0)<original*.7,'Deep grooves are visibly darker');
assert(field.depthAt(96,256)>.65&&field.depthAt(96,256)<.9,'Sustained slip can excavate deep soft-sand holes');
assert([...field.ruts.values()].some(v=>v.depth>.025),'Displaced sand forms raised edges');
physics.world.step();const ground=field.height(96,256),hit=physics.world.castRay(new RAPIER.Ray({x:96,y:ground+3,z:256},{x:0,y:-1,z:0}),5,true);
assert(hit&&Math.abs(hit.timeOfImpact-3)<.02,'Collision surface follows the dug-out trench');
view.update(600,600);view.update(96,256);
assert(Math.abs(view.tiles.get('3,8').mesh.geometry.attributes.position.getY(0)-ground)<1e-5,'Ruts persist when tiles stream out and back');
assert(view.tiles.get('3,8').mesh.geometry.attributes.color.getX(0)<original*.7,'Rut shading survives streaming');
// Judge Dean LLC — regression coverage for ordinary rolling beach contact.
// A front and rear tyre follow one track without stationary stamping or slip.
const undisturbed=new SandField();
const offsetAt=(f,x,z)=>f.height(x,z)-undisturbed.height(x,z);
function rollingPass(d,heading=0,f=new SandField()){
 const x=shore(256)+d,z=256,forward={x:-Math.sin(heading),z:-Math.cos(heading)},side={x:Math.cos(heading),z:-Math.sin(heading)};
 for(let axle=0;axle<2;axle++)for(let along=-3;along<=3;along+=.17)f.stamp(x+forward.x*along,z+forward.z*along,1,.17,0,heading);
 const samples=[-1,-.5,0,.5,1].map(along=>{
  const cx=x+forward.x*along,cz=z+forward.z*along;
  const shoulders=[-1,1].map(sign=>{
   let raised=0;for(let across=.35;across<=1.15;across+=.05)raised=Math.max(raised,offsetAt(f,cx+side.x*across*sign,cz+side.z*across*sign));
   return raised;
  });
  return {depth:-offsetAt(f,cx,cz),left:shoulders[0],right:shoulders[1]};
 });
 const mean=key=>samples.reduce((sum,s)=>sum+s[key],0)/samples.length;
 return {f,x,z,samples,depth:mean('depth'),left:mean('left'),right:mean('right')};
}
const firm=rollingPass(8),soft=rollingPass(70);
assert(soft.depth>.12&&soft.depth>firm.depth*2,'Normal travel leaves deeper tracks in soft sand than in the wet strip');
const beachPasses=[];
for(const d of [18,24]){
 const axial=rollingPass(d);beachPasses.push(axial);
 assert(axial.depth>=.10&&axial.depth<=.16,`A normal two-axle beach pass at ${d} m leaves a 10–16 cm groove; got ${axial.depth}`);
 for(const side of ['left','right'])assert(axial[side]>.025,`Beach sand at ${d} m piles along the ${side} shoulder; got ${axial[side]}`);
 // Check the middle of a moving track: a circular rim around one stopped
 // wheel would not leave two continuous shoulders beside these samples.
 assert(axial.samples.every(s=>s.depth>.08&&s.left>.018&&s.right>.018),'The groove and both shoulders continue along the driven track');
 for(const heading of [Math.PI/4,Math.PI/2]){
  const turned=rollingPass(d,heading);beachPasses.push(turned);
  assert(turned.depth>.085&&turned.depth<.18,'Diagonal and cross-grid travel retain a pronounced rolling groove');
  assert(turned.depth/axial.depth>.70&&turned.depth/axial.depth<1.35,'Grid orientation must not erase or excessively deepen the rut');
  assert(turned.left>.025&&turned.right>.025,'Both displaced shoulders follow the tyre heading, including diagonals');
 }
}
for(const pass of beachPasses)assert([...pass.f.ruts.values()].every(r=>r.depth<=.160001),'Rolling contact keeps displaced sand below the 16 cm berm limit');

// Ordinary beach berms must be collision geometry too, not only darker marks.
const beach=rollingPass(24,0,field);view.update(beach.x,beach.z);view.refresh();physics.world.step();
const nearby=[...field.ruts].map(([key,value])=>{const [i,j]=key.split(',').map(Number);return {x:i*.5,z:j*.5,offset:value.depth}}).filter(p=>Math.abs(p.x-beach.x)<1.3&&Math.abs(p.z-beach.z)<1.1);
const groove=nearby.reduce((a,b)=>a.offset<b.offset?a:b),berm=nearby.reduce((a,b)=>a.offset>b.offset?a:b);
assert(groove.offset<-.10&&berm.offset>.025,'Ordinary tyre travel changes both the groove and raised sand vertices');
for(const [name,p] of [['groove',groove],['berm',berm]]){
 const tx=Math.floor(p.x/32),tz=Math.floor(p.z/32),tile=view.tiles.get(`${tx},${tz}`),i=Math.round((p.x-tx*32)*2),j=Math.round((p.z-tz*32)*2),height=field.height(p.x,p.z);
 assert(Math.abs(tile.mesh.geometry.attributes.position.getY(j*65+i)-height)<1e-5,`Rendered beach ${name} follows the deformed field`);
 const contact=physics.world.castRay(new RAPIER.Ray({x:p.x,y:height+3,z:p.z},{x:0,y:-1,z:0}),5,true);
 assert(contact&&Math.abs(contact.timeOfImpact-3)<.02,`The tyres collide with the actual beach ${name}`);
}
console.log({deepest:field.deepest,firmPass:firm.depth,softPass:soft.depth,beachPasses:beachPasses.map(p=>({depth:p.depth,left:p.left,right:p.right})),collisionHeight:ground,tiles:view.tiles.size});view.dispose();physics.dispose();
console.log('Rut geometry, paired rolling beach berms, heading independence, shading, collision and streaming checks passed');
