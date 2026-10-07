import {wheelLayout} from './physics.mjs';
// Reuse four records. Grounded tyres use the actual rock/terrain contact;
// ungrounded tyres can still displace water while the body bobs through it.
export function createWheelWaterState(){return {contact:0,depth:0,marks:Array.from({length:4},(_,wheel)=>({wheel,active:false,x:0,y:0,z:0,slip:0,soft:0,dir:1}))}}
export function sampleWheelWater(physics,height,time,state){
 let count=0,total=0,body,rotation;
 for(let i=0;i<4;i++){
  const mark=state.marks[i],tyre=physics.tyres[i],c=tyre?.contact&&physics.vehicle.wheelIsInContact(i)?physics.vehicle.wheelContactPoint(i):null;
  mark.active=false;let x,y,z;
  if(c){x=c.x+physics.origin.x;y=c.y;z=c.z+physics.origin.z;}
  else{
   body??=physics.rb?.translation();rotation??=physics.rb?.rotation();
   if(!body||!rotation)continue;
   const wheel=wheelLayout[i],suspension=physics.vehicle.wheelSuspensionLength?.(i),length=Number.isFinite(suspension)?Math.max(0,suspension):.5;
   const lx=wheel.x,ly=.06-length,lz=wheel.z,q=rotation;
   // Rotate the hub, then measure the tyre's lower extent in world space.
   // Rotating a local 'bottom' point would miss water when the truck is inverted.
   const tx=2*(q.y*lz-q.z*ly),ty=2*(q.z*lx-q.x*lz),tz=2*(q.x*ly-q.y*lx);
   x=body.x+lx+q.w*tx+q.y*tz-q.z*ty+physics.origin.x;
   y=body.y+ly+q.w*ty+q.z*tx-q.x*tz-.45;
   z=body.z+lz+q.w*tz+q.x*ty-q.y*tx+physics.origin.z;
  }
  const water=height(x,z,time),depth=water-y;
  if(!Number.isFinite(water)||!Number.isFinite(depth)||water<=y+.025)continue;
  Object.assign(mark,{active:true,x,y,z,slip:Math.max(0,tyre.slip||0),soft:tyre.soft||0,dir:Math.sign(tyre.omega)||Math.sign(physics.speed)||1});
  count++;total+=Math.min(1.5,depth);
 }
 state.contact=count/4;state.depth=count?total/count:0;return state;
}
