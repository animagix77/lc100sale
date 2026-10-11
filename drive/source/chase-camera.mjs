// Judge Dean LLC — driving composition is independent of recovery-board animation.
import {Vector3} from 'three/webgpu';
import {smooth} from './terrain.mjs';

export class ChaseCamera{
 constructor(){this.target=new Vector3();this.reset()}
 reset(yaw=0){this.yaw=yaw;this.aimHeight=null}
 update(camera,dt,{world,local,forward,heading,origin,field,orbit,narrow=false,preview=false,mobile=false,reduced=false}){
  const delta=Math.atan2(Math.sin(heading-this.yaw),Math.cos(heading-this.yaw));
  this.yaw+=delta*(1-Math.exp(-dt*2));
  const canyon=(1-smooth(18,70,Math.abs(world.x-665)))*(1-smooth(45,95,Math.abs(world.z+470)));
  const vista=preview||mobile?0:smooth(40,100,world.y),fov=48+vista*16;
  if(Math.abs(camera.fov-fov)>.03){camera.fov+=(fov-camera.fov)*(1-Math.exp(-dt*2));camera.updateProjectionMatrix()}
  const distance=(preview?9.5:narrow?13.5:10.5)+vista*5.5;
  const lateral=(preview?2:narrow?.5:3.7)*(1-vista*.6);
  const offset=orbit.offset(this.yaw,distance,lateral,(preview?2.8:narrow?4.1:3.3)-vista*.8+canyon*3.5);
  this.target.set(local.x+offset.x,local.y+offset.y,local.z+offset.z);
  this.target.y=Math.max(this.target.y,field.height(this.target.x+origin.x,this.target.z+origin.z)+2);
  camera.position.lerp(this.target,1-Math.exp(-dt*(reduced?12:4)));
  camera.position.y=Math.max(camera.position.y,field.height(camera.position.x+origin.x,camera.position.z+origin.z)+1.2);
  const aim=preview?1:3+vista*21;
  this.aimHeight??=local.y+1;
  this.aimHeight+=(local.y+1+vista*10*(1-canyon*.9)-this.aimHeight)*(1-Math.exp(-dt*(reduced?12:2.4)));
  camera.lookAt(local.x+forward.x*aim*(1-orbit.blend),this.aimHeight*(1-orbit.blend)+(local.y+1)*orbit.blend,local.z+forward.z*aim*(1-orbit.blend));
 }
}
