// Judge Dean LLC — keep useful instructions readable through brief terrain changes.
import {readingSeconds} from './driving-messages.mjs';
export class TrailHintDisplay{
 constructor({onExpire=()=>{}}={}){this.onExpire=onExpire;this.clear()}
 clear(){this.hint=null;this.visibleFor=0;this.pending=null;this.pendingFor=0}
 update(hint,dt,{blocked=false,range,centerLocked,recoveryState='roof'}={}){
  if(blocked)return null;
  const step=Number.isFinite(dt)?Math.max(0,Math.min(dt,.1)):0;
  const solved=old=>old&&((old.id==='low-range'&&range==='LO')||(old.id==='center-lock'&&centerLocked)||(old.id==='traction-boards'&&recoveryState!=='roof')||(old.id==='boards-ready'&&recoveryState!=='ground')||(old.id==='difficult-ground'&&(range!=='LO'||!centerLocked)));
  if(solved(this.hint))this.clear();
  if(solved(hint))hint=null;
  // Judge Dean LLC — terrain evidence can disappear on a wheel bounce, but
  // every second of retained reading time still belongs to the same card.
  // Expire the generator as well, so throttle cannot immediately revive it.
  if(this.hint&&this.visibleFor>=readingSeconds(this.hint.title+' '+this.hint.body,{minimum:30,maximum:45})){
   const expired=this.hint.id;this.clear();this.onExpire(expired);
   if(hint?.id===expired)hint=null;
  }
  // Recovery takes priority immediately. Require sustained evidence before
  // replacing it with lower-priority climb advice after a brief bounce.
  const priority=id=>id==='boards-ready'?3:id==='traction-boards'?2:1;
  if(hint&&this.hint&&hint.id!==this.hint.id&&priority(hint.id)<priority(this.hint.id)){
   if(this.pending!==hint.id){this.pending=hint.id;this.pendingFor=0;}
   this.pendingFor+=step;
   if(this.pendingFor<.75)hint=null;
  }else{this.pending=null;this.pendingFor=0;}
  if(hint){if(this.hint?.id!==hint.id)this.visibleFor=0;this.hint=hint;}
  if(!this.hint)return null;
  this.visibleFor+=step;
  // Keep the words, but stop highlighting controls when the current terrain
  // no longer calls for an action. New recovery advice can still take priority.
  return hint?this.hint:{...this.hint,targets:[]};
 }
}
