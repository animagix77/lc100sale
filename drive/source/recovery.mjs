import {Quaternion,Vector3,Matrix4} from 'three';
import {RAPIER} from './physics.mjs';
import {clamp} from './terrain.mjs';
// Boards are local, finite support surfaces. No teleport or global traction multiplier.
export class Recovery{
 constructor(physics){this.physics=physics;physics.recovery=this;this.boards=[];this.state='roof';this.age=0;this.recoveries=0;this.lastOrigin={...physics.origin}}
 deploy(){
  const p=this.physics,q=p.rb.rotation(),up=1-2*(q.x*q.x+q.z*q.z);
  if(this.state!=='roof')return 'already';
  if(Math.abs(p.speed)>.45||Math.hypot(p.rb.linvel().x,p.rb.linvel().z)>.6)return 'moving';
  if(up<.65||![0,1,2,3].every(i=>p.vehicle.wheelIsInContact(i)))return 'tilted';
  const f=p.forward(),length=Math.hypot(f.x,f.z),forward=new Vector3(f.x/length,0,f.z/length),right=new Vector3(-forward.z,0,forward.x);
  this.start=p.position();this.age=0;this.state='deploying';
  for(let i=0;i<4;i++){
   const c=p.vehicle.wheelContactPoint(i),x=c.x+p.origin.x,z=c.z+p.origin.z;
   const h=(s)=>p.sand?.height(x+forward.x*s,z+forward.z*s)??c.y;
   const slope=clamp((h(.8)-h(-.2)), -.45,.45),along=forward.clone().setY(slope).normalize(),normal=new Vector3().crossVectors(right,along).normalize();
   const rotation=new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(right,normal,along.clone().negate()));
   const position={x:x+forward.x*.32,y:c.y+.022+slope*.32,z:z+forward.z*.32};
   this.boards.push({position,rotation,collider:null});
  }
  return 'ok';
 }
 supports(x,z,y){return this.state==='ground'&&this.boards.some(b=>{const local=new Vector3(x-b.position.x,(y??b.position.y)-b.position.y,z-b.position.z).applyQuaternion(b.rotation.clone().invert());return Math.abs(local.x)<.19&&Math.abs(local.z)<.59&&Math.abs(local.y)<.18})}
 step(dt){
  if(this.state==='roof')return;
  this.age+=dt;const p=this.physics;
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
