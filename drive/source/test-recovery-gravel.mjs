// Judge Dean LLC — recovery placement with the game's physical pebble system enabled.
import assert from 'node:assert/strict';
import * as THREE from 'three/webgpu';
import {DrivePhysics,RAPIER,wheelLayout} from './physics.mjs';
import {Recovery} from './recovery.mjs';
import {LoosePebbles} from './loose-pebbles.mjs';
const dt=1/120,field={height:()=>0,depthAt:()=>0,stamp(){}};
for(const mobile of [false,true]){
 const scene=new THREE.Scene(),p=await DrivePhysics.create(field),r=new Recovery(p);
 const ground=p.world.createCollider(RAPIER.ColliderDesc.cuboid(30,.2,30).setTranslation(100,-.2,0));
 p.reset(100,0,0);const gravel=new LoosePebbles(scene,p,field,{mobile});
 const run=(seconds,input={brake:true})=>{for(let i=0;i<seconds*120;i++)p.step(dt,input)};
 run(3);const before=p.position();
 assert(gravel.tyres.every(t=>t.collider.isEnabled()),'Real tire push colliders are present');
 // This used to report the upper tire surface and place boards about 77 cm high.
 assert.equal(r.deploy(),'ok');
 console.log('Recovery with tire push shapes',{mobile,boardHeights:r.boards.map(b=>b.position.y)});
 assert(r.boards.every(b=>Math.abs(b.position.y-.022)<.015),'Boards must sit on ground, not on the truck’s tire push shapes');
 assert.deepEqual(p.position(),before,'Placing boards never teleports the truck');
 run(1.5);assert.equal(r.state,'ground');assert(r.boards.every(b=>b.collider));
 for(let i=0;i<4;i++){
  const c=p.vehicle.wheelContactPoint(i);assert(p.vehicle.wheelIsInContact(i));
  assert(r.supports(c.x+p.origin.x,c.z+p.origin.z,c.y),'Each tire is supported by its own board');
 }
 assert(Math.abs(p.position().y-before.y)<.12,'Deployment does not kick the chassis into the air');
 // Redeployment must not stack on old board colliders.
 const old=r.boards.map(b=>b.collider);assert.equal(r.deploy(),'ok');
 assert(old.every(c=>!c.isValid()));assert(r.boards.every(b=>Math.abs(b.position.y-.022)<.015));
 run(1);p.setRange('LO');p.setCenterLock(true);run(8,{gas:true});
 assert(p.position().z<before.z-5,'Truck drives off the physical boards');assert.equal(r.state,'roof','Boards pack away after driving clear');
 // Ignore dynamic gravel and trigger volumes, but keep actual solid rocks.
 p.reset(100,0,0);run(3);
 const rock=gravel.pool.find(s=>s.radius===.105),w=wheelLayout[0];
 rock.body.setEnabled(true);rock.body.setTranslation({x:100+w.x,y:.3,z:w.z},true);
 const sensor=p.world.createCollider(RAPIER.ColliderDesc.cuboid(.4,.1,.8).setTranslation(100+wheelLayout[1].x,.5,wheelLayout[1].z).setSensor(true));
 p.world.step();assert.equal(r.deploy(),'ok');assert(r.boards.every(b=>Math.abs(b.position.y-.022)<.015),'Loose stones and sensors are not stable recovery supports');r.clear();rock.body.setEnabled(false);p.world.removeCollider(sensor,true);
 const solid=p.world.createCollider(RAPIER.ColliderDesc.cuboid(.4,.2,.8).setTranslation(100+w.x,.2,w.z-.32));
 p.world.step();assert.equal(r.deploy(),'ok');assert(r.boards[0].position.y>.40,'A fixed rock still supports a board');assert(r.boards[1].position.y<.05);run(1);r.clear();p.world.removeCollider(solid,true);
 // Rebase terrain and the truck, then deploy again using world-space placement.
 p.reset(100,0,0);run(3);p.rebase(96,0);ground.setTranslation({x:4,y:-.2,z:0});run(.2);
 assert.equal(r.deploy(),'ok');run(1);
 assert(r.boards.every(b=>Math.abs(b.position.y-.022)<.015&&Math.abs(b.collider.translation().x-(b.position.x-96))<.001),'Placement remains correct after world-origin shifts');
 r.clear();gravel.dispose();p.dispose();
}
console.log('Recovery/gravel integration: ground placement, tire support, no chassis kick, redeploy, escape/stow, debris/sensor filtering, fixed rocks and rebasing passed.');
