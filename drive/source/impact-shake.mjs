import {Euler,Quaternion,Vector3} from 'three/webgpu';

// Judge Dean LLC — short camera feedback for nearby volcanic rock landings.
// Restore the previous pose before camera follow/rebasing, then update and apply
// once the base camera is ready. Physics, field of view and controls stay intact.
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const smooth=(a,b,v)=>{const t=clamp((v-a)/(b-a),0,1);return t*t*(3-2*t)};
const DECAY=8,MAX_AGE=1.1,MAX_IMPULSES=8,MAX_POSITION=.10,MAX_ROTATION=.012,TAU=Math.PI*2;

function impactStrength(event){
 if(event?.kind!=='rock'||event.source!=='volcano'||event.ground!==true)return 0;
 const {radius,distance,velocity}=event;
 if(!Number.isFinite(radius)||radius<.5||!Number.isFinite(distance)||distance<0||distance>=38||!Number.isFinite(velocity)||velocity<=2)return 0;
 return (.16+.84*smooth(.5,.75,radius))*smooth(2,24,velocity)*(1-smooth(5,38,distance));
}

export class ImpactShake{
 constructor({reduced=false}={}){
  this.reduced=reduced;this.strength=0;this.impulses=[];this.camera=null;
  this.position=new Vector3();this.rotation=new Vector3();this.basePosition=new Vector3();this.baseQuaternion=new Quaternion();
  this.localPosition=new Vector3();this.kickEuler=new Euler(0,0,0,'XYZ');this.kickQuaternion=new Quaternion();
 }
 update(dt,events=[]){
  if(this.reduced){this.reset();return this}
  const elapsed=Number.isFinite(dt)?Math.max(0,dt):0;
  for(let i=this.impulses.length-1;i>=0;i--){const impulse=this.impulses[i];impulse.age+=elapsed;if(impulse.age>=MAX_AGE)this.impulses.splice(i,1)}
  for(const event of events){
   const strength=impactStrength(event);if(strength<=0)continue;
   this.impulses.push({strength,age:0,pan:clamp(Number.isFinite(event.pan)?event.pan:0,-1,1)});
   // A burst stays bounded in cost as well as in camera displacement. Retain its
   // strongest arrivals so tiny late contacts cannot displace a large landing.
   if(this.impulses.length>MAX_IMPULSES){let weakest=0;for(let i=1;i<this.impulses.length;i++)if(this.envelope(this.impulses[i])<this.envelope(this.impulses[weakest]))weakest=i;this.impulses.splice(weakest,1)}
  }
  this.position.set(0,0,0);this.rotation.set(0,0,0);let total=0;
  for(const impulse of this.impulses){
   const envelope=this.envelope(impulse),t=impulse.age*TAU,pan=impulse.pan;total+=envelope;
   this.position.x+=envelope*(pan*.35*Math.cos(t*9)+.25*Math.sin(t*11));
   this.position.y-=envelope*.72*Math.cos(t*10);
   this.position.z+=envelope*.20*Math.sin(t*7);
   this.rotation.x+=envelope*.65*Math.cos(t*9);
   this.rotation.y+=envelope*pan*.18*Math.cos(t*7);
   this.rotation.z+=envelope*(pan*.40*Math.cos(t*11)+.16*Math.sin(t*8));
  }
  this.strength=Math.min(1,total);
  const scale=1/Math.max(1,total);
  this.position.multiplyScalar(scale*MAX_POSITION).clampLength(0,MAX_POSITION);
  this.rotation.multiplyScalar(scale*MAX_ROTATION).clampLength(0,MAX_ROTATION);
  return this;
 }
 envelope(impulse){return impulse.strength*Math.exp(-DECAY*impulse.age)}
 apply(camera){
  // Repeated apply calls cannot accumulate offsets, even without an intervening
  // frame. The saved base pose makes restoration exact instead of subtractive.
  this.restore();
  if(this.reduced||this.strength<=0||!camera)return this;
  this.camera=camera;this.basePosition.copy(camera.position);this.baseQuaternion.copy(camera.quaternion);
  this.localPosition.copy(this.position).applyQuaternion(this.baseQuaternion);camera.position.add(this.localPosition);
  this.kickEuler.set(this.rotation.x,this.rotation.y,this.rotation.z,'XYZ');this.kickQuaternion.setFromEuler(this.kickEuler);camera.quaternion.multiply(this.kickQuaternion);
  return this;
 }
 restore(camera=this.camera){
  // The owning camera is the one changed by apply; accepting the caller's
  // camera keeps reset/follow call sites explicit without risking another pose.
  if(this.camera){this.camera.position.copy(this.basePosition);this.camera.quaternion.copy(this.baseQuaternion);this.camera=null}
  return this;
 }
 reset(camera=this.camera){this.restore(camera);this.impulses.length=0;this.strength=0;this.position.set(0,0,0);this.rotation.set(0,0,0);return this}
}
