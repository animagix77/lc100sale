import assert from 'node:assert/strict';
import * as THREE from 'three/webgpu';
import {LAVA_CROSSING,lavaCrossingPoint,lavaCrossingProfile} from './lava-crossing.mjs';
import {LavaCrossingView} from './lava-crossing-view.mjs';
import {baseHeight,lavaSurfaceHeight,SandField,clamp} from './terrain.mjs';
import {DrivePhysics,RAPIER} from './physics.mjs';
import {BeachObstacles} from './obstacles.mjs';
import {TerrainView} from './terrain-view.mjs';
import {LANDMARKS} from './expedition.mjs';

// A single invertible footprint drives terrain, flowing lava, and the solid crossing.
assert.equal(lavaCrossingProfile(0,0),null);
for(const s of [-85,-50,-5,0,5,50,85])for(const u of [-3,0,3]){
 const point=lavaCrossingPoint(s,u),profile=lavaCrossingProfile(point.x,point.z);
 if(Math.abs(s)===85){assert.equal(profile,null,'The channel closes at both finite ends');continue;}
 assert(profile&&Math.abs(profile.s-s)<1e-8&&Math.abs(profile.u-u)<1e-8,'Channel coordinates round-trip in world space');
}
for(let s=-70;s<=70;s+=2){
 if(Math.abs(s)<5)continue;
 const center=lavaCrossingPoint(s),profile=lavaCrossingProfile(center.x,center.z);
 for(const fraction of [-.9,-.5,0,.5,.9]){
  const at=lavaCrossingPoint(s,profile.width*fraction),depth=lavaSurfaceHeight(at.x,at.z)-baseHeight(at.x,at.z);
  assert(depth>.75&&depth<1.1,'Molten sheets follow the sloping recessed channel bed');
 }
 for(const side of [-1,1]){
  const bank=lavaCrossingPoint(s,side*(profile.width+3));
  assert(baseHeight(bank.x,bank.z)-lavaSurfaceHeight(bank.x,bank.z)>.5,'Both outer banks enclose the local sloping liquid surface');
 }
}
const a=LANDMARKS[14],b=LANDMARKS[15],routeLength=Math.hypot(b.x-a.x,b.z-a.z),field=new SandField();let steepest=0;
for(let d=0;d<=routeLength;d+=.25)for(const side of [-2.1,-.962,0,.962,2.1]){
 const x=a.x+(b.x-a.x)*d/routeLength-LAVA_CROSSING.tz*side,z=a.z+(b.z-a.z)*d/routeLength+LAVA_CROSSING.tx*side,p=lavaCrossingProfile(x,z);
 if(p){assert.equal(p.causeway,1,'A full truck-width line between flags remains dry and uncut');assert(baseHeight(x,z)>lavaSurfaceHeight(x,z)+.5,'The driveable basalt bench sits above lava');}
 const ahead={x:x+LAVA_CROSSING.tx*.25,z:z+LAVA_CROSSING.tz*.25};steepest=Math.max(steepest,Math.abs(field.height(ahead.x,ahead.z)-field.height(x,z))/.25);
}
assert(steepest<.4,'The complete route 14–15 causeway keeps a crawlable grade');

for(const mobile of [false,true]){
 const scene=new THREE.Scene(),view=new LavaCrossingView(scene,{mobile}),p=await DrivePhysics.create(),solid=new BeachObstacles(p,{radius:Infinity}),life={key:'lava-test',lavaRocks:view.rocks};
 const geometry=view.lava.geometry,positions=geometry.attributes.position;assert(positions.count<2000,'Molten geometry stays within its fixed mobile/desktop budget');
 assert([...positions.array,...geometry.attributes.normal.array,...geometry.attributes.uv.array].every(Number.isFinite),'Molten geometry contains only finite attributes');
 let buriedEnds=0;
 for(let i=0;i<positions.count;i++){
  const x=positions.getX(i),y=positions.getY(i),z=positions.getZ(i),profile=lavaCrossingProfile(x,z);assert(profile,'Every liquid vertex lies inside the shared finite channel');
  assert(Math.abs(profile.s)>4.34,'Both liquid sheets stop clear of the dry crossing');
  const offset=lavaSurfaceHeight(x,z)-y;assert(offset>-.001&&offset<.057,'Liquid vertices match their sloping terrain surface with only the narrow edge inset');
  if(profile.end>.99)assert(y-baseHeight(x,z)>.7,'Visible molten vertices sit above the recessed bed');
  if(Math.abs(profile.s)>82)buriedEnds+=y<baseHeight(x,z)?1:0;
 }
 assert(buriedEnds>0,'The far ends disappear into the banks without exposed hanging sheets');
 assert.equal(view.rockPoints.filter(r=>r.crawl).length,18,'Both tire lines have a finite series of embedded basalt obstacles');
 assert(view.rocks.count<90,'Bank details retain a fixed collision and instance budget');
 const baseColliderCount=p.world.colliders.len();solid.refresh(life);assert.equal(solid.colliders.length,view.rocks.count,'Every rendered basalt stone has physical geometry');
 const handles=solid.colliders.map(c=>c.handle),matrix=new THREE.Matrix4(),raycaster=new THREE.Raycaster();
 const verifySurfaces=()=>{
  view.rocks.updateMatrixWorld(true);view.rocks.computeBoundingSphere();
  for(let i=0;i<view.rockPoints.length;i++){
   view.rocks.getMatrixAt(i,matrix);const origin=new THREE.Vector3(matrix.elements[12],matrix.elements[13]+4,matrix.elements[14]);raycaster.set(origin,new THREE.Vector3(0,-1,0));
   const hit=raycaster.intersectObject(view.rocks).find(h=>h.instanceId===i);assert(hit,'The rendered rock has a top surface above its embedded center');
   const toi=solid.colliders[i].castRay(new RAPIER.Ray(origin,{x:0,y:-1,z:0}),10,true);assert(Math.abs(toi-hit.distance)<.001,'Collision triangles exactly follow rendered basalt surfaces');
   assert.equal(solid.kind(solid.colliders[i]),'rock');
  }
 };
 verifySurfaces();const initial=view.rocks.instanceMatrix.array.slice();view.update(8,p.origin);solid.refresh(life);assert.deepEqual(view.rocks.instanceMatrix.array,initial);assert.equal(view.clock.value,8);
 life.key='next-scenery-cell';solid.refresh(life);assert.deepEqual(solid.colliders.map(c=>c.handle),handles,'Streaming nearby scenery reuses the persistent basalt colliders');
 p.rebase(512,-512);view.update(9,p.origin);solid.refresh(life);assert.deepEqual(solid.colliders.map(c=>c.handle),handles,'Origin shifts translate existing basalt colliders instead of rebuilding');verifySurfaces();
 assert.equal(view.group.position.x,-512);assert.equal(view.group.position.z,512);
 assert.equal(p.world.colliders.len(),baseColliderCount+view.rocks.count,'Repeated refreshes never leak colliders');
 let disposed=0;for(const asset of [view.lava.geometry,view.lava.material,view.rocks.geometry,view.rocks.material])asset.addEventListener('dispose',()=>disposed++);
 solid.dispose();assert.equal(p.world.colliders.len(),baseColliderCount);assert.equal(p.obstacles,null);view.dispose();assert.equal(disposed,4,'Every lava and basalt GPU asset is disposed');assert.equal(scene.children.length,0);p.dispose();
}
const still=new LavaCrossingView(new THREE.Scene(),{reduced:true});still.update(20,{x:0,z:0});assert.equal(still.clock.value,0,'Reduced motion freezes molten flow');still.dispose();
console.log('Lava crossing geometry: shared channel, dry graded causeway, matched rendered/physical basalt, collider reuse, rebasing, fixed budgets and disposal passed.');

