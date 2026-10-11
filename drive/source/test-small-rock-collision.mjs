import assert from 'node:assert/strict';
import * as THREE from 'three/webgpu';
import {DrivePhysics,RAPIER} from './physics.mjs';
import {BeachObstacles} from './obstacles.mjs';
// Small embedded stones use exact instance geometry, including the canyon's
// parent-rebased world-coordinate instances. No invisible oversized barriers.
const p=await DrivePhysics.create(),geometry=new THREE.IcosahedronGeometry(1,0),material=new THREE.MeshBasicMaterial();
const ridgeScree=new THREE.InstancedMesh(geometry,material,1),canyonRocks=new THREE.InstancedMesh(geometry,material,1),matrix=new THREE.Matrix4();
canyonRocks.userData.worldCoordinates=true;
const life={key:'small',ridgeScree,canyonRocks},solid=new BeachObstacles(p),positions=[{x:1,y:.1,z:-3},{x:-1,y:.1,z:-4}];
function write(){[ridgeScree,canyonRocks].forEach((mesh,i)=>{const a=positions[i];mesh.setMatrixAt(0,matrix.compose(new THREE.Vector3(a.x-(i?0:p.origin.x),a.y,a.z-(i?0:p.origin.z)),new THREE.Quaternion(),new THREE.Vector3(.3,.2,.2)));});ridgeScree.userData.detailKey=String(p.origin.x);}
p.reset(0,0,0);write();solid.refresh(life,{budgeted:true});assert.equal(solid.colliders.length,2);
const handles=solid.colliders.map(c=>c.handle);
for(let round=0;round<2;round++){
 for(const mesh of [ridgeScree,canyonRocks]){
  const e=solid.groups.get(mesh).entries[0],ray=new RAPIER.Ray({x:e.x-p.origin.x,y:2,z:e.z-p.origin.z},{x:0,y:-1,z:0});
  const distance=e.collider.castRay(ray,4,true);assert(distance>1.69&&distance<1.9,'Contact matches the visible stone, not a large proxy');
  const probe=p.world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(e.localX,1,e.localZ));
  const c=p.world.createCollider(RAPIER.ColliderDesc.ball(.04).setMass(.2),probe);let contact=false;
  for(let i=0;i<100;i++){p.world.step();p.world.contactPair(c,e.collider,()=>{contact=true})}assert(contact,'A small stone physically stops a falling body');p.world.removeRigidBody(probe);
 }
 if(round===0){p.rebase(512,-512);write();solid.refresh(life,{budgeted:true});assert.deepEqual(solid.colliders.map(c=>c.handle),handles,'Rebasing retains collision identity');}
}
solid.dispose();p.dispose();ridgeScree.dispose();canyonRocks.dispose();geometry.dispose();material.dispose();
console.log('Small-rock collisions: exact shoulder/canyon shapes, rigid contact, world/local origins and retained identity passed.');
