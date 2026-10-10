import {LANDMARKS,ROUTE_FORKS} from './expedition.mjs';
export const GATE_HALF_WIDTH=8;
export const WAYPOINT_COUNT=LANDMARKS.length-1;
export function waypoint(index){const leg=Math.min(index+1,WAYPOINT_COUNT),p=LANDMARKS[leg],before=LANDMARKS[leg-1],after=LANDMARKS[Math.min(leg+1,WAYPOINT_COUNT)],dx=after.x-before.x,dz=after.z-before.z,length=Math.hypot(dx,dz);return {...p,index,leg,dx:dx/length,dz:dz/length}}
export class WaypointRoute{
 constructor(){this.next=0;this.previous=null;this.passed=0;this.choices={};this.revision=0;}
 get count(){return WAYPOINT_COUNT}
 get complete(){return this.next>=this.count}
 get points(){return LANDMARKS.map((p,i)=>{for(const f of ROUTE_FORKS){const o=f.options.find(o=>o.id===this.choices[f.id]);if(o?.replacements[i])return {...o.replacements[i],index:i}}return p})}
 fork(){return ROUTE_FORKS.find(f=>this.next===f.at&&!this.choices[f.id])||null}
 choose(id,option){const f=ROUTE_FORKS.find(f=>f.id===id);if(!f||this.next>f.at||!f.options.some(o=>o.id===option))return false;this.choices[id]=option;this.revision++;this.resetTracking();return true}
 snapshot(){return {version:2,next:this.next,choices:{...this.choices}}}
 restore(data){
  if(![1,2].includes(data?.version)||!Number.isInteger(data.next)||data.next<0)return false;
  // Version 1 predates the three canyon gates. Preserve the reached landmark,
  // route choices and completed camp saves; never reinterpret an old index.
  if(data.next>(data.version===1?this.count-3:this.count))return false;
  const next=data.version===1&&data.next>=17?data.next+3:data.next;
  for(const f of ROUTE_FORKS){if(data.choices?.[f.id]&&!f.options.some(o=>o.id===data.choices[f.id]))return false;if(next>f.at&&!data.choices?.[f.id])return false}
  this.next=this.passed=next;this.choices={...data.choices};this.previous=null;this.revision++;return true;
 }
 resetTracking(position=null){this.previous=position?{...position}:null}
 checkpoint(){return this.points[Math.min(this.next,this.count)]}
 target(){const leg=Math.min(this.next+1,this.count),points=this.points,p=points[leg],a=points[leg-1],b=points[Math.min(leg+1,this.count)],dx=b.x-a.x,dz=b.z-a.z,l=Math.hypot(dx,dz)||1;return {...p,index:Math.min(this.next,this.count-1),leg,dx:dx/l,dz:dz/l}}
 nearby(){if(this.complete)return [];return this.points.slice(Math.max(1,this.next),Math.min(this.count+1,this.next+4)).map((p,i)=>{const leg=p.index,points=this.points,a=points[Math.max(0,leg-1)],b=points[Math.min(this.count,leg+1)],dx=b.x-a.x,dz=b.z-a.z,l=Math.hypot(dx,dz)||1;return {...p,index:leg-1,leg,dx:dx/l,dz:dz/l}})}
 update(position,{grounded=true,groundHeight=0}={}){
  if(this.complete)return false;
  const a=this.previous,b=position,t=this.target();this.previous={...b};if(!a||!grounded)return false;
  const dx=b.x-a.x,dz=b.z-a.z,dist2=dx*dx+dz*dz;if(dist2>144)return false;
  const u=dist2?Math.max(0,Math.min(1,((t.x-a.x)*dx+(t.z-a.z)*dz)/dist2)):0;
  const x=a.x+dx*u,z=a.z+dz*u,y=a.y+(b.y-a.y)*u;
  if(Math.hypot(x-t.x,z-t.z)>(t.gateRadius??GATE_HALF_WIDTH+1)||y-groundHeight>3.5||y-groundHeight<-.5)return false;
  const fork=this.fork();if(fork)this.choices[fork.id]=fork.options[0].id;
  this.next++;this.passed++;return true;
 }
 guidance(position,heading){const t=this.target(),dx=t.x-position.x,dz=t.z-position.z,desired=Math.atan2(-dx,-dz);return {distance:Math.hypot(dx,dz),angle:Math.atan2(Math.sin(desired-heading),Math.cos(desired-heading))}}
}
