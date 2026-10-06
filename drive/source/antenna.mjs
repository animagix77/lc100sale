import * as THREE from 'three/webgpu';
const clamp=x=>Math.max(0,Math.min(1,x));
export class PowerAntenna{
 constructor(truck,{reduced=false}={}){this.truck=truck;this.reduced=reduced;this.extension=0;this.powered=false;this.age=99;this.blend=0;this.shot=false;this.saved=false;this.stages=[1,2,3].map(i=>truck.getObjectByName('Antenna_'+i));if(this.stages.some(s=>!s))throw new Error('Truck is missing the telescoping antenna rig');this.base=truck.getObjectByName('RadioAntenna');this.eye=new THREE.Vector3();this.aim=new THREE.Vector3();this.chasePosition=new THREE.Vector3();this.chaseRotation=new THREE.Quaternion();}
 power(on,{speed=0,recovering=false}={}){if(on===this.powered)return;this.powered=on;this.age=0;this.shot=on&&!this.reduced&&Math.abs(speed)<.7&&!recovering;}
 update(dt,{driving=false,recovering=false}={}){
  this.age+=dt;if(driving||recovering)this.shot=false;
  const delay=this.powered&&this.shot&&this.age<.25;
  if(!delay)this.extension=clamp(this.extension+(this.powered?1:-1)*dt/1.5);
  this.stages[0].position.y=-.29+.29*this.extension;this.stages[1].position.y=.27*this.extension;this.stages[2].position.y=.27*this.extension;
  this.blend=this.holding?1:0;
 }
 get holding(){return this.shot&&this.age<3.15}
 // Save the ordinary chase pose, so the cinematic never pulls the chase spring through the body.
 restore(camera){if(!this.saved)return;camera.position.copy(this.chasePosition);camera.quaternion.copy(this.chaseRotation);this.saved=false}
 camera(camera,terrain,origin){if(!this.holding)return;this.chasePosition.copy(camera.position);this.chaseRotation.copy(camera.quaternion);this.saved=true;this.truck.updateMatrixWorld(true);
  const push=clamp(this.age/2)*.18;this.eye.set(4.1-push,2.8,-4.6+push);this.truck.localToWorld(this.eye);this.eye.y=Math.max(this.eye.y,terrain.height(this.eye.x+origin.x,this.eye.z+origin.z)+.7);
  this.aim.set(.48,1.65,-.70);this.truck.localToWorld(this.aim);camera.position.copy(this.eye);camera.lookAt(this.aim);
 }
}
