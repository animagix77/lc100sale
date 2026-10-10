// Judge Dean LLC — campsite rules stay independent of rendering and input.
import {CAMP} from './expedition.mjs';
export const FIRE_SITE={x:CAMP.x-10,z:CAMP.z};
export function campPlacement(point,{heightAt,waterAt,vehicle,obstructed=()=>false}={}){
 if(!point||![point.x,point.z,point.yaw??0].every(Number.isFinite))return {ok:false,reason:'Select a spot on the ground.'};
 if(Math.hypot(point.x-CAMP.x,point.z-CAMP.z)>CAMP.radius-3)return {ok:false,reason:'Keep the tent inside the campsite clearing.'};
 if(Math.hypot(point.x-CAMP.x,point.z-CAMP.z)<5)return {ok:false,reason:'Keep the arrival and recovery space clear.'};
 if(Math.hypot(point.x-FIRE_SITE.x,point.z-FIRE_SITE.z)<6)return {ok:false,reason:'Leave six metres around the fire ring.'};
 if(vehicle&&Math.hypot(point.x-vehicle.x,point.z-vehicle.z)<5)return {ok:false,reason:'Move the tent clear of the truck.'};
 const heights=[];
 for(const dx of [-2.3,0,2.3])for(const dz of [-2.3,0,2.3]){const x=point.x+dx,z=point.z+dz,h=heightAt(x,z);if(!Number.isFinite(h)||waterAt(x,z)>h-.05)return {ok:false,reason:'Choose dry ground.'};heights.push(h)}
 if(Math.max(...heights)-Math.min(...heights)>.4)return {ok:false,reason:'Choose a flatter spot.'};
 const y=Math.max(...heights)+.025;
 if(obstructed(point.x,y,point.z))return {ok:false,reason:'That spot is blocked by a rock or tree.'};
 return {ok:true,reason:'Clear, level ground. Ready to pitch.',pose:{x:point.x,z:point.z,y,yaw:point.yaw||0}};
}
export class CampState{
 constructor(){this.tent=null;this.fire=false;this.candidate=null;this.placing=false;this.result={ok:false,reason:''};}
 begin(point){this.placing=true;this.candidate={...point};}
 cancel(){this.placing=false;this.candidate=null;}
 confirm(){if(!this.placing||!this.result.ok)return false;this.tent={...this.result.pose};this.cancel();return true;}
 snapshot(){return {tent:this.tent,fire:this.fire}}
 restore(data){if(data?.tent&&['x','y','z','yaw'].every(k=>Number.isFinite(data.tent[k]))&&Math.hypot(data.tent.x-CAMP.x,data.tent.z-CAMP.z)<CAMP.radius-3)this.tent={...data.tent};this.fire=!!data?.fire&&!!this.tent;}
}