// Exercise the actual tire rays, chassis, terrain triangles and embedded stones in 4LO.
for(const direction of [-1,1]){
 const f=new SandField(),p=await DrivePhysics.create(f),scene=new THREE.Scene(),terrain=new TerrainView(scene,p,f),crossing=new LavaCrossingView(scene),solid=new BeachObstacles(p),life={key:'crawl',lavaRocks:crossing.rocks};
 const geometry=terrain.geometry.bind(terrain);terrain.geometry=(...args)=>args[4]?new THREE.PlaneGeometry(1,1):geometry(...args);
 const start=lavaCrossingPoint(0,-direction*20),target=lavaCrossingPoint(0,direction*22),heading=Math.atan2(-direction*LAVA_CROSSING.tx,-direction*LAVA_CROSSING.tz);
 terrain.update(start.x,start.z);p.reset(start.x,start.z,f.height(start.x,start.z));p.rb.setRotation(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),heading),true);p.setRange('LO');p.setCenterLock(true);crossing.update(0,p.origin);solid.refresh(life);
 for(let i=0;i<240;i++)p.step(1/120,{brake:true});
 let reached=false,contacts=0,minSuspension=1,maxLateral=0,steps=0;const contactWheels=new Set(),contactRocks=new Set();
 for(;steps<9000;steps++){
  const at=p.position(),forward=p.forward(),yaw=Math.atan2(-forward.x,-forward.z),desired=Math.atan2(-(target.x-at.x),-(target.z-at.z)),error=Math.atan2(Math.sin(desired-yaw),Math.cos(desired-yaw));
  terrain.update(at.x,at.z);crossing.update(steps/120,p.origin);solid.refresh(life);if(steps%16===0)terrain.refresh();
  p.step(1/120,{gas:p.speed<2.2,turn:clamp(error*3,-1,1),brake:Math.abs(error)>1&&Math.abs(p.speed)>1.5});p.marks.length=0;p.soundEvents.length=0;
  const now=p.position(),along=(now.x-LAVA_CROSSING.x)*LAVA_CROSSING.tx+(now.z-LAVA_CROSSING.z)*LAVA_CROSSING.tz,lateral=-(now.x-LAVA_CROSSING.x)*LAVA_CROSSING.tz+(now.z-LAVA_CROSSING.z)*LAVA_CROSSING.tx;
  maxLateral=Math.max(maxLateral,Math.abs(lateral));
  for(let i=0;i<4;i++){const collider=p.vehicle.wheelGroundObject(i);if(solid.has(collider)){contacts++;contactWheels.add(i);contactRocks.add(collider.handle);minSuspension=Math.min(minSuspension,p.vehicle.wheelSuspensionLength(i));}}
  if(direction*along>20){reached=true;break;}
 }
 console.log({direction,reached,seconds:steps/120,contacts,rocks:contactRocks.size,wheels:[...contactWheels],minSuspension,maxLateral,position:p.position()});
 assert(reached,'The complete basalt causeway is driveable in both directions in locked 4LO');assert(contacts>0&&contactRocks.size>=4,'Tires climb a sequence of real embedded stones');assert(contactWheels.size===4,'Both axles and both tire tracks contact basalt');assert(minSuspension<.43,'Low embedded stones visibly compress the suspension');assert(maxLateral<1,'The truck stays inside the broad dry bench');
 solid.dispose();crossing.dispose();terrain.dispose();assert.equal(scene.children.length,0);p.dispose();
}
console.log('Lava crossing 4LO crawl: both directions, actual basalt wheel contacts, suspension articulation and dry-line stability passed.');
