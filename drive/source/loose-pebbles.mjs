// Judge Dean LLC — bounded, persistent loose gravel with Rapier contact physics.
import * as THREE from 'three/webgpu';
import {RAPIER,wheelLayout} from './physics.mjs';
import {surfaceAt,shore,smooth} from './terrain.mjs';
const CELL=2.4,HISTORY=1024,RADII=[.045,.07,.105];
const rand=(x,z=0)=>{const n=Math.sin(x*127.1+z*311.7)*43758.5453;return n-Math.floor(n)};
export function pebbleHabitat(x,z){
 const s=surfaceAt(x,z);
 return x-shore(z)>12&&s.snow<.12&&s.river<.1&&s.puddle<.22&&s.volcanic<.18&&s.mud<.65&&(s.grass<.35||s.trail>.65||s.riverApproach>.2);
}
export class LoosePebbles{
 constructor(scene,physics,field,{mobile=false}={}){
  Object.assign(this,{scene,physics,field});this.radius=mobile?11:14;this.capacity=mobile?72:120;this.origin={...physics.origin};this.candidateKey='';this.candidates=[];this.active=new Map();this.history=new Map();this.handles=new Set();this.stones=new Map();this.touched=new Set();this.pool=[];this.tyres=[];this.stats={visible:0,moving:0,displaced:0};this.disposed=false;this.snapTyres=true;this.lastTruck=new THREE.Vector3(Infinity,0,0);
  this.dummy=new THREE.Object3D();this.rotation=new THREE.Quaternion();this.steer=new THREE.Quaternion();this.roll=new THREE.Quaternion();this.axle=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),Math.PI/2);this.xAxis=new THREE.Vector3(1,0,0);this.yAxis=new THREE.Vector3(0,1,0);this.center=new THREE.Vector3();this.tint=new THREE.Color();
  const geo=new THREE.IcosahedronGeometry(1,1),pos=geo.attributes.position;
  for(let i=0;i<pos.count;i++){const x=pos.getX(i),y=pos.getY(i),z=pos.getZ(i),rough=.90+.10*Math.sin(x*9+y*5+z*7);pos.setXYZ(i,x*rough,y*rough*.68,z*rough*.86)}geo.computeVertexNormals();geo.computeBoundingBox();this.bottom=-geo.boundingBox.min.y;
  const mat=new THREE.MeshStandardMaterial({color:'#ffffff',roughness:.93,flatShading:true});this.mesh=new THREE.InstancedMesh(geo,mat,this.capacity);this.mesh.count=0;this.mesh.frustumCulled=false;this.mesh.receiveShadow=true;this.mesh.setColorAt(0,new THREE.Color('#827b6d'));scene.add(this.mesh);
  for(let i=0;i<this.capacity;i++){
   const size=i%3,radius=RADII[size],vertices=Float32Array.from(pos.array,v=>v*radius);
   const body=physics.world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setEnabled(false).setCanSleep(true).setCcdEnabled(true).setLinearDamping(.35).setAngularDamping(1.4));
   const collider=physics.world.createCollider(RAPIER.ColliderDesc.convexHull(vertices).setDensity(2450).setFriction(.82).setRestitution(.10).setCollisionGroups(0x0004ffff),body);
   const rock={body,collider,radius,size,key:null,moved:false,sand:false,embedded:false,quiet:0};this.pool.push(rock);this.stones.set(collider.handle,rock);
  }
  // The suspension still samples terrain. These lightweight kinematic wheel
  // shapes exist only to transfer contact momentum into loose dynamic gravel.
  this.originalGroups=physics.chassis.collisionGroups();physics.chassis.setCollisionGroups(0x0001ffff);
  for(let i=0;i<4;i++){
   const body=physics.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased());
   const collider=physics.world.createCollider(RAPIER.ColliderDesc.roundCylinder(.14,.425,.025).setFriction(.95).setRestitution(.02).setCollisionGroups(0x00020004),body);
   this.tyres.push({body,collider});this.handles.add(collider.handle);
  }
  this.movers=[...this.tyres.map(t=>t.collider),physics.chassis];physics.loosePebbles=this;this.beforeStep();
 }
 beforeStep(){
  const p=this.physics.rb.translation(),q=this.physics.rb.rotation();this.rotation.set(q.x,q.y,q.z,q.w);
  const snap=this.snapTyres||this.lastTruck.distanceToSquared(p)>16;
  for(let i=0;i<4;i++){
   const w=wheelLayout[i],t=this.tyres[i],length=this.physics.vehicle.wheelSuspensionLength(i)??.5;
   this.center.set(w.x,.06-length,w.z).applyQuaternion(this.rotation).add(p);
   this.steer.setFromAxisAngle(this.yAxis,w.front?this.physics.steer:0);this.roll.setFromAxisAngle(this.xAxis,-this.physics.tyres[i].angle);
   const rotation=this.dummy.quaternion.copy(this.rotation).multiply(this.steer).multiply(this.roll).multiply(this.axle);
   if(snap){t.body.setTranslation(this.center,false);t.body.setRotation(rotation,false)}
   t.body.setNextKinematicTranslation(this.center);t.body.setNextKinematicRotation(rotation);
  }
  this.lastTruck.copy(p);this.snapTyres=false;
 }
 embed(r){
  const p=r.body.translation(),x=p.x+this.origin.x,z=p.z+this.origin.z;r.rest={x,y:p.y,z,ground:this.field.height(x,z),q:{...r.body.rotation()}};r.embedded=true;r.quiet=0;
  r.body.setLinvel({x:0,y:0,z:0},false);r.body.setAngvel({x:0,y:0,z:0},false);r.body.sleep();
 }
 afterStep(dt){
  // Sand holds settled gravel. Only a real moving-vehicle manifold releases
  // it; rebuilding terrain, gravity and a nearby truck cannot wake a hillside.
  const world=this.physics.world,touched=this.touched;touched.clear();
  for(const collider of this.movers){
   const body=collider.parent(),v=body.linvel(),w=body.angvel();if(Math.hypot(v.x,v.y,v.z)<.08&&Math.hypot(w.x,w.y,w.z)<.2)continue;
   world.contactPairsWith(collider,other=>{const r=this.stones.get(other.handle);if(!r?.key||!r.sand)return;
    world.contactPair(collider,other,m=>{for(let i=0;i<m.numContacts();i++)if(m.contactDist(i)<=.012){touched.add(r);break}});
   });
  }
  for(const r of this.pool)if(r.key&&r.sand){
   if(touched.has(r)){r.embedded=false;r.quiet=0;r.body.wakeUp();continue;}
   if(r.embedded){
    if(!r.body.isSleeping()){const p=r.rest;r.body.setTranslation({x:p.x-this.origin.x,y:p.y,z:p.z-this.origin.z},false);r.body.setRotation(p.q,false);r.body.setLinvel({x:0,y:0,z:0},false);r.body.setAngvel({x:0,y:0,z:0},false);r.body.sleep();}continue;
   }
   let supported=false;
   world.contactPairsWith(r.collider,other=>{if(other.parent()&&!other.parent().isFixed())return;
    world.contactPair(r.collider,other,m=>{if(m.numSolverContacts()>0)for(let i=0;i<m.numContacts();i++)if(m.contactDist(i)<=.015){supported=true;break}});
    // CCD may leave an empty manifold just above the ground. Exact convex
    // distance still lets sand absorb that tiny gap without catching air.
    if(!supported){const contact=r.collider.contactCollider(other,.015);if(contact&&contact.distance<=.015)supported=true;}
   });
   // Airborne stones retain gravity. At ground contact, soil absorbs rolling
   // energy and embeds the stone at its new pose once motion has died away.
   if(!supported){r.quiet=0;continue;}
   const v=r.body.linvel(),speed=Math.hypot(v.x,v.y,v.z),drag=Math.max(0,1-(4+r.soft*3)*dt/Math.max(speed,1e-6))*Math.exp(-8*dt),w=r.body.angvel();
   r.body.setLinvel({x:v.x*drag,y:v.y*drag,z:v.z*drag},false);const spin=Math.exp(-16*dt);r.body.setAngvel({x:w.x*spin,y:w.y*spin,z:w.z*spin},false);
   r.quiet=speed<.35?r.quiet+dt:0;if(r.quiet>.3)this.embed(r);
  }
 }
 rebase(x,z){
  for(const r of this.pool)if(r.key){const p=r.body.translation();r.body.setTranslation({x:p.x-x,y:p.y,z:p.z-z},false)}
  this.origin.x+=x;this.origin.z+=z;this.snapTyres=true;this.beforeStep();
 }
 retire(r){
  const p=r.body.translation();this.history.delete(r.key);this.history.set(r.key,{x:p.x+this.origin.x,y:p.y,z:p.z+this.origin.z,q:{...r.body.rotation()},moved:r.moved,embedded:r.embedded,ground:r.rest?.ground});
  if(this.history.size>HISTORY)this.history.delete(this.history.keys().next().value);
  this.active.delete(r.key);r.key=null;r.body.setEnabled(false);
 }
 stream(p){
  for(const r of this.pool)if(r.key){const at=r.body.translation(),wx=at.x+this.origin.x,wz=at.z+this.origin.z,ground=this.field.height(wx,wz);if(Math.hypot(wx-p.x,wz-p.z)>this.radius+5||at.y<ground-2)this.retire(r);else if(r.embedded&&Math.abs(ground-r.rest.ground)>.001){r.rest.y+=ground-r.rest.ground;r.rest.ground=ground;r.body.setTranslation({x:at.x,y:r.rest.y,z:at.z},false);r.body.sleep();}}
  const cx=Math.floor(p.x/CELL),cz=Math.floor(p.z/CELL),n=Math.ceil(this.radius/CELL),cellKey=cx+','+cz;
  if(this.candidateKey!==cellKey){
   this.candidates=[];this.candidateKey=cellKey;
   for(let ring=0;ring<=n;ring++)for(let dz=-ring;dz<=ring;dz++)for(let dx=-ring;dx<=ring;dx++){
    if(Math.max(Math.abs(dx),Math.abs(dz))!==ring)continue;
    const ix=cx+dx,iz=cz+dz,key=ix+','+iz,seed=rand(ix,iz),size=seed<.4?0:seed<.8?1:2,x=(ix+.12+rand(ix+11,iz)*.76)*CELL,z=(iz+.12+rand(ix,iz+23)*.76)*CELL;
    if(pebbleHabitat(x,z))this.candidates.push({key,size,x,z});
   }
  }
  // Cache habitat sampling by world cell; cap activations independently of FPS.
  let added=0;
  for(const {key,size,x,z} of this.candidates){
   if(added>=12)break;if(this.active.has(key))continue;
   const saved=this.history.get(key),wx=saved?.x??x,wz=saved?.z??z,distance=Math.hypot(wx-p.x,wz-p.z);
   // Never materialize gravel inside a tyre; entering stones fade in at range.
   if(distance<3.2||distance>this.radius)continue;
   const r=this.pool.find(r=>!r.key&&r.size===size);if(!r)continue;
   const ground=this.field.height(wx,wz);if(this.physics.waterHeight(wx,wz,this.physics.time)>ground+.02)continue;const y=saved?.embedded&&Number.isFinite(saved.ground)?saved.y+ground-saved.ground:Math.max(saved?.y??-Infinity,ground+r.radius*this.bottom+.012);
   const s=surfaceAt(wx,wz),sand=(s.biome==='beach'||s.biome==='dunes')&&s.snow<.1&&s.mud<.1&&s.river<.1&&s.volcanic<.1;
   Object.assign(r,{key,x,z,moved:saved?.moved??false,sand,soft:s.soft,embedded:false,quiet:0});r.body.setTranslation({x:wx-this.origin.x,y,z:wz-this.origin.z},false);r.body.setRotation(saved?.q??{x:0,y:0,z:0,w:1},false);r.body.setLinvel({x:0,y:0,z:0},false);r.body.setAngvel({x:0,y:0,z:0},false);r.body.resetForces(false);r.body.resetTorques(false);r.body.setEnabled(true);if(sand&&saved?.embedded!==false)this.embed(r);else r.body.wakeUp();this.active.set(key,r);added++;
  }
 }
 update(p){
  let count=0,moving=0;
  for(const r of this.pool)if(r.key){
   const at=r.body.translation(),q=r.body.rotation(),wx=at.x+this.origin.x,wz=at.z+this.origin.z;
   if(!r.moved&&Math.hypot(wx-r.x,wz-r.z)>r.radius*.5){r.moved=true;this.stats.displaced++}
   if(!r.body.isSleeping())moving++;
   const fade=1-smooth(this.radius,this.radius+4,Math.hypot(wx-p.x,wz-p.z));this.dummy.position.copy(at);this.dummy.quaternion.set(q.x,q.y,q.z,q.w);this.dummy.scale.setScalar(r.radius*fade);this.dummy.updateMatrix();this.mesh.setMatrixAt(count,this.dummy.matrix);
   this.tint.setHSL(.085+rand(r.x,r.z)*.045,.10+rand(r.z,r.x)*.12,.22+rand(r.x+5,r.z)*.22);this.mesh.setColorAt(count++,this.tint);
  }
  this.mesh.count=count;this.mesh.instanceMatrix.needsUpdate=true;this.mesh.instanceColor.needsUpdate=true;this.stats.visible=count;this.stats.moving=moving;
 }
 dispose(){
  if(this.disposed)return;this.disposed=true;for(const r of [...this.pool,...this.tyres])this.physics.world.removeRigidBody(r.body);
  this.physics.chassis.setCollisionGroups(this.originalGroups);if(this.physics.loosePebbles===this)this.physics.loosePebbles=null;this.mesh.removeFromParent();this.mesh.geometry.dispose();this.mesh.material.dispose();this.mesh.dispose();this.active.clear();this.history.clear();this.stones.clear();this.touched.clear();
 }
}
