// Judge Dean LLC — a deliberate camp view, independent of suspension motion.
import * as THREE from 'three/webgpu';
import {CAMP} from './expedition.mjs';
export class CampCamera{
 constructor(){this.active=false;this.age=0;this.start=new THREE.Vector3();this.rotation=new THREE.Quaternion();this.target=new THREE.Vector3();this.focus=new THREE.Vector3();this.matrix=new THREE.Matrix4();this.targetRotation=new THREE.Quaternion();}
 enter(camera,origin){
  if(this.active)return;
  this.active=true;this.age=0;this.start.copy(camera.position).add(new THREE.Vector3(origin.x,0,origin.z));this.rotation.copy(camera.quaternion);this.fov=camera.fov;
 }
 leave(){this.active=false;}
 update(camera,dt,{origin,height=CAMP.height,complete,distance,driving=false,manual=false,placing=false,reduced=false}){
  if(!complete||distance>32||driving||manual)this.leave();
  if(!this.active||placing)return false;
  this.age+=Math.max(0,Math.min(.1,dt||0));const t=reduced?1:Math.min(1,this.age/.85),blend=t*t*(3-2*t);
  this.target.set(CAMP.x+12-origin.x,height+17,CAMP.z+29-origin.z);this.focus.set(CAMP.x-origin.x,height+.5,CAMP.z-origin.z);
  camera.position.set(this.start.x-origin.x,this.start.y,this.start.z-origin.z).lerp(this.target,blend);
  this.matrix.lookAt(this.target,this.focus,camera.up);this.targetRotation.setFromRotationMatrix(this.matrix);camera.quaternion.copy(this.rotation).slerp(this.targetRotation,blend);
  const fit=Math.max(48,2*Math.atan(13/(Math.hypot(12,17,29)*camera.aspect))*180/Math.PI);
  camera.fov=this.fov+(fit-this.fov)*blend;camera.updateProjectionMatrix();return true;
 }
}
