// Judge Dean LLC — boards may move, but they must not move the driver's view.
import assert from 'node:assert/strict';
import * as THREE from 'three/webgpu';
import {ChaseCamera} from './chase-camera.mjs';
import {CameraOrbit} from './camera-orbit.mjs';
import {MobileCameraFrame} from './mobile-camera-frame.mjs';
import {RecoveryView} from './recovery-view.mjs';
import {Recovery} from './recovery.mjs';
import {DrivePhysics,RAPIER} from './physics.mjs';

let cycles=0;
for(const mobile of [false,true])for(const manual of [false,true]){
 const p=await DrivePhysics.create(),r=new Recovery(p),scene=new THREE.Scene();
 p.world.createCollider(RAPIER.ColliderDesc.cuboid(80,.2,80).setTranslation(0,-.2,0));
 p.reset(0,0,0);for(let i=0;i<240;i++)p.step(1/120,{brake:true});
 const truck=new THREE.Mesh(new THREE.BoxGeometry(2.5,2.8,5.5),new THREE.MeshBasicMaterial());scene.add(truck);
 const frame=new MobileCameraFrame();frame.setSubject(truck);
 const view=new RecoveryView(scene,truck,new THREE.Mesh(new THREE.BoxGeometry(.33,.03,1.15),new THREE.MeshBasicMaterial()),r);
 const camera=new THREE.PerspectiveCamera(48,mobile?390/844:1024/768,.1,1500),chase=new ChaseCamera(),orbit=new CameraOrbit();
 const safe={width:390,height:844,left:14,right:376,top:220,bottom:600};
 const field={height:()=>0};
 if(manual){orbit.nudge('ArrowRight');orbit.nudge('ArrowUp')}
 const update=()=>{
  frame.restore(camera);const local=p.rb.translation(),rot=p.rb.rotation(),world=p.position(),forward=p.forward();
  truck.position.copy(local);truck.quaternion.copy(rot);view.update();orbit.update(1/60,new Set());
  chase.update(camera,1/60,{world,local,forward,heading:Math.atan2(-forward.x,-forward.z),origin:p.origin,field,orbit,narrow:mobile,mobile});
  if(mobile)frame.apply(camera,truck,safe,1/60);
 };
 camera.position.set(4,4,14);for(let i=0;i<900;i++)update();
 const initial=camera.position.clone(),rotation=camera.quaternion.clone(),projection=camera.projectionMatrix.clone();
 assert.equal(r.request(),'ok');const states=new Set();
 // Low-speed rocking used to toggle a recovery close-up at 0.5 m/s. Exercise
 // that threshold while holding the body pose fixed to isolate camera ownership.
 for(let i=0;i<240;i++){
  p.speed=i%2?.49:.51;r.step(1/60);if(i===120)r.stow();update();states.add(r.state);
  assert(camera.position.distanceTo(initial)<1e-8,'Board transitions must not pull the chase position sideways');
  assert(1-Math.abs(camera.quaternion.dot(rotation))<1e-12,'Board transitions must not change the aim');
  camera.projectionMatrix.elements.forEach((v,j)=>assert(Math.abs(v-projection.elements[j])<1e-10,'Board transitions must not change field of view or mobile framing'));
 }
 assert.deepEqual([...states],['deploying','ground','stowing','roof']);
 assert.equal(view.models.filter(m=>m.visible).length,2);assert.equal(r.boards.length,0);
 assert.equal(orbit.active,manual,'Recovery must preserve deliberate orbit choice');
 // Then run an actual vehicle escape: automatic pickup, motion and ground
 // clearance must work together without any camera discontinuity at pickup.
 p.speed=0;assert.equal(r.request(),'ok');p.setRange('LO');const motionStates=new Set();let previous=camera.position.clone(),maxStep=0;
 for(let i=0;i<1200&&!(motionStates.has('stowing')&&r.state==='roof');i++){
  p.step(1/120,{gas:true});p.step(1/120,{gas:true});update();motionStates.add(r.state);
  const step=camera.position.distanceTo(previous);maxStep=Math.max(maxStep,step);previous.copy(camera.position);
  assert(step<.4,'Moving recovery camera must not jump');assert(camera.position.y>=1.2);
  assert(camera.position.toArray().every(Number.isFinite));
 }
 assert(motionStates.has('stowing')&&r.state==='roof','Driving off all four supports must automatically pack the boards');
 console.log('Recovery camera cycle',{mobile,manual,maxStep});cycles++;p.dispose();
}
console.log(`Recovery camera: ${cycles} desktop/phone and chase/manual cycles; rocking, deployment, packing, projection and real-physics auto pickup passed.`);
