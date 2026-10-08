// Detect attempted driving without progress, including chassis-supported rocks.
// Use world position, not wheel speed: spinning tyres do not mean the truck moved.
export class StuckRecovery {
 constructor(){this.reset()}
 reset(){this.anchor=null;this.effort=0;this.visible=false;this.grace=2;this.movingFor=0;this.snooze=0}
 dismiss(){this.visible=false;this.effort=0;this.anchor=null;this.snooze=12}
 update(dt,{position,velocity,input={},blocked=false}){
  if(!Number.isFinite(dt)||dt<=0)return this.visible;
  const step=Math.min(dt,.06);
  if(this.grace>0){this.grace=Math.max(0,this.grace-step);return false}
  this.snooze=Math.max(0,this.snooze-step);
  if(!this.anchor)this.anchor={x:position.x,z:position.z};
  const distance=Math.hypot(position.x-this.anchor.x,position.z-this.anchor.z);
  const speed=Math.hypot(velocity.x,velocity.z);
  if(this.visible){
   this.movingFor=speed>1.2?this.movingFor+step:0;
   if(distance>3||this.movingFor>1){this.reset();return false}
   return true;
  }
  if(distance>1){this.anchor={x:position.x,z:position.z};this.effort=0}
  const trying=Number(input.gas)>.12||Number(input.reverse)>.12||input.cruise;
  const stalled=trying&&!input.brake&&!input.handbrake&&!blocked&&speed<.65&&Math.abs(velocity.y)<.6;
  this.effort=stalled?this.effort+step:Math.max(0,this.effort-step*.7);
  if(this.effort>=4.5&&this.snooze===0){this.visible=true;this.movingFor=0;this.anchor={x:position.x,z:position.z}}
  return this.visible;
 }
}
