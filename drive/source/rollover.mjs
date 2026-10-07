// Detect the rigid body's up axis, independent of camera angle and suspension.
// A brief jump or bank must recover on its own before an automatic reset.
export class RolloverRecovery{
 constructor(){this.reset()}
 reset(){this.tippedFor=0;this.cooldown=.75;this.triggered=false}
 update(dt,rotation){
  if(!Number.isFinite(dt)||dt<=0||this.triggered)return false;
  const step=Math.min(dt,.06);
  if(this.cooldown>0){this.cooldown=Math.max(0,this.cooldown-step);return false}
  const upright=1-2*(rotation.x*rotation.x+rotation.z*rotation.z);
  if(!Number.isFinite(upright)||upright>=.2){this.tippedFor=0;return false}
  this.tippedFor+=step;
  if(this.tippedFor+1e-8<1.65)return false;
  this.triggered=true;return true;
 }
}
// A route's target is the next unvisited stop; respawn at the previous one.
export function checkpointPose(route,heightAt){
 const start=route.checkpoint(),target=route.target(),x=start.x,z=start.z;
 const yaw=Math.atan2(-(target.x-x),-(target.z-z)),cs=Math.cos(yaw),sn=Math.sin(yaw);
 let height=heightAt(x,z);
 // Clear the uphill corners as well as the centre before suspension settles.
 for(const side of [-1,1])for(const axle of [-1,1]){
  const ox=side*.962,oz=axle*1.43;
  height=Math.max(height,heightAt(x+ox*cs+oz*sn,z-ox*sn+oz*cs));
 }
 return {x,z,height,yaw,name:start.name};
}
