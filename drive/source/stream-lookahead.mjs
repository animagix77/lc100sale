// Judge Dean LLC — prepare the direction of travel without moving physical ground.
export function streamLookahead(position,velocity,{seconds=2.4,maxDistance=48,minimumSpeed=.8}={}){
 const vx=Number.isFinite(velocity?.x)?velocity.x:0,vz=Number.isFinite(velocity?.z)?velocity.z:0,speed=Math.hypot(vx,vz);
 if(speed<minimumSpeed)return {x:position.x,z:position.z};
 const lead=Math.min(Math.max(0,seconds),Math.max(0,maxDistance)/speed);
 return {x:position.x+vx*lead,z:position.z+vz*lead};
}

// Missing tiles in the immediate neighbourhood always win. Once those are
// ready, favor the predicted corridor over equally distant ground behind us.
export function terrainStreamPriority(tx,tz,x,z,lookahead){
 const dx=(tx+.5)*32-x,dz=(tz+.5)*32-z,near=Math.hypot(dx,dz);
 if(near<=48)return near-128;
 if(!Number.isFinite(lookahead?.x)||!Number.isFinite(lookahead?.z))return near;
 return Math.min(near,Math.hypot((tx+.5)*32-lookahead.x,(tz+.5)*32-lookahead.z)+16);
}
