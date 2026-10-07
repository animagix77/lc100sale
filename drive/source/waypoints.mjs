import {LANDMARKS} from './expedition.mjs';
export const GATE_HALF_WIDTH=8;
export const WAYPOINT_COUNT=LANDMARKS.length-1;
export function waypoint(index){const leg=index%WAYPOINT_COUNT+1,p=LANDMARKS[leg],before=LANDMARKS[leg-1],after=LANDMARKS[leg===WAYPOINT_COUNT?1:leg+1],dx=after.x-before.x,dz=after.z-before.z,length=Math.hypot(dx,dz);return {...p,index,leg,dx:dx/length,dz:dz/length}}
export class WaypointRoute{
 constructor(){this.next=0;this.previous=null;this.passed=0}
 resetTracking(position=null){this.previous=position?{...position}:null}
 target(){return waypoint(this.next)}
 nearby(){return Array.from({length:this.next?4:3},(_,i)=>waypoint(Math.max(0,this.next-1)+i))}
 update(position,{grounded=true,groundHeight=0}={}){
  const a=this.previous,b=position,t=this.target();this.previous={...b};if(!a||!grounded)return false;
  const dx=b.x-a.x,dz=b.z-a.z,dist2=dx*dx+dz*dz;if(dist2>144)return false;
  const u=dist2?Math.max(0,Math.min(1,((t.x-a.x)*dx+(t.z-a.z)*dz)/dist2)):0;
  const x=a.x+dx*u,z=a.z+dz*u,y=a.y+(b.y-a.y)*u;
  if(Math.hypot(x-t.x,z-t.z)>GATE_HALF_WIDTH+1||y-groundHeight>3.5||y-groundHeight<-.5)return false;
  this.next++;this.passed++;return true;
 }
 guidance(position,heading){const t=this.target(),dx=t.x-position.x,dz=t.z-position.z,desired=Math.atan2(-dx,-dz);return {distance:Math.hypot(dx,dz),angle:Math.atan2(Math.sin(desired-heading),Math.cos(desired-heading))}}
}
