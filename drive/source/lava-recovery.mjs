// Judge Dean LLC — actual molten-surface contact, then a short checkpoint recovery.
import {Raycaster,Vector3} from 'three/webgpu';
import {wheelLayout} from './physics.mjs';
import {VOLCANO} from './expedition.mjs';
export class LavaRecovery{
 constructor(){this.ray=new Raycaster();this.point=new Vector3();this.rescues=0;this.reset()}
 reset(){this.burning=false;this.age=0;this.triggered=false}
 touching(physics,surfaces){
  const world=physics.position();if(Math.hypot(world.x-VOLCANO.x,world.z-VOLCANO.z)>360)return false;
  const position=physics.rb.translation(),rotation=physics.rb.rotation();
  for(const mesh of surfaces)mesh.updateWorldMatrix(true,false);
  const samples=wheelLayout.map((w,i)=>({x:w.x,y:.06-(physics.vehicle.wheelSuspensionLength(i)??.5)-.45,z:w.z}));
  samples.push({x:0,y:-.15,z:0});
  for(const sample of samples){
   this.point.set(sample.x,sample.y,sample.z).applyQuaternion(rotation).add(position);
   this.ray.set(new Vector3(this.point.x,this.point.y+30,this.point.z),new Vector3(0,-1,0));this.ray.far=60;
   const hit=this.ray.intersectObjects(surfaces,false)[0];
   if(hit&&this.point.y<=hit.point.y+.08)return true;
  }
  return false;
 }
 update(dt,contact){
  if(!Number.isFinite(dt)||dt<=0||this.triggered)return null;
  if(!this.burning){if(!contact)return null;this.burning=true;this.age=0;return 'ignite'}
  this.age+=Math.min(dt,.1);
  if(this.age>=3){this.triggered=true;this.rescues++;return 'respawn'}
  return null;
 }
}
