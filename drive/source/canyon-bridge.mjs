// Judge Dean LLC — constrained rigid timber decks and compliant suspension.
import RAPIER from '@dimforge/rapier3d-compat';
export const BRIDGE_SPEC=Object.freeze({centerX:665,centerZ:-470,span:60,width:4.2,count:20,length:3,halfHeight:.18,height:80,towerHeight:86,deckSag:1,cableSag:3,mass:360,hangerStiffness:11000,hangerDamping:1800});
export function bridgeDeckHeight(z){const u=Math.max(-1,Math.min(1,(z-BRIDGE_SPEC.centerZ)/(BRIDGE_SPEC.span/2)));return BRIDGE_SPEC.height-BRIDGE_SPEC.deckSag*(1-u*u)}
export function bridgeCableHeight(z){const u=Math.max(-1,Math.min(1,(z-BRIDGE_SPEC.centerZ)/(BRIDGE_SPEC.span/2)));return BRIDGE_SPEC.towerHeight-BRIDGE_SPEC.cableSag*(1-u*u)}
/** Reduced-order suspension: timber sections and hanger springs are real
 * rigid bodies/joints. Fixed upper cable nodes approximate a tensioned main
 * cable; this is not a structural engineering model. No fixed span collider. */
export class CanyonBridge{
 constructor(physics){
  this.physics=physics;this.world=physics.world;this.segments=[];this.bodies=[];this.joints=[];this.handles=new Set();this.byHandle=new Map();this.disposed=false;this.abutments=[];
  const s=BRIDGE_SPEC,o=physics.origin||{x:0,z:0};
  // Fixed landing sills stop outside the suspended span; the timber remains
  // supported entirely by its springs and end joints.
  for(const end of [-1,1]){
   const body=this.world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(s.centerX-o.x,s.height-1,s.centerZ+end*(s.span/2+.725)-o.z));
   const collider=this.world.createCollider(RAPIER.ColliderDesc.cuboid(s.width/2+.15,1,.675).setFriction(.9),body);
   this.bodies.push(body);this.abutments.push({body,collider});this.handles.add(collider.handle);
  }
  this.anchor=this.world.createRigidBody(RAPIER.RigidBodyDesc.fixed());this.bodies.push(this.anchor);
  for(let i=0;i<s.count;i++){
   const z=s.centerZ-s.span/2+(i+.5)*s.length,restY=bridgeDeckHeight(z)-s.halfHeight;
   const body=this.world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(s.centerX-o.x,restY,z-o.z).setLinearDamping(.24).setAngularDamping(.8).setCanSleep(false).setCcdEnabled(true));
   const collider=this.world.createCollider(RAPIER.ColliderDesc.cuboid(s.width/2,s.halfHeight,s.length/2+.025).setMass(s.mass).setCollisionGroups(0x0008fff7).setFriction(.9).setRestitution(0),body);
   const segment={body,collider,index:i,z,restY,anchors:[],rails:[]};this.segments.push(segment);this.bodies.push(body);this.handles.add(collider.handle);this.byHandle.set(collider.handle,segment);
   for(const side of [-1,1]){
    const rail=this.world.createCollider(RAPIER.ColliderDesc.cuboid(.055,.065,s.length/2+.025).setTranslation(side*(s.width/2+.03),.70,0).setMass(0).setCollisionGroups(0x0008fff7).setFriction(.5),body);segment.rails.push(rail);this.handles.add(rail.handle);this.byHandle.set(rail.handle,segment);
    const x=s.centerX+side*(s.width/2-.12),y=bridgeCableHeight(z);segment.anchors.push({x,y,z});
    const rest=y-restY-s.mass*9.81/(2*s.hangerStiffness);
    this.joints.push(this.world.createImpulseJoint(RAPIER.JointData.spring(rest,s.hangerStiffness,s.hangerDamping,{x:x-o.x,y,z:z-o.z},{x:side*(s.width/2-.12),y:0,z:0}),this.anchor,body,true));
   }
   if(i){
    const prev=this.segments[i-1],joinY=(prev.restY+restY)/2;
    const joint=this.world.createImpulseJoint(RAPIER.JointData.spherical({x:0,y:joinY-prev.restY,z:s.length/2},{x:0,y:joinY-restY,z:-s.length/2}),prev.body,body,true);joint.setContactsEnabled(false);this.joints.push(joint);
    // Side lashings resist excessive relative roll/yaw without a rigid rail.
    for(const side of [-1,1])this.joints.push(this.world.createImpulseJoint(RAPIER.JointData.spring(0,18000,1200,{x:side*1.8,y:joinY-prev.restY,z:s.length/2},{x:side*1.8,y:joinY-restY,z:-s.length/2}),prev.body,body,true));
   }
  }
  for(const [i,end] of [[0,-1],[s.count-1,1]]){
   const seg=this.segments[i],z=s.centerZ+end*s.span/2,y=s.height-s.halfHeight;
   this.joints.push(this.world.createImpulseJoint(RAPIER.JointData.spherical({x:s.centerX-o.x,y,z:z-o.z},{x:0,y:y-seg.restY,z:end*s.length/2}),this.anchor,seg.body,true));
  }
 }
 has(c){return c!=null&&this.handles.has(typeof c==='number'?c:c.handle)}
 segment(c){return this.byHandle.get(typeof c==='number'?c:c?.handle)}
 velocityAt(c,point){const b=this.segment(c)?.body;return b?b.velocityAtPoint(point):{x:0,y:0,z:0}}
 beforeStep(){this.chassisVelocity=this.physics.rb?.linvel()}
 afterStep(){}
 // Rapier updates the chassis alone. Return normal wheel load and the
 // controller's horizontal momentum change to its supporting timber. On mixed
 // terrain/deck contacts horizontal reaction is apportioned by wheel load.
 applyWheelLoads(dt){
  const v=this.physics.vehicle;if(!v)return;
  const wheels=[];let totalLoad=0,normalX=0,normalZ=0;
  for(let i=0;i<v.numWheels();i++)if(v.wheelIsInContact(i)){
   const point=v.wheelContactPoint(i),normal=v.wheelContactNormal(i)||{x:0,y:1,z:0},force=Math.max(0,v.wheelSuspensionForce(i)||0);
   wheels.push({segment:this.segment(v.wheelGroundObject(i)),point,normal,force});totalLoad+=force;normalX+=normal.x*force*dt;normalZ+=normal.z*force*dt;
  }
  const body=this.physics.rb,current=body.linvel(),before=this.chassisVelocity;
  const extraX=before?(current.x-before.x)*body.mass()-normalX:0,extraZ=before?(current.z-before.z)*body.mass()-normalZ:0;
  for(const {segment,point,normal,force} of wheels){if(!segment||!point)continue;const share=totalLoad?force/totalLoad:0;segment.body.applyImpulseAtPoint({x:-normal.x*force*dt-extraX*share,y:-normal.y*force*dt,z:-normal.z*force*dt-extraZ*share},point,true)}
  this.chassisVelocity=null;
 }

 poses(){const o=this.physics.origin||{x:0,z:0};return this.segments.map(s=>({index:s.index,position:{x:s.body.translation().x+o.x,y:s.body.translation().y,z:s.body.translation().z+o.z},rotation:s.body.rotation()}))}
 rebase(x,z){for(const b of this.bodies){const p=b.translation();b.setTranslation({x:p.x-x,y:p.y,z:p.z-z},true)}}
 dispose(){if(this.disposed)return;this.disposed=true;for(const b of this.bodies)this.world.removeRigidBody(b);this.handles.clear();this.byHandle.clear()}
}
