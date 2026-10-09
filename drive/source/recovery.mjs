import {Quaternion,Vector3,Matrix4} from 'three';
import {RAPIER,wheelLayout} from './physics.mjs';
import {clamp} from './terrain.mjs';
// Judge Dean LLC — boards are local, finite support surfaces. No teleport or global traction multiplier.
export class Recovery{
 constructor(physics){this.physics=physics;physics.recovery=this;this.boards=[];this.state='roof';this.age=0;this.recoveries=0;this.lastOrigin={...physics.origin}}
 deploy(){
  const p=this.physics,q=p.rb.rotation(),up=1-2*(q.x*q.x+q.z*q.z);
  if(this.state!=='roof'&&this.state!=='ground')return 'already';
  if(Math.hypot(p.rb.linvel().x,p.rb.linvel().z)>2)return 'moving';
  if(up<.25)return 'tilted';
  if(this.state==='ground')this.clear();
  const f=p.forward(),length=Math.hypot(f.x,f.z),forward=new Vector3(f.x/length,0,f.z/length),right=new Vector3(-forward.z,0,forward.x);
  this.start=p.position();this.age=0;this.state='deploying';
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
  if(this.state==='roof')return;
  this.age+=dt;const p=this.physics;
  if(this.state==='deploying'){p.rb.setLinvel({x:0,y:0,z:0},true);p.rb.setAngvel({x:0,y:0,z:0},true);}
  // Keep static support colliders aligned when the endless world rebases.
  if(p.origin.x!==this.lastOrigin.x||p.origin.z!==this.lastOrigin.z){for(const b of this.boards)b.collider?.setTranslation({x:b.position.x-p.origin.x,y:b.position.y,z:b.position.z-p.origin.z});this.lastOrigin={...p.origin}}
  if(this.state==='deploying'&&this.age>=.85){
   for(const b of this.boards)b.collider=p.world.createCollider(RAPIER.ColliderDesc.cuboid(.165,.015,.575).setTranslation(b.position.x-p.origin.x,b.position.y,b.position.z-p.origin.z).setRotation(b.rotation).setFriction(1.4));
   this.state='ground';this.age=0;
  }
  if(this.state==='ground'){const pos=p.position();if(Math.hypot(pos.x-this.start.x,pos.z-this.start.z)>5){this.recoveries++;this.stow()}}
  if(this.state==='stowing'&&this.age>.75){this.state='roof';this.boards=[];this.age=0}
 }
 stow(){for(const b of this.boards){if(b.collider)this.physics.world.removeCollider(b.collider,true);b.collider=null}this.state='stowing';this.age=0}
 clear(){for(const b of this.boards)if(b.collider)this.physics.world.removeCollider(b.collider,true);this.boards=[];this.state='roof';this.age=0}
}
