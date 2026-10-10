import {BRIDGE_SPEC} from './canyon-bridge.mjs';
import {Quaternion,Vector3,Matrix4} from 'three';
import {RAPIER,wheelLayout} from './physics.mjs';
import {clamp} from './terrain.mjs';
// Judge Dean LLC — boards are local, finite support surfaces. No teleport or global traction multiplier.
export class Recovery{
 constructor(physics){this.physics=physics;physics.recovery=this;this.boards=[];this.state='roof';this.age=0;this.recoveries=0;this.lastOrigin={...physics.origin};this.motion=[];this.motionTime=0;this.pending=false;this.pendingAge=0;this.result=''}
 request(){
  if(this.pending)return 'braking';
  const result=this.deploy();
  if(result==='moving'){this.pending=true;this.pendingAge=0;this.result='braking';return 'braking'}
  this.result=result;return result;
 }
 deploy(){
  const p=this.physics,q=p.rb.rotation(),up=1-2*(q.x*q.x+q.z*q.z);
  if(this.state!=='roof'&&this.state!=='ground')return 'already';
  const velocity=p.rb.linvel(),speed=Math.hypot(velocity.x,velocity.z),pos=p.position(),old=this.motion[0];
  const onBridge=wheelLayout.some((_,i)=>p.vehicle.wheelIsInContact(i)&&p.bridge?.has(p.vehicle.wheelGroundObject(i)));
  if(onBridge||(Math.abs(pos.x-BRIDGE_SPEC.centerX)<3.2&&Math.abs(pos.z-BRIDGE_SPEC.centerZ)<32&&pos.y>70))return 'bridge';
  const rocking=old&&this.motionTime-old.time>=.5&&Math.hypot(pos.x-old.x,pos.z-old.z)<.65;
  if(speed>2&&!(rocking&&speed<3.5))return 'moving';
  if(up<.25)return 'tilted';
  if(this.state==='ground')this.clear();
  const f=p.forward(),length=Math.hypot(f.x,f.z),forward=new Vector3(f.x/length,0,f.z/length),right=new Vector3(-forward.z,0,forward.x);
  this.start=p.position();this.age=0;this.state='deploying';this.pending=false;this.result='placing';
  p.rb.setLinvel({x:0,y:0,z:0},true);p.rb.setAngvel({x:0,y:0,z:0},true);p.speed=0;
  for(let i=0;i<4;i++){
   const w=wheelLayout[i],hub=new Vector3(w.x,.06,w.z).applyQuaternion(q).add(p.rb.translation());
   const contact=p.vehicle.wheelIsInContact(i)?p.vehicle.wheelContactPoint(i):null;
   const x=(contact?.x??hub.x)+p.origin.x,z=(contact?.z??hub.z)+p.origin.z;
   // Probe the physical terrain and obstacles even when suspension has lost contact.
   // Ignore the chassis, gravel-pushing tire shapes, loose debris and sensors.
   // Those are not stable ground; sampling a tire would suspend boards above it.
   const h=s=>{const wx=x+forward.x*s,wz=z+forward.z*s,top=Math.max(hub.y+.9,(contact?.y??hub.y)+.9),hit=p.world.castRay(new RAPIER.Ray({x:wx-p.origin.x,y:top,z:wz-p.origin.z},{x:0,y:-1,z:0}),20,true,RAPIER.QueryFilterFlags.EXCLUDE_DYNAMIC|RAPIER.QueryFilterFlags.EXCLUDE_SENSORS,undefined,undefined,p.rb,c=>!p.loosePebbles?.handles.has(c.handle));return hit?top-hit.timeOfImpact:p.sand?.height(wx,wz)??hub.y-1;};
   const rear=h(-.255),front=h(.895),slope=clamp((front-rear)/1.15,-1.2,1.2),along=forward.clone().setY(slope).normalize(),normal=new Vector3().crossVectors(right,along).normalize();
   const rotation=new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(right,normal,along.clone().negate()));
   const centerHeight=Math.max(rear+slope*.575,front-slope*.575,h(0)+slope*.32,h(.32));
   const position={x:x+forward.x*.32,y:centerHeight+.022,z:z+forward.z*.32};
   this.boards.push({position,rotation,collider:null});
  }
  return 'ok';
 }
 supports(x,z,y){return this.state==='ground'&&this.boards.some(b=>{const local=new Vector3(x-b.position.x,(y??b.position.y)-b.position.y,z-b.position.z).applyQuaternion(b.rotation.clone().invert());return Math.abs(local.x)<.19&&Math.abs(local.z)<.59&&Math.abs(local.y)<.18})}
 step(dt){
  this.motionTime+=dt;const position=this.physics.position();
  this.motion.push({x:position.x,z:position.z,time:this.motionTime});
  while(this.motion.length>1&&this.motion[1].time<this.motionTime-.75)this.motion.shift();
  if(this.pending){
   this.pendingAge+=dt;const result=this.deploy();
   if(result==='ok')this.pending=false;
   else if(result!=='moving'||this.pendingAge>=8){this.pending=false;this.result=result==='moving'?'unsettled':result;}
  }
  if(this.state==='roof')return;
  this.age+=dt;const p=this.physics;
  if(this.state==='deploying'){p.rb.setLinvel({x:0,y:0,z:0},true);p.rb.setAngvel({x:0,y:0,z:0},true);}
  // Keep static support colliders aligned when the endless world rebases.
  if(p.origin.x!==this.lastOrigin.x||p.origin.z!==this.lastOrigin.z){for(const b of this.boards)b.collider?.setTranslation({x:b.position.x-p.origin.x,y:b.position.y,z:b.position.z-p.origin.z});this.lastOrigin={...p.origin}}
  if(this.state==='deploying'&&this.age>=.85){
   for(const b of this.boards)b.collider=p.world.createCollider(RAPIER.ColliderDesc.cuboid(.165,.015,.575).setTranslation(b.position.x-p.origin.x,b.position.y,b.position.z-p.origin.z).setRotation(b.rotation).setFriction(1.4));
   this.state='ground';this.age=0;this.result='ready';
  }
  if(this.state==='ground'){const pos=p.position();if(Math.hypot(pos.x-this.start.x,pos.z-this.start.z)>5){this.recoveries++;this.stow()}}
  if(this.state==='stowing'&&this.age>.75){this.state='roof';this.boards=[];this.age=0;this.result='packed'}
 }
 stow(){for(const b of this.boards){if(b.collider)this.physics.world.removeCollider(b.collider,true);b.collider=null}this.state='stowing';this.age=0;this.result='packing'}
 clear(){for(const b of this.boards)if(b.collider)this.physics.world.removeCollider(b.collider,true);this.boards=[];this.state='roof';this.age=0;this.motion=[];this.pending=false;this.pendingAge=0;this.result=''}
}
