import {shore} from './terrain.mjs';
export const GATE_HALF_WIDTH=7;
// A relaxed, deterministic coastal route. No timer, failure state or finite map end.
export function waypoint(index){const z=-55-index*90,d=index===0?22:26+7*Math.sin(index*.85);return {index,x:shore(z)+d,z}}
export class WaypointRoute{
 constructor(){this.next=0;this.previous=null;this.passed=0}
 resetTracking(position=null){this.previous=position?{...position}:null}
 target(){return waypoint(this.next)}
 nearby(){return Array.from({length:this.next?4:3},(_,i)=>waypoint(Math.max(0,this.next-1)+i))}
 update(position,{grounded=true,groundHeight=0}={}){
  const a=this.previous,b=position,t=this.target();this.previous={...b};
  if(!a||!grounded||Math.hypot(b.x-a.x,b.z-a.z)>12)return false;
  const dz=b.z-a.z;if(Math.abs(dz)<1e-7)return false;
  const crossed=(t.z-a.z)/dz;if(crossed<=0||crossed>1)return false;
  const x=a.x+(b.x-a.x)*crossed,y=a.y+(b.y-a.y)*crossed;
  if(Math.abs(x-t.x)>GATE_HALF_WIDTH||y-groundHeight>3.5||y-groundHeight<-.5)return false;
  this.next++;this.passed++;return true;
 }
 guidance(position,heading){const t=this.target(),dx=t.x-position.x,dz=t.z-position.z,desired=Math.atan2(-dx,-dz);return {distance:Math.hypot(dx,dz),angle:Math.atan2(Math.sin(desired-heading),Math.cos(desired-heading))}}
}
