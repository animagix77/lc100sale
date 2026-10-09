const TAU=Math.PI*2;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const wrap=v=>Math.atan2(Math.sin(v),Math.cos(v));
export const CAMERA_KEYS=new Set(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown']);
export const TOUCH_CAMERA_HOLD=5;

// Judge Dean LLC — vehicle-relative orbit keeps keyboard views, while scenery
// drags return to the default chase view after a short hold.
export class CameraOrbit{
 constructor(){this.reset()}
 reset(){this.yaw=0;this.pitch=0;this.blend=0;this.active=false;this.dragging=false;this.returnAfter=null}
 recenter(){this.active=false;this.dragging=false;this.returnAfter=null}
 beginDrag(){this.dragging=true;this.active=true;this.returnAfter=TOUCH_CAMERA_HOLD}
 drag(yaw,pitch){
  if(!Number.isFinite(yaw)||!Number.isFinite(pitch))return;
  this.active=true;this.returnAfter=TOUCH_CAMERA_HOLD;
  this.yaw=wrap(this.yaw+yaw);this.pitch=clamp(this.pitch+pitch,-.22,1.15);
 }
 endDrag(){if(this.dragging){this.dragging=false;this.returnAfter=TOUCH_CAMERA_HOLD}}
 nudge(code){
  if(!CAMERA_KEYS.has(code))return;
  this.active=true;this.returnAfter=null;
  this.yaw=wrap(this.yaw+(code==='ArrowLeft'?-.09:code==='ArrowRight'?.09:0));
  this.pitch=clamp(this.pitch+(code==='ArrowUp'?.065:code==='ArrowDown'?-.065:0),-.22,1.15);
 }
 update(dt,keys,{enabled=true}={}){
  if(!enabled)return this;
  dt=clamp(Number.isFinite(dt)?dt:0,0,.1);
  const horizontal=Number(keys.has('ArrowRight'))-Number(keys.has('ArrowLeft'));
  const vertical=Number(keys.has('ArrowUp'))-Number(keys.has('ArrowDown'));
  if(horizontal||vertical){this.active=true;this.returnAfter=null;this.yaw=wrap(this.yaw+horizontal*dt*TAU/5);this.pitch=clamp(this.pitch+vertical*dt*.8,-.22,1.15)}
  if(this.returnAfter!==null&&!this.dragging){this.returnAfter=Math.max(0,this.returnAfter-dt);if(this.returnAfter<1e-8)this.recenter()}
  const response=1-Math.exp(-dt*6);
  if(!this.active){this.yaw=wrap(this.yaw)*(1-response);this.pitch*=1-response;if(Math.abs(this.yaw)+Math.abs(this.pitch)<.0001)this.yaw=this.pitch=0}
  this.blend+=((this.active?1:0)-this.blend)*response;
  if(!this.active&&this.blend<.0001)this.blend=0;
  return this;
 }
 // Keep a constant orbit radius; camera-ground clearance is applied by caller.
 offset(heading,distance,lateral,lift){
  const planar=Math.hypot(distance,lateral),radius=Math.hypot(planar,lift-1);
  const azimuth=heading+this.yaw+Math.atan2(lateral,distance);
  const elevation=clamp(Math.atan2(lift-1,planar)+this.pitch,.055,Math.PI*.43);
  const horizontal=radius*Math.cos(elevation);
  return {x:Math.sin(azimuth)*horizontal,y:1+Math.sin(elevation)*radius,z:Math.cos(azimuth)*horizontal};
 }
}
