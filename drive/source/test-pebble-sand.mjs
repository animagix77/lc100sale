// Judge Dean LLC — sand holds pebbles until real vehicle contact disturbs them.
import assert from 'node:assert/strict';
import * as THREE from 'three/webgpu';
import {DrivePhysics,RAPIER} from './physics.mjs';
import {LoosePebbles} from './loose-pebbles.mjs';
import {surfaceAt} from './terrain.mjs';
const dt=1/120;
const pose=body=>({p:{...body.translation()},q:{...body.rotation()}});
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
const speed=body=>Math.hypot(...Object.values(body.linvel()));
const groundContact=(p,r)=>{let supported=false;p.world.contactPairsWith(r.collider,c=>{if(c.parent())return;p.world.contactPair(r.collider,c,m=>{for(let i=0;i<m.numContacts();i++)if(m.contactDist(i)<.025)supported=true;});});return supported;};
async function fixture(start,mobile){
 let lowered=0;const slope=.38,field={height:(x,z)=>8+slope*(x-start.x)-lowered},p=await DrivePhysics.create(),scene=new THREE.Scene();
 p.reset(start.x,start.z,field.height(start.x,start.z));
 const makeGround=()=>{
  const vertices=[];for(const [x,z] of [[start.x-100,start.z-100],[start.x+100,start.z-100],[start.x-100,start.z+100],[start.x+100,start.z+100]])vertices.push(x,field.height(x,z),z);
  return p.world.createCollider(RAPIER.ColliderDesc.trimesh(new Float32Array(vertices),new Uint32Array([0,2,1,1,2,3])).setTranslation(-p.origin.x,0,-p.origin.z).setFriction(.9));
 };
 let ground=makeGround();const gravel=new LoosePebbles(scene,p,field,{mobile});
 for(let i=0;i<14;i++)gravel.stream(start);
 const sand=[...gravel.active.values()].filter(r=>['beach','dunes'].includes(surfaceAt(r.x,r.z).biome));assert(sand.length>15,'The inclined sand fixture contains real streamed pebbles');
 // Keep the truck outside the patch. Simply being loaded near a vehicle must not
 // disturb these stones, even though the whole test surface slopes downhill.
 const park=()=>p.reset(start.x,start.z+45,field.height(start.x,start.z+45));park();
 const step=(n,input={brake:true})=>{for(let i=0;i<n;i++)p.step(dt,input);};
 return {start,mobile,field,p,gravel,sand,park,step,replaceGround(){p.world.removeCollider(ground,true);ground=makeGround();},lowerGround(amount){lowered+=amount;p.world.removeCollider(ground,true);ground=makeGround();},rebase(x,z){p.rebase(x,z);ground.setTranslation({x:-p.origin.x,y:0,z:-p.origin.z});},dispose(){gravel.dispose();p.dispose();}};
}
for(const [start,mobile] of [[{x:-12,z:0},false],[{x:60,z:0},true]]){
 const f=await fixture(start,mobile),{p,gravel,sand,step}=f;
 const initial=new Map(sand.map(r=>[r.key,pose(r.body)]));step(720);
 for(const r of sand){assert(distance(r.body.translation(),initial.get(r.key).p)<.0001,'Untouched sand pebbles stay planted on a 21-degree slope');assert(r.body.isSleeping(),'Untouched sand pebbles remain asleep');}
 // Terrain streaming/rut reconstruction can wake contact islands. Such a wake
 // is not tyre contact and must not release an embedded stone.
 f.replaceGround();for(const r of sand)r.body.wakeUp();step(240);
 for(const r of sand)assert(distance(r.body.translation(),initial.get(r.key).p)<.0001,'Replacing the collision surface does not start a sand avalanche');
 f.rebase(512,-512);step(120);
 for(const r of sand){const at=r.body.translation(),old=initial.get(r.key);assert(distance({x:at.x+512,y:at.y,z:at.z-512},old.p)<.0002,'Origin shifts preserve each embedded world position');assert.deepEqual({...r.body.rotation()},old.q,'Origin shifts preserve each embedded orientation');}
 const retained=sand.find(r=>Math.hypot(r.x-start.x,r.z-start.z)>5&&Math.hypot(r.x-start.x,r.z-start.z)<9);assert(retained);
 const retainedKey=retained.key,before=pose(retained.body);gravel.retire(retained);gravel.stream(start);const restored=gravel.active.get(retainedKey);assert(restored,'A nearby retired stone streams back into the pool');step(240);
 assert(distance(restored.body.translation(),before.p)<.0002,'Revisiting restores the embedded location without restarting gravity');
 // Select a naturally streamed rock and drive a real suspension-following tyre
 // across it. Contact, sideways movement and rotation must still be simulated.
 const rock=[...gravel.active.values()].find(r=>r.radius>=.07&&Math.abs(r.x-start.x)<5&&Math.abs(r.z-start.z)<8);assert(rock,'A larger nearby sand pebble is available for the contact drive');
 const at=rock.body.translation(),wx=at.x+p.origin.x,wz=at.z+p.origin.z,original=pose(rock.body),truck={x:wx+.80,z:wz+5};p.reset(truck.x,truck.z,f.field.height(truck.x,truck.z));step(180);
 let contact=false,first=-1,peakSpeed=0,maxTurn=0,maxDisplacement=0;
 for(let i=0;i<720;i++){
  p.step(dt,{gas:true});maxDisplacement=Math.max(maxDisplacement,distance(rock.body.translation(),original.p));peakSpeed=Math.max(peakSpeed,speed(rock.body));maxTurn=Math.max(maxTurn,Math.abs(rock.body.rotation().w-original.q.w));
  p.world.contactPairsWith(rock.collider,c=>{if(!gravel.handles.has(c.handle))return;p.world.contactPair(rock.collider,c,m=>{for(let j=0;j<m.numContacts();j++)if(m.contactDist(j)<.005)contact=true;});});
  if(contact&&first<0)first=i;if(first>=0&&i-first>=100)break;
 }
 assert(contact,'A sand pebble is released by an actual Rapier tyre contact');
 assert(maxDisplacement>rock.radius*.2,'The tyre can agitate an embedded sand pebble');assert(peakSpeed>.10,'Tyre contact transfers physical velocity');assert(maxTurn>.002,'Tyre contact turns the pebble');
 f.park();step(720);const settled=pose(rock.body);assert(rock.body.isSleeping()||speed(rock.body)<.035,'Agitated sand pebbles settle promptly');
 assert(groundContact(p,rock)||rock.body.translation().y-f.field.height(rock.body.translation().x+p.origin.x,rock.body.translation().z+p.origin.z)<rock.radius+.035,'Settling never freezes a stone in midair');
 step(720);assert(distance(rock.body.translation(),settled.p)<.0002,'After settling, an agitated sand pebble does not resume rolling downhill');
 // Sand deformation can lower the supporting ground without direct stone
 // contact. Loaded and retired rest poses must follow vertically, never hover.
 const seated=[...gravel.active.values()].filter(r=>r.sand&&r.embedded&&r.body.isSleeping()&&Math.hypot(r.body.translation().x+p.origin.x-start.x,r.body.translation().z+p.origin.z-start.z)>5&&Math.hypot(r.body.translation().x+p.origin.x-start.x,r.body.translation().z+p.origin.z-start.z)<9);assert(seated.length>=2);
 const resident=seated[0],historic=seated[1],residentBefore=pose(resident.body),historicBefore=pose(historic.body),historicKey=historic.key;gravel.retire(historic);f.lowerGround(.18);gravel.stream(start);const reseated=gravel.active.get(historicKey);assert(reseated,'The buried history stone is restored after deformation');step(240);
 for(const [r,before] of [[resident,residentBefore],[reseated,historicBefore]]){const at=r.body.translation();assert(Math.abs(at.y-(before.p.y-.18))<.001,`Embedded stones follow a lowered sand surface: ${JSON.stringify({key:r.key,sand:r.sand,embedded:r.embedded,at,before,rest:r.rest})}`);assert(Math.hypot(at.x-before.p.x,at.z-before.p.z)<.0002,'Ground deformation cannot restart lateral rolling');assert.deepEqual({...r.body.rotation()},before.q,'Ground deformation retains the embedded orientation');}
 console.log({surface:surfaceAt(start.x,start.z).biome,mobile,restingStones:sand.length,tyreContact:contact,agitationSpeed:peakSpeed,displaced:distance(settled.p,original.p)});f.dispose();
}
// A released pebble must finish an airborne fall before the sand catches it.
// Elevating an already-contacted body isolates this from how high a particular
// tyre strike happens to launch it, while preserving the normal release path.
for(const revisit of [false,true]){
 const f=await fixture({x:-12,z:0},false),{p,gravel,step}=f;
 let rock=[...gravel.active.values()].find(r=>r.radius>=.07&&Math.abs(r.x+12)<5&&Math.abs(r.z)<8);assert(rock);
 const at=rock.body.translation(),truck={x:at.x+.80,z:at.z+5};p.reset(truck.x,truck.z,f.field.height(truck.x,truck.z));step(180);let hit=false;
 for(let i=0;i<720&&!hit;i++){p.step(dt,{gas:true});p.world.contactPairsWith(rock.collider,c=>{if(!gravel.handles.has(c.handle))return;p.world.contactPair(rock.collider,c,m=>{for(let j=0;j<m.numContacts();j++)if(m.contactDist(j)<.005)hit=true;});});}
 assert(hit,'The airborne check starts with a real tyre-released pebble');
 const lifted={...rock.body.translation()};lifted.y+=1.5;rock.body.setTranslation(lifted,true);rock.body.setLinvel({x:0,y:0,z:0},true);f.park();step(24);
 assert(rock.body.translation().y<lifted.y-.12&&rock.body.linvel().y<-1.5,'A released airborne pebble continues falling under gravity');
 if(revisit){const airborneKey=rock.key;gravel.retire(rock);gravel.stream(f.start);rock=gravel.active.get(airborneKey);assert(rock,'The airborne stone can stream back in');}
 step(720);assert(rock.body.isSleeping()||speed(rock.body)<.035,'The airborne pebble settles after landing');const landed=rock.body.translation();assert(landed.y-f.field.height(landed.x,landed.z)<rock.radius+.035,'Sand absorption only captures a grounded pebble');f.dispose();
}
console.log('Sand pebble rest, inclined terrain, terrain replacement, wake rejection, rebasing, history, physical tyre agitation, airborne gravity, deformation anchoring and stable settling passed.');
